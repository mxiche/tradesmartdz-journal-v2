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
      founder: 'مؤسس ورئيس تنفيذي، TradeSmartDz',
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
      founder: 'Founder & CEO, TradeSmartDz',
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
      founder: 'Founder & CEO, TradeSmartDz',
      issuedOn: 'Issued on:',
    };

    const dateStr = new Date().toLocaleDateString(
      isAr ? 'ar-DZ' : isFr ? 'fr-FR' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' }
    );

    const stats = [
      { label: L.totalTrades,  value: String(totalTrades),                                                        color: '#60a5fa' },
      { label: L.winRate,      value: `${winRate}%`,                                                              color: '#00e0b8' },
      { label: L.totalPnl,     value: `$${totalPnl.toFixed(2)}`,                                                  color: totalPnl >= 0 ? '#22c55e' : '#ef4444' },
      { label: L.bestTrade,    value: bestTrade >= 0 ? `+$${bestTrade.toFixed(2)}` : `$${bestTrade.toFixed(2)}`, color: '#d4af37' },
      { label: L.profitFactor, value: profitFactor,                                                               color: '#a78bfa' },
    ];

    const GOLD  = '#d4af37';
    const TEAL  = '#00e0b8';
    const SLATE = '#94a3b8';
    const BM = 46, BOX_H = 110, BOX_GAP = 14;
    const BOX1_W = (1200 - BM * 2 - BOX_GAP * 2) / 3;
    const fontFamily = isAr ? "'Tajawal', Arial, sans-serif" : "Helvetica, Arial, sans-serif";

    const divider = (top: number, lx: number, rx: number) => (
      <div style={{ position: 'absolute', top, left: lx, right: 1200 - rx, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, height: 0.7, background: '#284050' }} />
        <div style={{ width: 12, height: 12, transform: 'rotate(45deg)', background: TEAL, margin: '0 14px', flexShrink: 0 }} />
        <div style={{ flex: 1, height: 0.7, background: '#284050' }} />
      </div>
    );

    return (
      <div
        ref={ref}
        style={{ position: 'fixed', left: -9999, top: 0, width: 1200, height: 850, fontFamily, overflow: 'hidden', direction: isAr ? 'rtl' : 'ltr' }}
      >
        {/* Two-tone background */}
        <div style={{ position: 'absolute', inset: 0, background: '#0a0f1c' }} />
        <div style={{ position: 'absolute', top: 0, left: 540, right: 0, bottom: 0, background: '#0d1b2a' }} />

        {/* Gold outer border */}
        <div style={{ position: 'absolute', inset: 15, border: `4px solid ${GOLD}`, boxSizing: 'border-box', pointerEvents: 'none' }} />
        {/* Teal inner border */}
        <div style={{ position: 'absolute', inset: 28, border: `1px solid ${TEAL}`, boxSizing: 'border-box', pointerEvents: 'none' }} />

        {/* Corner L-ornaments */}
        <div style={{ position: 'absolute', top: 15, left: 15,   width: 48, height: 48, borderTop:    `2.5px solid ${GOLD}`, borderLeft:  `2.5px solid ${GOLD}` }} />
        <div style={{ position: 'absolute', top: 15, right: 15,  width: 48, height: 48, borderTop:    `2.5px solid ${GOLD}`, borderRight: `2.5px solid ${GOLD}` }} />
        <div style={{ position: 'absolute', bottom: 15, left: 15,  width: 48, height: 48, borderBottom: `2.5px solid ${GOLD}`, borderLeft:  `2.5px solid ${GOLD}` }} />
        <div style={{ position: 'absolute', bottom: 15, right: 15, width: 48, height: 48, borderBottom: `2.5px solid ${GOLD}`, borderRight: `2.5px solid ${GOLD}` }} />

        {/* Corner stars */}
        {([[8,8],[1181,8],[8,831],[1181,831]] as [number,number][]).map(([x,y],i) => (
          <span key={i} style={{ position: 'absolute', left: x, top: y, color: GOLD, fontSize: 12, lineHeight: 1, userSelect: 'none' }}>✦</span>
        ))}

        {/* Stars flanking title */}
        <span style={{ position: 'absolute', left: 358, top: 84, color: GOLD, fontSize: 14, userSelect: 'none' }}>✦</span>
        <span style={{ position: 'absolute', right: 358, top: 84, color: GOLD, fontSize: 14, userSelect: 'none' }}>✦</span>

        {/* HEADER */}
        <div style={{ position: 'absolute', top: 66, left: 0, right: 0, textAlign: 'center', fontSize: 38, fontWeight: 'bold', color: GOLD, letterSpacing: 2, fontFamily: 'Helvetica, Arial, sans-serif' }}>
          CERTIFICATE OF PERFORMANCE
        </div>
        <div style={{ position: 'absolute', top: 114, left: 80, right: 80, height: 0.8, background: '#8c7323' }} />
        <div style={{ position: 'absolute', top: 121, left: 0, right: 0, textAlign: 'center', fontSize: 13, color: '#a0aec0', fontFamily: 'Helvetica, Arial, sans-serif' }}>
          Presented by TradeSmartDz
        </div>

        {/* Divider 1 */}
        {divider(149, 200, 1000)}

        {/* Congrats */}
        <div style={{ position: 'absolute', top: 166, left: 0, right: 0, textAlign: 'center', fontSize: 14, color: SLATE }}>
          {L.congrats}
        </div>

        {/* User name with text-decoration underline */}
        <div style={{ position: 'absolute', top: 195, left: 40, right: 40, textAlign: 'center', fontSize: 56, fontWeight: 'bold', color: '#ffffff', textShadow: '2px 2px 0 #644b08,-1px -1px 0 #644b08', lineHeight: 1.1, textDecoration: 'underline', textDecorationColor: GOLD, textUnderlineOffset: 8, textDecorationThickness: 1 }}>
          {userName}
        </div>

        {/* Tagline */}
        <div style={{ position: 'absolute', top: 267, left: 40, right: 40, textAlign: 'center', fontSize: 14, fontStyle: 'italic', color: '#cbd5e1' }}>
          {L.tagline}
        </div>

        {/* Divider 2 */}
        {divider(293, 80, 1120)}

        {/* Stats row 1 — 3 boxes */}
        <div style={{ position: 'absolute', top: 315, left: BM, display: 'flex', gap: BOX_GAP }}>
          {stats.slice(0, 3).map((s, i) => (
            <div key={i} style={{ width: BOX1_W, height: BOX_H, borderRadius: 8, background: '#0d1b2a', border: `1px solid ${s.color}`, boxShadow: `0 0 0 3px ${s.color}40`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ fontSize: 12, color: SLATE, textAlign: 'center' }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: s.color, textAlign: 'center', fontFamily: 'Helvetica, Arial, sans-serif' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Stats row 2 — 2 boxes centered */}
        <div style={{ position: 'absolute', top: 439, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: BOX_GAP }}>
          {stats.slice(3).map((s, i) => (
            <div key={i} style={{ width: BOX1_W, height: BOX_H, borderRadius: 8, background: '#0d1b2a', border: `1px solid ${s.color}`, boxShadow: `0 0 0 3px ${s.color}40`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ fontSize: 12, color: SLATE, textAlign: 'center' }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: s.color, textAlign: 'center', fontFamily: 'Helvetica, Arial, sans-serif' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Divider 3 */}
        {divider(562, 80, 1120)}

        {/* Quote */}
        <div style={{ position: 'absolute', top: 576, left: 80, right: 80, textAlign: 'center', fontSize: 12, fontStyle: 'italic', color: '#64748b' }}>
          "{L.quote}"
        </div>

        {/* Seal — centered at cx=600, cy=686 */}
        {/* Outer gold ring r=70 */}
        <div style={{ position: 'absolute', left: 530, top: 616, width: 140, height: 140, borderRadius: '50%', border: `2px solid ${GOLD}` }} />
        {/* Inner teal ring r=58 */}
        <div style={{ position: 'absolute', left: 542, top: 628, width: 116, height: 116, borderRadius: '50%', border: `1px solid ${TEAL}` }} />
        {/* Seal content */}
        <div style={{ position: 'absolute', left: 543, top: 629, width: 114, height: 114, borderRadius: '50%', background: '#0a0f1c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
            <polyline points="2,12 10,20 30,2" stroke={TEAL} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 9, color: GOLD, letterSpacing: 1, fontFamily: 'Helvetica, Arial, sans-serif' }}>VERIFIED</div>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: GOLD, letterSpacing: 1, fontFamily: 'Helvetica, Arial, sans-serif' }}>TRADER</div>
          <div style={{ fontSize: 8, color: TEAL, fontFamily: 'Helvetica, Arial, sans-serif' }}>TradeSmartDz</div>
          <div style={{ fontSize: 8, color: '#64748b', fontFamily: 'Helvetica, Arial, sans-serif' }}>2026</div>
        </div>

        {/* Signature — bottom right */}
        <div style={{ position: 'absolute', bottom: 44, right: 110, textAlign: 'center', width: 180 }}>
          <div style={{ fontSize: 17, fontStyle: 'italic', color: TEAL, marginBottom: 8, fontFamily: 'Helvetica, Arial, sans-serif' }}>TradeSmartDz</div>
          <div style={{ height: 0.7, background: SLATE, margin: '0 10px 8px' }} />
          <div style={{ fontSize: 11, color: SLATE, fontFamily: 'Helvetica, Arial, sans-serif' }}>Founder &amp; CEO</div>
          <div style={{ marginTop: 4, fontSize: 10, color: SLATE }}>{L.issuedOn} {dateStr}</div>
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
