import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tables } from '@/integrations/supabase/types';
import { Loader2, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

// ── Certificate HTML template (rendered off-screen, captured by html2canvas) ──
interface CertProps {
  userName: string;
  lang: Lang;
  totalTrades: number;
  winRate: string;
  totalPnl: number;
  bestTrade: number;
  profitFactor: string;
}

const CertificateTemplate = forwardRef<HTMLDivElement, CertProps>(
  function CertificateTemplate({ userName, lang, totalTrades, winRate, totalPnl, bestTrade, profitFactor }, ref) {
    const isAr = lang === 'ar';
    const isFr = lang === 'fr';

    const L = isAr ? {
      congrats: 'يُقدَّم هذا الشهادة بفخر إلى',
      tagline: 'للأداء المتميز والانضباط في التداول',
      totalTrades: 'إجمالي الصفقات',
      winRate: 'نسبة الفوز',
      totalPnl: 'إجمالي الربح',
      bestTrade: 'أفضل صفقة',
      profitFactor: 'معامل الربح',
      quote: 'الانضباط والاتساق هما أساس النجاح في التداول.',
      issuedOn: 'صدر بتاريخ:',
    } : isFr ? {
      congrats: 'Ce certificat est fièrement décerné à',
      tagline: 'Pour une performance exceptionnelle et de la discipline en trading',
      totalTrades: 'Total trades',
      winRate: 'Taux de réussite',
      totalPnl: 'PnL total',
      bestTrade: 'Meilleur trade',
      profitFactor: 'Facteur de profit',
      quote: 'La discipline et la constance sont les bases du succès en trading.',
      issuedOn: 'Émis le :',
    } : {
      congrats: 'This certificate is proudly awarded to',
      tagline: 'For outstanding performance and discipline in trading',
      totalTrades: 'Total Trades',
      winRate: 'Win Rate',
      totalPnl: 'Total PnL',
      bestTrade: 'Best Trade',
      profitFactor: 'Profit Factor',
      quote: 'Discipline and consistency are the foundation of trading success.',
      issuedOn: 'Issued on:',
    };

    const dateStr = new Date().toLocaleDateString(
      isAr ? 'ar-DZ' : isFr ? 'fr-FR' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' }
    );

    const pnlColor = totalPnl >= 0 ? '#22c55e' : '#ef4444';
    const stats = [
      { label: L.totalTrades,  value: String(totalTrades),                                                        color: '#60a5fa' },
      { label: L.winRate,      value: `${winRate}%`,                                                              color: '#00e0b8' },
      { label: L.totalPnl,     value: `$${totalPnl.toFixed(2)}`,                                                  color: pnlColor  },
      { label: L.bestTrade,    value: bestTrade >= 0 ? `+$${bestTrade.toFixed(2)}` : `$${bestTrade.toFixed(2)}`, color: '#d4af37' },
      { label: L.profitFactor, value: profitFactor,                                                               color: '#a78bfa' },
    ];

    // ── Design tokens ──
    const GOLD  = '#d4af37';
    const TEAL  = '#00e0b8';
    const SLATE = '#94a3b8';
    const DARK  = '#0a0f1c';
    const DARK2 = '#0d1b2a';
    const W = 1200, H = 850;

    // ── Stats layout: 340×110, 20px gap ──
    const BW = 340, BH = 110, BG = 20;
    const row1Left = (W - 3 * BW - 2 * BG) / 2;  // = 70
    const row2Left = (W - 2 * BW - 1 * BG) / 2;  // = 250

    // All text uses center alignment — works for both LTR and RTL
    const fontFamily = isAr ? "'Tajawal', Arial, sans-serif" : "Helvetica, Arial, sans-serif";
    const mono = "Helvetica, Arial, sans-serif";

    // Helper: horizontal divider with teal diamond at center
    const Divider = ({ top, lx, rx }: { top: number; lx: number; rx: number }) => (
      <>
        <div style={{ position: 'absolute', top, left: lx, width: W / 2 - lx - 14, height: 1, background: '#2a4050' }} />
        <div style={{ position: 'absolute', top: top - 6, left: W / 2 - 7, width: 14, height: 14, background: TEAL, transform: 'rotate(45deg)' }} />
        <div style={{ position: 'absolute', top, left: W / 2 + 14, width: rx - W / 2 - 14, height: 1, background: '#2a4050' }} />
      </>
    );

    return (
      <div
        ref={ref}
        dir={isAr ? 'rtl' : 'ltr'}
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          width: W,
          height: H,
          overflow: 'hidden',
          fontFamily,
          // Explicit pixel dimensions for html2canvas
          minWidth: W,
          maxWidth: W,
          minHeight: H,
          maxHeight: H,
        }}
      >
        {/* ── Background ── */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, background: DARK }} />
        <div style={{ position: 'absolute', top: 0, left: 540, width: 660, height: H, background: DARK2 }} />

        {/* ── Gold outer border (explicit w/h so it's never clipped) ── */}
        <div style={{ position: 'absolute', top: 15, left: 15, width: W - 30, height: H - 30, border: `3px solid ${GOLD}`, boxSizing: 'border-box' }} />

        {/* ── Teal inner border ── */}
        <div style={{ position: 'absolute', top: 28, left: 28, width: W - 56, height: H - 56, border: `1px solid ${TEAL}`, boxSizing: 'border-box' }} />

        {/* ── Corner L-ornaments (explicitly sized) ── */}
        <div style={{ position: 'absolute', top: 15, left: 15,      width: 50, height: 50, borderTop: `2.5px solid ${GOLD}`, borderLeft:  `2.5px solid ${GOLD}` }} />
        <div style={{ position: 'absolute', top: 15, left: W-65,    width: 50, height: 50, borderTop: `2.5px solid ${GOLD}`, borderRight: `2.5px solid ${GOLD}` }} />
        <div style={{ position: 'absolute', top: H-65, left: 15,    width: 50, height: 50, borderBottom: `2.5px solid ${GOLD}`, borderLeft: `2.5px solid ${GOLD}` }} />
        <div style={{ position: 'absolute', top: H-65, left: W-65,  width: 50, height: 50, borderBottom: `2.5px solid ${GOLD}`, borderRight: `2.5px solid ${GOLD}` }} />

        {/* ── Corner stars ── */}
        {([[ 10, 10],[ W-22, 10],[ 10, H-22],[ W-22, H-22]] as [number,number][]).map(([x,y],i) => (
          <span key={i} style={{ position: 'absolute', left: x, top: y, color: GOLD, fontSize: 12, lineHeight: '1', userSelect: 'none', fontFamily: mono }}>✦</span>
        ))}

        {/* ── Stars flanking title ── */}
        <span style={{ position: 'absolute', left: 352, top: 57, color: GOLD, fontSize: 13, userSelect: 'none', fontFamily: mono }}>✦</span>
        <span style={{ position: 'absolute', left: W - 365, top: 57, color: GOLD, fontSize: 13, userSelect: 'none', fontFamily: mono }}>✦</span>

        {/* ── Title (single line, whiteSpace nowrap) ── */}
        <div style={{
          position: 'absolute', top: 44, left: 0, width: W,
          textAlign: 'center', fontSize: 32, fontWeight: 'bold',
          color: GOLD, letterSpacing: 3, whiteSpace: 'nowrap', fontFamily: mono,
        }}>
          CERTIFICATE OF PERFORMANCE
        </div>

        {/* Gold rule */}
        <div style={{ position: 'absolute', top: 88, left: 80, width: W - 160, height: 1, background: '#7a6520' }} />

        {/* Subtitle */}
        <div style={{ position: 'absolute', top: 98, left: 0, width: W, textAlign: 'center', fontSize: 12, color: '#8899aa', fontFamily: mono }}>
          Presented by TradeSmartDz
        </div>

        {/* ── Divider 1 ── */}
        <Divider top={121} lx={200} rx={1000} />

        {/* Congrats */}
        <div style={{ position: 'absolute', top: 136, left: 0, width: W, textAlign: 'center', fontSize: 13, color: SLATE }}>
          {L.congrats}
        </div>

        {/* ── User name ── */}
        <div style={{
          position: 'absolute', top: 162, left: 60, width: W - 120,
          textAlign: 'center', fontSize: 52, fontWeight: 'bold',
          color: '#ffffff', lineHeight: '1.1',
          textShadow: '2px 2px 0 #6b4f00, -1px -1px 0 #6b4f00',
          textDecoration: 'underline', textDecorationColor: GOLD,
          textUnderlineOffset: '10px', textDecorationThickness: '1px',
        }}>
          {userName}
        </div>

        {/* Tagline */}
        <div style={{ position: 'absolute', top: 238, left: 60, width: W - 120, textAlign: 'center', fontSize: 13, fontStyle: 'italic', color: '#b0bec8' }}>
          {L.tagline}
        </div>

        {/* ── Divider 2 ── */}
        <Divider top={263} lx={80} rx={1120} />

        {/* ── Stats row 1 — 3 × 340px ── */}
        {stats.slice(0, 3).map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 280,
              left: row1Left + i * (BW + BG),
              width: BW,
              height: BH,
              boxSizing: 'border-box',
              border: `1.5px solid ${s.color}`,
              borderRadius: 10,
              background: DARK2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 11, color: SLATE, textAlign: 'center', fontFamily: mono }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 'bold', color: s.color, textAlign: 'center', fontFamily: mono }}>{s.value}</div>
          </div>
        ))}

        {/* ── Stats row 2 — 2 × 340px centered ── */}
        {stats.slice(3).map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 406,
              left: row2Left + i * (BW + BG),
              width: BW,
              height: BH,
              boxSizing: 'border-box',
              border: `1.5px solid ${s.color}`,
              borderRadius: 10,
              background: DARK2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 11, color: SLATE, textAlign: 'center', fontFamily: mono }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 'bold', color: s.color, textAlign: 'center', fontFamily: mono }}>{s.value}</div>
          </div>
        ))}

        {/* ── Divider 3 ── */}
        <Divider top={534} lx={80} rx={1120} />

        {/* Quote */}
        <div style={{ position: 'absolute', top: 549, left: 100, width: W - 200, textAlign: 'center', fontSize: 12, fontStyle: 'italic', color: '#506070' }}>
          "{L.quote}"
        </div>

        {/* ── Seal — centered at (600, 660), r_outer=68, r_inner=56 ── */}
        {/* Outer gold ring */}
        <div style={{
          position: 'absolute',
          left: 600 - 68, top: 660 - 68,
          width: 136, height: 136,
          borderRadius: '50%',
          border: `2px solid ${GOLD}`,
          boxSizing: 'border-box',
        }} />
        {/* Inner teal ring */}
        <div style={{
          position: 'absolute',
          left: 600 - 56, top: 660 - 56,
          width: 112, height: 112,
          borderRadius: '50%',
          border: `1px solid ${TEAL}`,
          boxSizing: 'border-box',
        }} />
        {/* Seal fill + content */}
        <div style={{
          position: 'absolute',
          left: 600 - 55, top: 660 - 55,
          width: 110, height: 110,
          borderRadius: '50%',
          background: DARK,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}>
          <svg width="30" height="20" viewBox="0 0 30 20" fill="none">
            <polyline points="2,11 9,18 28,2" stroke={TEAL} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 8,  color: GOLD, letterSpacing: 1, fontFamily: mono, marginTop: 1 }}>VERIFIED</div>
          <div style={{ fontSize: 10, fontWeight: 'bold', color: GOLD, letterSpacing: 1, fontFamily: mono }}>TRADER</div>
          <div style={{ fontSize: 7,  color: TEAL, fontFamily: mono }}>TradeSmartDz</div>
          <div style={{ fontSize: 7,  color: '#556070', fontFamily: mono }}>2026</div>
        </div>

        {/* ── Signature — bottom right ── */}
        <div style={{ position: 'absolute', top: 756, left: W - 290, width: 200, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontStyle: 'italic', color: TEAL, fontFamily: mono }}>TradeSmartDz</div>
          <div style={{ height: 1, background: '#3a4a5a', margin: '6px 20px' }} />
          <div style={{ fontSize: 10, color: SLATE, fontFamily: mono }}>Founder &amp; CEO</div>
          <div style={{ fontSize: 9, color: SLATE, marginTop: 3, fontFamily }}>{L.issuedOn} {dateStr}</div>
        </div>
      </div>
    );
  }
);
CertificateTemplate.displayName = 'CertificateTemplate';

const AnalyticsPage = () => {
  const { t, language } = useLanguage();
  const lang = language as Lang;
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [timeRange, setTimeRange] = useState('allTime');
  const [certLoading, setCertLoading] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);
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

  // ── Certificate stats (memoised to avoid recompute on every render) ──
  const certStats = useMemo(() => {
    const closed      = filteredTrades.filter(tr => tr.profit !== null);
    const wins        = closed.filter(tr => (tr.profit ?? 0) > 0);
    const losses      = closed.filter(tr => (tr.profit ?? 0) < 0);
    const totalPnl    = closed.reduce((s, tr) => s + (tr.profit ?? 0), 0);
    const winRate     = closed.length ? (wins.length / closed.length * 100).toFixed(1) : '0';
    const bestTrade   = closed.length ? Math.max(...closed.map(tr => tr.profit ?? 0)) : 0;
    const grossProfit = wins.reduce((s, tr) => s + (tr.profit ?? 0), 0);
    const grossLoss   = Math.abs(losses.reduce((s, tr) => s + (tr.profit ?? 0), 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞';
    return { totalTrades: closed.length, winRate, totalPnl, bestTrade, profitFactor };
  }, [filteredTrades]);

  const downloadCertificate = async () => {
    const el = certRef.current;
    if (!el) return;
    setCertLoading(true);
    // Move element into viewport so html2canvas can render it
    const prevLeft = el.style.left;
    el.style.left = '0px';
    el.style.zIndex = '9999';
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(el, { useCORS: true, scale: 1, width: 1200, height: 850 });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1200, 850] });
      pdf.addImage(imgData, 'JPEG', 0, 0, 1200, 850);
      const date = new Date().toISOString().slice(0, 10);
      pdf.save(`tradesmartdz-certificate-${date}.pdf`);
    } finally {
      el.style.left = prevLeft;
      el.style.zIndex = '';
      setCertLoading(false);
    }
  };

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
          <Button variant="outline" size="sm" onClick={downloadCertificate} disabled={certLoading} className="gap-1.5">
            {certLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
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

      {/* Hidden certificate template — captured by html2canvas on download */}
      <CertificateTemplate
        ref={certRef}
        userName={fullName || 'Trader'}
        lang={lang}
        totalTrades={certStats.totalTrades}
        winRate={certStats.winRate}
        totalPnl={certStats.totalPnl}
        bestTrade={certStats.bestTrade}
        profitFactor={certStats.profitFactor}
      />
    </div>
  );
};

export default AnalyticsPage;
