import { useEffect, useState, useMemo, useRef, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  TrendingUp, TrendingDown, Loader2, Plus, ChevronLeft, ChevronRight, Camera, X, Download,
  Lightbulb, Target, Shield, AlertTriangle, CalendarDays, BarChart2,
  Send, CheckCircle2, Bell, BellOff,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { t } from '@/lib/i18n';
import { AccountCard } from '@/pages/ConnectPage';
import { OnboardingModal } from '@/components/OnboardingModal';
import { toast } from 'sonner';
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine, ReferenceArea,
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
  closedTrades, wins, losses, profitFactor, avgWin, avgLoss, lang, tradesCount,
}: {
  closedTrades: Trade[]; wins: Trade[]; losses: Trade[];
  profitFactor: number | null; avgWin: number; avgLoss: number;
  lang: 'ar'|'fr'|'en'; tradesCount: number;
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
      byDay[k] = (byDay[k] ?? 0) + ((tr.profit ?? 0) - ((tr as any).commission ?? 0));
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
      running += (tr.profit ?? 0) - ((tr as any).commission ?? 0);
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDd) maxDd = dd;
    }
    const maxDdPct = peak > 0 ? (maxDd / peak) * 100 : 0;
    const drawdownScore = Math.max(0, 100 - maxDdPct * 5); // 20% DD → 0

    // 6. Recovery Factor: totalPnL / maxDrawdown × 50, capped at 100
    const totalPnl = closedTrades.reduce((s, tr) => s + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), 0);
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
    const needed = Math.max(0, 5 - tradesCount);
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">{L.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <BarChart2 className="h-7 w-7 text-primary/60" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-xs">{L.minTrades}</p>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full transition-colors ${i < tradesCount ? 'bg-primary' : 'bg-border'}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {tradesCount}/5 {lang === 'ar' ? 'صفقات' : lang === 'fr' ? 'trades' : 'trades'}
            {needed > 0 && ` — ${needed} ${lang === 'ar' ? 'متبقية' : lang === 'fr' ? 'restants' : 'to go'}`}
          </p>
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
  if (abs >= 10000) return `${sign}${(abs / 1000).toFixed(1)}K`;
  if (abs >= 1000)  return `${sign}${(abs / 1000).toFixed(2)}K`;
  return `${sign}${abs.toFixed(0)}`;
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
      className={`relative flex min-h-[72px] md:min-h-[80px] flex-col overflow-hidden rounded-lg border p-1.5 sm:p-2 transition-all duration-150 select-none
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
          <span className={`w-full text-center text-xs font-bold leading-tight ${d.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
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
  const totalPnl = dayTrades.reduce((s, tr) => s + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), 0);
  const wins = dayTrades.filter(tr => ((tr.profit ?? 0) - ((tr as any).commission ?? 0)) > 0).length;
  const losses = dayTrades.filter(tr => ((tr.profit ?? 0) - ((tr as any).commission ?? 0)) < 0).length;
  const winRate = dayTrades.length > 0 ? Math.round((wins / dayTrades.length) * 100) : 0;
  const bestVal = dayTrades.length > 0 ? Math.max(...dayTrades.map(t => (t.profit ?? 0) - ((t as any).commission ?? 0))) : 0;
  const worstVal = dayTrades.length > 0 ? Math.min(...dayTrades.map(t => (t.profit ?? 0) - ((t as any).commission ?? 0))) : 0;

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
              const pnl = (tr.profit ?? 0) - ((tr as any).commission ?? 0);
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
      const netPnl = (tr.profit ?? 0) - ((tr as any).commission ?? 0);
      byDay[k].pnl   += netPnl;
      byDay[k].count += 1;
      byDay[k].dayTrades.push(tr);
      if (netPnl > 0) byDay[k].wins += 1;
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
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const calExportTitle = t('cal_export_title', lang);

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
        <div style="color:#64748b;font-size:10px;margin-top:3px;">${d.tradeCount} ${t('cal_trades', lang)}</div>
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
      <div style="direction:${dir};background-color:#ffffff;padding:24px;font-family:Arial,sans-serif;width:800px;border-radius:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <span style="font-size:18px;font-weight:900;color:#0f172a;">TradeSmart<span style="color:#14b8a6;">Dz</span></span>
          <span style="font-size:16px;font-weight:700;color:#0f172a;">${calExportTitle} — ${monthName} ${year}</span>
          <span style="font-size:12px;color:#94a3b8;">tradesmartdz.com</span>
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
          <div style="text-align:${dir === 'rtl' ? 'left' : 'right'};">
            <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#0f172a;">${userName}</p>
            <p style="margin:0;font-size:11px;color:#64748b;">tradesmartdz.com</p>
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
  const [mobileShowFullMonth, setMobileShowFullMonth] = useState(true);

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
              <div key={i} className={`py-1.5 text-center font-semibold overflow-hidden ${i === 0 || i === 6 ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                <span className="block truncate text-[9px] sm:text-xs">{name}</span>
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
  const { user, userPlan, userStatus } = useAuth();
  const navigate = useNavigate();
  const isPro = userPlan === 'pro' || userStatus === 'trial';

  const [trades, setTrades]     = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [addOpen, setAddOpen]   = useState(false);
  const [insightIndex, setInsightIndex] = useState(0);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [weeklyGoal, setWeeklyGoal] = useState(0);
  const [weeklyGoalActive, setWeeklyGoalActive] = useState(false);
  const [showDeleteGoalConfirm, setShowDeleteGoalConfirm] = useState(false);
  // Filters
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');

  // Equity chart account selector
  const [equityAccountId, setEquityAccountId] = useState<string>('all');

  // Telegram onboarding
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [tgPolling, setTgPolling] = useState(false);
  const [tgConnected, setTgConnected] = useState(false);
  const [showTgBanner, setShowTgBanner] = useState(false);
  const [tgBannerHidden, setTgBannerHidden] = useState(false);
  const tgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getDrawdownFloors = (
    account: any,
    currentBalance: number,
    sortedTrades: any[]
  ): { maxLossFloor: number | null; dailyFloor: number | null; highWaterMark: number; isLocked: boolean; drawdownType: string; dailyLossDollars: number; todayLoss: number; startOfDayBalance: number } => {
    if (!account) return { maxLossFloor: null, dailyFloor: null, highWaterMark: currentBalance, isLocked: false, drawdownType: 'static', dailyLossDollars: 0, todayLoss: 0, startOfDayBalance: currentBalance };

    const isFutures = account.account_category === 'futures';
    const startBal: number = account.starting_balance ?? account.account_size ?? 0;
    const drawdownType: string = account.drawdown_type ?? 'static';

    const maxLossDollars: number = isFutures
      ? (account.max_loss_limit_dollars ?? 0)
      : ((account.account_size ?? 0) * ((account.max_drawdown_limit ?? 0) / 100));

    // Daily floor is based on start-of-day balance (flat for the whole day)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayNetPnl = sortedTrades
      .filter(t => t.close_time && new Date(t.close_time) >= todayStart)
      .reduce((sum, t) => sum + ((t.profit ?? 0) - ((t as any).commission ?? 0)), 0);
    const startOfDayBalance = currentBalance - todayNetPnl;
    const todayLoss = todayNetPnl < 0 ? Math.abs(todayNetPnl) : 0;

    // Daily limit: forex uses % of start-of-day balance; futures uses fixed $
    const dailyLossDollars: number = isFutures
      ? ((account as any).daily_loss_limit_dollars ?? 0)
      : (startOfDayBalance * ((account.daily_loss_limit ?? 0) / 100));

    const dailyFloor = dailyLossDollars > 0 ? +(startOfDayBalance - dailyLossDollars).toFixed(2) : null;

    if (drawdownType === 'static') {
      return {
        maxLossFloor: maxLossDollars > 0 ? startBal - maxLossDollars : null,
        dailyFloor,
        highWaterMark: currentBalance,
        isLocked: false,
        drawdownType,
        dailyLossDollars,
        todayLoss,
        startOfDayBalance,
      };
    }

    // EOD trailing / intraday trailing
    let runningBalance = startBal;
    let highWaterMark = startBal;
    for (const trade of sortedTrades) {
      const netPnl = (trade.profit ?? 0) - ((trade as any).commission ?? 0);
      runningBalance += netPnl;
      if (runningBalance > highWaterMark) highWaterMark = runningBalance;
    }
    highWaterMark = Math.max(highWaterMark, currentBalance);

    // Floor locks at startBal once account has earned back the full max loss
    const isLocked = maxLossDollars > 0 && highWaterMark >= startBal + maxLossDollars;

    let maxLossFloor: number | null = null;
    if (maxLossDollars > 0) {
      maxLossFloor = isLocked ? startBal : +(highWaterMark - maxLossDollars).toFixed(2);
    }

    return { maxLossFloor, dailyFloor, highWaterMark, isLocked, drawdownType, dailyLossDollars, todayLoss, startOfDayBalance };
  };

  const fetchData = async () => {
    if (!user) return;
    const [{ data: tradesData }, { data: accountsData }] = await Promise.all([
      supabase.from('trades').select('*').eq('user_id', user.id).order('close_time', { ascending: true }),
      supabase.from('mt5_accounts').select('*').eq('user_id', user.id),
    ]);
    setTrades(tradesData ?? []);
    setAccounts(accountsData ?? []);
    await loadWeeklyGoal();
  };

  const getCurrentWeekKey = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(
      ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  };

  const loadWeeklyGoal = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_preferences')
      .select('weekly_goal_amount, weekly_goal_week, weekly_goal_set_at')
      .eq('user_id', user.id)
      .single();
    if (!data) return;
    const currentWeek = getCurrentWeekKey();
    if ((data as any).weekly_goal_week === currentWeek && (data as any).weekly_goal_amount) {
      setWeeklyGoal((data as any).weekly_goal_amount);
      setWeeklyGoalActive(true);
    } else {
      setWeeklyGoal(0);
      setWeeklyGoalActive(false);
    }
  };

  const saveWeeklyGoal = async (amount: number) => {
    if (!user) return;
    const currentWeek = getCurrentWeekKey();
    await supabase
      .from('user_preferences')
      .update({
        weekly_goal_amount: amount,
        weekly_goal_week: currentWeek,
        weekly_goal_set_at: new Date().toISOString(),
      } as any)
      .eq('user_id', user.id);
    setWeeklyGoal(amount);
    setWeeklyGoalActive(true);
    toast.success(
      lang === 'ar' ? 'تم حفظ الهدف الأسبوعي' :
      lang === 'fr' ? 'Objectif hebdomadaire enregistré' :
      'Weekly goal saved'
    );
  };

  const deleteWeeklyGoal = async () => {
    if (!user) return;
    await supabase
      .from('user_preferences')
      .update({ weekly_goal_amount: null, weekly_goal_week: null, weekly_goal_set_at: null } as any)
      .eq('user_id', user.id);
    setWeeklyGoal(0);
    setWeeklyGoalActive(false);
    setShowDeleteGoalConfirm(false);
    toast.success(
      lang === 'ar' ? 'تم حذف الهدف الأسبوعي' :
      lang === 'fr' ? 'Objectif supprimé' :
      'Weekly goal removed'
    );
  };

  const stopTgPolling = () => {
    if (tgPollRef.current) { clearInterval(tgPollRef.current); tgPollRef.current = null; }
    setTgPolling(false);
  };

  const startTgPolling = () => {
    if (!user || tgPollRef.current) return;
    setTgPolling(true);
    tgPollRef.current = setInterval(async () => {
      const { data } = await supabase.from('user_preferences').select('telegram_chat_id').eq('user_id', user.id).maybeSingle();
      const chatId = data?.telegram_chat_id;
      if (chatId) {
        setTelegramChatId(chatId);
        setTgConnected(true);
        stopTgPolling();
        setTimeout(() => {
          setShowTelegramModal(false);
          setShowTgBanner(false);
          localStorage.setItem('tg_onboard_dismissed', '1');
        }, 2000);
      }
    }, 5000);
    setTimeout(() => { if (tgPollRef.current) stopTgPolling(); }, 180000);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchData().finally(() => setLoading(false));

    const channel = supabase
      .channel('user-preferences-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const data = payload.new as any;
          const currentWeek = getCurrentWeekKey();
          if (data.weekly_goal_week === currentWeek && data.weekly_goal_amount) {
            setWeeklyGoal(data.weekly_goal_amount);
            setWeeklyGoalActive(true);
          } else {
            setWeeklyGoal(0);
            setWeeklyGoalActive(false);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('telegram_chat_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const chatId = data?.telegram_chat_id;
      if (chatId) {
        setTelegramChatId(chatId);
        return;
      }
      // Free users: no banner, no modal
      if (!isPro) return;
      if (localStorage.getItem('tg_onboard_dismissed')) {
        setShowTgBanner(true);
        return;
      }
      timer = setTimeout(() => setShowTelegramModal(true), 2000);
    })();
    return () => {
      clearTimeout(timer);
      if (tgPollRef.current) { clearInterval(tgPollRef.current); tgPollRef.current = null; }
    };
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
  const totalPnl      = closedTrades.reduce((s, tr) => s + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), 0);
  const wins          = closedTrades.filter(tr => ((tr.profit ?? 0) - ((tr as any).commission ?? 0)) > 0);
  const losses        = closedTrades.filter(tr => ((tr.profit ?? 0) - ((tr as any).commission ?? 0)) < 0);
  const winRate       = closedTrades.length ? (wins.length / closedTrades.length) * 100 : 0;
  const grossProfit   = wins.reduce((s, tr) => s + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), 0);
  const grossLoss     = Math.abs(losses.reduce((s, tr) => s + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), 0));
  const profitFactor: number | null = (() => {
    if (wins.length === 0 && losses.length === 0) return 0;
    if (losses.length === 0) return grossProfit > 0 ? null : 0;
    if (wins.length === 0) return 0;
    if (grossLoss === 0) return null;
    const pf = grossProfit / grossLoss;
    if (pf > 20 && losses.length <= 1) {
      const avgLossAmount = grossLoss / losses.length;
      if (avgLossAmount < 5) return null;
    }
    return parseFloat(pf.toFixed(2));
  })();
  const avgWin        = wins.length ? grossProfit / wins.length : 0;
  const avgLoss       = losses.length ? grossLoss / losses.length : 0;

  // ---- streak — consecutive winning/losing DAYS (not individual trades) ----
  const streak = useMemo(() => {
    if (!closedTrades.length) return { count: 0, type: 'win' as 'win' | 'loss' };
    const dayMap = new Map<string, number>();
    closedTrades.forEach(trade => {
      if (!trade.close_time) return;
      const day = new Date(trade.close_time).toISOString().split('T')[0];
      const net = (trade.profit ?? 0) - ((trade as any).commission ?? 0);
      dayMap.set(day, (dayMap.get(day) ?? 0) + net);
    });
    const days = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (!days.length) return { count: 0, type: 'win' as 'win' | 'loss' };
    const lastIsWin = days[days.length - 1][1] > 0;
    let count = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if ((days[i][1] > 0) === lastIsWin) count++;
      else break;
    }
    return { count, type: lastIsWin ? 'win' : 'loss' as 'win' | 'loss' };
  }, [closedTrades]);

  // ---- weekly goal — stored in Supabase, loaded via loadWeeklyGoal() ----

  // Listen for balance updates dispatched from ConnectPage — also update starting_balance
  // so the equity curve (which uses starting_balance + accPnl) reflects the new value.
  useEffect(() => {
    const handler = (e: any) => {
      const { accountId, balance } = e.detail;
      const accPnl = trades
        .filter(tr => tr.account_id === accountId && tr.profit !== null)
        .reduce((s, tr) => s + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), 0);
      const newStartBal = +(balance - accPnl).toFixed(2);
      setAccounts(prev => prev.map(a =>
        a.id === accountId ? { ...a, balance, starting_balance: newStartBal } : a
      ));
    };
    window.addEventListener('balance-updated', handler);
    return () => window.removeEventListener('balance-updated', handler);
  }, [trades]);

  const thisWeekPnl = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return closedTrades
      .filter(tr => tr.close_time && new Date(tr.close_time) >= startOfWeek)
      .reduce((s, tr) => s + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), 0);
  }, [closedTrades]);

  const weeklyProgress = weeklyGoalActive && weeklyGoal > 0 ? Math.min((thisWeekPnl / weeklyGoal) * 100, 100) : 0;

  // ---- smart insights ----
  const insights = useMemo(() => {
    const result: { icon: string; text: string }[] = [];
    if (closedTrades.length < 3) return result;

    // Best hour
    const hourGroups: Record<number, { pnl: number; count: number }> = {};
    for (const tr of closedTrades) {
      if (!tr.close_time) continue;
      const h = new Date(tr.close_time).getHours();
      if (!hourGroups[h]) hourGroups[h] = { pnl: 0, count: 0 };
      hourGroups[h].pnl += (tr.profit ?? 0) - ((tr as any).commission ?? 0);
      hourGroups[h].count += 1;
    }
    const bestHourEntry = Object.entries(hourGroups).sort((a, b) => b[1].pnl - a[1].pnl)[0];
    if (bestHourEntry) {
      const h = parseInt(bestHourEntry[0]);
      const label = `${h}:00–${h + 1}:00`;
      result.push({
        icon: '🕐',
        text: lang === 'ar' ? `أفضل وقت للتداول: ${label}` : lang === 'fr' ? `Meilleure heure: ${label}` : `Best trading hour: ${label}`,
      });
    }

    // Best symbol
    const symbolGroups: Record<string, number> = {};
    for (const tr of closedTrades) {
      if (!tr.symbol) continue;
      symbolGroups[tr.symbol] = (symbolGroups[tr.symbol] ?? 0) + ((tr.profit ?? 0) - ((tr as any).commission ?? 0));
    }
    const bestSymbol = Object.entries(symbolGroups).sort((a, b) => b[1] - a[1])[0];
    if (bestSymbol && bestSymbol[1] > 0) {
      result.push({
        icon: '📈',
        text: lang === 'ar' ? `أفضل رمز: ${bestSymbol[0]}` : lang === 'fr' ? `Meilleur symbole: ${bestSymbol[0]}` : `Best symbol: ${bestSymbol[0]}`,
      });
    }

    // Best setup
    const SETUP_RESULT_VALS = new Set(['win','loss','breakeven','partial win - tp1','partial win - tp2','partial win']);
    const SETUP_SESSION_VALS = new Set(['london','new york','asia','ny lunch']);
    const setupGroups: Record<string, { pnl: number; display: string }> = {};
    for (const tr of closedTrades) {
      if (!tr.setup_tag) continue;
      const seen = new Set<string>();
      const setupParts = tr.setup_tag.split(',').map(s => s.trim()).filter(s => {
        const lower = s.toLowerCase();
        if (!s || SETUP_RESULT_VALS.has(lower) || SETUP_SESSION_VALS.has(lower)) return false;
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
      if (setupParts.length === 0) continue;
      const key = setupParts.map(s => s.toLowerCase()).sort().join(',');
      const display = setupParts.join(', ');
      if (!setupGroups[key]) setupGroups[key] = { pnl: 0, display };
      setupGroups[key].pnl += (tr.profit ?? 0) - ((tr as any).commission ?? 0);
    }
    const bestSetup = Object.entries(setupGroups).filter(([, v]) => v.pnl > 0).sort((a, b) => b[1].pnl - a[1].pnl)[0];
    if (bestSetup) {
      const setupName = bestSetup[1].display;
      result.push({
        icon: '🎯',
        text: lang === 'ar' ? `أفضل استراتيجية: ${setupName}` : lang === 'fr' ? `Meilleure stratégie: ${setupName}` : `Best setup: ${setupName}`,
      });
    }

    // Win rate praise
    if (winRate >= 60) {
      result.push({
        icon: '🔥',
        text: lang === 'ar' ? `نسبة فوزك ${winRate.toFixed(0)}% — رائع!` : lang === 'fr' ? `Taux de réussite ${winRate.toFixed(0)}% — excellent!` : `Win rate ${winRate.toFixed(0)}% — great discipline!`,
      });
    }

    return result;
  }, [closedTrades, winRate, lang]);

  // Start auto-rotate once insights are available
  useEffect(() => {
    if (insights.length < 2) return;
    setInsightIndex(0);
    const timer = setInterval(() => setInsightIndex(i => (i + 1) % insights.length), 4000);
    return () => clearInterval(timer);
  }, [insights.length]);

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

    const isFutures = selectedEquityAccount?.account_category === 'futures';
    const drawdownType = (selectedEquityAccount as any)?.drawdown_type || 'static';
    const isTrailing = drawdownType === 'eod_trailing' || drawdownType === 'intraday_trailing';

    const CHALLENGE_TYPES = ['Challenge Phase 1', 'Challenge Phase 2', 'Evaluation', 'Instant Funded'];
    const isChallengeAccount = CHALLENGE_TYPES.includes(selectedEquityAccount?.account_type || '');

    const profitTargetLevel = (() => {
      if (!selectedEquityAccount || isAll) return null;
      if (isFutures) {
        const target = (selectedEquityAccount as any).profit_target_dollars ?? 0;
        return target > 0 ? +(startBalance + target).toFixed(2) : null;
      }
      const pct = selectedEquityAccount.profit_target ?? 0;
      const sz = selectedEquityAccount.account_size ?? 0;
      return pct > 0 && sz > 0 ? +(startBalance + (sz * pct / 100)).toFixed(2) : null;
    })();

    // Build equity points
    let pts: { date: string; balance: number; tradeCount: number }[];
    if (sorted.length === 0) {
      pts = [];
    } else {
      // Group by day — one data point per trading day (not per trade)
      const byDay = new Map<string, { pnl: number; count: number }>();
      for (const tr of sorted) {
        const day = new Date(tr.close_time!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const prev = byDay.get(day) ?? { pnl: 0, count: 0 };
        byDay.set(day, { pnl: prev.pnl + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), count: prev.count + 1 });
      }
      let running = startBalance;
      let cumCount = 0;
      pts = Array.from(byDay.entries()).map(([date, { pnl, count }]) => {
        running += pnl;
        cumCount += count;
        return { date, balance: +running.toFixed(2), tradeCount: cumCount };
      });
    }

    const currentEquityBalance = pts.length > 0 ? pts[pts.length - 1].balance : startBalance;

    // Compute floors for the current state using the full trade history
    const accountFloors = getDrawdownFloors(selectedEquityAccount, currentEquityBalance, sorted);

    // DD used % — based on drop from high water mark (correct for trailing accounts)
    const ddUsedPct = (() => {
      if (!selectedEquityAccount || isAll || !accountFloors.maxLossFloor) return null;
      const maxLossDollars = isFutures
        ? ((selectedEquityAccount as any).max_loss_limit_dollars ?? 0)
        : ((selectedEquityAccount.account_size ?? 0) * ((selectedEquityAccount.max_drawdown_limit ?? 0) / 100));
      if (maxLossDollars <= 0) return null;
      const dropped = Math.max(0, accountFloors.highWaterMark - currentEquityBalance);
      return Math.min(100, (dropped / maxLossDollars) * 100);
    })();

    // Daily loss used today
    const dailyUsedPct = (() => {
      if (!selectedEquityAccount || isAll) return null;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayTrades = rel.filter(tr =>
        tr.close_time && new Date(tr.close_time) >= todayStart
      );
      const todayNetPnl = todayTrades.reduce((s, tr) =>
        s + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), 0);
      const startOfDayBal = currentEquityBalance - todayNetPnl;
      const dailyLossDollars = isFutures
        ? ((selectedEquityAccount as any).daily_loss_limit_dollars ?? 0)
        : (startOfDayBal * ((selectedEquityAccount.daily_loss_limit ?? 0) / 100));
      if (dailyLossDollars <= 0) return null;
      const todayLoss = todayNetPnl < 0 ? Math.abs(todayNetPnl) : 0;
      return Math.min(100, (todayLoss / dailyLossDollars) * 100);
    })();

    const rawPoints = sorted.length === 0
      ? [{ date: lang === 'ar' ? 'الآن' : 'Now', balance: +startBalance.toFixed(2), tradeCount: 0 }]
      : [{ date: '', balance: +startBalance.toFixed(2), tradeCount: 0 }, ...pts];

    // Per-point floor — uses trades up to that point for correct trailing calculation
    // Daily floor only shown for today's points (it resets each day; showing historical is misleading)
    const todayDateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const points = rawPoints.map((pt) => {
      if (!selectedEquityAccount || isAll) return { ...pt, maxLossFloor: null as number | null, dailyFloor: null as number | null };
      const tradesUpToPoint = sorted.slice(0, pt.tradeCount);
      const ptFloors = getDrawdownFloors(selectedEquityAccount, pt.balance, tradesUpToPoint);
      const isToday = pt.date === todayDateLabel;
      return { ...pt, maxLossFloor: ptFloors.maxLossFloor, dailyFloor: isToday ? ptFloors.dailyFloor : null };
    });

    return {
      points,
      startBalance,
      currentEquityBalance,
      maxLossFloor: accountFloors.maxLossFloor,
      dailyFloor: accountFloors.dailyFloor,
      highWaterMark: accountFloors.highWaterMark,
      isLocked: accountFloors.isLocked,
      profitTargetLevel,
      isTrailing,
      isFutures,
      isChallengeAccount,
      ddUsedPct,
      dailyUsedPct,
    };
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

      {/* ── TELEGRAM ONBOARDING MODAL ── */}
      <Dialog open={showTelegramModal && isPro} onOpenChange={(o) => {
        if (!isPro) { setShowTelegramModal(false); navigate('/settings?tab=subscription'); return; }
        if (!o && !tgConnected) { stopTgPolling(); setShowTelegramModal(false); localStorage.setItem('tg_onboard_dismissed', '1'); setShowTgBanner(true); }
      }}>
        <DialogContent className="max-w-sm rounded-3xl border-0 p-0 overflow-hidden">
          <div className="border-t-4 border-teal-500 rounded-3xl bg-white">
            <div className="p-6 space-y-5">
              {tgConnected ? (
                /* ── Success state ── */
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <CheckCircle2 className="h-14 w-14 text-teal-500" />
                  <p className="text-xl font-bold text-gray-900">
                    {lang === 'ar' ? '🎉 تم الربط بنجاح!' : lang === 'fr' ? '🎉 Connecté avec succès!' : '🎉 Connected successfully!'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {lang === 'ar' ? 'ستصلك ملخصاتك اليومية على تيليجرام' : lang === 'fr' ? 'Vous recevrez vos résumés quotidiens sur Telegram' : "You'll receive your daily summaries on Telegram"}
                  </p>
                </div>
              ) : (
                /* ── Default / polling state ── */
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50">
                      <Send className="h-5 w-5 text-teal-500" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {lang === 'ar' ? 'ربط Telegram' : lang === 'fr' ? 'Connecter Telegram' : 'Connect Telegram'}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {lang === 'ar' ? 'إشعارات يومية مجانية' : lang === 'fr' ? 'Notifications quotidiennes gratuites' : 'Free daily notifications'}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {lang === 'ar'
                      ? 'احصل على ملخص يومي لصفقاتك مباشرة على تيليجرام'
                      : lang === 'fr'
                      ? 'Recevez un résumé quotidien de vos trades directement sur Telegram'
                      : 'Get a daily summary of your trades directly on Telegram'}
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { icon: '📊', ar: 'ملخص يومي تلقائي — نتائجك كل مساء', fr: 'Résumé quotidien automatique chaque soir', en: 'Automatic daily summary every evening' },
                      { icon: '🚨', ar: 'تنبيهات فورية عند اقتراب حدود الحساب', fr: 'Alertes quand vous approchez des limites', en: 'Instant alerts when nearing account limits' },
                      { icon: '🤖', ar: 'نصائح AI Coach على تيليجرام مباشرة', fr: "Conseils AI Coach sur Telegram", en: 'AI Coach tips delivered to Telegram' },
                    ].map(({ icon, ar, fr, en }) => (
                      <div key={icon} className="flex items-start gap-2.5">
                        <span className="text-base leading-none mt-0.5">{icon}</span>
                        <span className="text-sm text-gray-700">{lang === 'ar' ? ar : lang === 'fr' ? fr : en}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2.5 pt-1">
                    <button
                      onClick={() => {
                        if (user) window.open(`https://t.me/Tradesmartdzbot?start=${user.id}`, '_blank');
                        setTimeout(() => startTgPolling(), 1500);
                      }}
                      disabled={tgPolling}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-500 py-3 text-sm font-bold text-white hover:bg-teal-600 transition-colors disabled:opacity-70"
                    >
                      {tgPolling ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {lang === 'ar' ? 'في انتظار الربط...' : lang === 'fr' ? 'En attente de connexion...' : 'Waiting for connection...'}
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          {lang === 'ar' ? 'ربط Telegram' : lang === 'fr' ? 'Connecter Telegram' : 'Connect Telegram'}
                        </>
                      )}
                    </button>
                    {!tgPolling && (
                      <button
                        onClick={() => { setShowTelegramModal(false); localStorage.setItem('tg_onboard_dismissed', '1'); setShowTgBanner(true); }}
                        className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium"
                      >
                        {lang === 'ar' ? 'ربما لاحقاً' : lang === 'fr' ? 'Plus tard' : 'Maybe Later'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
          {/* Weekly goal prompt */}
          {!weeklyGoalActive && closedTrades.length > 0 && (
            <button
              type="button"
              onClick={() => { setGoalInput(''); setShowGoalModal(true); }}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors"
            >
              <Target className="h-3.5 w-3.5" />
              {lang === 'ar' ? 'تعيين هدف أسبوعي' : lang === 'fr' ? 'Fixer objectif' : 'Set weekly goal'}
            </button>
          )}
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

      {/* ── TELEGRAM BANNER — Case 1: isPro, no telegram, dismissed ── */}
      {isPro && showTgBanner && !tgBannerHidden && !telegramChatId && (
        <div className={`rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white p-4 flex items-center justify-between gap-3 shadow-sm ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-3 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Send className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {lang === 'ar' ? 'ربط التيليغرام' : lang === 'fr' ? 'Connecter Telegram' : 'Connect Telegram'}
              </p>
              <p className="text-xs text-gray-500">
                {lang === 'ar'
                  ? 'استقبل تقاريرك اليومية مباشرة على هاتفك'
                  : lang === 'fr'
                  ? 'Recevez vos rapports quotidiens sur votre téléphone'
                  : 'Get your daily trading reports on your phone'}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={() => { setTgConnected(false); setTgPolling(false); setShowTelegramModal(true); }}
              className="text-xs px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-semibold transition-colors"
            >
              {lang === 'ar' ? 'ربط الآن' : lang === 'fr' ? 'Connecter' : 'Connect Now'}
            </button>
            <button
              onClick={() => setTgBannerHidden(true)}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* ── TELEGRAM BANNER — Case 3: not isPro, has telegram (trial expired while connected) ── */}
      {!isPro && telegramChatId && (
        <div className={`rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 flex items-center justify-between gap-3 shadow-sm ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center gap-3 ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <BellOff className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {lang === 'ar' ? 'إشعارات تيليغرام متوقفة' : lang === 'fr' ? 'Notifications Telegram en pause' : 'Telegram notifications paused'}
              </p>
              <p className="text-xs text-gray-500">
                {lang === 'ar'
                  ? 'قم بالترقية إلى Pro لاستئناف التقارير اليومية'
                  : lang === 'fr'
                  ? 'Passez à Pro pour reprendre les rapports quotidiens'
                  : 'Upgrade to Pro to resume daily reports'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/settings?tab=subscription')}
            className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors flex-shrink-0"
          >
            {lang === 'ar' ? 'ترقية' : lang === 'fr' ? 'Passer à Pro' : 'Upgrade to Pro'}
          </button>
        </div>
      )}

      {/* ── WEEKLY GOAL + INSIGHTS ROW ── */}
      {(weeklyGoalActive || insights.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Weekly goal progress */}
          {weeklyGoalActive && (
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {lang === 'ar' ? 'هدف الأسبوع' : lang === 'fr' ? 'Objectif semaine' : 'Weekly Goal'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {showDeleteGoalConfirm ? (
                      <div className="flex items-center gap-2 animate-in fade-in duration-200">
                        <p className="text-xs text-gray-500">
                          {lang === 'ar' ? 'حذف الهدف؟' : lang === 'fr' ? "Supprimer l'objectif ?" : 'Remove goal?'}
                        </p>
                        <button
                          type="button"
                          onClick={deleteWeeklyGoal}
                          className="text-xs font-bold text-red-500 hover:text-red-600 px-2 py-0.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          {lang === 'ar' ? 'نعم' : lang === 'fr' ? 'Oui' : 'Yes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteGoalConfirm(false)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {lang === 'ar' ? 'لا' : lang === 'fr' ? 'Non' : 'No'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setGoalInput(String(weeklyGoal)); setShowGoalModal(true); }}
                          className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        >
                          {lang === 'ar' ? 'تعديل' : lang === 'fr' ? 'Modifier' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteGoalConfirm(true)}
                          className="w-6 h-6 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors group"
                        >
                          <X className="w-3.5 h-3.5 text-gray-300 group-hover:text-red-400 transition-colors" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-end gap-2 mb-2">
                  <span className={`text-2xl font-bold tabular-nums ${thisWeekPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {thisWeekPnl >= 0 ? '+' : ''}${thisWeekPnl.toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground mb-0.5">/ ${weeklyGoal.toFixed(0)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ${thisWeekPnl >= weeklyGoal ? 'bg-profit' : thisWeekPnl > 0 ? 'bg-primary' : 'bg-loss'}`}
                    style={{ width: `${Math.max(0, weeklyProgress)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {weeklyProgress >= 100
                    ? (lang === 'ar' ? '🎉 حققت الهدف!' : lang === 'fr' ? '🎉 Objectif atteint!' : '🎉 Goal reached!')
                    : `${weeklyProgress.toFixed(0)}% ${lang === 'ar' ? 'من الهدف' : lang === 'fr' ? 'de l\'objectif' : 'of goal'}`}
                </p>
              </CardContent>
            </Card>
          )}
          {/* Smart insights */}
          {insights.length > 0 && (
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm font-semibold text-foreground">
                    {lang === 'ar' ? 'رؤى ذكية' : lang === 'fr' ? 'Insights' : 'Smart Insights'}
                  </span>
                </div>
                <p className="text-sm text-foreground min-h-[2.5rem] transition-all duration-500">
                  {insights[insightIndex % insights.length]?.icon}{' '}
                  {insights[insightIndex % insights.length]?.text}
                </p>
                {insights.length > 1 && (
                  <div className="flex gap-1 mt-3">
                    {insights.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setInsightIndex(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === insightIndex % insights.length ? 'w-4 bg-primary' : 'w-1.5 bg-border'}`}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── SCORE CARD ── */}
      <TradesmartScore
        closedTrades={closedTrades} wins={wins} losses={losses}
        profitFactor={typeof profitFactor === 'number' ? profitFactor : 0}
        avgWin={avgWin} avgLoss={avgLoss} lang={lang}
        tradesCount={closedTrades.length}
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
              {accounts.length >= 1 && accounts.length <= 4 ? (
                <div className="flex flex-wrap gap-1.5">
                  {accounts.length > 1 && (
                    <button
                      onClick={() => setEquityAccountId('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        equityAccountId === 'all'
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {lang === 'ar' ? 'الكل' : 'All'}
                    </button>
                  )}
                  {accounts.map(acc => {
                    const isSelected = equityAccountId === acc.id;
                    const accBalance = acc.balance ?? acc.starting_balance ?? 0;
                    const accStart = acc.starting_balance ?? accBalance;
                    const accSize = acc.account_size ?? accStart;
                    const ddPct = acc.max_drawdown_limit
                      ? ((accStart - accBalance) / accSize) * 100 : 0;
                    const statusDot = ddPct >= 90 ? 'bg-red-500' :
                      ddPct >= 70 ? 'bg-amber-400' : 'bg-teal-500';
                    return (
                      <button
                        key={acc.id}
                        onClick={() => setEquityAccountId(acc.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isSelected ? 'bg-white' : statusDot
                        }`} />
                        {acc.account_name || acc.firm}
                      </button>
                    );
                  })}
                </div>
              ) : accounts.length > 4 ? (
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
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            {/* Stats bar */}
            <div className="flex items-center gap-4 px-1 mb-3 flex-wrap">
              {/* Balance — always show */}
              <div>
                <p className="text-xs text-gray-400">
                  {lang === 'ar' ? 'الرصيد' : lang === 'fr' ? 'Solde' : 'Balance'}
                </p>
                <p className="text-sm font-black text-gray-900">
                  ${equityData.currentEquityBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              {/* P&L — always show */}
              {(() => {
                const pnl = equityData.currentEquityBalance - equityData.startBalance;
                return (
                  <div>
                    <p className="text-xs text-gray-400">P&L</p>
                    <p className={`text-sm font-black ${pnl >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
                      {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                );
              })()}
              {/* DD Used — only single account with drawdown limit set */}
              {equityAccountId !== 'all' && equityData.ddUsedPct !== null && (
                <div>
                  <p className="text-xs text-gray-400">
                    {lang === 'ar' ? 'السحب المستخدم' : lang === 'fr' ? 'DD utilisé' : 'DD Used'}
                  </p>
                  <p className={`text-sm font-black ${
                    equityData.ddUsedPct >= 90 ? 'text-red-500' :
                    equityData.ddUsedPct >= 70 ? 'text-amber-500' :
                    'text-gray-700'
                  }`}>
                    {equityData.ddUsedPct.toFixed(1)}%
                  </p>
                </div>
              )}
              {/* Daily Used — only single account with daily loss limit set */}
              {equityAccountId !== 'all' && equityData.dailyUsedPct !== null && (
                <div>
                  <p className="text-xs text-gray-400">
                    {lang === 'ar' ? 'يومي' : lang === 'fr' ? 'Journalier' : 'Daily'}
                  </p>
                  <p className={`text-sm font-black ${
                    equityData.dailyUsedPct >= 90 ? 'text-red-500' :
                    equityData.dailyUsedPct >= 70 ? 'text-amber-500' :
                    'text-gray-700'
                  }`}>
                    {equityData.dailyUsedPct.toFixed(1)}%
                  </p>
                </div>
              )}
              {/* Target — only for challenge/evaluation accounts */}
              {equityAccountId !== 'all' && equityData.profitTargetLevel !== null && equityData.isChallengeAccount && (
                <div>
                  <p className="text-xs text-gray-400">
                    {lang === 'ar' ? 'الهدف' : lang === 'fr' ? 'Objectif' : 'Target'}
                  </p>
                  <p className="text-sm font-black text-teal-600">
                    ${equityData.profitTargetLevel.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={equityData.points} margin={{ left: 0, right: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={
                      equityData.ddUsedPct !== null && equityData.ddUsedPct >= 90
                        ? '#ef4444'
                        : equityData.ddUsedPct !== null && equityData.ddUsedPct >= 70
                        ? '#f59e0b'
                        : lineColor
                    } stopOpacity={0.2} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(220,10%,50%)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="hsl(220,10%,50%)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v}`}
                  width={68}
                  domain={(() => {
                    const levels = [
                      equityData.maxLossFloor,
                      equityData.dailyFloor,
                    ].filter(l => l !== null) as number[];
                    if (levels.length === 0) return ['auto', 'auto'] as ['auto', 'auto'];
                    const minLvl = Math.min(...levels);
                    const upperLevels = [equityData.profitTargetLevel].filter(l => l !== null) as number[];
                    const upperDomain = upperLevels.length > 0 ? Math.max(...upperLevels) * 1.002 : 'auto';
                    return [Math.min(minLvl * 0.998, minLvl - 50), upperDomain] as [number, number | 'auto'];
                  })()}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const equity: number = payload.find(p => p.dataKey === 'balance')?.value ?? 0;
                    const ptPayload = payload[0]?.payload as any;
                    const floor: number | null = ptPayload?.maxLossFloor ?? null;
                    const change = equity - equityData.startBalance;
                    const tradeCount: number = ptPayload?.tradeCount ?? 0;
                    const cushion = floor !== null ? equity - floor : null;
                    const cushionPct = cushion !== null && floor !== null && floor > 0
                      ? ((cushion / floor) * 100)
                      : null;
                    return (
                      <div className="bg-gray-900/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl border border-white/10 min-w-[200px]" dir="ltr">
                        {label && <p className="text-xs text-gray-400 mb-3 font-medium border-b border-white/10 pb-2">{label}</p>}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-teal-400" />
                            <span className="text-xs text-gray-300">{lang === 'ar' ? 'الرصيد' : lang === 'fr' ? 'Solde' : 'Equity'}</span>
                          </div>
                          <span className="text-sm font-black text-white ms-4">${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        {floor !== null && (
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-amber-400" />
                              <span className="text-xs text-gray-300">{lang === 'ar' ? 'حد السحب' : lang === 'fr' ? 'Plancher' : 'DD Floor'}</span>
                            </div>
                            <span className="text-sm font-bold text-amber-400 ms-4">${floor.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                        )}
                        {cushion !== null && (
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${cushionPct !== null && cushionPct > 50 ? 'bg-teal-400' : cushionPct !== null && cushionPct > 25 ? 'bg-amber-400' : 'bg-red-400'}`} />
                              <span className="text-xs text-gray-300">{lang === 'ar' ? 'الهامش المتبقي' : lang === 'fr' ? 'Marge restante' : 'Cushion Left'}</span>
                            </div>
                            <span className={`text-sm font-bold ms-4 ${cushionPct !== null && cushionPct > 50 ? 'text-teal-400' : cushionPct !== null && cushionPct > 25 ? 'text-amber-400' : 'text-red-400'}`}>
                              ${cushion.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        )}
                        <div className="border-t border-white/10 my-2" />
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-400">{lang === 'ar' ? 'التغيير' : lang === 'fr' ? 'Variation' : 'Change'}</span>
                          <span className={`text-sm font-bold ms-4 ${change >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                            {change >= 0 ? '+' : ''}${Math.abs(change).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        {tradeCount > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">{lang === 'ar' ? 'الصفقات' : lang === 'fr' ? 'Trades' : 'Trades'}</span>
                            <span className="text-sm font-bold text-white ms-4">{tradeCount}</span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                {/* Start balance — always shown for single account */}
                {equityAccountId !== 'all' && (
                  <ReferenceLine y={equityData.startBalance} stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={1.5}
                    label={{ value: `$${equityData.startBalance.toLocaleString()}`, position: 'insideTopRight', fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                )}
                {/* Max loss floor (static or trailing, forex or futures) */}
                {equityData.maxLossFloor !== null && (
                  <ReferenceLine y={equityData.maxLossFloor} stroke="#ef4444" strokeDasharray="5 4" strokeWidth={1.5}
                    label={{ value: `${equityData.isLocked ? '🔒 ' : ''}$${equityData.maxLossFloor.toLocaleString()}`, position: 'insideBottomRight', fill: '#ef4444', fontSize: 11, fontWeight: 700 }} />
                )}
                {/* Daily floor */}
                {equityData.dailyFloor !== null && (
                  <ReferenceLine y={equityData.dailyFloor} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: `$${equityData.dailyFloor.toLocaleString()}`, position: 'insideBottomLeft', fill: '#f59e0b', fontSize: 11, fontWeight: 700 }} />
                )}
                {/* Profit target */}
                {equityData.profitTargetLevel !== null && (
                  <ReferenceLine y={equityData.profitTargetLevel} stroke="#14b8a6" strokeDasharray="8 3" strokeWidth={1.5}
                    label={{ value: `$${equityData.profitTargetLevel.toLocaleString()}`, position: 'insideTopRight', fill: '#14b8a6', fontSize: 11, fontWeight: 700 }} />
                )}
                {equityAccountId !== 'all' && equityData.points.some(p => (p as any).maxLossFloor !== null) && (() => {
                  const floorVals = equityData.points.map(p => (p as any).maxLossFloor as number).filter(f => f !== null);
                  const balVals = equityData.points.map(p => p.balance);
                  return (
                    <ReferenceArea
                      y1={Math.min(...floorVals)}
                      y2={Math.max(...balVals)}
                      fill="url(#cushionGradient)"
                      fillOpacity={1}
                      strokeOpacity={0}
                    />
                  );
                })()}
                <defs>
                  <linearGradient id="cushionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="balance" stroke={lineColor} strokeWidth={2} fill="url(#equityFill)"
                  dot={false} activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }} />
                {equityAccountId !== 'all' && equityData.isTrailing && (
                  <Line type="stepAfter" dataKey="maxLossFloor" stroke="#ef4444" strokeWidth={1.5}
                    strokeDasharray="5 5" dot={false} strokeOpacity={0.5} legendType="none" />
                )}
                {equityAccountId !== 'all' && !equityData.isTrailing && (
                  <Line type="monotone" dataKey="maxLossFloor" stroke="#ef4444" strokeWidth={1.5}
                    strokeDasharray="5 5" dot={false} legendType="none" />
                )}
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {accounts.map(acc => {
                const a = acc as any;
                const isFuturesAcc = a.account_category === 'futures';
                const size = acc.account_size ?? acc.starting_balance ?? 0;
                const startBal = acc.starting_balance ?? size;
                const accTrades = trades
                  .filter(tr => tr.account_id === acc.id && tr.profit !== null)
                  .sort((a, b) => new Date(a.close_time!).getTime() - new Date(b.close_time!).getTime());
                const currentBal = acc.balance ?? startBal;
                const accPnl = accTrades.reduce((s, tr) => s + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), 0);
                const effectiveCurrentBal = startBal + accPnl;

                const floors = getDrawdownFloors(a, effectiveCurrentBal, accTrades);

                // Max loss DD
                const maxLossDollars = isFuturesAcc
                  ? (a.max_loss_limit_dollars ?? 0)
                  : (size * ((acc.max_drawdown_limit ?? 0) / 100));
                // Inline HWM: static uses startBal as reference, trailing uses running peak
                const accDrawdownType = a.drawdown_type ?? 'static';
                let accHwm = startBal; let accRunBal = startBal;
                for (const tr of accTrades) {
                  accRunBal += (tr.profit ?? 0) - ((tr as any).commission ?? 0);
                  if (accRunBal > accHwm) accHwm = accRunBal;
                }
                accHwm = Math.max(accHwm, effectiveCurrentBal);
                const ddDropped = accDrawdownType === 'static'
                  ? Math.max(0, startBal - effectiveCurrentBal)
                  : Math.max(0, accHwm - effectiveCurrentBal);
                const ddUsedPct = maxLossDollars > 0 ? Math.min((ddDropped / maxLossDollars) * 100, 100) : 0;

                // Daily loss — uses start-of-day balance for correct forex % limit
                const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                const dailyLossTrades = accTrades.filter(tr => tr.close_time && new Date(tr.close_time) >= todayStart);
                const dailyPnl = dailyLossTrades.reduce((s, tr) => s + ((tr.profit ?? 0) - ((tr as any).commission ?? 0)), 0);
                const startOfDayBal = effectiveCurrentBal - dailyPnl;
                const dailyLossDollars = isFuturesAcc
                  ? (a.daily_loss_limit_dollars ?? 0)
                  : (startOfDayBal * ((acc.daily_loss_limit ?? 0) / 100));
                const dailyLossUsed = dailyPnl < 0 ? Math.abs(dailyPnl) : 0;
                const dailyPct = dailyLossDollars > 0 ? Math.min((dailyLossUsed / dailyLossDollars) * 100, 100) : 0;

                // Profit target
                const profitTargetDollars = isFuturesAcc
                  ? (a.profit_target_dollars ?? 0)
                  : (size * ((acc.profit_target ?? 0) / 100));
                const profitPct = profitTargetDollars > 0 ? Math.min((accPnl / profitTargetDollars) * 100, 100) : 0;

                // DD floor (trailing accounts)
                const isTrailingAcc = a.drawdown_type === 'eod_trailing' || a.drawdown_type === 'intraday_trailing';
                const ddFloor = floors.maxLossFloor;

                const hasPropRules = maxLossDollars > 0 || dailyLossDollars > 0 || profitTargetDollars > 0;
                const status = ddUsedPct >= 90 || dailyPct >= 90 ? 'danger'
                  : ddUsedPct >= 70 || dailyPct >= 70 ? 'warning'
                  : 'safe';
                return (
                  <div key={acc.id} className="space-y-3">
                    <AccountCard acc={acc} lang={lang} compact userId={user?.id} onRefresh={fetchData} />
                    {hasPropRules && (
                      <div className={`rounded-xl border p-3 space-y-2.5 ${status === 'danger' ? 'border-loss/40 bg-loss/5' : status === 'warning' ? 'border-amber-400/40 bg-amber-50/30 dark:bg-amber-900/10' : 'border-border bg-card'}`}>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          {status === 'danger' && <><AlertTriangle className="h-3.5 w-3.5 text-loss" /><span className="text-loss">{lang === 'ar' ? '⚠ خطر' : lang === 'fr' ? '⚠ Danger' : '⚠ Danger'}</span></>}
                          {status === 'warning' && <><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /><span className="text-amber-500">{lang === 'ar' ? '⚠ تحذير' : lang === 'fr' ? '⚠ Attention' : '⚠ Warning'}</span></>}
                          {status === 'safe' && <span className="text-profit">✅ {lang === 'ar' ? 'آمن' : lang === 'fr' ? 'Sûr' : 'Safe'}</span>}
                        </div>
                        {maxLossDollars > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{lang === 'ar' ? 'الحد الأقصى للسحب' : lang === 'fr' ? 'DD Max' : 'Max Drawdown'}</span>
                              <span className={ddUsedPct >= 90 ? 'text-loss font-semibold' : ddUsedPct >= 70 ? 'text-amber-500 font-semibold' : ''}>${ddDropped.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${maxLossDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                              <div className={`h-full rounded-full transition-[width] duration-500 ${ddUsedPct >= 90 ? 'bg-loss' : ddUsedPct >= 70 ? 'bg-yellow-400' : 'bg-[#22c55e]'}`} style={{ width: `${ddUsedPct}%` }} />
                            </div>
                          </div>
                        )}
                        {dailyLossDollars > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{lang === 'ar' ? 'الخسارة اليومية' : lang === 'fr' ? 'Perte/jour' : 'Daily Loss'}</span>
                              <span className={dailyPct >= 90 ? 'text-loss font-semibold' : dailyPct >= 70 ? 'text-amber-500 font-semibold' : ''}>${dailyLossUsed.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${dailyLossDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                              <div className={`h-full rounded-full transition-[width] duration-500 ${dailyPct >= 90 ? 'bg-loss' : dailyPct >= 70 ? 'bg-yellow-400' : 'bg-[#22c55e]'}`} style={{ width: `${dailyPct}%` }} />
                            </div>
                          </div>
                        )}
                        {profitTargetDollars > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1"><Target className="h-3 w-3" />{lang === 'ar' ? 'هدف الربح' : lang === 'fr' ? 'Objectif profit' : 'Profit Target'}</span>
                              <span className={profitPct >= 100 ? 'text-profit font-semibold' : ''}>${Math.max(0, accPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${profitTargetDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(0, profitPct)}%` }} />
                            </div>
                          </div>
                        )}
                        {isTrailingAcc && ddFloor !== null && (
                          <div className="flex justify-between items-start text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              {lang === 'ar' ? 'حد السحب المتحرك' : lang === 'fr' ? 'Plancher flottant' : 'DD Floor'}
                            </span>
                            <div className="text-end">
                              <p className="text-sm font-bold text-teal-600">
                                ${ddFloor.toLocaleString(undefined, { maximumFractionDigits: 0 })}{floors.isLocked ? ' 🔒' : ''}
                              </p>
                              <p className="text-xs text-gray-400">
                                {floors.isLocked
                                  ? (lang === 'ar' ? 'الحد مقفل — حسابك في أمان' : lang === 'fr' ? 'Plancher verrouillé — compte sûr' : 'Floor locked — account is safe')
                                  : (lang === 'ar' ? 'الحد الأدنى المتحرك لرصيدك' : lang === 'fr' ? 'Plancher mobile de votre solde' : 'Your trailing balance floor')}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                    <TableHead className="hidden sm:table-cell font-semibold">{lang === 'ar' ? 'النتيجة' : lang === 'fr' ? 'Résultat' : 'Result'}</TableHead>
                    <TableHead className="font-semibold">{lang === 'ar' ? 'P&L' : 'P&L'}</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold">{lang === 'ar' ? 'الحساب' : lang === 'fr' ? 'Compte' : 'Account'}</TableHead>
                    <TableHead className="hidden sm:table-cell pe-4 font-semibold">{lang === 'ar' ? 'التاريخ' : lang === 'fr' ? 'Date' : 'Date'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTrades.map(tr => {
                    const setupTag = tr.setup_tag ?? '';
                    const parts = setupTag.split(',').map(s => s.trim());
                    const result = parts.find(p => ['Win','Loss','Breakeven','Partial Win - TP1','Partial Win - TP2'].includes(p)) ?? null;
                    const pnl = (tr.profit ?? 0) - ((tr as any).commission ?? 0);
                    const netBadgeClass = pnl > 0
                      ? 'bg-profit/15 text-profit border-profit/20'
                      : pnl < 0
                      ? 'bg-loss/15 text-loss border-loss/20'
                      : 'bg-yellow-500/15 text-yellow-400';
                    return (
                      <TableRow
                        key={tr.id}
                        className="border-border hover:bg-secondary/30 cursor-pointer"
                        onClick={() => { window.location.href = '/trades'; }}
                      >
                        <TableCell className="ps-4 font-bold text-foreground">{tr.symbol}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tr.direction === 'BUY' ? 'border-profit/30 bg-profit/10 text-profit' : 'border-loss/30 bg-loss/10 text-loss'}`}>
                            {tr.direction === 'BUY' ? (lang === 'ar' ? 'شراء' : lang === 'fr' ? 'ACHAT' : 'BUY') : (lang === 'ar' ? 'بيع' : lang === 'fr' ? 'VENTE' : 'SELL')}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {result ? (
                            <Badge variant="secondary" className={netBadgeClass}>
                              {result === 'Win' ? (lang === 'ar' ? 'ربح' : result) :
                               result === 'Loss' ? (lang === 'ar' ? 'خسارة' : result) :
                               result === 'Breakeven' ? (lang === 'ar' ? 'تعادل' : result) : result}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className={`font-semibold tabular-nums ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
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
                        <TableCell className="hidden sm:table-cell pe-4 whitespace-nowrap text-sm text-muted-foreground">
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
        className="fixed bottom-6 end-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-teal-200/60 transition-transform hover:scale-105 active:scale-95 bg-teal-500 hover:bg-teal-600 text-white"
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

      {/* Weekly Goal Modal */}
      <Dialog open={showGoalModal} onOpenChange={setShowGoalModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {lang === 'ar' ? 'تحديد هدف أسبوعي' : lang === 'fr' ? 'Objectif hebdomadaire' : 'Set Weekly Goal'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {lang === 'ar' ? 'أدخل هدفك الأسبوعي بالدولار' : lang === 'fr' ? 'Entrez votre objectif en dollars' : 'Enter your weekly profit goal in dollars'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
              <Input
                type="number"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    const val = parseFloat(goalInput);
                    if (!isNaN(val) && val > 0) {
                      await saveWeeklyGoal(val);
                      setShowGoalModal(false);
                      setGoalInput('');
                    }
                  }
                }}
                placeholder="500"
                className="pl-8"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowGoalModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground font-semibold text-sm hover:bg-secondary transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : lang === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={async () => {
                const val = parseFloat(goalInput);
                if (!isNaN(val) && val > 0) {
                  await saveWeeklyGoal(val);
                  setShowGoalModal(false);
                  setGoalInput('');
                }
              }}
              className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white font-bold text-sm hover:bg-teal-600 transition-colors"
            >
              {lang === 'ar' ? 'حفظ' : lang === 'fr' ? 'Enregistrer' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default DashboardPage;
