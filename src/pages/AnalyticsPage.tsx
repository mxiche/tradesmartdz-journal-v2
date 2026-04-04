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
      congrats:     'يُقدَّم هذا الشهادة بفخر إلى',
      tagline:      'للأداء المتميز والانضباط في التداول',
      totalTrades:  'إجمالي الصفقات',
      winRate:      'نسبة الفوز',
      totalPnl:     'إجمالي الربح',
      bestTrade:    'أفضل صفقة',
      profitFactor: 'معامل الربح',
      quote:        'الانضباط والاتساق هما أساس النجاح في التداول.',
      issuedOn:     'صدر بتاريخ:',
    } : isFr ? {
      congrats:     'Ce certificat est fièrement décerné à',
      tagline:      'Pour une performance exceptionnelle et de la discipline en trading',
      totalTrades:  'Total trades',
      winRate:      'Taux de réussite',
      totalPnl:     'PnL total',
      bestTrade:    'Meilleur trade',
      profitFactor: 'Facteur de profit',
      quote:        'La discipline et la constance sont les bases du succès en trading.',
      issuedOn:     'Émis le :',
    } : {
      congrats:     'This certificate is proudly awarded to',
      tagline:      'For outstanding performance and discipline in trading',
      totalTrades:  'Total Trades',
      winRate:      'Win Rate',
      totalPnl:     'Total PnL',
      bestTrade:    'Best Trade',
      profitFactor: 'Profit Factor',
      quote:        'Discipline and consistency are the foundation of trading success.',
      issuedOn:     'Issued on:',
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
    const GRAY  = '#64748b';
    const DARK  = '#0a0f1c';
    const DARK2 = '#0d1b2a';
    const W = 1200, H = 850;
    const CX = W / 2; // = 600 — horizontal center

    // ── Stats layout: 340 × 110, 20px gap ──
    const BW = 340, BH = 110, BG = 20;
    const row1Left = (W - 3 * BW - 2 * BG) / 2; // = 70
    const row2Left = (W - 2 * BW - 1 * BG) / 2; // = 250

    const fontFamily = isAr ? "'Tajawal', Arial, sans-serif" : "Helvetica, Arial, sans-serif";
    const mono = "Helvetica, Arial, sans-serif";

    // Divider: teal 14×14 diamond at center, dark lines on each side
    const Divider = ({ top, lx, rx }: { top: number; lx: number; rx: number }) => (
      <>
        {/* left line */}
        <div style={{ position: 'absolute', top, left: lx, width: CX - lx - 11, height: 1, background: '#253545' }} />
        {/* center diamond 14×14 rotated 45° */}
        <div style={{ position: 'absolute', top: top - 7, left: CX - 7, width: 14, height: 14, background: TEAL, transform: 'rotate(45deg)' }} />
        {/* right line */}
        <div style={{ position: 'absolute', top, left: CX + 11, width: rx - CX - 11, height: 1, background: '#253545' }} />
      </>
    );

    // ── Vertical layout anchors ──
    // Header
    const Y_TITLE    = 48;   // title baseline area
    const Y_SUBTITLE = 100;
    const Y_DIV1     = 122;
    const Y_CONGRATS = 140;
    const Y_NAME     = 160;  // 52px bold → visual bottom ≈ 220
    const Y_TAGLINE  = 235;
    const Y_DIV2     = 260;
    // Stats
    const Y_ROW1     = 278;  // top of row 1
    const Y_ROW2     = Y_ROW1 + BH + BG;  // = 408
    const Y_DIV3     = Y_ROW2 + BH + 18;  // = 536
    const Y_QUOTE    = Y_DIV3 + 16;       // = 552
    // Bottom — seal center at 60px above inner-border bottom (y=822)
    const SEAL_R     = 65;   // diameter = 130px
    const SEAL_CY    = 822 - 60 - SEAL_R; // = 697
    const SEAL_CX    = CX;               // = 600
    // Signature bottom aligns with seal bottom (697+65=762), height ≈ 68px
    const Y_SIG      = 762 - 68;         // = 694

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
          minWidth: W,
          maxWidth: W,
          minHeight: H,
          maxHeight: H,
        }}
      >
        {/* ── Background ── */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, background: DARK }} />
        <div style={{ position: 'absolute', top: 0, left: 540, width: 660, height: H, background: DARK2 }} />

        {/* ── Borders (explicit dimensions — no inset shorthand) ── */}
        {/* Gold outer 3px */}
        <div style={{ position: 'absolute', top: 15, left: 15, width: W - 30, height: H - 30, border: `3px solid ${GOLD}`, boxSizing: 'border-box' }} />
        {/* Teal inner 1px */}
        <div style={{ position: 'absolute', top: 28, left: 28, width: W - 56, height: H - 56, border: `1px solid ${TEAL}`, boxSizing: 'border-box' }} />

        {/* ── Corner L-ornaments ── */}
        <div style={{ position: 'absolute', top: 15, left: 15,        width: 50, height: 50, borderTop:    `2.5px solid ${GOLD}`, borderLeft:   `2.5px solid ${GOLD}` }} />
        <div style={{ position: 'absolute', top: 15, left: W - 65,    width: 50, height: 50, borderTop:    `2.5px solid ${GOLD}`, borderRight:  `2.5px solid ${GOLD}` }} />
        <div style={{ position: 'absolute', top: H - 65, left: 15,    width: 50, height: 50, borderBottom: `2.5px solid ${GOLD}`, borderLeft:   `2.5px solid ${GOLD}` }} />
        <div style={{ position: 'absolute', top: H - 65, left: W - 65,width: 50, height: 50, borderBottom: `2.5px solid ${GOLD}`, borderRight:  `2.5px solid ${GOLD}` }} />

        {/* ── Corner stars 20px gold ── */}
        {([[10, 8],[W - 28, 8],[10, H - 28],[W - 28, H - 28]] as [number,number][]).map(([x,y],i) => (
          <span key={i} style={{ position: 'absolute', left: x, top: y, color: GOLD, fontSize: 20, lineHeight: '1', fontFamily: mono }}>✦</span>
        ))}

        {/* ── Stars flanking title (20px gold) ── */}
        <span style={{ position: 'absolute', left: 236, top: Y_TITLE + 4, color: GOLD, fontSize: 20, lineHeight: '1', fontFamily: mono }}>✦</span>
        <span style={{ position: 'absolute', left: W - 256, top: Y_TITLE + 4, color: GOLD, fontSize: 20, lineHeight: '1', fontFamily: mono }}>✦</span>

        {/* ── TITLE: 36px, letterSpacing 4px, single line ── */}
        <div style={{
          position: 'absolute', top: Y_TITLE, left: 0, width: W,
          textAlign: 'center', fontSize: 36, fontWeight: 'bold',
          color: GOLD, letterSpacing: 4, whiteSpace: 'nowrap', fontFamily: mono,
        }}>
          CERTIFICATE OF PERFORMANCE
        </div>

        {/* Subtitle */}
        <div style={{ position: 'absolute', top: Y_SUBTITLE, left: 0, width: W, textAlign: 'center', fontSize: 12, color: '#7a8a9a', fontFamily: mono }}>
          Presented by TradeSmartDz
        </div>

        {/* ── Divider 1 ── */}
        <Divider top={Y_DIV1} lx={180} rx={1020} />

        {/* Congrats */}
        <div style={{ position: 'absolute', top: Y_CONGRATS, left: 0, width: W, textAlign: 'center', fontSize: 13, color: SLATE }}>
          {L.congrats}
        </div>

        {/* ── User name ── */}
        <div style={{
          position: 'absolute', top: Y_NAME, left: 60, width: W - 120,
          textAlign: 'center', fontSize: 52, fontWeight: 'bold',
          color: '#ffffff', lineHeight: '1.1',
          textShadow: '2px 2px 0 #6b4f00, -1px -1px 0 #6b4f00',
        }}>
          {userName}
        </div>

        {/* Tagline */}
        <div style={{ position: 'absolute', top: Y_TAGLINE, left: 60, width: W - 120, textAlign: 'center', fontSize: 13, fontStyle: 'italic', color: '#a0b0c0' }}>
          {L.tagline}
        </div>

        {/* ── Divider 2 ── */}
        <Divider top={Y_DIV2} lx={80} rx={1120} />

        {/* ── Stats row 1 — 3 × 340 × 110 ── */}
        {stats.slice(0, 3).map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: Y_ROW1,
            left: row1Left + i * (BW + BG),
            width: BW, height: BH,
            boxSizing: 'border-box',
            border: `1.5px solid ${s.color}`,
            borderRadius: 10,
            background: DARK2,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 16, gap: 8,
          }}>
            <div style={{ fontSize: 14, color: '#ffffff', fontWeight: 600, textAlign: 'center', fontFamily: mono }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: s.color, textAlign: 'center', fontFamily: mono }}>{s.value}</div>
          </div>
        ))}

        {/* ── Stats row 2 — 2 × 340 × 110 centered ── */}
        {stats.slice(3).map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: Y_ROW2,
            left: row2Left + i * (BW + BG),
            width: BW, height: BH,
            boxSizing: 'border-box',
            border: `1.5px solid ${s.color}`,
            borderRadius: 10,
            background: DARK2,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 16, gap: 8,
          }}>
            <div style={{ fontSize: 14, color: '#ffffff', fontWeight: 600, textAlign: 'center', fontFamily: mono }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: s.color, textAlign: 'center', fontFamily: mono }}>{s.value}</div>
          </div>
        ))}

        {/* ── Divider 3 ── */}
        <Divider top={Y_DIV3} lx={80} rx={1120} />

        {/* Quote */}
        <div style={{ position: 'absolute', top: Y_QUOTE, left: 100, width: W - 200, textAlign: 'center', fontSize: 12, fontStyle: 'italic', color: '#4a5a6a' }}>
          "{L.quote}"
        </div>

        {/* ── SEAL — bottom-center, diameter 130px ── */}
        {/* Outer gold ring */}
        <div style={{
          position: 'absolute',
          left: SEAL_CX - SEAL_R, top: SEAL_CY - SEAL_R,
          width: SEAL_R * 2, height: SEAL_R * 2,
          borderRadius: '50%', border: `2px solid ${GOLD}`, boxSizing: 'border-box',
        }} />
        {/* Inner teal ring */}
        <div style={{
          position: 'absolute',
          left: SEAL_CX - 53, top: SEAL_CY - 53,
          width: 106, height: 106,
          borderRadius: '50%', border: `1px solid ${TEAL}`, boxSizing: 'border-box',
        }} />
        {/* Seal dark fill + content */}
        <div style={{
          position: 'absolute',
          left: SEAL_CX - 52, top: SEAL_CY - 52,
          width: 104, height: 104,
          borderRadius: '50%', background: DARK,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 2, paddingTop: 6,
        }}>
          {/* Checkmark SVG — 24px teal */}
          <svg width="28" height="22" viewBox="0 0 28 22" fill="none" style={{ display: 'block' }}>
            <polyline points="2,12 10,20 26,2" stroke={TEAL} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 10, color: '#ffffff', letterSpacing: 1, fontFamily: mono }}>VERIFIED</div>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: GOLD, letterSpacing: 1, fontFamily: mono }}>TRADER</div>
          <div style={{ fontSize: 9, color: TEAL, fontFamily: mono }}>TradeSmartDz</div>
          <div style={{ fontSize: 9, color: '#506070', fontFamily: mono }}>2026</div>
        </div>

        {/* ── SIGNATURE — bottom-right, 60px from inner border ── */}
        {/* Inner border right = W-28=1172, bottom = H-28=822 */}
        {/* Sig width=200, right margin 60px → left = 1172-60-200 = 912 */}
        {/* Sig bottom = 822-60 = 762 */}
        <div style={{ position: 'absolute', top: Y_SIG, left: 912, width: 200, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontStyle: 'italic', color: TEAL, fontFamily: mono }}>TradeSmartDz</div>
          {/* 100px wide centered signature line */}
          <div style={{ height: 1, background: GRAY, margin: '7px auto', width: 100 }} />
          <div style={{ fontSize: 12, color: SLATE, fontFamily: mono }}>Founder &amp; CEO</div>
          <div style={{ fontSize: 11, color: GRAY, marginTop: 4, fontFamily }}>{L.issuedOn} {dateStr}</div>
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
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: null, width: 1200, height: 850 });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
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

  const PnLTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value as number;
    const color = val >= 0 ? '#22c55e' : '#ef4444';
    return (
      <div style={{ backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', padding: '8px 12px' }}>
        <p style={{ color: '#e2e8f0', marginBottom: 4, fontSize: 13 }}>{label}</p>
        <p style={{ color, fontSize: 13 }}>{`P&L: $${val.toFixed(2)}`}</p>
      </div>
    );
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
              <Tooltip content={<PnLTooltip />} />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
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
              <Tooltip content={<PnLTooltip />} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
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
