import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tables } from '@/integrations/supabase/types';
import { Loader2, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';

type Trade = Tables<'trades'>;

const RESULT_VALUES = ['Win', 'Loss', 'Breakeven', 'Partial Win - TP1', 'Partial Win - TP2'];
const SESSION_VALUES = ['London', 'New York', 'Asia', 'NY Lunch'];

function parseSetupTag(setupTag: string | null) {
  if (!setupTag) return { result: null, session: null, setup: null };
  const parts = setupTag.split(',').map(s => s.trim()).filter(Boolean);
  let result: string | null = null;
  let session: string | null = null;
  const setup: string[] = [];
  for (const p of parts) {
    if (RESULT_VALUES.includes(p)) result = p;
    else if (SESSION_VALUES.includes(p)) session = p;
    else setup.push(p);
  }
  return { result, session, setup: setup.join(', ') || null };
}

function getTradeSession(trade: Trade): string | null {
  // Prefer dedicated session column, fall back to parsing setup_tag
  if (trade.session) return trade.session;
  return parseSetupTag(trade.setup_tag).session;
}

type Lang = 'ar' | 'fr' | 'en';

function generatePDF(trades: Trade[], lang: Lang, userName: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1200, 850] });
  const W = 1200, H = 850, cx = W / 2;

  type RGB = [number, number, number];
  const TEAL:     RGB = [0, 224, 184];
  const GOLD:     RGB = [212, 175, 55];
  const GOLD_DIM: RGB = [140, 115, 35];
  const WHITE:    RGB = [255, 255, 255];
  const SLATE:    RGB = [148, 163, 184];
  const SLATE2:   RGB = [100, 116, 139];

  // ── Labels — Arabic falls back to English (jsPDF cannot render RTL/Arabic) ──
  const L = {
    ar: {
      congrats:     'This certificate is proudly awarded to',
      tagline:      'For outstanding performance and discipline in trading',
      totalTrades:  'Total Trades',
      winRate:      'Win Rate',
      totalPnl:     'Total PnL',
      bestTrade:    'Best Trade',
      profitFactor: 'Profit Factor',
      quote:        'Discipline and consistency are the foundation of trading success.',
      founder:      'Founder & CEO, TradeSmartDz',
      issuedOn:     'Issued on:',
    },
    fr: {
      congrats:     'Ce certificat est fièrement décerné à',
      tagline:      'Pour une performance exceptionnelle et de la discipline en trading',
      totalTrades:  'Total trades',
      winRate:      'Taux de réussite',
      totalPnl:     'PnL total',
      bestTrade:    'Meilleur trade',
      profitFactor: 'Facteur de profit',
      quote:        'La discipline et la constance sont les bases du succès en trading.',
      founder:      'Founder & CEO, TradeSmartDz',
      issuedOn:     'Issued on:',
    },
    en: {
      congrats:     'This certificate is proudly awarded to',
      tagline:      'For outstanding performance and discipline in trading',
      totalTrades:  'Total Trades',
      winRate:      'Win Rate',
      totalPnl:     'Total PnL',
      bestTrade:    'Best Trade',
      profitFactor: 'Profit Factor',
      quote:        'Discipline and consistency are the foundation of trading success.',
      founder:      'Founder & CEO, TradeSmartDz',
      issuedOn:     'Issued on:',
    },
  }[lang];

  // ── Stats ──
  const closed      = trades.filter(tr => tr.profit !== null);
  const wins        = closed.filter(tr => (tr.profit ?? 0) > 0);
  const losses      = closed.filter(tr => (tr.profit ?? 0) < 0);
  const totalPnl    = closed.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const winRate     = closed.length ? (wins.length / closed.length * 100).toFixed(1) : '0';
  const bestTrade   = closed.length ? Math.max(...closed.map(tr => tr.profit ?? 0)) : 0;
  const grossProfit = wins.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const grossLoss   = Math.abs(losses.reduce((s, tr) => s + (tr.profit ?? 0), 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞';

  const stats: Array<{ label: string; value: string; color: RGB }> = [
    { label: L.totalTrades,  value: String(closed.length),                                                     color: [96, 165, 250]  },
    { label: L.winRate,      value: `${winRate}%`,                                                             color: [0, 224, 184]   },
    { label: L.totalPnl,    value: `$${totalPnl.toFixed(2)}`,                                                 color: totalPnl >= 0 ? [34, 197, 94] : [239, 68, 68] },
    { label: L.bestTrade,   value: bestTrade >= 0 ? `+$${bestTrade.toFixed(2)}` : `$${bestTrade.toFixed(2)}`, color: [212, 175, 55]  },
    { label: L.profitFactor, value: profitFactor,                                                              color: [167, 139, 250] },
  ];

  // ── Shared draw helpers ──
  // 4-line star drawn at (x,y) with arm length sz
  const drawStar = (x: number, y: number, sz: number) => {
    doc.line(x - sz, y, x + sz, y);
    doc.line(x, y - sz, x, y + sz);
    doc.line(x - sz * 0.65, y - sz * 0.65, x + sz * 0.65, y + sz * 0.65);
    doc.line(x + sz * 0.65, y - sz * 0.65, x - sz * 0.65, y + sz * 0.65);
  };
  // Diamond outline at (x,y) half-size sz
  const drawDiamond = (x: number, y: number, sz: number) => {
    doc.line(x, y - sz, x + sz, y);
    doc.line(x + sz, y, x, y + sz);
    doc.line(x, y + sz, x - sz, y);
    doc.line(x - sz, y, x, y - sz);
  };
  // Divider: lines either side of a drawn diamond
  const drawDivider = (y: number, lx1: number, lx2: number, color: RGB) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.7);
    doc.line(lx1, y, cx - 14, y);
    doc.line(cx + 14, y, lx2, y);
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(1.2);
    drawDiamond(cx, y, 7);
  };

  // ── Layout constants ──
  const OM = 15, IM = 28;      // outer/inner border margins
  const BM = 46;               // box left/right margin
  const BOX_H = 110, BOX_GAP = 14;
  const BOX1_W = (W - BM * 2 - BOX_GAP * 2) / 3;  // 3 boxes row1
  const SEAL_R = 70;

  // ── Vertical anchors ──
  const Y_TITLE    = 98;
  const Y_LINE1    = 114;
  const Y_SUB      = 132;
  const Y_DIV1     = 152;   // diamond divider after sub
  const Y_CONGRATS = 178;
  const Y_NAME     = 242;   // size 56 bold
  const Y_UNDERLN  = 257;
  const Y_TAGLINE  = 278;
  const Y_DIV2     = 297;   // diamond divider before stats
  const Y_ROW1     = 315;
  const Y_ROW2     = Y_ROW1 + BOX_H + BOX_GAP;   // 439
  const Y_DIV3     = Y_ROW2 + BOX_H + 16;          // 565
  const Y_QUOTE    = Y_DIV3 + 22;                   // 587
  const Y_SEAL     = Y_QUOTE + 34 + SEAL_R;         // 686
  const Y_SIG_LINE = Y_SEAL + SEAL_R + 22;          // 773 — but clamp to safe range
  const Y_SIG_T1   = Y_SIG_LINE + 18;
  const Y_SIG_T2   = Y_SIG_LINE + 34;

  // ── 1. Background gradient ──
  doc.setFillColor(10, 15, 28);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(13, 27, 42);
  doc.rect(W * 0.45, 0, W * 0.55, H, 'F');

  // ── 2. Corner glow circles (~6% teal on dark) ──
  doc.setFillColor(9, 28, 38);
  doc.circle(0,   0,   200, 'F');
  doc.circle(W,   0,   200, 'F');
  doc.circle(0,   H,   200, 'F');
  doc.circle(W,   H,   200, 'F');

  // ── 3. Outer border: gold 4px ──
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(4);
  doc.rect(OM, OM, W - OM * 2, H - OM * 2, 'S');

  // ── 4. Inner border: teal 1px ──
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(1);
  doc.rect(IM, IM, W - IM * 2, H - IM * 2, 'S');

  // ── 5. Corner ornaments: gold L-shapes + star at junction ──
  const ARM = 48;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2.5);
  doc.line(OM, OM, OM + ARM, OM);       doc.line(OM, OM, OM, OM + ARM);
  doc.line(W-OM, OM, W-OM-ARM, OM);     doc.line(W-OM, OM, W-OM, OM+ARM);
  doc.line(OM, H-OM, OM+ARM, H-OM);     doc.line(OM, H-OM, OM, H-OM-ARM);
  doc.line(W-OM, H-OM, W-OM-ARM, H-OM); doc.line(W-OM, H-OM, W-OM, H-OM-ARM);
  // Small star at each corner junction
  doc.setLineWidth(1.2);
  [[OM,OM],[W-OM,OM],[OM,H-OM],[W-OM,H-OM]].forEach(([cx2,cy2]) => drawStar(cx2, cy2, 5));

  // ── 6. HEADER ──
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.8);
  drawStar(cx - 248, Y_TITLE - 4, 7);
  drawStar(cx + 248, Y_TITLE - 4, 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38);
  doc.setTextColor(...GOLD);
  doc.text('CERTIFICATE OF PERFORMANCE', cx, Y_TITLE, { align: 'center' });

  doc.setDrawColor(...GOLD_DIM);
  doc.setLineWidth(0.8);
  doc.line(80, Y_LINE1, W - 80, Y_LINE1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(160, 174, 192);
  doc.text('Presented by TradeSmartDz', cx, Y_SUB, { align: 'center' });

  // Teal diamond divider
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(1);
  drawDivider(Y_DIV1, 200, W - 200, [40, 65, 80]);

  // ── 7. RECIPIENT ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(...SLATE);
  doc.text(L.congrats, cx, Y_CONGRATS, { align: 'center' });

  // Username — gold glow shadow + white main
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(56);
  doc.setTextColor(100, 75, 8);
  doc.text(userName, cx - 1.5, Y_NAME + 1.5, { align: 'center' });
  doc.text(userName, cx + 1.5, Y_NAME - 1.5, { align: 'center' });
  doc.setTextColor(...WHITE);
  doc.text(userName, cx, Y_NAME, { align: 'center' });

  // Gold underline sized to name width
  const nameW = doc.getTextWidth(userName);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(cx - nameW / 2, Y_UNDERLN, cx + nameW / 2, Y_UNDERLN);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(203, 213, 225);
  doc.text(L.tagline, cx, Y_TAGLINE, { align: 'center' });

  drawDivider(Y_DIV2, 80, W - 80, [40, 65, 80]);

  // ── 8. STATS — row 1: 3 boxes, row 2: 2 boxes centered ──
  const drawBox = (bx: number, by: number, bw: number, label: string, value: string, col: RGB) => {
    // Outer glow ring
    doc.setDrawColor(Math.round(col[0]*0.35), Math.round(col[1]*0.35), Math.round(col[2]*0.35));
    doc.setLineWidth(3);
    doc.roundedRect(bx - 1, by - 1, bw + 2, BOX_H + 2, 9, 9, 'S');
    // Box fill + border
    doc.setFillColor(13, 27, 42);
    doc.setDrawColor(...col);
    doc.setLineWidth(1);
    doc.roundedRect(bx, by, bw, BOX_H, 8, 8, 'FD');
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    doc.text(label, bx + bw / 2, by + 30, { align: 'center' });
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(...col);
    doc.text(value, bx + bw / 2, by + 80, { align: 'center' });
  };

  // Row 1: 3 boxes
  stats.slice(0, 3).forEach((s, i) =>
    drawBox(BM + i * (BOX1_W + BOX_GAP), Y_ROW1, BOX1_W, s.label, s.value, s.color)
  );
  // Row 2: 2 boxes centered
  const r2Stats = stats.slice(3);
  const r2W = r2Stats.length * BOX1_W + (r2Stats.length - 1) * BOX_GAP;
  r2Stats.forEach((s, i) =>
    drawBox((W - r2W) / 2 + i * (BOX1_W + BOX_GAP), Y_ROW2, BOX1_W, s.label, s.value, s.color)
  );

  // ── 9. Divider after stats ──
  drawDivider(Y_DIV3, 80, W - 80, [40, 65, 80]);

  // ── 10. QUOTE ──
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(...SLATE2);
  doc.text(`"${L.quote}"`, cx, Y_QUOTE, { align: 'center' });

  // ── 11. SEAL — centered horizontally on cx ──
  // Outer gold ring (radius 70)
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2);
  doc.circle(cx, Y_SEAL, SEAL_R, 'S');
  // Inner teal ring (radius 58)
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(1);
  doc.circle(cx, Y_SEAL, 58, 'S');
  // Dark fill inside inner ring
  doc.setFillColor(10, 15, 28);
  doc.circle(cx, Y_SEAL, 57, 'F');

  // Drawn checkmark centered in top half of seal
  const ckY = Y_SEAL - 22;   // vertical center of checkmark
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(2.8);
  doc.line(cx - 13, ckY + 2,  cx - 3,  ckY + 14);   // left leg
  doc.line(cx - 3,  ckY + 14, cx + 16, ckY - 10);   // right leg

  // "VERIFIED" — size 9, gold, below checkmark
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('VERIFIED', cx, Y_SEAL + 10, { align: 'center' });

  // "TRADER" — size 11, gold, bold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text('TRADER', cx, Y_SEAL + 25, { align: 'center' });

  // "TradeSmartDz" — size 8, teal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEAL);
  doc.text('TradeSmartDz', cx, Y_SEAL + 39, { align: 'center' });

  // "2026" — size 8, gray
  doc.setTextColor(...SLATE2);
  doc.text('2026', cx, Y_SEAL + 51, { align: 'center' });

  // ── 12. SIGNATURE — bottom right ──
  const sigX = W - 185;
  // "TradeSmartDz" italic teal as stylized signature
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(17);
  doc.setTextColor(...TEAL);
  doc.text('TradeSmartDz', sigX, Y_SIG_LINE - 10, { align: 'center' });
  doc.setDrawColor(...SLATE2);
  doc.setLineWidth(0.7);
  doc.line(sigX - 65, Y_SIG_LINE, sigX + 65, Y_SIG_LINE);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...SLATE2);
  doc.text('Founder & CEO', sigX, Y_SIG_T1, { align: 'center' });
  const dateStr = new Date().toLocaleDateString(
    lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
  doc.setFontSize(10);
  doc.text(`${L.issuedOn} ${dateStr}`, sigX, Y_SIG_T2, { align: 'center' });

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`tradesmartdz-certificate-${date}.pdf`);
}

const AnalyticsPage = () => {
  const { t, language } = useLanguage();
  const lang = language as Lang;
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [timeRange, setTimeRange] = useState('allTime');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchTrades = async () => {
      setLoading(true);
      const [{ data: tradesData }, { data: profile }] = await Promise.all([
        supabase.from('trades').select('*').eq('user_id', user.id).order('close_time', { ascending: true }),
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      ]);
      setTrades(tradesData ?? []);
      setFullName(profile?.full_name || '');
      setLoading(false);
    };
    fetchTrades();
  }, [user]);

  const ranges = [
    { key: 'thisWeek', label: t('thisWeek') },
    { key: 'thisMonth', label: t('thisMonth') },
    { key: 'last3Months', label: t('last3Months') },
    { key: 'allTime', label: t('allTime') },
  ];

  const filteredTrades = trades.filter(tr => {
    if (!tr.close_time || timeRange === 'allTime') return true;
    const now = new Date();
    const d = new Date(tr.close_time);
    if (timeRange === 'thisWeek') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return d >= start;
    }
    if (timeRange === 'thisMonth') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (timeRange === 'last3Months') {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      return d >= start;
    }
    return true;
  });

  // By Setup — group by setup portion of setup_tag
  const setupGroups: Record<string, Trade[]> = {};
  for (const tr of filteredTrades) {
    const { setup } = parseSetupTag(tr.setup_tag);
    const key = setup || 'Other';
    if (!setupGroups[key]) setupGroups[key] = [];
    setupGroups[key].push(tr);
  }
  const bySetup = Object.entries(setupGroups).map(([name, ts]) => {
    const wins = ts.filter(tr => (tr.profit ?? 0) > 0).length;
    return {
      name: name.length > 18 ? name.slice(0, 18) + '…' : name,
      pnl: +ts.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2),
      winRate: ts.length ? Math.round((wins / ts.length) * 100) : 0,
      count: ts.length,
    };
  }).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

  // By Symbol
  const symbolGroups: Record<string, Trade[]> = {};
  for (const tr of filteredTrades) {
    if (!symbolGroups[tr.symbol]) symbolGroups[tr.symbol] = [];
    symbolGroups[tr.symbol].push(tr);
  }
  const bySymbol = Object.entries(symbolGroups).map(([sym, ts]) => ({
    name: sym,
    pnl: +ts.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2),
    count: ts.length,
  })).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

  // By Session — use dedicated session column with fallback to parsed setup_tag
  const sessions = ['London', 'New York', 'Asia', 'NY Lunch'];
  const bySession = sessions.map(ses => {
    const ts = filteredTrades.filter(tr => getTradeSession(tr) === ses);
    const wins = ts.filter(tr => (tr.profit ?? 0) > 0).length;
    return {
      name: ses === 'New York' ? 'NY' : ses,
      pnl: +ts.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2),
      winRate: ts.length ? Math.round((wins / ts.length) * 100) : 0,
      count: ts.length,
    };
  }).filter(s => s.count > 0);

  // By Day of week
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byDay = days.map((day, i) => {
    const ts = filteredTrades.filter(tr => tr.close_time && new Date(tr.close_time).getDay() === (i + 1) % 7);
    return { name: day, pnl: +ts.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2) };
  });

  // Calendar for calendarMonth
  const { year, month } = calendarMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  // Build calendar grid with leading empty cells (Mon-first: shift Sun to end)
  const leadingBlanks = (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1);

  const calendarData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dayTrades = filteredTrades.filter(tr => {
      if (!tr.close_time) return false;
      const d = new Date(tr.close_time);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
    const pnl = dayTrades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
    const wins = dayTrades.filter(tr => (tr.profit ?? 0) > 0).length;
    return { day, pnl, count: dayTrades.length, wins };
  });

  const selectedDayData = selectedDay !== null ? calendarData[selectedDay - 1] : null;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const prevMonth = () => {
    setCalendarMonth(({ year, month }) => month === 0
      ? { year: year - 1, month: 11 }
      : { year, month: month - 1 });
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCalendarMonth(({ year, month }) => month === 11
      ? { year: year + 1, month: 0 }
      : { year, month: month + 1 });
    setSelectedDay(null);
  };

  const renderBarChart = (data: { name: string; pnl: number }[], title: string) => (
    <Card className="border-border bg-card">
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-sm text-muted-foreground">{t('noDataYet')}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 20%)" horizontal={false} />
              <XAxis type="number" stroke="hsl(220, 10%, 55%)" fontSize={11} />
              <YAxis dataKey="name" type="category" stroke="hsl(220, 10%, 55%)" fontSize={11} width={90} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(225, 18%, 12%)', border: '1px solid hsl(225, 15%, 20%)', borderRadius: '8px', color: 'hsl(220, 10%, 90%)' }}
                formatter={(val: number) => [`$${val.toFixed(2)}`, 'P&L']}
              />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  const renderDayChart = (data: { name: string; pnl: number }[], title: string) => (
    <Card className="border-border bg-card">
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.every(d => d.pnl === 0) ? (
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-sm text-muted-foreground">{t('noDataYet')}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 20%)" />
              <XAxis dataKey="name" stroke="hsl(220, 10%, 55%)" fontSize={11} />
              <YAxis stroke="hsl(220, 10%, 55%)" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(225, 18%, 12%)', border: '1px solid hsl(225, 15%, 20%)', borderRadius: '8px', color: 'hsl(220, 10%, 90%)' }} formatter={(val: number) => [`$${val.toFixed(2)}`, 'P&L']} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{t('analytics')}</h1>
        <div className="flex flex-wrap gap-2">
          {ranges.map(r => (
            <Button key={r.key} variant={timeRange === r.key ? 'default' : 'outline'} size="sm"
              className={timeRange === r.key ? 'gradient-primary text-primary-foreground' : ''}
              onClick={() => setTimeRange(r.key)}>
              {r.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => generatePDF(filteredTrades, lang, fullName || 'Trader')} className="gap-1.5">
            <FileDown className="h-4 w-4" />
            {lang === 'ar' ? 'تحميل الشهادة' : lang === 'fr' ? 'Télécharger le certificat' : 'Download Certificate'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {renderBarChart(bySetup, t('bySetup'))}
        {renderBarChart(bySymbol, t('bySymbol'))}
        {renderBarChart(bySession, t('bySession'))}
        {renderDayChart(byDay, t('byDay'))}
      </div>

      {/* Monthly Calendar */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('monthlyCalendar')}</CardTitle>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[130px] text-center text-sm font-medium">
                {monthNames[month]} {year}
              </span>
              <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day-of-week headers (Mon–Sun) */}
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="py-1 font-medium">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {/* Leading blanks */}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {calendarData.map(({ day, pnl, count }) => {
              const isSelected = selectedDay === day;
              let cellClass = 'bg-secondary text-muted-foreground';
              if (count > 0) {
                if (pnl > 0) cellClass = 'bg-profit/20 text-profit hover:bg-profit/30';
                else if (pnl < 0) cellClass = 'bg-loss/20 text-loss hover:bg-loss/30';
                else cellClass = 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30';
              }
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                  className={`flex h-10 flex-col items-center justify-center rounded-md text-xs font-medium transition-colors ${cellClass} ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-card' : ''}`}
                >
                  <span>{day}</span>
                  {count > 0 && <span className="text-[9px] opacity-70">{count}t</span>}
                </button>
              );
            })}
          </div>

          {/* Day detail popover */}
          {selectedDay !== null && selectedDayData && selectedDayData.count > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-secondary/60 p-4">
              <p className="mb-2 text-sm font-semibold">
                {monthNames[month]} {selectedDay}, {year}
              </p>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-muted-foreground">Trades</p>
                  <p className="font-bold">{selectedDayData.count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">P&L</p>
                  <p className={`font-bold ${selectedDayData.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {selectedDayData.pnl >= 0 ? '+' : ''}${selectedDayData.pnl.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Win Rate</p>
                  <p className="font-bold">
                    {selectedDayData.count > 0 ? Math.round((selectedDayData.wins / selectedDayData.count) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          )}
          {selectedDay !== null && selectedDayData && selectedDayData.count === 0 && (
            <div className="mt-4 rounded-lg border border-border bg-secondary/60 p-4">
              <p className="text-sm text-muted-foreground">No trades on {monthNames[month]} {selectedDay}.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
