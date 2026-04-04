import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Calendar } from 'lucide-react';

type Lang = 'ar' | 'fr' | 'en';

interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: 'High' | 'Medium' | 'Low' | 'Holiday';
  forecast: string;
  previous: string;
  actual?: string;
}

const CALENDAR_URL      = 'https://vikqwycjqqoobteslbxp.supabase.co/functions/v1/forex-calendar';
const CALENDAR_NEXT_URL = 'https://vikqwycjqqoobteslbxp.supabase.co/functions/v1/forex-calendar-next';
const TZ = 'Africa/Algiers';
const LS_KEY = 'tradesmartdz_calendar_filters';
const ALL_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
const IMPACTS = ['High', 'Medium', 'Low'] as const;

const CURRENCY_FLAG: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  CHF: '🇨🇭', CAD: '🇨🇦', AUD: '🇦🇺', NZD: '🇳🇿',
};

// ---- i18n ----
const UI = {
  title:    { ar: 'التقويم الاقتصادي', fr: 'Calendrier économique', en: 'Economic Calendar' },
  all:      { ar: 'الكل',    fr: 'Tout',   en: 'All'    },
  high:     { ar: 'عالي',   fr: 'Élevé',  en: 'High'   },
  medium:   { ar: 'متوسط',  fr: 'Moyen',  en: 'Medium' },
  low:      { ar: 'منخفض',  fr: 'Faible', en: 'Low'    },
  holiday:  { ar: 'عطلة',   fr: 'Férié',  en: 'Holiday'},
  time:     { ar: 'الوقت',  fr: 'Heure',  en: 'Time'   },
  currency: { ar: 'العملة', fr: 'Devise', en: 'Currency'},
  event:    { ar: 'الحدث',  fr: 'Événement', en: 'Event' },
  previous: { ar: 'السابق', fr: 'Précédent', en: 'Previous' },
  forecast: { ar: 'المتوقع', fr: 'Prévu',  en: 'Forecast' },
  actual:   { ar: 'الفعلي', fr: 'Actuel', en: 'Actual'  },
  today:    { ar: 'اليوم',  fr: "Aujourd'hui", en: 'Today' },
  noEvents: { ar: 'لا توجد أحداث لهذا الأسبوع', fr: 'Aucun événement cette semaine', en: 'No events this week' },
  error:    { ar: 'تعذّر تحميل التقويم', fr: 'Impossible de charger le calendrier', en: 'Failed to load calendar' },
  retry:    { ar: 'إعادة المحاولة', fr: 'Réessayer', en: 'Retry' },
  currencies: { ar: 'العملات', fr: 'Devises', en: 'Currencies' },
} as const;

function t(key: keyof typeof UI, lang: Lang): string {
  return UI[key][lang];
}

// Returns "YYYY-MM-DD" in Algiers timezone
function dayKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: TZ });
}

// Returns "HH:MM" in Algiers timezone
function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// Day header label
function dayLabel(isoDay: string, lang: Lang): string {
  const date = new Date(isoDay + 'T12:00:00');
  const localeMap: Record<Lang, string> = { ar: 'ar-DZ', fr: 'fr-FR', en: 'en-GB' };
  const dayName = date.toLocaleDateString(localeMap[lang], { weekday: 'long' });
  const dayNum  = date.toLocaleDateString(localeMap[lang], { day: 'numeric' });
  const month   = date.toLocaleDateString(localeMap[lang], { month: lang === 'ar' ? 'long' : 'long' });
  if (lang === 'ar') return `${dayName} ${dayNum} ${month}`;
  if (lang === 'fr') return `${dayName} ${dayNum} ${month}`;
  return `${dayName} ${month} ${dayNum}`;
}

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

// ---- Impact badge ----
function ImpactBadge({ impact, lang }: { impact: string; lang: Lang }) {
  const cls =
    impact === 'High'    ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
    impact === 'Medium'  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
    impact === 'Low'     ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                           'bg-secondary text-muted-foreground border border-border';
  const label =
    impact === 'High'   ? t('high', lang) :
    impact === 'Medium' ? t('medium', lang) :
    impact === 'Low'    ? t('low', lang) :
                          t('holiday', lang);
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ---- Loading skeleton ----
function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2].map(g => (
        <div key={g}>
          <div className="mb-2 h-5 w-32 rounded bg-secondary" />
          <div className="space-y-2">
            {[1, 2, 3].map(r => (
              <div key={r} className="flex gap-3">
                <div className="h-4 w-12 rounded bg-secondary" />
                <div className="h-4 w-10 rounded bg-secondary" />
                <div className="h-4 w-48 rounded bg-secondary" />
                <div className="h-4 w-14 rounded bg-secondary" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Persisted filter state ----
interface Filters {
  impacts: string[];
  currencies: string[];
}

function loadFilters(): Filters {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { impacts: ['High', 'Medium'], currencies: [...ALL_CURRENCIES] };
}

function saveFilters(f: Filters) {
  localStorage.setItem(LS_KEY, JSON.stringify(f));
}

// ---- Main component ----
interface ForexCalendarProps { lang: Lang }

export function ForexCalendar({ lang }: ForexCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(loadFilters);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [thisRes, nextRes] = await Promise.all([
        fetch(CALENDAR_URL),
        fetch(CALENDAR_NEXT_URL),
      ]);
      if (!thisRes.ok) throw new Error(`HTTP ${thisRes.status}`);
      const [thisData, nextData] = await Promise.all([
        thisRes.json(),
        nextRes.ok ? nextRes.json() : Promise.resolve([]),
      ]);
      const combined = [
        ...(Array.isArray(thisData) ? thisData : []),
        ...(Array.isArray(nextData) ? nextData : []),
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(combined);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const setImpacts = (impacts: string[]) => {
    const next = { ...filters, impacts };
    setFilters(next);
    saveFilters(next);
  };

  const toggleCurrency = (cur: string) => {
    const next = filters.currencies.includes(cur)
      ? { ...filters, currencies: filters.currencies.filter(c => c !== cur) }
      : { ...filters, currencies: [...filters.currencies, cur] };
    setFilters(next);
    saveFilters(next);
  };

  // Filter + group by day
  const filtered = events.filter(ev => {
    const impactMatch = filters.impacts.length === 0 || filters.impacts.includes(ev.impact);
    const currencyMatch = filters.currencies.includes(ev.country);
    return impactMatch && currencyMatch;
  });

  const grouped = filtered.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const k = dayKey(ev.date);
    if (!acc[k]) acc[k] = [];
    acc[k].push(ev);
    return acc;
  }, {});

  const sortedDays = Object.keys(grouped).sort();
  const today = todayKey();

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('title', lang)}</CardTitle>
          </div>
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('retry', lang)}
          </button>
        </div>

        {/* Impact filter buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => setImpacts([])}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
              filters.impacts.length === 0
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {t('all', lang)}
          </button>
          {IMPACTS.map(imp => {
            const active = filters.impacts.includes(imp) && filters.impacts.length < 3;
            const singleActive = filters.impacts.length === 1 && filters.impacts[0] === imp;
            const isSelected = filters.impacts.includes(imp) && filters.impacts.length !== 0;
            const colorCls =
              imp === 'High'   ? 'border-red-500/50 text-red-400 bg-red-500/10' :
              imp === 'Medium' ? 'border-orange-500/50 text-orange-400 bg-orange-500/10' :
                                 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10';
            const inactiveCls = 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground';
            return (
              <button
                key={imp}
                onClick={() => {
                  if (filters.impacts.length === 0) {
                    // "All" was selected — switch to just this impact
                    setImpacts([imp]);
                  } else if (singleActive) {
                    // Deselecting the only active one → show all
                    setImpacts([]);
                  } else if (isSelected) {
                    setImpacts(filters.impacts.filter(i => i !== imp));
                  } else {
                    setImpacts([...filters.impacts, imp]);
                  }
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                  isSelected ? colorCls : inactiveCls
                }`}
              >
                {t(imp.toLowerCase() as keyof typeof UI, lang)}
              </button>
            );
          })}
        </div>

        {/* Currency checkboxes */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <span className="text-xs text-muted-foreground">{t('currencies', lang)}:</span>
          {ALL_CURRENCIES.map(cur => (
            <label key={cur} className="flex cursor-pointer items-center gap-1 text-xs">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={filters.currencies.includes(cur)}
                onChange={() => toggleCurrency(cur)}
              />
              <span className={filters.currencies.includes(cur) ? 'text-foreground' : 'text-muted-foreground'}>
                {CURRENCY_FLAG[cur]} {cur}
              </span>
            </label>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t('error', lang)}: {error}</p>
            <Button variant="outline" size="sm" onClick={fetchEvents} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              {t('retry', lang)}
            </Button>
          </div>
        ) : sortedDays.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('noEvents', lang)}</p>
        ) : (
          <div className="space-y-5">
            {sortedDays.map(day => {
              const isToday = day === today;
              return (
                <div key={day}>
                  {/* Day header */}
                  <div className={`mb-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                    isToday
                      ? 'bg-primary/15 text-primary'
                      : 'bg-secondary/60 text-muted-foreground'
                  }`}>
                    {isToday ? t('today', lang) : dayLabel(day, lang)}
                  </div>

                  {/* Events table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="pb-1.5 pe-3 text-start font-medium">{t('time', lang)}</th>
                          <th className="pb-1.5 pe-3 text-start font-medium">{t('currency', lang)}</th>
                          <th className="pb-1.5 pe-3 text-start font-medium w-full">{t('event', lang)}</th>
                          <th className="pb-1.5 pe-3 text-end font-medium">{t('previous', lang)}</th>
                          <th className="pb-1.5 pe-3 text-end font-medium">{t('forecast', lang)}</th>
                          <th className="pb-1.5 text-end font-medium">{t('actual', lang)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grouped[day].map((ev, i) => (
                          <tr
                            key={i}
                            className={`border-b border-border/50 transition-colors last:border-0 ${
                              isToday ? 'hover:bg-primary/5' : 'hover:bg-secondary/40'
                            }`}
                          >
                            <td className="py-2 pe-3 tabular-nums text-muted-foreground whitespace-nowrap">
                              {fmtTime(ev.date)}
                            </td>
                            <td className="py-2 pe-3 whitespace-nowrap">
                              <span className="flex items-center gap-1 font-medium text-foreground">
                                {CURRENCY_FLAG[ev.country] ?? '🏳'} {ev.country}
                              </span>
                            </td>
                            <td className="py-2 pe-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-foreground">{ev.title}</span>
                                <ImpactBadge impact={ev.impact} lang={lang} />
                              </div>
                            </td>
                            <td className="py-2 pe-3 text-end tabular-nums text-muted-foreground whitespace-nowrap">
                              {ev.previous || '—'}
                            </td>
                            <td className="py-2 pe-3 text-end tabular-nums text-muted-foreground whitespace-nowrap">
                              {ev.forecast || '—'}
                            </td>
                            <td className={`py-2 text-end tabular-nums font-medium whitespace-nowrap ${
                              ev.actual
                                ? parseFloat(ev.actual) >= parseFloat(ev.forecast || '0')
                                  ? 'text-profit'
                                  : 'text-loss'
                                : 'text-muted-foreground'
                            }`}>
                              {ev.actual || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
