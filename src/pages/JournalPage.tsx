import { useEffect, useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Trade = Tables<'trades'>;

function isoDate(d: Date) {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

const MONTH_NAMES: Record<string, string[]> = {
  ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
  fr: ['Janv','Févr','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'],
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
};

const DAY_NAMES: Record<string, string[]> = {
  ar: ['أ','إ','ث','أ','خ','ج','س'],
  fr: ['D','L','M','M','J','V','S'],
  en: ['S','M','T','W','T','F','S'],
};

export default function JournalPage() {
  const { t, language: lang } = useLanguage();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState(isoDate(new Date()));
  const [preMarket, setPreMarket]   = useState('');
  const [tradeNotes, setTradeNotes] = useState('');
  const [lessons, setLessons]       = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'>('idle');
  const [loading, setLoading]       = useState(false);
  const [trades, setTrades]         = useState<Trade[]>([]);
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());

  // Mini calendar
  const [calView, setCalView] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryExistsRef = useRef(false);

  // Load entry + trades for selected date
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const load = async () => {
      const [{ data: entry }, { data: tradesData }] = await Promise.all([
        supabase.from('journal_entries' as any).select('*').eq('user_id', user.id).eq('entry_date', selectedDate).maybeSingle(),
        supabase.from('trades').select('*').eq('user_id', user.id),
      ]);
      const e = entry as any;
      setPreMarket(e?.pre_market ?? '');
      setTradeNotes(e?.trade_notes ?? '');
      setLessons(e?.lessons ?? '');
      entryExistsRef.current = !!e;
      setSaveStatus('idle');
      setTrades((tradesData ?? []) as Trade[]);
      setLoading(false);
    };
    load();
  }, [user, selectedDate]);

  // Load all entry dates for the calendar dots
  useEffect(() => {
    if (!user) return;
    supabase.from('journal_entries' as any).select('entry_date').eq('user_id', user.id)
      .then(({ data }) => {
        setEntryDates(new Set((data ?? []).map((r: any) => r.entry_date as string)));
      });
  }, [user, saveStatus]);

  // Auto-save after 2s inactivity
  const triggerSave = useCallback((pm: string, tn: string, ls: string) => {
    if (!user) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setSaveStatus('saving');
    autoSaveTimer.current = setTimeout(async () => {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        entry_date: selectedDate,
        pre_market: pm || null,
        trade_notes: tn || null,
        lessons: ls || null,
        updated_at: new Date().toISOString(),
      };
      if (entryExistsRef.current) {
        await supabase.from('journal_entries' as any).update(payload).eq('user_id', user.id).eq('entry_date', selectedDate);
      } else {
        const { error } = await supabase.from('journal_entries' as any).insert(payload);
        if (!error) {
          entryExistsRef.current = true;
          setEntryDates(prev => new Set([...prev, selectedDate]));
        }
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }, 2000);
  }, [user, selectedDate]);

  const handleChange = (field: 'pre_market'|'trade_notes'|'lessons', val: string) => {
    if (field === 'pre_market')   { setPreMarket(val);   triggerSave(val, tradeNotes, lessons); }
    if (field === 'trade_notes')  { setTradeNotes(val);  triggerSave(preMarket, val, lessons); }
    if (field === 'lessons')      { setLessons(val);     triggerSave(preMarket, tradeNotes, val); }
  };

  // Day's trade stats
  const dayTrades = trades.filter(tr => tr.close_time && isoDate(new Date(tr.close_time)) === selectedDate);
  const dayPnl    = dayTrades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const dayWins   = dayTrades.filter(tr => (tr.profit ?? 0) > 0).length;
  const dayWR     = dayTrades.length > 0 ? Math.round((dayWins / dayTrades.length) * 100) : 0;

  // Mini calendar grid
  const calGrid = (() => {
    const first = new Date(calView.year, calView.month, 1);
    const startDow = first.getDay();
    const start = new Date(first);
    start.setDate(start.getDate() - startDow);
    return Array.from({ length: 35 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  })();

  const today = isoDate(new Date());

  const sections: { key: 'pre_market'|'trade_notes'|'lessons'; label: string; placeholder: string }[] = [
    {
      key: 'pre_market',
      label: t('preMarketPlan'),
      placeholder: lang === 'ar'
        ? 'ما هي خطتك لجلسة اليوم؟ الأزواج، المستويات، المحفزات...'
        : lang === 'fr'
        ? 'Quel est votre plan pour la session d\'aujourd\'hui ? Paires, niveaux, catalyseurs...'
        : 'What is your plan for today\'s session? Pairs, levels, catalysts...',
    },
    {
      key: 'trade_notes',
      label: t('tradeNotesEmotions'),
      placeholder: lang === 'ar'
        ? 'كيف كانت جلسة التداول؟ الانضباط، الأخطاء، المشاعر...'
        : lang === 'fr'
        ? 'Comment s\'est passée la session ? Discipline, erreurs, émotions...'
        : 'How did the trading session go? Discipline, mistakes, emotions...',
    },
    {
      key: 'lessons',
      label: t('lessonsLearned'),
      placeholder: lang === 'ar'
        ? 'ما الذي تعلمته اليوم؟ ما الذي ستفعله بشكل مختلف؟'
        : lang === 'fr'
        ? 'Qu\'avez-vous appris aujourd\'hui ? Que feriez-vous différemment ?'
        : 'What did you learn today? What would you do differently?',
    },
  ];

  const values: Record<string, string> = { pre_market: preMarket, trade_notes: tradeNotes, lessons };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{t('dailyJournal')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />{t('saving')}
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-sm text-profit">✓ {t('autoSaved')}</span>
          )}
          {/* Date input */}
          <input
            type="date"
            value={selectedDate}
            max={isoDate(new Date())}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── Left: Journal sections ── */}
        <div className="space-y-5 lg:col-span-2">

          {/* Today's trade summary */}
          {dayTrades.length > 0 && (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {lang === 'ar' ? 'صفقات اليوم' : lang === 'fr' ? 'Trades du jour' : "Today's trades"}:
                  </span>
                  <span className="font-bold text-foreground">{dayTrades.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">P&L:</span>
                  <span className={`font-bold ${dayPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {dayPnl >= 0 ? '+' : ''}${dayPnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {lang === 'ar' ? 'نسبة الفوز' : 'Win Rate'}:
                  </span>
                  <span className={`font-bold ${dayWR >= 50 ? 'text-profit' : 'text-loss'}`}>{dayWR}%</span>
                </div>
                {/* Mini trade list */}
                <div className="w-full flex flex-wrap gap-2 pt-1">
                  {dayTrades.map(tr => (
                    <span key={tr.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${(tr.profit ?? 0) >= 0 ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'}`}>
                      {tr.symbol} {(tr.profit ?? 0) >= 0 ? '+' : ''}${(tr.profit ?? 0).toFixed(2)}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            sections.map(section => (
              <Card key={section.key} className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {sections.indexOf(section) + 1}
                    </span>
                    {section.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder={section.placeholder}
                    rows={5}
                    value={values[section.key]}
                    onChange={e => handleChange(section.key, e.target.value)}
                    className="resize-none text-sm leading-relaxed"
                  />
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* ── Right: Mini calendar ── */}
        <div className="space-y-4">
          <Card className="border-border bg-card sticky top-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCalView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
                ><ChevronLeft className="h-3.5 w-3.5" /></button>
                <span className="text-sm font-semibold text-foreground">
                  {MONTH_NAMES[lang][calView.month]} {calView.year}
                </span>
                <button
                  onClick={() => setCalView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
                ><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              {/* Day headers */}
              <div className="mb-1 grid grid-cols-7 text-center">
                {DAY_NAMES[lang].map((d, i) => (
                  <span key={i} className="py-1 text-[10px] font-medium text-muted-foreground/60">{d}</span>
                ))}
              </div>
              {/* Days grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {calGrid.map((d, i) => {
                  const iso = isoDate(d);
                  const isCurrentMonth = d.getMonth() === calView.month;
                  const isToday = iso === today;
                  const isSelected = iso === selectedDate;
                  const hasEntry = entryDates.has(iso);
                  const hasTrade = trades.some(tr => tr.close_time && isoDate(new Date(tr.close_time)) === iso);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => isCurrentMonth && setSelectedDate(iso)}
                      disabled={!isCurrentMonth || iso > today}
                      className={`relative flex flex-col items-center justify-center rounded-md p-1 text-xs transition-colors
                        ${!isCurrentMonth ? 'opacity-20 cursor-default' : iso > today ? 'opacity-30 cursor-default' : 'cursor-pointer hover:bg-secondary'}
                        ${isSelected ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary/50' : ''}
                        ${isToday && !isSelected ? 'border border-primary/50 font-semibold text-primary' : 'text-foreground'}
                      `}
                    >
                      {d.getDate()}
                      {/* Dots */}
                      <div className="flex gap-0.5 mt-0.5">
                        {hasEntry && <span className="h-1 w-1 rounded-full bg-primary" />}
                        {hasTrade && <span className="h-1 w-1 rounded-full bg-profit" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="mt-3 flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />{lang === 'ar' ? 'مدخل' : lang === 'fr' ? 'Entrée' : 'Entry'}</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-profit inline-block" />{lang === 'ar' ? 'صفقة' : lang === 'fr' ? 'Trade' : 'Trade'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
