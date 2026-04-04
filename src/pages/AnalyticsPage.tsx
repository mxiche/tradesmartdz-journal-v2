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

function generatePDF(trades: Trade[], lang: Lang, userEmail: string) {
  // Landscape A4: W=297, H=210
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;
  const cx = W / 2;

  // ── Colors ──
  const TEAL: [number, number, number] = [0, 212, 170];
  const TEAL_GLOW: [number, number, number] = [0, 150, 120];
  const BG: [number, number, number] = [15, 17, 23];
  const WHITE: [number, number, number] = [240, 242, 248];
  const GRAY: [number, number, number] = [120, 125, 140];
  const BOX_BG: [number, number, number] = [24, 28, 42];

  // ── Labels ──
  const L = {
    ar: {
      certTitle: 'شهادة أداء التداول',
      congrats: 'تُمنح هذه الشهادة بفخر إلى',
      totalTrades: 'إجمالي الصفقات',
      winRate: 'نسبة الربح',
      totalPnl: 'إجمالي الربح والخسارة',
      bestTrade: 'أفضل صفقة',
      profitFactor: 'معامل الربح',
      tagline: 'واصل التداول بذكاء',
      quote: 'الانضباط والاتساق هما أساس النجاح في التداول',
    },
    fr: {
      certTitle: 'Certificat de Performance',
      congrats: 'Ce certificat est fièrement décerné à',
      totalTrades: 'Total Trades',
      winRate: 'Taux de Réussite',
      totalPnl: 'PnL Total',
      bestTrade: 'Meilleur Trade',
      profitFactor: 'Facteur de Profit',
      tagline: 'Continuez à trader intelligemment',
      quote: 'La discipline et la constance sont les bases du succès en trading',
    },
    en: {
      certTitle: 'Trading Performance Certificate',
      congrats: 'This certificate is proudly presented to',
      totalTrades: 'Total Trades',
      winRate: 'Win Rate',
      totalPnl: 'Total PnL',
      bestTrade: 'Best Trade',
      profitFactor: 'Profit Factor',
      tagline: 'Keep trading smart',
      quote: 'Discipline and consistency are the foundation of trading success',
    },
  }[lang];

  // ── Stats ──
  const closed = trades.filter(tr => tr.profit !== null);
  const wins = closed.filter(tr => (tr.profit ?? 0) > 0);
  const losses = closed.filter(tr => (tr.profit ?? 0) < 0);
  const totalPnl = closed.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const winRate = closed.length ? (wins.length / closed.length * 100).toFixed(1) : '0';
  const bestTrade = closed.length ? Math.max(...closed.map(tr => tr.profit ?? 0)) : 0;
  const grossProfit = wins.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, tr) => s + (tr.profit ?? 0), 0));
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞';

  // ── 1. Dark background ──
  doc.setFillColor(...BG);
  doc.rect(0, 0, W, H, 'F');

  // ── 2. Watermark (draw before border so it's behind everything) ──
  doc.saveGraphicsState();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(60);
  doc.setTextColor(0, 212, 170);
  // jsPDF doesn't support alpha natively; use a very dark color to simulate very low opacity
  doc.setTextColor(20, 45, 40); // ~5% teal on dark bg
  const watermarkX = cx;
  const watermarkY = H / 2 + 10;
  doc.text('TradeSmartDz', watermarkX, watermarkY, { align: 'center', angle: 45 });
  doc.restoreGraphicsState();

  // ── 3. Borders (outer glow + outer + inner) ──
  // Glow effect: draw a slightly larger border in darker teal first
  doc.setDrawColor(...TEAL_GLOW);
  doc.setLineWidth(4);
  doc.rect(5, 5, W - 10, H - 10, 'S');
  // Outer border (thick)
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(3);
  doc.rect(7, 7, W - 14, H - 14, 'S');
  // Inner border (thin)
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.4);
  doc.rect(12, 12, W - 24, H - 24, 'S');

  // ── 4. Corner ornaments — L-shaped lines at each corner ──
  const orn = 12; // arm length
  const op = 15;  // offset from page edge
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(1.5);
  // Top-left
  doc.line(op, op, op + orn, op);
  doc.line(op, op, op, op + orn);
  // Top-right
  doc.line(W - op, op, W - op - orn, op);
  doc.line(W - op, op, W - op, op + orn);
  // Bottom-left
  doc.line(op, H - op, op + orn, H - op);
  doc.line(op, H - op, op, H - op - orn);
  // Bottom-right
  doc.line(W - op, H - op, W - op - orn, H - op);
  doc.line(W - op, H - op, W - op, H - op - orn);

  // ── 5. Top section ──
  // "TradeSmartDz" large
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...TEAL);
  doc.text('TradeSmartDz', cx, 30, { align: 'center' });

  // Thin teal line
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.5);
  doc.line(70, 35, W - 70, 35);

  // Certificate title with star ornaments
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...WHITE);
  doc.text(`* ${L.certTitle} *`, cx, 44, { align: 'center' });

  // Date
  const dateStr = new Date().toLocaleDateString(
    lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(dateStr, cx, 51, { align: 'center' });

  // Congratulations line
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  doc.text(L.congrats, cx, 60, { align: 'center' });

  // ── 6. User email/name — bigger & bolder ──
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text(userEmail, cx, 70, { align: 'center' });

  // ── 7. 2x2 stat boxes + 5th centered ──
  const boxW = 54;
  const boxH = 28;
  const gapX = 8;
  const gapY = 6;
  const gridW = boxW * 2 + gapX;
  const startX = cx - gridW / 2;
  const startY = 78;

  const stats = [
    { label: L.totalTrades, value: String(closed.length) },
    { label: L.winRate,     value: `${winRate}%` },
    { label: L.totalPnl,   value: `$${totalPnl.toFixed(2)}` },
    { label: L.bestTrade,  value: bestTrade > 0 ? `+$${bestTrade.toFixed(2)}` : `$${bestTrade.toFixed(2)}` },
  ];

  const drawBox = (bx: number, by: number, label: string, value: string) => {
    doc.setFillColor(...BOX_BG);
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.5);
    doc.roundedRect(bx, by, boxW, boxH, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(label, bx + boxW / 2, by + 9, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEAL);
    doc.text(value, bx + boxW / 2, by + 22, { align: 'center' });
  };

  stats.forEach((stat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawBox(startX + col * (boxW + gapX), startY + row * (boxH + gapY), stat.label, stat.value);
  });

  // 5th box centered below
  const fifthY = startY + (boxH + gapY) * 2;
  drawBox(cx - boxW / 2, fifthY, L.profitFactor, profitFactor);

  // ── 8. Motivational quote ──
  const quoteY = fifthY + boxH + 6;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...GRAY);
  doc.text(`"${L.quote}"`, cx, quoteY, { align: 'center' });

  // ── 9. Bottom section ──
  const bottomLineY = H - 24;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.5);
  doc.line(70, bottomLineY, W - 70, bottomLineY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEAL);
  doc.text('TradeSmartDz', cx, bottomLineY + 7, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('neuroport.xyz', cx, bottomLineY + 13, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(L.tagline, cx, bottomLineY + 19, { align: 'center' });

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
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('close_time', { ascending: true });
      setTrades(data ?? []);
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
          <Button variant="outline" size="sm" onClick={() => generatePDF(filteredTrades, lang, user?.email ?? '')} className="gap-1.5">
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
