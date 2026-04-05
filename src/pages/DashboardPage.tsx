import { useEffect, useState, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  TrendingUp, TrendingDown, Loader2, Plus, ChevronLeft, ChevronRight, Camera, X,
} from 'lucide-react';
import { AccountCard } from '@/pages/ConnectPage';
import { OnboardingModal } from '@/components/OnboardingModal';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import { Tables } from '@/integrations/supabase/types';

type Trade = Tables<'trades'>;
type Account = Tables<'mt5_accounts'>;

// ---- helpers ----
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      const maxWidth = 800;
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.5);
    };
    img.src = URL.createObjectURL(file);
  });
}

function computeDuration(open: string, close: string): string {
  const diffMs = new Date(close).getTime() - new Date(open).getTime();
  if (isNaN(diffMs) || diffMs < 0) return '';
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

const RESULT_OPTIONS = [
  { value: 'Win',               label: { ar: 'ربح',          fr: 'Gain',    en: 'Win'  } },
  { value: 'Loss',              label: { ar: 'خسارة',         fr: 'Perte',   en: 'Loss' } },
  { value: 'Breakeven',         label: { ar: 'تعادل',         fr: 'Neutre',  en: 'Breakeven' } },
  { value: 'Partial Win - TP1', label: { ar: 'ربح جزئي - TP1', fr: 'Gain partiel - TP1', en: 'Partial Win - TP1' } },
  { value: 'Partial Win - TP2', label: { ar: 'ربح جزئي - TP2', fr: 'Gain partiel - TP2', en: 'Partial Win - TP2' } },
];
const SESSION_OPTIONS = [
  { value: 'London',   label: { ar: 'لندن',    fr: 'Londres',  en: 'London'   } },
  { value: 'New York', label: { ar: 'نيويورك', fr: 'New York', en: 'New York' } },
  { value: 'Asia',     label: { ar: 'آسيا',    fr: 'Asie',     en: 'Asia'     } },
];

const HAS_LIMITS_TYPES = ['Challenge Phase 1', 'Challenge Phase 2', 'Instant Funded', 'Funded'];

// Date range helpers
type DateRange = 'week' | 'month' | '3months' | 'all';
function getRangeStart(range: DateRange): Date | null {
  const now = new Date();
  if (range === 'week') {
    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    return d;
  }
  if (range === 'month') {
    const d = new Date(now);
    d.setMonth(now.getMonth() - 1);
    return d;
  }
  if (range === '3months') {
    const d = new Date(now);
    d.setMonth(now.getMonth() - 3);
    return d;
  }
  return null; // all
}

// ---- Win Rate Donut ----
function WinRateDonut({ wins, total, lang }: { wins: number; total: number; lang: 'ar'|'fr'|'en' }) {
  const losses = total - wins;
  const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
  const data = total === 0
    ? [{ value: 1, color: '#2a2d3a' }]
    : [
        { value: wins,   color: '#22c55e' },
        { value: losses, color: '#ef4444' },
      ];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <PieChart width={160} height={160}>
          <Pie data={data} cx={75} cy={75} innerRadius={52} outerRadius={72} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${pct >= 50 ? 'text-profit' : total === 0 ? 'text-muted-foreground' : 'text-loss'}`}>{pct}%</span>
          <span className="text-xs text-muted-foreground">
            {lang === 'ar' ? 'نسبة الربح' : lang === 'fr' ? 'Réussite' : 'Win Rate'}
          </span>
        </div>
      </div>
      <div className="flex gap-5 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-profit" />
          <span className="text-muted-foreground">{lang === 'ar' ? 'رابح' : lang === 'fr' ? 'Gagnants' : 'Winners'}</span>
          <span className="font-semibold text-foreground">{wins}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-loss" />
          <span className="text-muted-foreground">{lang === 'ar' ? 'خاسر' : lang === 'fr' ? 'Perdants' : 'Losers'}</span>
          <span className="font-semibold text-foreground">{losses}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Day Detail Modal ----
function DayDetailModal({
  day, month, year, dayTrades, lang, onClose,
}: {
  day: number; month: number; year: number;
  dayTrades: Trade[]; lang: 'ar'|'fr'|'en'; onClose: () => void;
}) {
  const totalPnl = dayTrades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const wins = dayTrades.filter(tr => (tr.profit ?? 0) > 0).length;
  const winRate = dayTrades.length > 0 ? ((wins / dayTrades.length) * 100).toFixed(1) : '0';
  const sorted = [...dayTrades].sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const dateStr = new Date(year, month, day).toLocaleDateString(
    lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }
  );
  const L = {
    trades:    lang === 'ar' ? 'الصفقات'    : lang === 'fr' ? 'Trades'     : 'Trades',
    winRate:   lang === 'ar' ? 'نسبة الفوز' : lang === 'fr' ? 'Réussite'   : 'Win Rate',
    winners:   lang === 'ar' ? 'رابحة'       : lang === 'fr' ? 'Gagnants'   : 'Winners',
    best:      lang === 'ar' ? 'أفضل صفقة'  : lang === 'fr' ? 'Meilleur'   : 'Best Trade',
    worst:     lang === 'ar' ? 'أسوأ صفقة'  : lang === 'fr' ? 'Pire trade' : 'Worst Trade',
    tradeList: lang === 'ar' ? 'قائمة الصفقات' : lang === 'fr' ? 'Liste des trades' : 'Trades',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl shadow-2xl"
        style={{
          backgroundColor: '#1a1d27',
          border: '1px solid rgba(0,212,170,0.3)',
          animation: 'calPopIn 0.18s cubic-bezier(0.175,0.885,0.32,1.275)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4" style={{ borderBottom: '1px solid #2a2d3a' }}>
          <div>
            <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>{dateStr}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: totalPnl >= 0 ? '#22c55e' : '#ef4444', lineHeight: 1 }}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#2a2d3a]"
            style={{ color: '#64748B', flexShrink: 0 }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #2a2d3a' }}>
          {[
            { label: L.trades,  val: String(dayTrades.length), color: '#e2e8f0' },
            { label: L.winRate, val: `${winRate}%`,            color: parseFloat(winRate) >= 50 ? '#22c55e' : '#ef4444' },
            { label: L.winners, val: String(wins),             color: '#22c55e' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '12px 16px', textAlign: 'center', borderRight: i < 2 ? '1px solid #2a2d3a' : undefined }}>
              <p style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Best / Worst */}
        {dayTrades.length > 1 && best && worst && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px 16px', borderBottom: '1px solid #2a2d3a' }}>
            <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <p style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{L.best}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>+${Math.abs(best.profit ?? 0).toFixed(2)}</p>
              <p style={{ fontSize: 11, color: '#64748B' }}>{best.symbol}</p>
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{L.worst}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>${(worst.profit ?? 0).toFixed(2)}</p>
              <p style={{ fontSize: 11, color: '#64748B' }}>{worst.symbol}</p>
            </div>
          </div>
        )}

        {/* Trade list */}
        <div style={{ maxHeight: 220, overflowY: 'auto', padding: '12px 16px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{L.tradeList}</p>
          <div className="space-y-1.5">
            {dayTrades.map(tr => {
              const pnl = tr.profit ?? 0;
              return (
                <div key={tr.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, backgroundColor: '#242836' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14 }}>{tr.symbol}</span>
                    <span style={{ padding: '2px 7px', borderRadius: 12, fontSize: 10, fontWeight: 600, backgroundColor: tr.direction === 'BUY' ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)', color: tr.direction === 'BUY' ? '#22c55e' : '#ef4444' }}>
                      {tr.direction}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: pnl >= 0 ? '#22c55e' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Trading Calendar (full-width, premium) ----
function TradingCalendar({
  trades, lang, accounts, user, onTradeSaved,
}: {
  trades: Trade[]; lang: 'ar'|'fr'|'en';
  accounts: Account[]; user: any; onTradeSaved: () => void;
}) {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const { year, month } = calMonth;
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay + 6) % 7;

  const dayData = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayTrades = trades.filter(tr => {
        if (!tr.close_time) return false;
        const d = new Date(tr.close_time);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
      });
      const pnl = dayTrades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
      const wins = dayTrades.filter(tr => (tr.profit ?? 0) > 0).length;
      return { day, pnl, count: dayTrades.length, wins, dayTrades };
    });
  }, [trades, year, month]);

  const weeks = useMemo(() => {
    type Cell = { day: number | null; pnl: number; count: number; wins: number; dayTrades: Trade[] };
    const cells: Cell[] = [
      ...Array.from({ length: leadingBlanks }, () => ({ day: null, pnl: 0, count: 0, wins: 0, dayTrades: [] as Trade[] })),
      ...dayData,
    ];
    while (cells.length % 7 !== 0) cells.push({ day: null, pnl: 0, count: 0, wins: 0, dayTrades: [] });
    const result = [];
    for (let i = 0; i < cells.length; i += 7) {
      const wk = cells.slice(i, i + 7);
      const active = wk.filter(c => c.day !== null && c.count > 0);
      result.push({ cells: wk, pnl: active.reduce((s, c) => s + c.pnl, 0), tradingDays: active.length });
    }
    return result;
  }, [leadingBlanks, dayData]);

  const maxAbsWeekPnl = useMemo(() => Math.max(...weeks.map(w => Math.abs(w.pnl)), 1), [weeks]);

  const todayWeekIdx = useMemo(() => {
    if (!isCurrentMonth) return -1;
    return weeks.findIndex(w => w.cells.some(c => c.day === today.getDate()));
  }, [weeks, isCurrentMonth, today]);

  const monthStats = useMemo(() => {
    const active = dayData.filter(d => d.count > 0);
    const totalPnl = active.reduce((s, d) => s + d.pnl, 0);
    const profitDays = active.filter(d => d.pnl > 0).length;
    const totalTrades = active.reduce((s, d) => s + d.count, 0);
    const totalWins = active.reduce((s, d) => s + d.wins, 0);
    const bestDay  = active.length > 0 ? active.reduce((b, d) => d.pnl > b.pnl ? d : b, active[0]) : null;
    const worstDay = active.length > 0 ? active.reduce((b, d) => d.pnl < b.pnl ? d : b, active[0]) : null;
    return {
      tradingDays: active.length, profitDays, totalPnl, totalTrades,
      winRate: totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0,
      bestDay, worstDay,
    };
  }, [dayData]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
    { month: 'long', year: 'numeric' }
  );
  const dayNames = lang === 'ar'
    ? ['إث','ثل','أر','خم','جم','سب','أح']
    : lang === 'fr'
    ? ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
    : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const fmtPnl = (v: number) => {
    const abs = Math.abs(v);
    const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(2);
    return `${v >= 0 ? '+' : '-'}$${s}`;
  };
  const fmtShort = (v: number) => {
    const abs = Math.abs(v);
    const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(0);
    return `${v >= 0 ? '+' : '-'}$${s}`;
  };

  const selectedDayTrades = selectedDay !== null
    ? (dayData.find(d => d.day === selectedDay)?.dayTrades ?? [])
    : [];

  const pad2 = (n: number) => String(n).padStart(2, '0');

  return (
    <>
      <style>{`
        @keyframes calPopIn {
          from { opacity:0; transform:scale(0.92) translateY(10px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes calCellIn {
          from { opacity:0; transform:translateY(5px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      <div className="space-y-4">
        {/* ── Monthly stats bar ── */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-secondary/30 p-4 sm:grid-cols-5">
          {[
            {
              label: lang === 'ar' ? 'P&L الشهري'    : lang === 'fr' ? 'P&L mensuel'       : 'Monthly P&L',
              val:   fmtPnl(monthStats.totalPnl),
              color: monthStats.totalPnl >= 0 ? '#22c55e' : '#ef4444',
            },
            {
              label: lang === 'ar' ? 'أيام التداول'  : lang === 'fr' ? 'Jours actifs'       : 'Trading Days',
              val:   String(monthStats.tradingDays),
              color: 'inherit' as const,
            },
            {
              label: lang === 'ar' ? 'نسبة الفوز'    : lang === 'fr' ? 'Taux de réussite'   : 'Win Rate',
              val:   `${monthStats.winRate}%`,
              color: monthStats.winRate >= 50 ? '#22c55e' : monthStats.winRate === 0 ? '#94A3B8' : '#ef4444',
            },
            {
              label: lang === 'ar' ? 'أفضل يوم'      : lang === 'fr' ? 'Meilleur jour'       : 'Best Day',
              val:   monthStats.bestDay ? fmtPnl(monthStats.bestDay.pnl) : '—',
              color: '#22c55e',
            },
            {
              label: lang === 'ar' ? 'أسوأ يوم'      : lang === 'fr' ? 'Pire jour'           : 'Worst Day',
              val:   monthStats.worstDay && monthStats.worstDay.pnl < 0 ? fmtPnl(monthStats.worstDay.pnl) : '—',
              color: '#ef4444',
            },
          ].map((s, i) => (
            <div key={i}>
              <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>{s.label}</p>
              <p style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* ── Calendar header ── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, borderRadius:8, backgroundColor:'rgba(0,212,170,0.1)', color:'#00d4aa', border:'1px solid rgba(0,212,170,0.22)', flexShrink:0, transition:'background 0.15s' }}
            className="hover:bg-[#00d4aa]/20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center justify-center gap-3">
            <span style={{ fontSize:18, fontWeight:700 }}>{monthLabel}</span>
            {!isCurrentMonth && (
              <button
                onClick={() => setCalMonth({ year: today.getFullYear(), month: today.getMonth() })}
                style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600, backgroundColor:'rgba(0,212,170,0.1)', color:'#00d4aa', border:'1px solid rgba(0,212,170,0.25)', transition:'background 0.15s' }}
                className="hover:bg-[#00d4aa]/20"
              >
                {lang === 'ar' ? 'اليوم' : lang === 'fr' ? "Aujourd'hui" : 'Today'}
              </button>
            )}
          </div>
          <button
            onClick={() => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, borderRadius:8, backgroundColor:'rgba(0,212,170,0.1)', color:'#00d4aa', border:'1px solid rgba(0,212,170,0.22)', flexShrink:0, transition:'background 0.15s' }}
            className="hover:bg-[#00d4aa]/20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* ── Grid + weekly sidebar ── */}
        <div className="flex gap-2">
          {/* Main grid */}
          <div className="min-w-0 flex-1">
            {/* Day-of-week headers */}
            <div className="mb-1.5 grid grid-cols-7 gap-1">
              {dayNames.map(d => (
                <div key={d} style={{ padding:'4px 0', textAlign:'center', fontSize:11, fontWeight:600, color:'#64748B' }}>{d}</div>
              ))}
            </div>
            {/* Week rows */}
            <div className="space-y-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.cells.map((cell, ci) => {
                    if (cell.day === null) {
                      return <div key={ci} style={{ minHeight:90 }} />;
                    }
                    const isTodayCell = isCurrentMonth && today.getDate() === cell.day;
                    const hasData = cell.count > 0;
                    const winRatePct = cell.count > 0 ? (cell.wins / cell.count) * 100 : 0;
                    const animDelay = (wi * 7 + ci) * 12;

                    let bgColor = 'rgba(30,35,50,0.55)';
                    if (hasData) {
                      bgColor = cell.pnl > 0 ? 'rgba(34,197,94,0.1)' : cell.pnl < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.08)';
                    }

                    return (
                      <div
                        key={ci}
                        onClick={() => {
                          if (hasData) {
                            setSelectedDay(cell.day!);
                          } else {
                            setQuickAddDate(`${year}-${pad2(month + 1)}-${pad2(cell.day!)}`);
                          }
                        }}
                        className="group cursor-pointer transition-[filter] hover:brightness-125"
                        style={{
                          minHeight: 90,
                          backgroundColor: bgColor,
                          borderRadius: 8,
                          padding: '6px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          border: isTodayCell ? '2px solid #00d4aa' : '1px solid rgba(255,255,255,0.04)',
                          animation: `calCellIn 0.28s ease-out ${animDelay}ms both`,
                          position: 'relative',
                        }}
                      >
                        {/* Day number */}
                        <span style={{ fontSize:13, color: isTodayCell ? '#00d4aa' : '#64748B', fontWeight: isTodayCell ? 700 : 400, lineHeight:1 }}>
                          {cell.day}
                        </span>

                        {hasData ? (
                          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, marginTop:2 }}>
                            {/* PnL */}
                            <span style={{ fontSize:18, fontWeight:700, color: cell.pnl >= 0 ? '#22c55e' : '#ef4444', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
                              {cell.pnl >= 0 ? '+' : '-'}{Math.abs(cell.pnl) >= 1000 ? `${(Math.abs(cell.pnl)/1000).toFixed(1)}k` : Math.abs(cell.pnl).toFixed(0)}
                            </span>
                            {/* Trade count */}
                            <span style={{ fontSize:12, color:'#94A3B8', lineHeight:1 }}>
                              {cell.count} {lang === 'ar' ? 'صفقة' : 'trade' + (cell.count !== 1 ? 's' : '')}
                            </span>
                            {/* Win rate */}
                            <span style={{ fontSize:12, color:'#94A3B8', lineHeight:1 }}>
                              {winRatePct.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          /* Empty day hover hint */
                          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}
                               className="opacity-0 transition-opacity group-hover:opacity-60">
                            <span style={{ fontSize:22, color:'#64748B', fontWeight:300, lineHeight:1 }}>+</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Weekly sidebar */}
          <div className="hidden w-[76px] flex-col gap-1 sm:flex">
            <div style={{ padding:'4px 0', textAlign:'center', fontSize:11, fontWeight:600, color:'#64748B', marginBottom:2 }}>
              {lang === 'ar' ? 'الأسبوع' : lang === 'fr' ? 'Sem.' : 'Week'}
            </div>
            {weeks.map((week, wi) => {
              const isCurWeek = wi === todayWeekIdx;
              const barPct = maxAbsWeekPnl > 0 ? Math.abs(week.pnl) / maxAbsWeekPnl : 0;
              return (
                <div key={wi} style={{
                  minHeight: 90,
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
                  borderRadius:8,
                  backgroundColor: isCurWeek ? 'rgba(0,212,170,0.07)' : 'rgba(30,35,50,0.5)',
                  border: isCurWeek ? '1px solid rgba(0,212,170,0.22)' : '1px solid rgba(255,255,255,0.03)',
                  padding:'6px 4px',
                }}>
                  <span style={{ fontSize:11, color: isCurWeek ? '#00d4aa' : '#64748B', fontWeight:600 }}>
                    {lang === 'ar' ? `أ${wi+1}` : `W${wi+1}`}
                  </span>
                  {week.tradingDays > 0 ? (
                    <>
                      <span style={{ fontSize:12, fontWeight:700, color: week.pnl >= 0 ? '#22c55e' : '#ef4444', lineHeight:1, fontVariantNumeric:'tabular-nums', textAlign:'center' }}>
                        {fmtShort(week.pnl)}
                      </span>
                      {/* Mini performance bar */}
                      <div style={{ width:'80%', height:4, borderRadius:2, backgroundColor:'rgba(255,255,255,0.06)' }}>
                        <div style={{ width:`${barPct*100}%`, height:'100%', borderRadius:2, backgroundColor: week.pnl >= 0 ? '#22c55e' : '#ef4444', transition:'width 0.4s ease' }} />
                      </div>
                      <span style={{ fontSize:10, color:'#64748B' }}>
                        {week.tradingDays}{lang === 'ar' ? 'ي' : 'd'}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize:12, color:'#64748B' }}>—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDay !== null && selectedDayTrades.length > 0 && (
        <DayDetailModal
          day={selectedDay} month={month} year={year}
          dayTrades={selectedDayTrades} lang={lang}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* Quick add trade modal (empty day click) */}
      {quickAddDate !== null && (
        <QuickAddTrade
          open
          onClose={() => setQuickAddDate(null)}
          accounts={accounts} lang={lang} user={user}
          onSaved={() => { setQuickAddDate(null); onTradeSaved(); }}
          initialDate={quickAddDate}
        />
      )}
    </>
  );
}

// ---- Add Trade Form (reused from TradesPage) ----
function QuickAddTrade({
  open, onClose, accounts, lang, user, onSaved, initialDate,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  lang: 'ar'|'fr'|'en';
  user: any;
  onSaved: () => void;
  initialDate?: string; // YYYY-MM-DD — prefills open/close time when provided
}) {
  const [form, setForm] = useState({
    symbol: '', direction: '' as 'BUY'|'SELL'|'', result: '', profit: '',
    tp1Amount: '', tp2Amount: '', risk: '', open_time: '', close_time: '',
    session: '', setup_tag: '', notes: '', account_id: '',
  });
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill date when modal opens for an empty-day click
  useEffect(() => {
    if (open && initialDate) {
      setForm(f => ({ ...f, open_time: `${initialDate}T09:00`, close_time: `${initialDate}T10:00` }));
    }
  }, [open, initialDate]);

  const isPartial = form.result.startsWith('Partial');
  const rr = (() => {
    const r = parseFloat(form.risk);
    if (!r) return '';
    const p = isPartial
      ? (parseFloat(form.tp1Amount) || 0) + (parseFloat(form.tp2Amount) || 0)
      : parseFloat(form.profit);
    if (isNaN(p) || isNaN(r)) return '';
    return (Math.abs(p) / r).toFixed(2);
  })();

  const reset = () => {
    setForm({ symbol: '', direction: '', result: '', profit: '', tp1Amount: '', tp2Amount: '', risk: '', open_time: '', close_time: '', session: '', setup_tag: '', notes: '', account_id: '' });
    setScreenshotFile(null);
  };

  const handleSave = async () => {
    const hasAmount = isPartial ? form.tp1Amount !== '' : form.profit !== '';
    if (!form.symbol.trim() || !form.direction || !form.result || !hasAmount || !form.open_time || !form.close_time) {
      toast.error(lang === 'ar' ? 'يرجى ملء الحقول المطلوبة' : lang === 'fr' ? 'Veuillez remplir les champs obligatoires' : 'Please fill all required fields');
      return;
    }
    if (!form.account_id) {
      toast.error(lang === 'ar' ? 'يرجى اختيار الحساب' : lang === 'fr' ? 'Veuillez sélectionner un compte' : 'Please select an account');
      return;
    }
    setSubmitting(true);
    let finalProfit =
      form.result === 'Win' ? Math.abs(parseFloat(form.profit)) :
      form.result === 'Loss' ? -Math.abs(parseFloat(form.profit)) :
      form.result === 'Breakeven' ? (parseFloat(form.profit) || 0) :
      Math.abs(parseFloat(form.tp1Amount) || 0) + Math.abs(parseFloat(form.tp2Amount) || 0);

    const tagParts = [form.result, form.session, form.setup_tag.trim()].filter(Boolean);
    const rrStr = rr ? `R:R ${rr}` : '';
    const riskStr = form.risk ? `Risk $${form.risk}` : '';
    const extraInfo = [riskStr, rrStr].filter(Boolean).join(' | ');
    const notesValue = [extraInfo, form.notes.trim()].filter(Boolean).join('\n') || null;
    const duration = computeDuration(form.open_time, form.close_time);

    const { data: inserted, error } = await supabase.from('trades').insert({
      user_id: user.id,
      symbol: form.symbol.trim().toUpperCase(),
      direction: form.direction,
      profit: finalProfit,
      open_time: new Date(form.open_time).toISOString(),
      close_time: new Date(form.close_time).toISOString(),
      duration: duration || null,
      setup_tag: tagParts.join(', ') || null,
      session: form.session || null,
      notes: notesValue,
      account_id: form.account_id || null,
      volume: 0,
    }).select().single();

    if (!error && inserted && screenshotFile) {
      const compressed = await compressImage(screenshotFile);
      const path = `${user.id}/${inserted.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('trade-screenshots').upload(path, compressed, { contentType: 'image/jpeg' });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('trade-screenshots').getPublicUrl(path);
        await supabase.from('trades').update({ screenshot_url: publicUrl }).eq('id', inserted.id);
      }
    }
    setSubmitting(false);
    if (error) { toast.error('Failed: ' + error.message); return; }
    toast.success(lang === 'ar' ? 'تم حفظ الصفقة' : lang === 'fr' ? 'Trade enregistré' : 'Trade saved!');
    reset();
    onClose();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lang === 'ar' ? 'إضافة صفقة يدوية' : lang === 'fr' ? 'Ajouter un trade manuel' : 'Add Manual Trade'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Account */}
          <div className="space-y-1.5">
            <Label>{lang === 'ar' ? 'الحساب' : lang === 'fr' ? 'Compte' : 'Account'} <span className="text-destructive">*</span></Label>
            <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
              <SelectTrigger><SelectValue placeholder={lang === 'ar' ? 'اختر الحساب' : lang === 'fr' ? 'Sélectionner' : 'Select account'} /></SelectTrigger>
              <SelectContent>
                {accounts.length === 0
                  ? <SelectItem value="none" disabled>{lang === 'ar' ? 'لا توجد حسابات' : lang === 'fr' ? 'Aucun compte' : 'No accounts'}</SelectItem>
                  : accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name || `${acc.firm}${acc.login ? ` · ${acc.login}` : ''}`}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          {/* Symbol */}
          <div className="space-y-1.5">
            <Label>{lang === 'ar' ? 'الرمز' : lang === 'fr' ? 'Symbole' : 'Symbol'} <span className="text-destructive">*</span></Label>
            <Input placeholder="NQ, XAUUSD, EURUSD..." value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} />
          </div>
          {/* Direction */}
          <div className="space-y-1.5">
            <Label>{lang === 'ar' ? 'الاتجاه' : lang === 'fr' ? 'Direction' : 'Direction'} <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              {(['BUY', 'SELL'] as const).map(dir => (
                <button key={dir} type="button" onClick={() => setForm(f => ({ ...f, direction: dir }))}
                  className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                    form.direction === dir
                      ? dir === 'BUY' ? 'border-profit bg-profit/20 text-profit' : 'border-loss bg-loss/20 text-loss'
                      : 'border-border bg-secondary text-muted-foreground hover:border-primary/50'
                  }`}>
                  {dir === 'BUY' ? (lang === 'ar' ? 'شراء' : dir) : (lang === 'ar' ? 'بيع' : dir)}
                </button>
              ))}
            </div>
          </div>
          {/* Result */}
          <div className="space-y-1.5">
            <Label>{lang === 'ar' ? 'النتيجة' : lang === 'fr' ? 'Résultat' : 'Result'} <span className="text-destructive">*</span></Label>
            <Select value={form.result} onValueChange={v => setForm(f => ({ ...f, result: v }))}>
              <SelectTrigger><SelectValue placeholder={lang === 'ar' ? 'اختر النتيجة' : lang === 'fr' ? 'Choisir' : 'Select result'} /></SelectTrigger>
              <SelectContent>
                {RESULT_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label[lang]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Profit/TP */}
          {isPartial ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lang === 'ar' ? 'مبلغ TP1 ($)' : 'TP1 ($)'} <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.tp1Amount} onChange={e => setForm(f => ({ ...f, tp1Amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === 'ar' ? 'مبلغ TP2 ($)' : 'TP2 ($)'}</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.tp2Amount} onChange={e => setForm(f => ({ ...f, tp2Amount: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{form.result === 'Loss' ? (lang === 'ar' ? 'الخسارة ($)' : lang === 'fr' ? 'Perte ($)' : 'Loss ($)') : (lang === 'ar' ? 'الربح ($)' : lang === 'fr' ? 'Gain ($)' : 'Profit ($)')} <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.profit} onChange={e => setForm(f => ({ ...f, profit: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === 'ar' ? 'المخاطرة ($)' : lang === 'fr' ? 'Risque ($)' : 'Risk ($)'}</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.risk} onChange={e => setForm(f => ({ ...f, risk: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>R:R</Label>
                <Input readOnly value={rr} placeholder="—" className="cursor-default bg-secondary text-muted-foreground" />
              </div>
            </div>
          )}
          {/* Open / Close */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'وقت الفتح' : lang === 'fr' ? 'Ouverture' : 'Open time'} <span className="text-destructive">*</span></Label>
              <Input type="datetime-local" value={form.open_time} onChange={e => setForm(f => ({ ...f, open_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'وقت الإغلاق' : lang === 'fr' ? 'Clôture' : 'Close time'} <span className="text-destructive">*</span></Label>
              <Input type="datetime-local" value={form.close_time} onChange={e => setForm(f => ({ ...f, close_time: e.target.value }))} />
            </div>
          </div>
          {/* Session */}
          <div className="space-y-1.5">
            <Label>{lang === 'ar' ? 'الجلسة' : lang === 'fr' ? 'Session' : 'Session'}</Label>
            <Select value={form.session} onValueChange={v => setForm(f => ({ ...f, session: v }))}>
              <SelectTrigger><SelectValue placeholder={lang === 'ar' ? 'اختر الجلسة' : lang === 'fr' ? 'Choisir' : 'Select session'} /></SelectTrigger>
              <SelectContent>
                {SESSION_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label[lang]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Setup */}
          <div className="space-y-1.5">
            <Label>{lang === 'ar' ? 'الإعداد' : lang === 'fr' ? 'Setup' : 'Setup'}</Label>
            <Input placeholder="FVG, Order Block, BOS..." value={form.setup_tag} onChange={e => setForm(f => ({ ...f, setup_tag: e.target.value }))} />
          </div>
          {/* Notes */}
          <div className="space-y-1.5">
            <Label>{lang === 'ar' ? 'ملاحظات' : lang === 'fr' ? 'Notes' : 'Notes'}</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {/* Screenshot */}
          <div className="space-y-1.5">
            <Label>{lang === 'ar' ? 'صورة' : lang === 'fr' ? 'Capture' : 'Screenshot'} <span className="ms-1 text-xs text-muted-foreground">({lang === 'ar' ? 'اختياري' : lang === 'fr' ? 'optionnel' : 'optional'})</span></Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setScreenshotFile(f); e.target.value = ''; }} />
            {screenshotFile ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /><span className="truncate max-w-[200px]">{screenshotFile.name}</span></span>
                <button type="button" onClick={() => setScreenshotFile(null)} className="text-muted-foreground hover:text-loss"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground">
                <Camera className="h-4 w-4" />
                {lang === 'ar' ? 'إضافة صورة' : lang === 'fr' ? 'Ajouter une image' : 'Add screenshot'}
              </button>
            )}
          </div>
          <Button className="w-full min-h-[44px] gradient-primary text-primary-foreground" onClick={handleSave} disabled={submitting}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {lang === 'ar' ? 'حفظ الصفقة' : lang === 'fr' ? 'Enregistrer' : 'Save Trade'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MAIN DASHBOARD
// ============================================================
const DashboardPage = () => {
  const { t, language } = useLanguage();
  const lang = language as 'ar'|'fr'|'en';
  const { user } = useAuth();

  const [trades, setTrades]     = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [addOpen, setAddOpen]   = useState(false);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');

  // Equity chart account selector
  const [equityAccountId, setEquityAccountId] = useState<string>('all');

  const fetchData = async () => {
    if (!user) return;
    const [{ data: tradesData }, { data: accountsData }] = await Promise.all([
      supabase.from('trades').select('*').eq('user_id', user.id).order('close_time', { ascending: true }),
      supabase.from('mt5_accounts').select('*').eq('user_id', user.id),
    ]);
    setTrades(tradesData ?? []);
    setAccounts(accountsData ?? []);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const checkOnboarding = async () => {
      const { data: prefs } = await supabase.from('user_preferences').select('onboarding_completed').eq('user_id', user.id).maybeSingle();
      if (prefs?.onboarding_completed) return;
      const [{ count: tc }, { count: ac }] = await Promise.all([
        supabase.from('trades').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('mt5_accounts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      if ((tc ?? 0) === 0 && (ac ?? 0) === 0) setShowOnboarding(true);
    };
    checkOnboarding();
  }, [user]);

  // ---- filtered trades ----
  const filteredTrades = useMemo(() => {
    const rangeStart = getRangeStart(dateRange);
    return trades.filter(tr => {
      if (!tr.profit !== null) {} // include all
      if (filterAccountId !== 'all' && tr.account_id !== filterAccountId) return false;
      if (rangeStart && tr.close_time) {
        if (new Date(tr.close_time) < rangeStart) return false;
      }
      return true;
    });
  }, [trades, dateRange, filterAccountId]);

  const closedTrades = filteredTrades.filter(tr => tr.profit !== null);

  // ---- stats ----
  const totalPnl      = closedTrades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const wins          = closedTrades.filter(tr => (tr.profit ?? 0) > 0);
  const losses        = closedTrades.filter(tr => (tr.profit ?? 0) < 0);
  const winRate       = closedTrades.length ? (wins.length / closedTrades.length) * 100 : 0;
  const grossProfit   = wins.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const grossLoss     = Math.abs(losses.reduce((s, tr) => s + (tr.profit ?? 0), 0));
  const profitFactor  = grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? null : 0;
  const avgWin        = wins.length ? grossProfit / wins.length : 0;
  const avgLoss       = losses.length ? grossLoss / losses.length : 0;

  // ---- streak ----
  const streak = useMemo(() => {
    if (!closedTrades.length) return { count: 0, type: 'win' as 'win'|'loss' };
    const sorted = [...closedTrades].sort((a, b) => new Date(a.close_time!).getTime() - new Date(b.close_time!).getTime());
    const last = sorted[sorted.length - 1];
    const isWin = (last.profit ?? 0) > 0;
    let count = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const w = (sorted[i].profit ?? 0) > 0;
      if (w === isWin) count++;
      else break;
    }
    return { count, type: isWin ? 'win' : 'loss' as 'win'|'loss' };
  }, [closedTrades]);

  // ---- equity curve ----
  const selectedEquityAccount = useMemo(
    () => equityAccountId === 'all' ? null : accounts.find(a => a.id === equityAccountId) ?? null,
    [equityAccountId, accounts]
  );
  const hasLimits = selectedEquityAccount ? HAS_LIMITS_TYPES.includes(selectedEquityAccount.account_type ?? '') : false;
  const accountSize = selectedEquityAccount?.account_size ?? selectedEquityAccount?.starting_balance ?? 0;
  const ddLimit = selectedEquityAccount?.max_drawdown_limit ?? 10;

  const equityData = useMemo(() => {
    const isAll = equityAccountId === 'all';
    const startBalance = isAll
      ? accounts.reduce((s, a) => s + (a.starting_balance ?? a.balance ?? 0), 0)
      : (selectedEquityAccount?.starting_balance ?? selectedEquityAccount?.balance ?? 0);
    const rel = isAll
      ? trades.filter(tr => tr.profit !== null)
      : trades.filter(tr => tr.profit !== null && tr.account_id === equityAccountId);
    const sorted = [...rel].sort((a, b) => new Date(a.close_time!).getTime() - new Date(b.close_time!).getTime());

    if (sorted.length === 0) {
      return { points: [{ date: lang === 'ar' ? 'الآن' : 'Now', balance: +startBalance.toFixed(2) }], startBalance, dangerLevel: null };
    }
    let running = startBalance;
    const pts = sorted.map(tr => {
      running += tr.profit ?? 0;
      return { date: new Date(tr.close_time!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), balance: +running.toFixed(2) };
    });
    const dangerLevel = hasLimits && accountSize > 0 ? +(startBalance - (accountSize * ddLimit / 100)).toFixed(2) : null;
    return { points: [{ date: '', balance: +startBalance.toFixed(2) }, ...pts], startBalance, dangerLevel };
  }, [equityAccountId, selectedEquityAccount, accounts, trades, hasLimits, accountSize, ddLimit, lang]);

  const equityCurrent = equityData.points[equityData.points.length - 1]?.balance ?? 0;
  const equityChange = equityCurrent - equityData.startBalance;
  const equityChangePct = equityData.startBalance > 0 ? ((equityChange / equityData.startBalance) * 100).toFixed(2) : '0.00';
  const lineColor = hasLimits
    ? (equityCurrent >= equityData.startBalance ? '#00d4aa' : equityData.dangerLevel !== null && equityCurrent > equityData.dangerLevel ? '#f59e0b' : '#ef4444')
    : '#00d4aa';

  // ---- display name / greeting ----
  const displayName = (user?.user_metadata?.full_name as string | undefined)?.trim() || 'Trader';
  const greeting =
    lang === 'ar' ? `مرحباً، ${displayName} 👋` :
    lang === 'fr' ? `Bonjour, ${displayName} 👋` :
                    `Welcome back, ${displayName} 👋`;

  // ---- date range labels ----
  const rangeLabels: Record<DateRange, Record<'ar'|'fr'|'en', string>> = {
    week:     { ar: 'هذا الأسبوع', fr: 'Cette semaine',   en: 'This week' },
    month:    { ar: 'هذا الشهر',   fr: 'Ce mois',         en: 'This month' },
    '3months':{ ar: 'آخر 3 أشهر',  fr: '3 derniers mois', en: 'Last 3 months' },
    all:      { ar: 'كل الوقت',    fr: 'Tout',            en: 'All time' },
  };

  // ---- account map ----
  const accountMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);

  // ---- recent trades (last 5, all time) ----
  const recentTrades = [...trades].sort((a, b) => new Date(b.close_time ?? 0).getTime() - new Date(a.close_time ?? 0).getTime()).slice(0, 5);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in pb-24">
      {showOnboarding && user && (
        <OnboardingModal userId={user.id} lang={lang} onClose={() => setShowOnboarding(false)} />
      )}

      {/* ── TOP BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {new Date().toLocaleDateString(
              lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
              { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range */}
          <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
            <SelectTrigger className="h-9 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(rangeLabels) as DateRange[]).map(r => (
                <SelectItem key={r} value={r}>{rangeLabels[r][lang]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Account filter */}
          {accounts.length > 0 && (
            <Select value={filterAccountId} onValueChange={setFilterAccountId}>
              <SelectTrigger className="h-9 w-44 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === 'ar' ? 'كل الحسابات' : lang === 'fr' ? 'Tous les comptes' : 'All accounts'}</SelectItem>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.account_name ?? acc.login?.toString() ?? acc.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* ── TOP STATS ROW ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Net PnL */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'إجمالي الربح/الخسارة' : lang === 'fr' ? 'PnL net' : 'Total Net PnL'}</p>
            <p className={`mt-1 text-2xl font-bold ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{closedTrades.length} {lang === 'ar' ? 'صفقة' : lang === 'fr' ? 'trades' : 'trades'}</p>
          </CardContent>
        </Card>
        {/* Profit Factor */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'معامل الربح' : lang === 'fr' ? 'Facteur de profit' : 'Profit Factor'}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {profitFactor === null ? '∞' : profitFactor === 0 ? '—' : profitFactor}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{lang === 'ar' ? 'ربح / خسارة' : lang === 'fr' ? 'gain / perte' : 'gross profit / loss'}</p>
          </CardContent>
        </Card>
        {/* Avg Win */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'متوسط الربح' : lang === 'fr' ? 'Gain moyen' : 'Avg Winning Trade'}</p>
            <p className="mt-1 text-2xl font-bold text-profit">
              {wins.length ? `+$${avgWin.toFixed(2)}` : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{wins.length} {lang === 'ar' ? 'صفقة رابحة' : lang === 'fr' ? 'gagnants' : 'winners'}</p>
          </CardContent>
        </Card>
        {/* Avg Loss */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{lang === 'ar' ? 'متوسط الخسارة' : lang === 'fr' ? 'Perte moyenne' : 'Avg Losing Trade'}</p>
            <p className="mt-1 text-2xl font-bold text-loss">
              {losses.length ? `-$${avgLoss.toFixed(2)}` : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{losses.length} {lang === 'ar' ? 'صفقة خاسرة' : lang === 'fr' ? 'perdants' : 'losers'}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── SECOND ROW: Win Rate + Equity ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left: Win Rate + Streak */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{lang === 'ar' ? 'نسبة الربح' : lang === 'fr' ? 'Taux de réussite' : 'Win Rate'}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center pb-4">
              <WinRateDonut wins={wins.length} total={closedTrades.length} lang={lang} />
            </CardContent>
          </Card>
          {/* Streak */}
          <Card className={`border-border bg-card ${streak.count > 0 ? (streak.type === 'win' ? 'border-profit/30' : 'border-loss/30') : ''}`}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold ${streak.type === 'win' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
                {streak.count > 0 ? (streak.type === 'win' ? '🔥' : '❄️') : '—'}
              </div>
              <div>
                <p className={`text-2xl font-bold ${streak.type === 'win' ? 'text-profit' : streak.count > 0 ? 'text-loss' : 'text-muted-foreground'}`}>
                  {streak.count > 0 ? streak.count : 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  {streak.count === 0
                    ? (lang === 'ar' ? 'لا توجد صفقات' : lang === 'fr' ? 'Aucun trade' : 'No trades yet')
                    : streak.type === 'win'
                    ? (lang === 'ar' ? 'صفقة رابحة متتالية' : lang === 'fr' ? 'trades gagnants consécutifs' : 'winning streak')
                    : (lang === 'ar' ? 'صفقة خاسرة متتالية' : lang === 'fr' ? 'trades perdants consécutifs' : 'losing streak')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Equity Curve */}
        <Card className="border-border bg-card lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{lang === 'ar' ? 'منحنى رأس المال' : lang === 'fr' ? "Courbe d'équité" : 'Equity Curve'}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    ${equityCurrent.toFixed(2)}
                  </span>
                  <span className={`font-medium ${equityChange >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {equityChange >= 0 ? '+' : ''}${equityChange.toFixed(2)} ({equityChange >= 0 ? '+' : ''}{equityChangePct}%)
                  </span>
                </div>
              </div>
              {accounts.length > 1 && (
                <Select value={equityAccountId} onValueChange={setEquityAccountId}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{lang === 'ar' ? 'جميع الحسابات' : lang === 'fr' ? 'Tous' : 'All accounts'}</SelectItem>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name ?? acc.login?.toString() ?? acc.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={equityData.points} margin={{ left: 0, right: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225,15%,18%)" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(220,10%,50%)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="hsl(220,10%,50%)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v}`}
                  width={68}
                  domain={equityData.dangerLevel !== null
                    ? [Math.min(equityData.dangerLevel * 0.998, equityData.dangerLevel - 30), 'auto']
                    : ['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', color: '#e2e8f0', fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, lang === 'ar' ? 'الرصيد' : lang === 'fr' ? 'Solde' : 'Balance']}
                />
                {hasLimits && (
                  <ReferenceLine y={equityData.startBalance} stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.5}
                    label={{ value: lang === 'ar' ? 'البداية' : 'Start', position: 'insideTopRight', fill: '#f59e0b', fontSize: 9 }} />
                )}
                {equityData.dangerLevel !== null && (
                  <ReferenceLine y={equityData.dangerLevel} stroke="#ef4444" strokeDasharray="5 4" strokeWidth={1.5}
                    label={{ value: lang === 'ar' ? 'حد السحب' : lang === 'fr' ? 'DD Max' : 'Max DD', position: 'insideBottomRight', fill: '#ef4444', fontSize: 9 }} />
                )}
                <Area type="monotone" dataKey="balance" stroke={lineColor} strokeWidth={2} fill="url(#equityFill)"
                  dot={false} activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
            {equityData.points.length === 1 && (
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {lang === 'ar' ? 'لا توجد صفقات بعد' : lang === 'fr' ? 'Aucun trade pour le moment' : 'No trades yet — flat line at starting balance'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── FOURTH ROW: Connected Accounts (full width, horizontal scroll) ── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('connectedAccounts')}</CardTitle>
            <a href="/connect" className="text-xs text-primary hover:underline">
              {lang === 'ar' ? 'إدارة' : lang === 'fr' ? 'Gérer' : 'Manage'}
            </a>
          </div>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">{t('noAccounts')}</p>
              <a href="/connect">
                <Button size="sm" className="gradient-primary text-primary-foreground">
                  <Plus className="me-2 h-4 w-4" />
                  {lang === 'ar' ? 'إضافة حساب' : lang === 'fr' ? 'Ajouter un compte' : 'Add Account'}
                </Button>
              </a>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-1">
              {accounts.map(acc => (
                <div key={acc.id} className="w-72 shrink-0">
                  <AccountCard acc={acc} lang={lang} compact userId={user?.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── FIFTH ROW: Trading Calendar (full width) ── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {lang === 'ar' ? 'التقويم الشهري' : lang === 'fr' ? 'Calendrier mensuel' : 'Monthly Calendar'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TradingCalendar
            trades={closedTrades} lang={lang}
            accounts={accounts} user={user} onTradeSaved={fetchData}
          />
        </CardContent>
      </Card>

      {/* ── FOURTH ROW: Recent Trades ── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('recentTrades')}</CardTitle>
            <a href="/trades" className="text-xs text-primary hover:underline">
              {lang === 'ar' ? 'عرض الكل' : lang === 'fr' ? 'Voir tout' : 'View all'}
            </a>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentTrades.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {lang === 'ar' ? 'لا توجد صفقات بعد' : lang === 'fr' ? 'Aucun trade pour le moment' : 'No trades yet'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="ps-4 font-semibold">{lang === 'ar' ? 'الرمز' : lang === 'fr' ? 'Symbole' : 'Symbol'}</TableHead>
                    <TableHead className="font-semibold">{lang === 'ar' ? 'الاتجاه' : lang === 'fr' ? 'Direction' : 'Direction'}</TableHead>
                    <TableHead className="font-semibold">{lang === 'ar' ? 'النتيجة' : lang === 'fr' ? 'Résultat' : 'Result'}</TableHead>
                    <TableHead className="font-semibold">{lang === 'ar' ? 'P&L' : 'P&L'}</TableHead>
                    <TableHead className="font-semibold">{lang === 'ar' ? 'الحساب' : lang === 'fr' ? 'Compte' : 'Account'}</TableHead>
                    <TableHead className="pe-4 font-semibold">{lang === 'ar' ? 'التاريخ' : lang === 'fr' ? 'Date' : 'Date'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTrades.map(tr => {
                    const setupTag = tr.setup_tag ?? '';
                    const parts = setupTag.split(',').map(s => s.trim());
                    const result = parts.find(p => ['Win','Loss','Breakeven','Partial Win - TP1','Partial Win - TP2'].includes(p)) ?? null;
                    const pnl = tr.profit ?? 0;
                    return (
                      <TableRow key={tr.id} className="border-border hover:bg-secondary/30">
                        <TableCell className="ps-4 font-bold text-foreground">{tr.symbol}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tr.direction === 'BUY' ? 'border-profit/30 bg-profit/10 text-profit' : 'border-loss/30 bg-loss/10 text-loss'}`}>
                            {tr.direction === 'BUY' ? (lang === 'ar' ? 'شراء' : lang === 'fr' ? 'ACHAT' : 'BUY') : (lang === 'ar' ? 'بيع' : lang === 'fr' ? 'VENTE' : 'SELL')}
                          </span>
                        </TableCell>
                        <TableCell>
                          {result ? (
                            <Badge variant="secondary" className={
                              result === 'Win' ? 'bg-profit/15 text-profit border-profit/20' :
                              result === 'Loss' ? 'bg-loss/15 text-loss border-loss/20' :
                              result === 'Breakeven' ? 'bg-yellow-500/15 text-yellow-400' :
                              'bg-blue-500/15 text-blue-400'
                            }>
                              {result === 'Win' ? (lang === 'ar' ? 'ربح' : result) :
                               result === 'Loss' ? (lang === 'ar' ? 'خسارة' : result) :
                               result === 'Breakeven' ? (lang === 'ar' ? 'تعادل' : result) : result}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className={`font-semibold tabular-nums ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {tr.account_id && accountMap[tr.account_id] ? (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                              {accountMap[tr.account_id].account_name ?? '—'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                              {lang === 'ar' ? 'يدوي' : 'Manual'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="pe-4 whitespace-nowrap text-sm text-muted-foreground">
                          {tr.close_time ? new Date(tr.close_time).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── FLOATING ADD TRADE BUTTON ── */}
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="fixed bottom-6 end-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 gradient-primary text-primary-foreground"
        title={lang === 'ar' ? 'إضافة صفقة' : lang === 'fr' ? 'Ajouter un trade' : 'Add Trade'}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add Trade Modal */}
      <QuickAddTrade
        open={addOpen}
        onClose={() => setAddOpen(false)}
        accounts={accounts}
        lang={lang}
        user={user}
        onSaved={fetchData}
      />
    </div>
  );
};

export default DashboardPage;
