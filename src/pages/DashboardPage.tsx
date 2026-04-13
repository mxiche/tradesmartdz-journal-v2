import { useEffect, useState, useMemo, useRef, useSyncExternalStore } from 'react';
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
  TrendingUp, TrendingDown, Loader2, Plus, ChevronLeft, ChevronRight, Camera, X, Download,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { AccountCard } from '@/pages/ConnectPage';
import { OnboardingModal } from '@/components/OnboardingModal';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
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

// ─── TradeSmartDz Score ───────────────────────────────────────
function TradesmartScore({
  closedTrades, wins, losses, profitFactor, avgWin, avgLoss, lang,
}: {
  closedTrades: Trade[]; wins: Trade[]; losses: Trade[];
  profitFactor: number | null; avgWin: number; avgLoss: number;
  lang: 'ar'|'fr'|'en';
}) {
  const scores = useMemo(() => {
    if (closedTrades.length < 5) return null;

    // 1. Win Rate (0–100)
    const winRateScore = (wins.length / closedTrades.length) * 100;

    // 2. Profit Factor (0–100): PF ≥ 3 → 100
    const pfScore = profitFactor === null ? 100
      : profitFactor === 0 ? 0
      : Math.min((profitFactor / 3) * 100, 100);

    // 3. Consistency: low daily-PnL variance → high score
    const byDay: Record<string, number> = {};
    for (const tr of closedTrades) {
      if (!tr.close_time) continue;
      const k = new Date(tr.close_time).toLocaleDateString('en-CA');
      byDay[k] = (byDay[k] ?? 0) + (tr.profit ?? 0);
    }
    const dailyPnls = Object.values(byDay);
    let consistencyScore = 50;
    if (dailyPnls.length >= 2) {
      const mean = dailyPnls.reduce((s, v) => s + v, 0) / dailyPnls.length;
      const stddev = Math.sqrt(dailyPnls.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyPnls.length);
      const cv = Math.abs(mean) > 0 ? stddev / Math.abs(mean) : stddev;
      consistencyScore = Math.max(0, Math.min(100, 100 - cv * 30));
    }

    // 4. Avg Win/Loss Ratio (0–100): ratio ≥ 2 → 100
    let rrScore = 50;
    if (wins.length > 0 && losses.length === 0) {
      rrScore = 100;
    } else if (wins.length > 0 && losses.length > 0 && avgLoss > 0) {
      rrScore = Math.min((avgWin / avgLoss) * 50, 100);
    }

    // 5. Max Drawdown from equity curve (lower drawdown → higher score)
    const sorted = [...closedTrades].sort((a, b) => new Date(a.close_time!).getTime() - new Date(b.close_time!).getTime());
    let running = 0, peak = 0, maxDd = 0;
    for (const tr of sorted) {
      running += tr.profit ?? 0;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDd) maxDd = dd;
    }
    const maxDdPct = peak > 0 ? (maxDd / peak) * 100 : 0;
    const drawdownScore = Math.max(0, 100 - maxDdPct * 5); // 20% DD → 0

    // 6. Recovery Factor: totalPnL / maxDrawdown × 50, capped at 100
    const totalPnl = closedTrades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
    let recoveryScore = 50;
    if (maxDd > 0) {
      recoveryScore = Math.max(0, Math.min((totalPnl / maxDd) * 50, 100));
    } else if (totalPnl > 0) {
      recoveryScore = 100;
    }

    const dims = [
      Math.round(winRateScore),
      Math.round(pfScore),
      Math.round(consistencyScore),
      Math.round(rrScore),
      Math.round(drawdownScore),
      Math.round(recoveryScore),
    ];
    const total = Math.round((dims.reduce((s, v) => s + v, 0) / dims.length) * 10) / 10;
    return { dims, total };
  }, [closedTrades, wins, losses, profitFactor, avgWin, avgLoss]);

  const axisLabels: Record<'ar'|'fr'|'en', string[]> = {
    ar: ['نسبة الفوز', 'معامل الربح', 'الاتساق', 'R:R', 'الحد الأقصى', 'الاسترداد'],
    fr: ['Win Rate', 'Profit Factor', 'Régularité', 'Ratio R:R', 'Drawdown', 'Récupération'],
    en: ['Win Rate', 'Profit Factor', 'Consistency', 'R:R Ratio', 'Drawdown', 'Recovery'],
  };

  const L = {
    title:    lang === 'ar' ? 'نقاط TradeSmartDz'  : lang === 'fr' ? 'Score TradeSmartDz' : 'TradeSmartDz Score',
    minTrades:lang === 'ar' ? 'أضف 5 صفقات على الأقل لرؤية نقاطك' : lang === 'fr' ? 'Ajoutez au moins 5 trades pour voir votre score' : 'Add at least 5 trades to see your score',
  };

  const interp = (s: number) => s >= 81
    ? { text: lang === 'ar' ? 'ممتاز'      : lang === 'fr' ? 'Excellent'    : 'Excellent',         color: '#22c55e' }
    : s >= 61
    ? { text: lang === 'ar' ? 'جيد'         : lang === 'fr' ? 'Bon'          : 'Good',               color: '#eab308' }
    : s >= 41
    ? { text: lang === 'ar' ? 'متوسط'       : lang === 'fr' ? 'Moyen'        : 'Average',            color: '#f97316' }
    : { text: lang === 'ar' ? 'يحتاج تحسين' : lang === 'fr' ? 'À améliorer' : 'Needs improvement',  color: '#ef4444' };

  if (!scores) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">{L.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="mb-2 text-3xl">📊</p>
            <p className="text-sm text-muted-foreground">{L.minTrades}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { dims, total } = scores;
  const { text: interpText, color: interpColor } = interp(total);
  const labels = axisLabels[lang];
  const radarData = labels.map((label, i) => ({ label, value: dims[i], fullMark: 100 }));

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{L.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* ── Radar chart ── */}
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
                <PolarGrid stroke="hsl(225,15%,22%)" />
                <PolarAngleAxis
                  dataKey="label"
                  tick={{ fill: 'hsl(220,10%,55%)', fontSize: 11, fontWeight: 500 }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value"
                  stroke="#00d4aa"
                  fill="rgba(0,212,170,0.18)"
                  strokeWidth={2}
                  dot={{ fill: '#00d4aa', r: 4, strokeWidth: 0 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Score display ── */}
          <div className="flex flex-col items-center justify-center gap-5">
            {/* Big number */}
            <div className="text-center">
              <p className="text-6xl font-bold leading-none tabular-nums text-[#00d4aa]">
                {total.toFixed(1)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{L.title}</p>
              <p className="mt-1 text-base font-semibold" style={{ color: interpColor }}>
                {interpText}
              </p>
            </div>

            {/* Gradient color bar with marker */}
            <div className="w-full max-w-xs">
              <div
                className="relative h-3 w-full overflow-hidden rounded-full"
                style={{ background: 'linear-gradient(to right, #ef4444 0%, #f97316 30%, #eab308 55%, #22c55e 80%, #16a34a 100%)' }}
              >
                <div
                  className="absolute top-1/2 h-5 w-2 -translate-y-1/2 rounded-full bg-white shadow-lg"
                  style={{ left: `${Math.min(Math.max(total, 0), 100)}%`, transform: 'translate(-50%, -50%)' }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>0</span><span>40</span><span>60</span><span>80</span><span>100</span>
              </div>
            </div>

            {/* Dimension bars */}
            <div className="w-full max-w-xs space-y-2">
              {labels.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-[10px] text-muted-foreground">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/40">
                    <div
                      className="h-full rounded-full bg-[#00d4aa] transition-[width] duration-700"
                      style={{ width: `${dims[i]}%` }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right text-[10px] font-semibold text-foreground">{dims[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── useIsMobile ──────────────────────────────────────────────
function useIsMobile(breakpoint = 640) {
  const mq = useMemo(() => window.matchMedia(`(max-width: ${breakpoint - 1}px)`), [breakpoint]);
  return useSyncExternalStore(
    cb => { mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); },
    () => mq.matches,
    () => false,
  );
}

// ─── Calendar helpers (shared by DashDayCell, DayDetailModal, TradingCalendar) ───
function isoDay(d: Date) { return d.toLocaleDateString('en-CA'); } // YYYY-MM-DD

function fmtPnlCal(val: number): string {
  const abs = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

const CAL_MONTH_NAMES: Record<'ar'|'fr'|'en', string[]> = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  fr: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
};
const CAL_DAY_NAMES: Record<'ar'|'fr'|'en', string[]> = {
  en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  fr: ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'],
  ar: ['أحد','إثن','ثلا','أرب','خمي','جمع','سبت'],
};
// Single-letter initials for mobile (Arabic uses specific root letters)
const CAL_DAY_INITIALS: Record<'ar'|'fr'|'en', string[]> = {
  en: ['S','M','T','W','T','F','S'],
  fr: ['D','L','M','M','J','V','S'],
  ar: ['ح','ن','ث','ر','خ','ج','س'],
};

// ─── DashDayData ─────────────────────────────────────────────
interface DashDayData {
  date: Date;
  pnl: number;
  tradeCount: number;
  wins: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  dayTrades: Trade[];
}

// ─── DashDayCell ─────────────────────────────────────────────
function DashDayCell({ d, lang, onClick }: { d: DashDayData; lang: 'ar'|'fr'|'en'; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const hasTrades = d.tradeCount > 0;
  const wr = d.tradeCount > 0 ? Math.round((d.wins / d.tradeCount) * 100) : 0;

  let bg = '';
  let border = '';
  if (!d.isCurrentMonth) {
    bg = 'bg-transparent opacity-25';
  } else if (hasTrades) {
    bg    = d.pnl >= 0 ? 'bg-[rgba(34,197,94,0.12)]'  : 'bg-[rgba(239,68,68,0.12)]';
    border = d.pnl >= 0 ? 'border-[rgba(34,197,94,0.25)]' : 'border-[rgba(239,68,68,0.25)]';
  } else if (d.isWeekend) {
    bg = 'bg-secondary/20';
  } else {
    bg = 'bg-card';
  }
  if (d.isToday) border = 'border-primary border-2';

  return (
    <div
      className={`relative flex min-h-[65px] sm:min-h-[90px] flex-col overflow-hidden rounded-lg border p-1.5 sm:p-2 transition-all duration-150 select-none
        ${bg} ${border || 'border-border/40'}
        ${d.isCurrentMonth ? 'cursor-pointer hover:border-primary/40 hover:brightness-110' : ''}
      `}
      onClick={() => d.isCurrentMonth && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Day number */}
      <span className={`text-[10px] sm:text-[11px] font-medium leading-none ${d.isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
        {d.date.getDate()}
      </span>

      {/* Trade data */}
      {hasTrades && d.isCurrentMonth && (
        <div className="mt-0.5 sm:mt-1 flex flex-1 flex-col items-center justify-center gap-0.5">
          <span className={`w-full truncate text-center text-[11px] sm:text-base font-bold leading-tight ${d.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {fmtPnlCal(d.pnl)}
          </span>
          <span className="text-[9px] sm:text-[10px] text-muted-foreground">
            {d.tradeCount}
            <span className="hidden sm:inline"> {lang === 'ar' ? 'صفقة' : lang === 'fr' ? (d.tradeCount > 1 ? 'trades' : 'trade') : (d.tradeCount !== 1 ? 'trades' : 'trade')}</span>
          </span>
          {/* Win rate: hidden on mobile */}
          <span className={`hidden sm:inline text-[10px] font-medium ${wr >= 50 ? 'text-[#22c55e]/80' : 'text-[#ef4444]/80'}`}>
            {wr}%
          </span>
        </div>
      )}

      {/* Empty day hover hint */}
      {!hasTrades && d.isCurrentMonth && !d.isWeekend && (
        <div className={`flex flex-1 items-center justify-center transition-opacity duration-150 ${hovered ? 'opacity-50' : 'opacity-0'}`}>
          <span className="text-xl font-thin text-muted-foreground">+</span>
        </div>
      )}

      {/* Hover tooltip (trade days only) */}
      {hovered && hasTrades && d.isCurrentMonth && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-44 -translate-x-1/2 rounded-lg border border-border bg-popover p-2.5 shadow-xl text-xs">
          <p className="mb-1 font-semibold text-foreground">
            {d.date.toLocaleDateString(
              lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
              { weekday: 'short', month: 'short', day: 'numeric' }
            )}
          </p>
          <div className="space-y-0.5 text-muted-foreground">
            <p>P&L: <span className={d.pnl >= 0 ? 'font-semibold text-[#22c55e]' : 'font-semibold text-[#ef4444]'}>{fmtPnlCal(d.pnl)}</span></p>
            <p>{lang === 'ar' ? 'صفقات' : lang === 'fr' ? 'Trades' : 'Trades'}: <span className="text-foreground">{d.tradeCount}</span></p>
            <p>{lang === 'ar' ? 'نسبة الفوز' : lang === 'fr' ? 'Réussite' : 'Win rate'}: <span className="text-foreground">{wr}%</span></p>
            <p>{lang === 'ar' ? 'ربح/خسارة' : 'W/L'}: <span className="text-[#22c55e]">{d.wins}</span> / <span className="text-[#ef4444]">{d.tradeCount - d.wins}</span></p>
          </div>
          <p className="mt-1 text-[9px] text-muted-foreground/50">
            {lang === 'ar' ? 'انقر للتفاصيل' : lang === 'fr' ? 'Cliquer pour détails' : 'Click for details'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Day Detail Modal ─────────────────────────────────────────
function DayDetailModal({
  day, month, year, dayTrades, lang, onClose,
}: {
  day: number; month: number; year: number;
  dayTrades: Trade[]; lang: 'ar'|'fr'|'en'; onClose: () => void;
}) {
  const totalPnl = dayTrades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const wins = dayTrades.filter(tr => (tr.profit ?? 0) > 0).length;
  const losses = dayTrades.filter(tr => (tr.profit ?? 0) < 0).length;
  const winRate = dayTrades.length > 0 ? Math.round((wins / dayTrades.length) * 100) : 0;
  const bestVal = dayTrades.length > 0 ? Math.max(...dayTrades.map(t => t.profit ?? 0)) : 0;
  const worstVal = dayTrades.length > 0 ? Math.min(...dayTrades.map(t => t.profit ?? 0)) : 0;

  const dateStr = new Date(year, month, day).toLocaleDateString(
    lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden"
        style={{ animation: 'calPopIn 0.18s cubic-bezier(0.175,0.885,0.32,1.275)', boxShadow: '0 20px 60px -12px rgba(0,0,0,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 ${
          totalPnl >= 0
            ? 'bg-gradient-to-br from-teal-50 to-green-50'
            : 'bg-gradient-to-br from-red-50 to-orange-50'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-500">{dateStr}</p>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
          <p className={`text-3xl font-black ${totalPnl >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {dayTrades.length} {lang === 'ar' ? 'صفقة' : lang === 'fr' ? 'trades' : 'trades'}
          </p>
        </div>

        <div className="p-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              {
                label: lang === 'ar' ? 'نسبة الفوز' : lang === 'fr' ? 'Win Rate' : 'Win Rate',
                value: `${winRate}%`,
                color: 'text-teal-600',
              },
              {
                label: lang === 'ar' ? 'الفائزة' : lang === 'fr' ? 'Gains' : 'Winners',
                value: wins,
                color: 'text-green-600',
              },
              {
                label: lang === 'ar' ? 'الخاسرة' : lang === 'fr' ? 'Pertes' : 'Losers',
                value: losses,
                color: 'text-red-500',
              },
            ].map((stat, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Best / Worst */}
          {dayTrades.length > 1 && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-green-50 border border-green-100 rounded-2xl p-3">
                <p className="text-xs text-green-600 font-semibold mb-1">
                  {lang === 'ar' ? '🏆 أفضل صفقة' : lang === 'fr' ? '🏆 Meilleur trade' : '🏆 Best Trade'}
                </p>
                <p className="text-sm font-black text-green-700">
                  {bestVal >= 0 ? '+' : ''}${bestVal.toFixed(2)}
                </p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-2xl p-3">
                <p className="text-xs text-red-500 font-semibold mb-1">
                  {lang === 'ar' ? '📉 أسوأ صفقة' : lang === 'fr' ? '📉 Pire trade' : '📉 Worst Trade'}
                </p>
                <p className="text-sm font-black text-red-600">${worstVal.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Trades list */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              {lang === 'ar' ? 'الصفقات' : lang === 'fr' ? 'Trades' : 'Trades'}
            </p>
            {dayTrades.map((tr, i) => {
              const pnl = tr.profit ?? 0;
              return (
                <div key={tr.id ?? i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-800">{tr.symbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      tr.direction === 'BUY'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {tr.direction === 'BUY'
                        ? (lang === 'ar' ? 'شراء' : 'BUY')
                        : (lang === 'ar' ? 'بيع' : 'SELL')}
                    </span>
                  </div>
                  <span className={`text-sm font-black ${pnl >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
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

// ─── Trading Calendar (CalendarPage style + improvements) ────
function TradingCalendar({
  trades, lang, accounts, user, onTradeSaved,
}: {
  trades: Trade[]; lang: 'ar'|'fr'|'en';
  accounts: Account[]; user: any; onTradeSaved: () => void;
}) {
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const { year, month } = calMonth;
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);

  const { grid, weekSummaries, monthStats, visibleWeeks } = useMemo(() => {
    const todayKey = isoDay(new Date());
    const firstOfMonth = new Date(year, month, 1);

    // Group trades by ISO day key
    const byDay: Record<string, { pnl: number; count: number; wins: number; dayTrades: Trade[] }> = {};
    for (const tr of trades) {
      if (!tr.close_time || tr.profit === null) continue;
      const k = isoDay(new Date(tr.close_time));
      if (!byDay[k]) byDay[k] = { pnl: 0, count: 0, wins: 0, dayTrades: [] };
      byDay[k].pnl   += tr.profit;
      byDay[k].count += 1;
      byDay[k].dayTrades.push(tr);
      if (tr.profit > 0) byDay[k].wins += 1;
    }

    // Start grid on Sunday of the week containing the 1st (same as CalendarPage)
    const startDow = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - startDow);

    // 42 cells (6 weeks × 7)
    const cells: DashDayData[] = [];
    const cur = new Date(gridStart);
    for (let i = 0; i < 42; i++) {
      const k = isoDay(cur);
      const data = byDay[k];
      cells.push({
        date: new Date(cur),
        pnl:          data?.pnl ?? 0,
        tradeCount:   data?.count ?? 0,
        wins:         data?.wins ?? 0,
        isCurrentMonth: cur.getMonth() === month && cur.getFullYear() === year,
        isToday:      k === todayKey,
        isWeekend:    cur.getDay() === 0 || cur.getDay() === 6,
        dayTrades:    data?.dayTrades ?? [],
      });
      cur.setDate(cur.getDate() + 1);
    }

    // Week summaries
    const weekSummaries = Array.from({ length: 6 }, (_, w) => {
      const wk = cells.slice(w * 7, w * 7 + 7);
      const active = wk.filter(d => d.tradeCount > 0 && d.isCurrentMonth);
      return {
        weekNum: w + 1,
        pnl: active.reduce((s, d) => s + d.pnl, 0),
        tradingDays: active.length,
        hasData: active.length > 0,
      };
    });

    // Monthly stats
    const monthCells = cells.filter(d => d.isCurrentMonth && d.tradeCount > 0);
    const totalPnl    = monthCells.reduce((s, d) => s + d.pnl, 0);
    const tradingDays = monthCells.length;
    const profitDays  = monthCells.filter(d => d.pnl > 0).length;
    const totalTrades = monthCells.reduce((s, d) => s + d.tradeCount, 0);
    const totalWins   = monthCells.reduce((s, d) => s + d.wins, 0);
    const winRate     = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;
    const bestDay     = monthCells.length > 0 ? monthCells.reduce((b, d) => d.pnl > b.pnl ? d : b, monthCells[0]) : null;
    const worstDay    = monthCells.length > 0 ? monthCells.reduce((b, d) => d.pnl < b.pnl ? d : b, monthCells[0]) : null;

    // Trim trailing empty weeks (same as CalendarPage)
    let last = 5;
    while (last > 0 && weekSummaries[last].tradingDays === 0 && cells.slice(last * 7, last * 7 + 7).every(d => !d.isCurrentMonth)) last--;
    const visibleWeeks = last + 1;

    return { grid: cells, weekSummaries, monthStats: { totalPnl, tradingDays, profitDays, winRate, totalTrades, bestDay, worstDay }, visibleWeeks };
  }, [trades, year, month]);

  // Current week index
  const todayWeekIdx = useMemo(() => {
    if (!isCurrentMonth) return -1;
    return weekSummaries.findIndex((_, w) => grid.slice(w * 7, w * 7 + 7).some(d => d.isToday));
  }, [grid, weekSummaries, isCurrentMonth]);

  // Max abs week PnL for the bar
  const maxAbsWeekPnl = Math.max(...weekSummaries.slice(0, visibleWeeks).map(w => Math.abs(w.pnl)), 1);

  const isMobile = useIsMobile();

  const prevMonth = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  const goToday   = () => { const n = new Date(); setCalMonth({ year: n.getFullYear(), month: n.getMonth() }); };

  const calGridRef = useRef<HTMLDivElement>(null);
  const handleExportCalendar = async () => {
    const monthName = CAL_MONTH_NAMES[lang][month];
    const dayNames = CAL_DAY_NAMES[lang];
    const userName = ((user?.user_metadata?.full_name as string | undefined)?.trim()) || user?.email?.split('@')[0] || 'Trader';

    // Build the visible grid (only current month + its surrounding week slots)
    const visibleCells = grid.slice(0, visibleWeeks * 7);

    // ── Build hardcoded-style HTML for reliable html2canvas capture ──
    const cellStyle = (d: DashDayData): string => {
      if (!d.isCurrentMonth) return 'background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;min-height:80px;opacity:0.4;';
      if (d.tradeCount > 0 && d.pnl >= 0) return 'background-color:#f0fdf9;border:1px solid #99f6e4;border-radius:6px;padding:8px;min-height:80px;text-align:center;';
      if (d.tradeCount > 0 && d.pnl < 0)  return 'background-color:#fff1f2;border:1px solid #fecaca;border-radius:6px;padding:8px;min-height:80px;text-align:center;';
      if (d.isWeekend) return 'background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:8px;min-height:80px;';
      return 'background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;min-height:80px;';
    };

    const cellInner = (d: DashDayData): string => {
      if (!d.isCurrentMonth) return `<span style="color:#cbd5e1;font-size:11px;">${d.date.getDate()}</span>`;
      const pnlColor = d.pnl >= 0 ? '#0d9488' : '#dc2626';
      const dayNum = `<div style="color:#94a3b8;font-size:11px;margin-bottom:4px;">${d.date.getDate()}</div>`;
      if (d.tradeCount === 0) return dayNum;
      const pnlStr = (d.pnl >= 0 ? '+' : '') + '$' + Math.abs(d.pnl).toFixed(2);
      const wr = Math.round((d.wins / d.tradeCount) * 100);
      return `${dayNum}
        <div style="color:${pnlColor};font-size:13px;font-weight:bold;line-height:1.2;">${pnlStr}</div>
        <div style="color:#64748b;font-size:10px;margin-top:3px;">${d.tradeCount} ${lang === 'ar' ? 'صفقة' : lang === 'fr' ? 'trades' : 'trades'}</div>
        <div style="color:${wr >= 50 ? '#0d9488' : '#dc2626'};font-size:10px;">${wr}%</div>`;
    };

    const headerRow = dayNames
      .map(n => `<div style="color:#94a3b8;font-size:12px;text-align:center;padding:6px 4px;font-weight:600;">${n}</div>`)
      .join('');

    const rows = Array.from({ length: visibleWeeks }, (_, w) =>
      `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;">
        ${visibleCells.slice(w * 7, w * 7 + 7).map(d =>
          `<div style="${cellStyle(d)}">${cellInner(d)}</div>`
        ).join('')}
      </div>`
    ).join('');

    const html = `
      <div style="background-color:#ffffff;padding:24px;font-family:Arial,sans-serif;width:800px;border-radius:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <span style="font-size:18px;font-weight:900;color:#0f172a;">TradeSmart<span style="color:#14b8a6;">Dz</span></span>
          <span style="font-size:18px;font-weight:700;color:#0f172a;">${monthName} ${year}</span>
          <span style="font-size:12px;color:#94a3b8;">neuroport.xyz</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;">${headerRow}</div>
        ${rows}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;margin-top:16px;border-radius:0 0 8px 8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:16px;font-weight:900;color:#14b8a6;">TradeSmartDz</span>
          </div>
          <div style="text-align:center;">
            <span style="font-size:14px;font-weight:700;color:#0f172a;">${monthName} ${year}</span>
          </div>
          <div style="text-align:right;">
            <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#0f172a;">${userName}</p>
            <p style="margin:0;font-size:11px;color:#64748b;">neuroport.xyz</p>
          </div>
        </div>
      </div>`;

    // Inject hidden element, capture, remove
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const el = wrapper.firstElementChild as HTMLElement;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    document.body.appendChild(el);

    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `tradesmartdz-calendar-${monthName.toLowerCase().replace(/\s+/g, '-')}-${year}.png`;
      a.click();
    } finally {
      document.body.removeChild(el);
    }
  };

  const pad2 = (n: number) => String(n).padStart(2, '0');

  const selectedDayData = selectedDay !== null
    ? grid.find(d => d.isCurrentMonth && d.date.getDate() === selectedDay)
    : null;

  // ── Mobile weekly view state ──────────────────────────────────
  const [mobileWeekStart, setMobileWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // Sunday of current week
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [mobileShowFullMonth, setMobileShowFullMonth] = useState(false);

  const mobileLocale = lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US';

  // 7-day cells for the current week view
  const mobileWeekCells = useMemo(() => {
    const todayKey = isoDay(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mobileWeekStart);
      d.setDate(mobileWeekStart.getDate() + i);
      const key = isoDay(d);
      const found = grid.find(g => isoDay(g.date) === key);
      return found ?? {
        date: d, pnl: 0, tradeCount: 0, wins: 0,
        isCurrentMonth: d.getMonth() === month && d.getFullYear() === year,
        isToday: key === todayKey,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        dayTrades: [],
      } as DashDayData;
    });
  }, [mobileWeekStart, grid, month, year]);

  const prevWeek = () => setMobileWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setMobileWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

  const mobileWeekEnd = useMemo(() => { const d = new Date(mobileWeekStart); d.setDate(d.getDate() + 6); return d; }, [mobileWeekStart]);

  const mobileWeekLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString(mobileLocale, { day: 'numeric', month: 'short' });
    return `${fmt(mobileWeekStart)} – ${fmt(mobileWeekEnd)}`;
  }, [mobileWeekStart, mobileWeekEnd, mobileLocale]);

  // Monthly trade days for full-month list view
  const mobileMonthTradeDays = useMemo(() =>
    grid.filter(d => d.isCurrentMonth && d.tradeCount > 0).sort((a, b) => b.date.getTime() - a.date.getTime()),
  [grid]);

  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Monthly stats bar */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <div className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground">{lang === 'ar' ? 'P&L الشهر' : lang === 'fr' ? 'P&L mois' : 'Month P&L'}</span>
            <span className={`text-sm font-bold ${monthStats.totalPnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {monthStats.totalTrades === 0 ? '—' : fmtPnlCal(monthStats.totalPnl)}
            </span>
          </div>
          <div className="h-7 w-px bg-border" />
          <div className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground">{lang === 'ar' ? 'أيام' : lang === 'fr' ? 'Jours' : 'Days'}</span>
            <span className="text-sm font-bold text-foreground">{monthStats.tradingDays}</span>
          </div>
          <div className="h-7 w-px bg-border" />
          <div className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground">{lang === 'ar' ? 'فوز' : lang === 'fr' ? 'Win' : 'Win'}</span>
            <span className={`text-sm font-bold ${monthStats.winRate >= 50 ? 'text-[#22c55e]' : monthStats.totalTrades === 0 ? 'text-foreground' : 'text-[#ef4444]'}`}>
              {monthStats.totalTrades === 0 ? '—' : `${monthStats.winRate}%`}
            </span>
          </div>
          <div className="h-7 w-px bg-border" />
          {/* Export icon */}
          <button
            onClick={handleExportCalendar}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground active:opacity-70"
            title={lang === 'ar' ? 'تصدير' : lang === 'fr' ? 'Exporter' : 'Export PNG'}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>

        {!mobileShowFullMonth ? (
          <>
            {/* Week navigation */}
            <div className="flex items-center justify-between gap-2">
              <button onClick={prevWeek} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium text-muted-foreground">{mobileWeekLabel}</span>
              <button onClick={nextWeek} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekly 7-column grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Day initials header */}
              {CAL_DAY_INITIALS[lang].map((init, i) => (
                <div key={i} className={`py-1 text-center text-[10px] font-semibold ${i === 0 || i === 6 ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                  {init}
                </div>
              ))}
              {/* Day cells */}
              {mobileWeekCells.map((d, i) => {
                const hasTrades = d.tradeCount > 0;
                const wr = hasTrades ? Math.round((d.wins / d.tradeCount) * 100) : 0;
                let bg = 'bg-card';
                let border = 'border-border/40';
                if (!d.isCurrentMonth) { bg = 'bg-transparent opacity-30'; }
                else if (hasTrades && d.pnl >= 0) { bg = 'bg-[rgba(34,197,94,0.12)]'; border = 'border-[rgba(34,197,94,0.3)]'; }
                else if (hasTrades && d.pnl < 0)  { bg = 'bg-[rgba(239,68,68,0.12)]';  border = 'border-[rgba(239,68,68,0.3)]'; }
                else if (d.isWeekend) { bg = 'bg-secondary/20'; }
                if (d.isToday) border = 'border-primary border-2';
                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (!d.isCurrentMonth) return;
                      if (hasTrades) setSelectedDay(d.date.getDate());
                      else setQuickAddDate(`${d.date.getFullYear()}-${pad2(d.date.getMonth()+1)}-${pad2(d.date.getDate())}`);
                    }}
                    className={`flex min-h-[80px] flex-col overflow-hidden rounded-lg border p-1 cursor-pointer select-none ${bg} ${border}`}
                  >
                    <span className={`text-[10px] font-medium leading-none ${d.isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                      {d.date.getDate()}
                    </span>
                    {hasTrades && d.isCurrentMonth && (
                      <div className="mt-0.5 flex flex-1 flex-col items-center justify-center gap-0.5">
                        <span className={`w-full truncate text-center text-[11px] font-bold leading-tight ${d.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          {fmtPnlCal(d.pnl)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{d.tradeCount}t</span>
                        <span className={`text-[9px] font-medium ${wr >= 50 ? 'text-[#22c55e]/70' : 'text-[#ef4444]/70'}`}>{wr}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* View Full Month button */}
            <button
              onClick={() => setMobileShowFullMonth(true)}
              className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {lang === 'ar' ? 'عرض الشهر كاملاً' : lang === 'fr' ? 'Voir le mois complet' : 'View Full Month'}
            </button>
          </>
        ) : (
          <>
            {/* Full month navigation */}
            <div className="flex items-center justify-between gap-2">
              <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-bold text-foreground">{CAL_MONTH_NAMES[lang][month]} {year}</span>
              <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Full month day headers */}
            <div className="grid grid-cols-7 gap-0.5">
              {CAL_DAY_INITIALS[lang].map((init, i) => (
                <div key={i} className={`py-1 text-center text-[10px] font-semibold ${i===0||i===6?'text-muted-foreground/40':'text-muted-foreground'}`}>{init}</div>
              ))}
              {grid.slice(0, visibleWeeks * 7).map((d, i) => {
                const hasTrades = d.tradeCount > 0;
                const wr = hasTrades ? Math.round((d.wins / d.tradeCount) * 100) : 0;
                let bg = 'bg-card'; let border = 'border-border/40';
                if (!d.isCurrentMonth) { bg = 'bg-transparent opacity-25'; }
                else if (hasTrades && d.pnl >= 0) { bg = 'bg-[rgba(34,197,94,0.12)]'; border = 'border-[rgba(34,197,94,0.25)]'; }
                else if (hasTrades && d.pnl < 0)  { bg = 'bg-[rgba(239,68,68,0.12)]';  border = 'border-[rgba(239,68,68,0.25)]'; }
                else if (d.isWeekend) { bg = 'bg-secondary/20'; }
                if (d.isToday) border = 'border-primary border-2';
                return (
                  <div key={i}
                    onClick={() => { if (!d.isCurrentMonth) return; if (hasTrades) setSelectedDay(d.date.getDate()); else setQuickAddDate(`${year}-${pad2(month+1)}-${pad2(d.date.getDate())}`); }}
                    className={`flex min-h-[65px] flex-col overflow-hidden rounded-lg border p-1 cursor-pointer select-none ${bg} ${border}`}
                  >
                    <span className={`text-[10px] leading-none ${d.isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{d.date.getDate()}</span>
                    {hasTrades && d.isCurrentMonth && (
                      <div className="mt-0.5 flex flex-1 flex-col items-center justify-center">
                        <span className={`w-full truncate text-center text-[11px] font-bold ${d.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{fmtPnlCal(d.pnl)}</span>
                        <span className={`text-[9px] ${wr >= 50 ? 'text-[#22c55e]/70' : 'text-[#ef4444]/70'}`}>{wr}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setMobileShowFullMonth(false)}
              className="w-full rounded-xl border border-border bg-card py-2.5 text-xs font-medium text-muted-foreground"
            >
              {lang === 'ar' ? 'عرض الأسبوع' : lang === 'fr' ? 'Vue semaine' : 'Week View'}
            </button>
          </>
        )}

        {/* Day detail modal */}
        {selectedDay !== null && selectedDayData && selectedDayData.dayTrades.length > 0 && (
          <DayDetailModal day={selectedDay} month={month} year={year} dayTrades={selectedDayData.dayTrades} lang={lang} onClose={() => setSelectedDay(null)} />
        )}
        {quickAddDate !== null && (
          <QuickAddTrade open onClose={() => setQuickAddDate(null)} accounts={accounts} lang={lang} user={user} onSaved={() => { setQuickAddDate(null); onTradeSaved(); }} initialDate={quickAddDate} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header: nav + monthly stats pills ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="min-w-[110px] sm:min-w-[170px] text-center text-base sm:text-xl font-bold text-foreground">
            {CAL_MONTH_NAMES[lang][month]} {year}
          </h2>
          <button onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs">
              {lang === 'ar' ? 'هذا الشهر' : lang === 'fr' ? 'Ce mois' : 'This month'}
            </Button>
          )}
        </div>

        {/* Stats pills + Export button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <span className="text-xs text-muted-foreground">{lang === 'ar' ? 'P&L الشهري' : lang === 'fr' ? 'P&L mensuel' : 'Monthly P&L'}</span>
            <span className={`text-sm font-bold ${monthStats.totalPnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {monthStats.totalTrades === 0 ? '—' : fmtPnlCal(monthStats.totalPnl)}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <span className="text-xs text-muted-foreground">{lang === 'ar' ? 'أيام التداول' : lang === 'fr' ? 'Jours' : 'Trading Days'}</span>
            <span className="text-sm font-bold text-foreground">{monthStats.tradingDays}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <span className="text-xs text-muted-foreground">{lang === 'ar' ? 'نسبة الفوز' : lang === 'fr' ? 'Réussite' : 'Win Rate'}</span>
            <span className={`text-sm font-bold ${monthStats.winRate >= 50 ? 'text-[#22c55e]' : monthStats.totalTrades === 0 ? 'text-foreground' : 'text-[#ef4444]'}`}>
              {monthStats.totalTrades === 0 ? '—' : `${monthStats.winRate}%`}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
            <span className="text-xs text-muted-foreground">{lang === 'ar' ? 'ربح/خسارة' : lang === 'fr' ? 'G/P' : 'W/L days'}</span>
            <span className="text-sm font-bold text-[#22c55e]">{monthStats.profitDays}</span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm font-bold text-[#ef4444]">{monthStats.tradingDays - monthStats.profitDays}</span>
          </div>
          {monthStats.bestDay && monthStats.bestDay.pnl > 0 && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-3 py-1.5">
              <span className="text-xs text-muted-foreground">{lang === 'ar' ? 'أفضل' : lang === 'fr' ? 'Meilleur' : 'Best'}</span>
              <span className="text-sm font-bold text-[#22c55e]">{fmtPnlCal(monthStats.bestDay.pnl)}</span>
            </div>
          )}
          {monthStats.worstDay && monthStats.worstDay.pnl < 0 && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3 py-1.5">
              <span className="text-xs text-muted-foreground">{lang === 'ar' ? 'أسوأ' : lang === 'fr' ? 'Pire' : 'Worst'}</span>
              <span className="text-sm font-bold text-[#ef4444]">{fmtPnlCal(monthStats.worstDay.pnl)}</span>
            </div>
          )}
          <button
            onClick={handleExportCalendar}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={lang === 'ar' ? 'تصدير كصورة' : lang === 'fr' ? 'Exporter en image' : 'Export as image'}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'تصدير' : lang === 'fr' ? 'Exporter' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* ── Calendar grid + weekly sidebar ── */}
      <div className="flex gap-3">
        {/* Main grid */}
        <div className="min-w-0 flex-1">
          {/* Day name headers */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {CAL_DAY_NAMES[lang].map((name, i) => (
              <div key={i} className={`py-1.5 text-center text-xs font-semibold ${i === 0 || i === 6 ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                <span className="hidden sm:inline">{name}</span>
                <span className="sm:hidden">{CAL_DAY_INITIALS[lang][i]}</span>
              </div>
            ))}
          </div>
          {/* Grid rows */}
          <div ref={calGridRef} className="space-y-1">
            {Array.from({ length: visibleWeeks }, (_, w) => (
              <div key={w} className="grid grid-cols-7 gap-1">
                {grid.slice(w * 7, w * 7 + 7).map((d, i) => (
                  <DashDayCell
                    key={i} d={d} lang={lang}
                    onClick={() => {
                      if (!d.isCurrentMonth) return;
                      if (d.tradeCount > 0) {
                        setSelectedDay(d.date.getDate());
                      } else {
                        setQuickAddDate(`${year}-${pad2(month + 1)}-${pad2(d.date.getDate())}`);
                      }
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Weekly sidebar */}
        <div className="hidden w-32 shrink-0 xl:flex xl:flex-col">
          <div className="mb-1 py-1.5" />{/* Spacer aligns with day-name row */}
          <div className="space-y-1">
            {Array.from({ length: visibleWeeks }, (_, w) => {
              const wk = weekSummaries[w];
              const isCurWeek = w === todayWeekIdx;
              const barPct = maxAbsWeekPnl > 0 ? Math.abs(wk.pnl) / maxAbsWeekPnl : 0;
              return (
                <div key={w} className={`flex min-h-[90px] flex-col justify-center gap-1.5 rounded-lg border px-3 py-2 ${isCurWeek ? 'border-primary/30 bg-primary/5' : 'border-border/30 bg-secondary/20'}`}>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${isCurWeek ? 'text-primary' : 'text-muted-foreground'}`}>
                    {lang === 'ar' ? `أسبوع ${wk.weekNum}` : lang === 'fr' ? `Sem. ${wk.weekNum}` : `Week ${wk.weekNum}`}
                  </span>
                  {wk.hasData ? (
                    <>
                      <span className={`text-sm font-bold leading-tight ${wk.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {fmtPnlCal(wk.pnl)}
                      </span>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-border/40">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${wk.pnl >= 0 ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
                          style={{ width: `${barPct * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {wk.tradingDays} {lang === 'ar' ? 'يوم' : lang === 'fr' ? 'j.' : 'd.'}
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

      {/* Day detail modal */}
      {selectedDay !== null && selectedDayData && selectedDayData.dayTrades.length > 0 && (
        <DayDetailModal
          day={selectedDay} month={month} year={year}
          dayTrades={selectedDayData.dayTrades} lang={lang}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* Quick add trade (empty day click) */}
      {quickAddDate !== null && (
        <QuickAddTrade
          open
          onClose={() => setQuickAddDate(null)}
          accounts={accounts} lang={lang} user={user}
          onSaved={() => { setQuickAddDate(null); onTradeSaved(); }}
          initialDate={quickAddDate}
        />
      )}
    </div>
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
      if (localStorage.getItem(`onboarding_completed_${user.id}`)) return;
      const { data: prefs } = await supabase.from('user_preferences').select('onboarding_completed').eq('user_id', user.id).maybeSingle();
      if (prefs?.onboarding_completed) {
        localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
        return;
      }
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
  const accountSize     = selectedEquityAccount?.account_size ?? selectedEquityAccount?.starting_balance ?? 0;
  const ddLimit         = selectedEquityAccount?.max_drawdown_limit ?? 0;
  const dailyLossLimit  = selectedEquityAccount?.daily_loss_limit   ?? 0;

  const equityData = useMemo(() => {
    const isAll = equityAccountId === 'all';
    const startBalance = isAll
      ? accounts.reduce((s, a) => s + (a.starting_balance ?? a.balance ?? 0), 0)
      : (selectedEquityAccount?.starting_balance ?? selectedEquityAccount?.balance ?? 0);
    const rel = isAll
      ? trades.filter(tr => tr.profit !== null)
      : trades.filter(tr => tr.profit !== null && tr.account_id === equityAccountId);
    const sorted = [...rel].sort((a, b) => new Date(a.close_time!).getTime() - new Date(b.close_time!).getTime());

    // Limit levels — shown whenever account has limits configured
    const dangerLevel    = accountSize > 0 && ddLimit > 0        ? +(startBalance - (accountSize * ddLimit / 100)).toFixed(2)        : null;
    const dailyLossLevel = accountSize > 0 && dailyLossLimit > 0 ? +(startBalance - (accountSize * dailyLossLimit / 100)).toFixed(2) : null;

    if (sorted.length === 0) {
      return { points: [{ date: lang === 'ar' ? 'الآن' : 'Now', balance: +startBalance.toFixed(2) }], startBalance, dangerLevel, dailyLossLevel };
    }

    // Group by day — one data point per trading day (not per trade)
    const byDay = new Map<string, number>();
    for (const tr of sorted) {
      const day = new Date(tr.close_time!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      byDay.set(day, (byDay.get(day) ?? 0) + (tr.profit ?? 0));
    }
    let running = startBalance;
    const pts = Array.from(byDay.entries()).map(([date, dailyPnl]) => {
      running += dailyPnl;
      return { date, balance: +running.toFixed(2) };
    });
    return { points: [{ date: '', balance: +startBalance.toFixed(2) }, ...pts], startBalance, dangerLevel, dailyLossLevel };
  }, [equityAccountId, selectedEquityAccount, accounts, trades, accountSize, ddLimit, dailyLossLimit, lang]);

  const equityCurrent = equityData.points[equityData.points.length - 1]?.balance ?? 0;
  const equityChange = equityCurrent - equityData.startBalance;
  const equityChangePct = equityData.startBalance > 0 ? ((equityChange / equityData.startBalance) * 100).toFixed(2) : '0.00';
  // Teal when at or above start balance, red when below
  const lineColor = equityCurrent >= equityData.startBalance ? '#00d4aa' : '#ef4444';

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

      {/* ── SCORE CARD ── */}
      <TradesmartScore
        closedTrades={closedTrades} wins={wins} losses={losses}
        profitFactor={typeof profitFactor === 'number' ? profitFactor : 0}
        avgWin={avgWin} avgLoss={avgLoss} lang={lang}
      />

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
                  domain={(() => {
                    const levels = [equityData.dangerLevel, equityData.dailyLossLevel].filter(l => l !== null) as number[];
                    if (levels.length === 0) return ['auto', 'auto'] as ['auto','auto'];
                    const minLvl = Math.min(...levels);
                    return [Math.min(minLvl * 0.998, minLvl - 30), 'auto'] as [number, 'auto'];
                  })()}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', color: '#e2e8f0', fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, lang === 'ar' ? 'الرصيد' : lang === 'fr' ? 'Solde' : 'Balance']}
                />
                {/* Start balance reference — shown when there are limit levels to compare against */}
                {(equityData.dangerLevel !== null || equityData.dailyLossLevel !== null) && (
                  <ReferenceLine y={equityData.startBalance} stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.5}
                    label={{ value: lang === 'ar' ? 'البداية' : 'Start', position: 'insideTopRight', fill: '#f59e0b', fontSize: 9 }} />
                )}
                {/* Max drawdown — always RED */}
                {equityData.dangerLevel !== null && (
                  <ReferenceLine y={equityData.dangerLevel} stroke="#ef4444" strokeDasharray="5 4" strokeWidth={1.5}
                    label={{ value: lang === 'ar' ? 'حد السحب' : lang === 'fr' ? 'DD Max' : 'Max DD', position: 'insideBottomRight', fill: '#ef4444', fontSize: 9 }} />
                )}
                {/* Daily loss limit — always ORANGE */}
                {equityData.dailyLossLevel !== null && (
                  <ReferenceLine y={equityData.dailyLossLevel} stroke="#f97316" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: lang === 'ar' ? 'خسارة يومية' : lang === 'fr' ? 'Perte/jour' : 'Daily Loss', position: 'insideBottomLeft', fill: '#f97316', fontSize: 9 }} />
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
