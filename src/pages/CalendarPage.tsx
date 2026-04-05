import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Loader2, TrendingUp, TrendingDown, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tables } from '@/integrations/supabase/types';
import { ForexCalendar } from '@/components/ForexCalendar';

type Trade = Tables<'trades'>;
type Lang = 'ar' | 'fr' | 'en';

// ─── i18n ────────────────────────────────────────────────────
const DAY_NAMES: Record<Lang, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  ar: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
};
const DAY_NAMES_FULL: Record<Lang, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};
const MONTH_NAMES: Record<Lang, string[]> = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  fr: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
};
const UI = {
  monthlyTotal:  { ar: 'إجمالي الشهر',   fr: 'Total du mois',     en: 'Monthly Total'  },
  tradingDays:   { ar: 'أيام التداول',     fr: 'Jours de trading',  en: 'Trading Days'   },
  winRate:       { ar: 'نسبة الربح',       fr: 'Taux de réussite',  en: 'Win Rate'       },
  thisMonth:     { ar: 'هذا الشهر',        fr: 'Ce mois',           en: 'This month'     },
  week:          { ar: 'أسبوع',            fr: 'Sem.',               en: 'Wk'             },
  trades:        { ar: 'صفقة',             fr: 'trades',             en: 'trades'         },
  noTrades:      { ar: 'لا توجد صفقات',    fr: 'Aucun trade',        en: 'No trades'      },
  holiday:       { ar: 'عطلة',             fr: 'Férié',              en: 'Holiday'        },
  economicCal:   { ar: 'التقويم الاقتصادي',fr: 'Calendrier économique', en: 'Economic Calendar' },
  profitDays:    { ar: 'أيام الربح',        fr: 'Jours gagnants',    en: 'Profit days'    },
  lossDays:      { ar: 'أيام الخسارة',      fr: 'Jours perdants',    en: 'Loss days'      },
};
const T = (key: keyof typeof UI, lang: Lang) => UI[key][lang];

// ─── helpers ─────────────────────────────────────────────────
function fmtPnl(val: number): string {
  const abs = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function isoDay(date: Date): string {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

// ─── Day Cell ────────────────────────────────────────────────
interface DayData {
  date: Date;
  pnl: number;
  tradeCount: number;
  wins: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

function DayCell({ d, lang }: { d: DayData; lang: Lang }) {
  const [hovered, setHovered] = useState(false);
  const hasTrades = d.tradeCount > 0;
  const wr = d.tradeCount > 0 ? Math.round((d.wins / d.tradeCount) * 100) : 0;

  let bg = '';
  let border = '';
  if (!d.isCurrentMonth) {
    bg = 'bg-transparent opacity-30';
  } else if (hasTrades) {
    bg = d.pnl >= 0 ? 'bg-[rgba(34,197,94,0.12)]' : 'bg-[rgba(239,68,68,0.12)]';
    border = d.pnl >= 0 ? 'border-[rgba(34,197,94,0.25)]' : 'border-[rgba(239,68,68,0.25)]';
  } else if (d.isWeekend) {
    bg = 'bg-secondary/20';
  } else {
    bg = 'bg-card';
  }
  if (d.isToday) border = 'border-primary border-2';

  return (
    <div
      className={`relative flex min-h-[90px] flex-col rounded-lg border p-2 transition-all duration-150 select-none
        ${bg} ${border || 'border-border/40'}
        ${d.isCurrentMonth && hasTrades ? 'cursor-default' : ''}
        ${d.isCurrentMonth ? 'hover:border-primary/40 hover:brightness-110' : ''}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Day number */}
      <span className={`text-[11px] font-medium leading-none ${d.isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
        {d.date.getDate()}
      </span>

      {/* Trade data */}
      {hasTrades && d.isCurrentMonth && (
        <div className="mt-1 flex flex-1 flex-col items-center justify-center gap-0.5">
          <span className={`text-base font-bold leading-tight ${d.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {fmtPnl(d.pnl)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {d.tradeCount} {T('trades', lang)}
          </span>
          <span className={`text-[10px] font-medium ${wr >= 50 ? 'text-[#22c55e]/80' : 'text-[#ef4444]/80'}`}>
            {wr}%
          </span>
        </div>
      )}

      {/* Hover tooltip */}
      {hovered && hasTrades && d.isCurrentMonth && (
        <div className="absolute bottom-full left-1/2 z-50 mb-1 w-48 -translate-x-1/2 rounded-lg border border-border bg-popover p-2.5 shadow-xl text-xs">
          <p className="mb-1 font-semibold text-foreground">
            {d.date.toLocaleDateString(
              lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
              { weekday: 'long', month: 'long', day: 'numeric' }
            )}
          </p>
          <div className="space-y-0.5 text-muted-foreground">
            <p>P&L: <span className={d.pnl >= 0 ? 'text-[#22c55e] font-semibold' : 'text-[#ef4444] font-semibold'}>{fmtPnl(d.pnl)}</span></p>
            <p>{T('trades', lang)}: <span className="text-foreground">{d.tradeCount}</span></p>
            <p>{T('winRate', lang)}: <span className="text-foreground">{wr}%</span></p>
            <p>{lang === 'ar' ? 'رابح' : lang === 'fr' ? 'Gagnants' : 'Wins'}: <span className="text-[#22c55e]">{d.wins}</span> / <span className="text-[#ef4444]">{d.tradeCount - d.wins}</span></p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
const CalendarPage = () => {
  const { language } = useLanguage();
  const lang = language as Lang;
  const { user } = useAuth();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [calDate, setCalDate] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from('trades')
      .select('profit, close_time, direction')
      .eq('user_id', user.id)
      .not('close_time', 'is', null)
      .then(({ data }) => {
        setTrades(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const { year, month } = calDate;

  // ── build calendar grid ──
  const { grid, weekSummaries, monthStats } = useMemo(() => {
    const todayKey = isoDay(new Date());
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth  = new Date(year, month + 1, 0);

    // Group trades by day key
    const byDay: Record<string, { pnl: number; count: number; wins: number }> = {};
    for (const tr of trades) {
      if (!tr.close_time || tr.profit === null) continue;
      const d = new Date(tr.close_time);
      const k = isoDay(d);
      if (!byDay[k]) byDay[k] = { pnl: 0, count: 0, wins: 0 };
      byDay[k].pnl   += tr.profit;
      byDay[k].count += 1;
      if (tr.profit > 0) byDay[k].wins += 1;
    }

    // Start grid on Sunday of the week containing firstOfMonth
    const startDow = firstOfMonth.getDay(); // 0=Sun
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - startDow);

    // Build 6 weeks (42 cells)
    const cells: DayData[] = [];
    const cur = new Date(gridStart);
    for (let i = 0; i < 42; i++) {
      const k = isoDay(cur);
      const data = byDay[k];
      cells.push({
        date: new Date(cur),
        pnl: data?.pnl ?? 0,
        tradeCount: data?.count ?? 0,
        wins: data?.wins ?? 0,
        isCurrentMonth: cur.getMonth() === month && cur.getFullYear() === year,
        isToday: k === todayKey,
        isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
      });
      cur.setDate(cur.getDate() + 1);
    }

    // Week summaries (6 rows)
    const weekSummaries = Array.from({ length: 6 }, (_, w) => {
      const week = cells.slice(w * 7, w * 7 + 7);
      const tradingDays = week.filter(d => d.tradeCount > 0 && d.isCurrentMonth);
      return {
        weekNum: w + 1,
        pnl: tradingDays.reduce((s, d) => s + d.pnl, 0),
        tradingDays: tradingDays.length,
        hasData: tradingDays.length > 0,
      };
    });

    // Monthly stats (current month only)
    const monthCells = cells.filter(d => d.isCurrentMonth && d.tradeCount > 0);
    const totalPnl = monthCells.reduce((s, d) => s + d.pnl, 0);
    const tradingDays = monthCells.length;
    const profitDays = monthCells.filter(d => d.pnl > 0).length;
    const totalTrades = monthCells.reduce((s, d) => s + d.tradeCount, 0);
    const totalWins   = monthCells.reduce((s, d) => s + d.wins, 0);
    const winRate     = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;

    return { grid: cells, weekSummaries, monthStats: { totalPnl, tradingDays, profitDays, winRate, totalTrades, totalWins } };
  }, [trades, year, month]);

  const prevMonth = () => setCalDate(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCalDate(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  const goToday   = () => { const n = new Date(); setCalDate({ year: n.getFullYear(), month: n.getMonth() }); };

  const isCurrentMonth = (() => { const n = new Date(); return n.getFullYear() === year && n.getMonth() === month; })();

  // trim trailing empty weeks
  const visibleWeeks = (() => {
    let last = 5;
    while (last > 0 && weekSummaries[last].tradingDays === 0 && grid.slice(last * 7, last * 7 + 7).every(d => !d.isCurrentMonth)) last--;
    return last + 1;
  })();

  return (
    <div className="animate-fade-in space-y-5">
      {/* ── Header + Monthly Stats ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h1 className="min-w-[180px] text-center text-xl font-bold text-foreground">
            {MONTH_NAMES[lang][month]} {year}
          </h1>
          <button onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs">
              {T('thisMonth', lang)}
            </Button>
          )}
        </div>

        {/* Monthly stats pills */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <span className="text-xs text-muted-foreground">{T('monthlyTotal', lang)}</span>
            <span className={`text-sm font-bold ${monthStats.totalPnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {monthStats.totalTrades === 0 ? '—' : fmtPnl(monthStats.totalPnl)}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{T('tradingDays', lang)}</span>
            <span className="text-sm font-bold text-foreground">{monthStats.tradingDays}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            {monthStats.winRate >= 50
              ? <TrendingUp className="h-3.5 w-3.5 text-[#22c55e]" />
              : <TrendingDown className="h-3.5 w-3.5 text-[#ef4444]" />}
            <span className="text-xs text-muted-foreground">{T('winRate', lang)}</span>
            <span className={`text-sm font-bold ${monthStats.winRate >= 50 ? 'text-[#22c55e]' : monthStats.totalTrades === 0 ? 'text-foreground' : 'text-[#ef4444]'}`}>
              {monthStats.totalTrades === 0 ? '—' : `${monthStats.winRate}%`}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <span className="text-xs text-muted-foreground">{T('profitDays', lang)}</span>
            <span className="text-sm font-bold text-[#22c55e]">{monthStats.profitDays}</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm font-bold text-[#ef4444]">{monthStats.tradingDays - monthStats.profitDays}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-4">
          {/* ── Calendar grid ── */}
          <div className="min-w-0 flex-1">
            {/* Day name headers */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {DAY_NAMES[lang].map((name, i) => (
                <div key={i} className={`py-1.5 text-center text-xs font-semibold ${i === 0 || i === 6 ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                  {name}
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div className="space-y-1">
              {Array.from({ length: visibleWeeks }, (_, w) => (
                <div key={w} className="grid grid-cols-7 gap-1">
                  {grid.slice(w * 7, w * 7 + 7).map((d, i) => (
                    <DayCell key={i} d={d} lang={lang} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ── Weekly sidebar ── */}
          <div className="hidden w-32 shrink-0 xl:flex xl:flex-col">
            {/* Header spacer to align with day name row */}
            <div className="mb-1 py-1.5" />
            <div className="space-y-1">
              {Array.from({ length: visibleWeeks }, (_, w) => {
                const wk = weekSummaries[w];
                return (
                  <div key={w}
                    className="flex min-h-[90px] flex-col justify-center gap-1 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {T('week', lang)} {wk.weekNum}
                    </span>
                    {wk.hasData ? (
                      <>
                        <span className={`text-sm font-bold leading-tight ${wk.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          {fmtPnl(wk.pnl)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {wk.tradingDays} {T('tradingDays', lang).toLowerCase().split(' ')[0]}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Economic Calendar section ── */}
      <div className="space-y-3 pt-2">
        <h2 className="text-lg font-semibold text-foreground">{T('economicCal', lang)}</h2>
        <ForexCalendar lang={lang} fullPage />
      </div>
    </div>
  );
};

export default CalendarPage;
