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
  // Canvas: 1200x850px
  const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1200, 850] });
  const W = 1200;
  const H = 850;
  const cx = W / 2;

  // ── Colors ──
  type RGB = [number, number, number];
  const TEAL:  RGB = [0, 224, 184];
  const GOLD:  RGB = [212, 175, 55];
  const GOLD_DIM: RGB = [140, 115, 35];
  const WHITE: RGB = [255, 255, 255];
  const SLATE: RGB = [148, 163, 184];
  const SLATE2: RGB = [100, 116, 139];
  const DIVIDER: RGB = [30, 45, 55];

  // ── Labels ──
  const L = {
    ar: {
      heading: 'C E R T I F I C A T E   O F   P E R F O R M A N C E',
      subHeading: 'Presented by TradeSmartDz',
      congrats: '\u062a\u064f\u0645\u0646\u062d \u0647\u0630\u0647 \u0627\u0644\u0634\u0647\u0627\u062f\u0629 \u0628\u0641\u062e\u0631 \u0625\u0644\u0649',
      tagline: '\u0644\u0623\u062f\u0627\u0621 \u0645\u062a\u0645\u064a\u0632 \u0648\u0627\u0646\u0636\u0628\u0627\u0637 \u0641\u064a \u0627\u0644\u062a\u062f\u0627\u0648\u0644',
      totalTrades: '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0635\u0641\u0642\u0627\u062a',
      winRate:    '\u0646\u0633\u0628\u0629 \u0627\u0644\u0631\u0628\u062d',
      totalPnl:  '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0631\u0628\u062d',
      bestTrade: '\u0623\u0641\u0636\u0644 \u0635\u0641\u0642\u0629',
      profitFactor: '\u0645\u0639\u0627\u0645\u0644 \u0627\u0644\u0631\u0628\u062d',
      quote: '\u0627\u0644\u0627\u0646\u0636\u0628\u0627\u0637 \u0648\u0627\u0644\u0627\u062a\u0633\u0627\u0642 \u0647\u0645\u0627 \u0623\u0633\u0627\u0633 \u0627\u0644\u0646\u062c\u0627\u062d \u0641\u064a \u0627\u0644\u062a\u062f\u0627\u0648\u0644.',
      founder: 'Founder, TradeSmartDz',
      issuedOn: '\u0635\u062f\u0631 \u0628\u062a\u0627\u0631\u064a\u062e:',
      verified: 'VERIFIED',
      trader: 'TRADER',
    },
    fr: {
      heading: 'C E R T I F I C A T E   O F   P E R F O R M A N C E',
      subHeading: 'Presented by TradeSmartDz',
      congrats: 'Ce certificat est fi\u00e8rement d\u00e9cern\u00e9 \u00e0',
      tagline: 'Pour une performance exceptionnelle et de la discipline en trading',
      totalTrades: 'Total trades',
      winRate:    'Taux de r\u00e9ussite',
      totalPnl:  'PnL total',
      bestTrade: 'Meilleur trade',
      profitFactor: 'Facteur de profit',
      quote: 'La discipline et la constance sont les bases du succ\u00e8s en trading.',
      founder: 'Founder, TradeSmartDz',
      issuedOn: 'Issued on:',
      verified: 'VERIFIED',
      trader: 'TRADER',
    },
    en: {
      heading: 'C E R T I F I C A T E   O F   P E R F O R M A N C E',
      subHeading: 'Presented by TradeSmartDz',
      congrats: 'This certificate is proudly awarded to',
      tagline: 'For outstanding performance and discipline in trading',
      totalTrades: 'Total Trades',
      winRate:    'Win Rate',
      totalPnl:  'Total PnL',
      bestTrade: 'Best Trade',
      profitFactor: 'Profit Factor',
      quote: 'Discipline and consistency are the foundation of trading success.',
      founder: 'Founder, TradeSmartDz',
      issuedOn: 'Issued on:',
      verified: 'VERIFIED',
      trader: 'TRADER',
    },
  }[lang];

  // ── Stats ──
  const closed = trades.filter(tr => tr.profit !== null);
  const wins   = closed.filter(tr => (tr.profit ?? 0) > 0);
  const losses = closed.filter(tr => (tr.profit ?? 0) < 0);
  const totalPnl    = closed.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const winRate     = closed.length ? (wins.length / closed.length * 100).toFixed(1) : '0';
  const bestTrade   = closed.length ? Math.max(...closed.map(tr => tr.profit ?? 0)) : 0;
  const grossProfit = wins.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const grossLoss   = Math.abs(losses.reduce((s, tr) => s + (tr.profit ?? 0), 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞';

  const stats = [
    { label: L.totalTrades,   value: String(closed.length) },
    { label: L.winRate,       value: `${winRate}%` },
    { label: L.totalPnl,     value: `$${totalPnl.toFixed(2)}` },
    { label: L.bestTrade,    value: bestTrade >= 0 ? `+$${bestTrade.toFixed(2)}` : `$${bestTrade.toFixed(2)}` },
    { label: L.profitFactor, value: profitFactor },
  ];

  // ── 1. Background gradient (two rects blending) ──
  doc.setFillColor(10, 15, 28);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(13, 27, 42);
  doc.rect(0, H * 0.4, W, H * 0.6, 'F');

  // ── 2. Radial center glow (stacked semi-transparent circles) ──
  const glowColors: RGB[] = [
    [15, 50, 45],
    [12, 40, 36],
    [10, 30, 28],
  ];
  const glowRadii = [320, 220, 140];
  glowColors.forEach((c, i) => {
    doc.setFillColor(...c);
    doc.circle(cx, H * 0.42, glowRadii[i], 'F');
  });

  // ── 3. Watermark behind everything ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(110);
  doc.setTextColor(18, 42, 38);
  doc.text('TradeSmartDz', cx, H / 2 + 40, { align: 'center', angle: 330 });

  // ── 4. Outer border (teal, thick + glow layer) ──
  doc.setDrawColor(0, 140, 115);
  doc.setLineWidth(6);
  doc.rect(18, 18, W - 36, H - 36, 'S');
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(3);
  doc.rect(20, 20, W - 40, H - 40, 'S');

  // ── 5. Inner border (gold, thin) ──
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.rect(35, 35, W - 70, H - 70, 'S');

  // ── 6. Corner ornaments (gold L-shapes) ──
  const arm = 40;
  const off = 35;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2.5);
  // Top-left
  doc.line(off, off, off + arm, off);
  doc.line(off, off, off, off + arm);
  // Top-right
  doc.line(W - off, off, W - off - arm, off);
  doc.line(W - off, off, W - off, off + arm);
  // Bottom-left
  doc.line(off, H - off, off + arm, H - off);
  doc.line(off, H - off, off, H - off - arm);
  // Bottom-right
  doc.line(W - off, H - off, W - off - arm, H - off);
  doc.line(W - off, H - off, W - off, H - off - arm);

  // ── 7. HEADER ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(...GOLD);
  doc.text(L.heading, cx, 108, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(...SLATE);
  doc.text(L.subHeading, cx, 135, { align: 'center' });

  // Gold divider line under header
  doc.setDrawColor(...GOLD_DIM);
  doc.setLineWidth(0.8);
  doc.line(200, 148, W - 200, 148);

  // ── 8. RECIPIENT SECTION ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(...SLATE);
  doc.text(L.congrats, cx, 182, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(42);
  doc.setTextColor(...WHITE);
  doc.text(userName, cx, 230, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(203, 213, 225);
  doc.text(L.tagline, cx, 258, { align: 'center' });

  // Teal divider
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.6);
  doc.line(250, 272, W - 250, 272);

  // ── 9. STATS — clean 2-column list, centered ──
  const statColLabelX = cx - 160;
  const statColValueX = cx + 160;
  let sy = 308;
  const statRowH = 46;

  stats.forEach((stat, i) => {
    // Thin divider between rows (not before first)
    if (i > 0) {
      doc.setDrawColor(...DIVIDER);
      doc.setLineWidth(0.5);
      doc.line(statColLabelX - 20, sy - 14, statColValueX + 20, sy - 14);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(...SLATE);
    doc.text(stat.label, statColLabelX, sy, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...TEAL);
    doc.text(stat.value, statColValueX, sy, { align: 'left' });

    sy += statRowH;
  });

  // ── 10. QUOTE ──
  const quoteY = sy + 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(...SLATE2);
  doc.text(`"${L.quote}"`, cx, quoteY, { align: 'center' });

  // ── 11. SEAL (bottom-left) ──
  const sealX = 155;
  const sealY = H - 110;
  const sealR = 62;

  // Outer gold ring
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2.5);
  doc.circle(sealX, sealY, sealR, 'S');
  // Inner ring
  doc.setDrawColor(...GOLD_DIM);
  doc.setLineWidth(0.8);
  doc.circle(sealX, sealY, sealR - 8, 'S');
  // Dark fill
  doc.setFillColor(10, 18, 30);
  doc.circle(sealX, sealY, sealR - 9, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(L.verified, sealX, sealY - 18, { align: 'center' });
  doc.setFontSize(14);
  doc.text(L.trader, sealX, sealY + 2, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(...SLATE2);
  doc.text('TradeSmartDz', sealX, sealY + 18, { align: 'center' });
  doc.text('2026', sealX, sealY + 30, { align: 'center' });

  // ── 12. SIGNATURE SECTION (bottom-right) ──
  const sigX = W - 200;
  const sigY = H - 90;
  doc.setDrawColor(...SLATE2);
  doc.setLineWidth(0.7);
  doc.line(sigX - 100, sigY, sigX + 100, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...SLATE2);
  doc.text(L.founder, sigX, sigY + 18, { align: 'center' });

  const dateStr = new Date().toLocaleDateString(
    lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
  doc.setFontSize(11);
  doc.setTextColor(...SLATE2);
  doc.text(`${L.issuedOn} ${dateStr}`, sigX, sigY + 34, { align: 'center' });

  // ── Save ──
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
