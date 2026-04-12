import { forwardRef, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProLockOverlay } from '@/components/ProLockOverlay';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, ReferenceLine, LabelList,
} from 'recharts';
import { Tables } from '@/integrations/supabase/types';
import { Loader2, FileDown, Calendar, Zap, Target, X as XIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type Trade = Tables<'trades'>;
type Account = Tables<'mt5_accounts'>;
type Lang = 'ar' | 'fr' | 'en';

function useIsMobile(breakpoint = 640) {
  const mq = useMemo(() => window.matchMedia(`(max-width: ${breakpoint - 1}px)`), [breakpoint]);
  return useSyncExternalStore(
    cb => { mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); },
    () => mq.matches,
    () => false,
  );
}

// ─── Static labels ────────────────────────────────────────────
const L = {
  ar: {
    title: 'التحليلات',
    bestDay: 'أفضل يوم',
    bestSession: 'أفضل جلسة',
    bestSetup: 'أفضل إعداد',
    allAccounts: 'كل الحسابات',
    winRateDonut: 'نسبة الفوز',
    wins: 'رابح',
    losses: 'خاسر',
    breakeven: 'متعادل',
    avgWin: 'متوسط الربح',
    avgLoss: 'متوسط الخسارة',
    rrRatio: 'نسبة المخاطرة/العائد',
    expectancy: 'التوقع الرياضي',
    heatmap: 'خريطة الأداء',
    setupTable: 'أداء الإعدادات',
    symbolChart: 'أداء الرموز',
    byDayTitle: 'الأداء حسب اليوم',
    byHourTitle: 'الأداء حسب الوقت',
    weeklyConsistency: 'الاتساق الأسبوعي',
    noData: 'لا توجد بيانات بعد',
    setup: 'الإعداد',
    trades: 'الصفقات',
    winRate: 'نسبة الفوز',
    totalPnl: 'إجمالي P&L',
    avgPnl: 'متوسط P&L',
    bestTrade: 'أفضل صفقة',
    loading: 'جاري التحميل...',
    certificate: 'تحميل الشهادة',
    days: { Mon: 'الإثنين', Tue: 'الثلاثاء', Wed: 'الأربعاء', Thu: 'الخميس', Fri: 'الجمعة', Sat: 'السبت', Sun: 'الأحد' },
    sessions: { London: 'لندن', 'New York': 'نيويورك', Asia: 'آسيا', 'NY Lunch': 'استراحة NY' },
    timeGroups: { Morning: 'الصباح', London: 'لندن', NY: 'نيويورك', Evening: 'المساء' },
    week: 'أسبوع',
    minTradesNote: 'يتطلب ٢ صفقة على الأقل',
  },
  fr: {
    title: 'Analytiques',
    bestDay: 'Meilleur jour',
    bestSession: 'Meilleure session',
    bestSetup: 'Meilleur setup',
    allAccounts: 'Tous les comptes',
    winRateDonut: 'Taux de réussite',
    wins: 'Gagnants',
    losses: 'Perdants',
    breakeven: 'Nuls',
    avgWin: 'Gain moyen',
    avgLoss: 'Perte moyenne',
    rrRatio: 'Ratio R/R',
    expectancy: 'Espérance',
    heatmap: 'Carte de performance',
    setupTable: 'Performance par setup',
    symbolChart: 'Performance par symbole',
    byDayTitle: 'Performance par jour',
    byHourTitle: 'Performance par heure',
    weeklyConsistency: 'Consistance hebdomadaire',
    noData: 'Aucune donnée',
    setup: 'Setup',
    trades: 'Trades',
    winRate: 'Taux win',
    totalPnl: 'PnL total',
    avgPnl: 'PnL moyen',
    bestTrade: 'Meilleur trade',
    loading: 'Chargement...',
    certificate: 'Télécharger le certificat',
    days: { Mon: 'Lun', Tue: 'Mar', Wed: 'Mer', Thu: 'Jeu', Fri: 'Ven', Sat: 'Sam', Sun: 'Dim' },
    sessions: { London: 'Londres', 'New York': 'New York', Asia: 'Asie', 'NY Lunch': 'NY Lunch' },
    timeGroups: { Morning: 'Matin', London: 'Londres', NY: 'New York', Evening: 'Soir' },
    week: 'Sem.',
    minTradesNote: 'Min. 2 trades requis',
  },
  en: {
    title: 'Analytics',
    bestDay: 'Best Day',
    bestSession: 'Best Session',
    bestSetup: 'Best Setup',
    allAccounts: 'All Accounts',
    winRateDonut: 'Win Rate',
    wins: 'Wins',
    losses: 'Losses',
    breakeven: 'Breakeven',
    avgWin: 'Average Win',
    avgLoss: 'Average Loss',
    rrRatio: 'Risk/Reward Ratio',
    expectancy: 'Expectancy',
    heatmap: 'Performance Heatmap',
    setupTable: 'Setup Performance',
    symbolChart: 'Symbol Performance',
    byDayTitle: 'Performance by Day',
    byHourTitle: 'Performance by Hour',
    weeklyConsistency: 'Weekly Consistency',
    noData: 'No data yet',
    setup: 'Setup',
    trades: 'Trades',
    winRate: 'Win Rate',
    totalPnl: 'Total PnL',
    avgPnl: 'Avg PnL',
    bestTrade: 'Best Trade',
    loading: 'Loading...',
    certificate: 'Download Certificate',
    days: { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun' },
    sessions: { London: 'London', 'New York': 'New York', Asia: 'Asia', 'NY Lunch': 'NY Lunch' },
    timeGroups: { Morning: 'Morning', London: 'London', NY: 'New York', Evening: 'Evening' },
    week: 'Week',
    minTradesNote: 'Requires min. 2 trades',
  },
};

const SESSIONS = ['London', 'New York', 'Asia', 'NY Lunch'] as const;
const RESULT_VALUES = ['Win', 'Loss', 'Breakeven', 'Partial Win - TP1', 'Partial Win - TP2'];

function parseSetupTag(setupTag: string | null) {
  if (!setupTag) return { result: null, session: null, setup: null };
  const parts = setupTag.split(',').map(s => s.trim()).filter(Boolean);
  let result: string | null = null;
  let session: string | null = null;
  const setup: string[] = [];
  for (const p of parts) {
    if (RESULT_VALUES.includes(p)) result = p;
    else if ((SESSIONS as readonly string[]).includes(p)) session = p;
    else setup.push(p);
  }
  return { result, session, setup: setup.join(', ') || null };
}

function getTradeSession(tr: Trade): string | null {
  if (tr.session) return tr.session;
  return parseSetupTag(tr.setup_tag).session;
}

function getTradeSetup(tr: Trade): string {
  return parseSetupTag(tr.setup_tag).setup || 'Other';
}

function fmtPnl(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}$${v.toFixed(2)}`;
}

// ─── Custom tooltip — theme-aware, no grey cursor box ────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-xl shadow-black/10 px-4 py-3 text-sm animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
      {label !== undefined && (
        <p className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wide">{label}</p>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground text-xs">{p.name}</span>
          </div>
          <span className="font-bold text-foreground text-xs">
            {typeof p.value === 'number' && (p.name?.toLowerCase().includes('pnl') || p.name?.toLowerCase().includes('p&l'))
              ? `${p.value >= 0 ? '+' : ''}$${p.value.toFixed(2)}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}

// ─── Certificate (kept from original) ─────────────────────────
interface CertProps {
  userName: string; lang: Lang; totalTrades: number;
  winRate: string; totalPnl: number; bestTrade: number; profitFactor: string;
}
const CertificateTemplate = forwardRef<HTMLDivElement, CertProps>(
  function CertificateTemplate({ userName, lang, totalTrades, winRate, totalPnl, bestTrade, profitFactor }, ref) {
    const isAr = lang === 'ar'; const isFr = lang === 'fr';
    const CL = isAr ? { congrats: 'يُقدَّم هذا الشهادة بفخر إلى', tagline: 'للأداء المتميز والانضباط في التداول', totalTrades: 'إجمالي الصفقات', winRate: 'نسبة الفوز', totalPnl: 'إجمالي الربح', bestTrade: 'أفضل صفقة', profitFactor: 'معامل الربح', quote: 'الانضباط والاتساق هما أساس النجاح في التداول.', issuedOn: 'صدر بتاريخ:' }
      : isFr ? { congrats: 'Ce certificat est fièrement décerné à', tagline: 'Pour une performance exceptionnelle et de la discipline en trading', totalTrades: 'Total trades', winRate: 'Taux de réussite', totalPnl: 'PnL total', bestTrade: 'Meilleur trade', profitFactor: 'Facteur de profit', quote: 'La discipline et la constance sont les bases du succès en trading.', issuedOn: 'Émis le :' }
      : { congrats: 'This certificate is proudly awarded to', tagline: 'For outstanding performance and discipline in trading', totalTrades: 'Total Trades', winRate: 'Win Rate', totalPnl: 'Total PnL', bestTrade: 'Best Trade', profitFactor: 'Profit Factor', quote: 'Discipline and consistency are the foundation of trading success.', issuedOn: 'Issued on:' };
    const dateStr = new Date().toLocaleDateString(isAr ? 'ar-DZ' : isFr ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const GOLD = '#d4af37', TEAL = '#00e0b8', SLATE = '#94a3b8', GRAY = '#64748b', DARK = '#0a0f1c', DARK2 = '#0d1b2a';
    const W = 1200, H = 850, CX = 600;
    const BW = 340, BH = 110, BG = 20;
    const row1Left = (W - 3 * BW - 2 * BG) / 2;
    const row2Left = (W - 2 * BW - 1 * BG) / 2;
    const mono = 'Helvetica, Arial, sans-serif';
    const fontFamily = isAr ? "'Tajawal', Arial, sans-serif" : mono;
    const pnlColor = totalPnl >= 0 ? '#22c55e' : '#ef4444';
    const stats = [
      { label: CL.totalTrades, value: String(totalTrades), color: '#60a5fa' },
      { label: CL.winRate, value: `${winRate}%`, color: '#00e0b8' },
      { label: CL.totalPnl, value: `$${totalPnl.toFixed(2)}`, color: pnlColor },
      { label: CL.bestTrade, value: bestTrade >= 0 ? `+$${bestTrade.toFixed(2)}` : `$${bestTrade.toFixed(2)}`, color: '#d4af37' },
      { label: CL.profitFactor, value: profitFactor, color: '#a78bfa' },
    ];
    const Divider = ({ top, lx, rx }: { top: number; lx: number; rx: number }) => (
      <><div style={{ position: 'absolute', top, left: lx, width: CX - lx - 11, height: 1, background: '#253545' }} /><div style={{ position: 'absolute', top: top - 7, left: CX - 7, width: 14, height: 14, background: TEAL, transform: 'rotate(45deg)' }} /><div style={{ position: 'absolute', top, left: CX + 11, width: rx - CX - 11, height: 1, background: '#253545' }} /></>
    );
    const Y_TITLE = 48, Y_SUBTITLE = 100, Y_DIV1 = 122, Y_CONGRATS = 140, Y_NAME = 160, Y_TAGLINE = 235, Y_DIV2 = 260;
    const Y_ROW1 = 278, Y_ROW2 = Y_ROW1 + BH + BG, Y_DIV3 = Y_ROW2 + BH + 18, Y_QUOTE = Y_DIV3 + 16;
    const SEAL_R = 65, SEAL_CY = 822 - 60 - SEAL_R, SEAL_CX = CX, Y_SIG = 762 - 68;
    return (
      <div ref={ref} dir={isAr ? 'rtl' : 'ltr'} style={{ position: 'fixed', left: -9999, top: 0, width: W, height: H, overflow: 'hidden', fontFamily, minWidth: W, maxWidth: W, minHeight: H, maxHeight: H }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, background: DARK }} />
        <div style={{ position: 'absolute', top: 0, left: 540, width: 660, height: H, background: DARK2 }} />
        <div style={{ position: 'absolute', top: 15, left: 15, width: W - 30, height: H - 30, border: `3px solid ${GOLD}`, boxSizing: 'border-box' }} />
        <div style={{ position: 'absolute', top: 28, left: 28, width: W - 56, height: H - 56, border: `1px solid ${TEAL}`, boxSizing: 'border-box' }} />
        {([[15,15],[15,W-65],[H-65,15],[H-65,W-65]] as [number,number][]).map(([t,l],i) => (
          <div key={i} style={{ position:'absolute', top:t, left:l, width:50, height:50, ...(i===0?{borderTop:`2.5px solid ${GOLD}`,borderLeft:`2.5px solid ${GOLD}`}:i===1?{borderTop:`2.5px solid ${GOLD}`,borderRight:`2.5px solid ${GOLD}`}:i===2?{borderBottom:`2.5px solid ${GOLD}`,borderLeft:`2.5px solid ${GOLD}`}:{borderBottom:`2.5px solid ${GOLD}`,borderRight:`2.5px solid ${GOLD}`}) }} />
        ))}
        <div style={{ position:'absolute', top: Y_TITLE, left:0, width:W, textAlign:'center', fontSize:36, fontWeight:'bold', color:GOLD, letterSpacing:4, whiteSpace:'nowrap', fontFamily:mono }}>CERTIFICATE OF PERFORMANCE</div>
        <div style={{ position:'absolute', top: Y_SUBTITLE, left:0, width:W, textAlign:'center', fontSize:12, color:'#7a8a9a', fontFamily:mono }}>Presented by TradeSmartDz</div>
        <Divider top={Y_DIV1} lx={180} rx={1020} />
        <div style={{ position:'absolute', top: Y_CONGRATS, left:0, width:W, textAlign:'center', fontSize:13, color:SLATE }}>{CL.congrats}</div>
        <div style={{ position:'absolute', top: Y_NAME, left:60, width:W-120, textAlign:'center', fontSize:52, fontWeight:'bold', color:'#ffffff', lineHeight:'1.1', textShadow:'2px 2px 0 #6b4f00, -1px -1px 0 #6b4f00' }}>{userName}</div>
        <div style={{ position:'absolute', top: Y_TAGLINE, left:60, width:W-120, textAlign:'center', fontSize:13, fontStyle:'italic', color:'#a0b0c0' }}>{CL.tagline}</div>
        <Divider top={Y_DIV2} lx={80} rx={1120} />
        {stats.slice(0,3).map((s,i) => (
          <div key={i} style={{ position:'absolute', top:Y_ROW1, left:row1Left+i*(BW+BG), width:BW, height:BH, boxSizing:'border-box', border:`1.5px solid ${s.color}`, borderRadius:10, background:DARK2, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:16, gap:8 }}>
            <div style={{ fontSize:14, color:'#fff', fontWeight:600, textAlign:'center', fontFamily:mono }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:'bold', color:s.color, textAlign:'center', fontFamily:mono }}>{s.value}</div>
          </div>
        ))}
        {stats.slice(3).map((s,i) => (
          <div key={i} style={{ position:'absolute', top:Y_ROW2, left:row2Left+i*(BW+BG), width:BW, height:BH, boxSizing:'border-box', border:`1.5px solid ${s.color}`, borderRadius:10, background:DARK2, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:16, gap:8 }}>
            <div style={{ fontSize:14, color:'#fff', fontWeight:600, textAlign:'center', fontFamily:mono }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:'bold', color:s.color, textAlign:'center', fontFamily:mono }}>{s.value}</div>
          </div>
        ))}
        <Divider top={Y_DIV3} lx={80} rx={1120} />
        <div style={{ position:'absolute', top:Y_QUOTE, left:100, width:W-200, textAlign:'center', fontSize:12, fontStyle:'italic', color:'#4a5a6a' }}>"{CL.quote}"</div>
        <div style={{ position:'absolute', left:SEAL_CX-SEAL_R, top:SEAL_CY-SEAL_R, width:SEAL_R*2, height:SEAL_R*2, borderRadius:'50%', border:`2px solid ${GOLD}`, boxSizing:'border-box' }} />
        <div style={{ position:'absolute', left:SEAL_CX-53, top:SEAL_CY-53, width:106, height:106, borderRadius:'50%', border:`1px solid ${TEAL}`, boxSizing:'border-box' }} />
        <div style={{ position:'absolute', left:SEAL_CX-52, top:SEAL_CY-52, width:104, height:104, borderRadius:'50%', background:DARK, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, paddingTop:6 }}>
          <svg width="28" height="22" viewBox="0 0 28 22" fill="none"><polyline points="2,12 10,20 26,2" stroke={TEAL} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div style={{ fontSize:10, color:'#fff', letterSpacing:1, fontFamily:mono }}>VERIFIED</div>
          <div style={{ fontSize:14, fontWeight:'bold', color:GOLD, letterSpacing:1, fontFamily:mono }}>TRADER</div>
          <div style={{ fontSize:9, color:TEAL, fontFamily:mono }}>TradeSmartDz</div>
          <div style={{ fontSize:9, color:'#506070', fontFamily:mono }}>2026</div>
        </div>
        <div style={{ position:'absolute', top:Y_SIG, left:912, width:200, textAlign:'center' }}>
          <div style={{ fontSize:18, fontStyle:'italic', color:TEAL, fontFamily:mono }}>TradeSmartDz</div>
          <div style={{ height:1, background:GRAY, margin:'7px auto', width:100 }} />
          <div style={{ fontSize:12, color:SLATE, fontFamily:mono }}>Founder &amp; CEO</div>
          <div style={{ fontSize:11, color:GRAY, marginTop:4, fontFamily }}>{CL.issuedOn} {dateStr}</div>
        </div>
      </div>
    );
  }
);
CertificateTemplate.displayName = 'CertificateTemplate';

// ─── Main component ────────────────────────────────────────────
const AnalyticsPage = () => {
  const { t, language } = useLanguage();
  const lang = language as Lang;
  const l = L[lang];
  const { user, userPlan, userStatus } = useAuth();
  const isPro = userPlan === 'pro' || userStatus === 'trial';
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [timeRange, setTimeRange] = useState('allTime');
  const [accountFilter, setAccountFilter] = useState('all');
  const [certLoading, setCertLoading] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: tradesData }, { data: accs }, { data: profile }] = await Promise.all([
        supabase.from('trades').select('*').eq('user_id', user.id).order('close_time', { ascending: true }),
        supabase.from('mt5_accounts').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      ]);
      setAllTrades(tradesData ?? []);
      setAccounts(accs ?? []);
      setFullName(profile?.full_name || '');
      setLoading(false);
    })();
  }, [user]);

  const ranges = [
    { key: 'thisWeek',    label: t('thisWeek') },
    { key: 'thisMonth',   label: t('thisMonth') },
    { key: 'last3Months', label: t('last3Months') },
    { key: 'allTime',     label: t('allTime') },
  ];

  // Filter by date range + account
  const trades = useMemo(() => {
    let list = allTrades.filter(tr => tr.profit !== null);
    if (accountFilter !== 'all') {
      list = list.filter(tr => tr.account_id === accountFilter);
    }
    if (timeRange !== 'allTime') {
      const now = new Date();
      list = list.filter(tr => {
        if (!tr.close_time) return false;
        const d = new Date(tr.close_time);
        if (timeRange === 'thisWeek') {
          const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
          return d >= start;
        }
        if (timeRange === 'thisMonth') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (timeRange === 'last3Months') { const s = new Date(now); s.setMonth(now.getMonth()-3); return d >= s; }
        return true;
      });
    }
    return list;
  }, [allTrades, timeRange, accountFilter]);

  // ── Core stats ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const wins      = trades.filter(tr => (tr.profit ?? 0) > 0);
    const losses    = trades.filter(tr => (tr.profit ?? 0) < 0);
    const beEvens   = trades.filter(tr => (tr.profit ?? 0) === 0);
    const totalPnl  = trades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
    const winRate   = trades.length ? (wins.length / trades.length) * 100 : 0;
    const avgWin    = wins.length   ? wins.reduce((s, tr) => s + (tr.profit ?? 0), 0) / wins.length   : 0;
    const avgLoss   = losses.length ? Math.abs(losses.reduce((s, tr) => s + (tr.profit ?? 0), 0) / losses.length) : 0;
    const rr        = avgLoss > 0 ? (avgWin / avgLoss) : 0;
    const lossRate  = trades.length ? (losses.length / trades.length) : 0;
    const expectancy = (winRate / 100) * avgWin - lossRate * avgLoss;
    const grossProfit = wins.reduce((s, tr) => s + (tr.profit ?? 0), 0);
    const grossLoss   = Math.abs(losses.reduce((s, tr) => s + (tr.profit ?? 0), 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞';
    const bestTradeVal = trades.length ? Math.max(...trades.map(tr => tr.profit ?? 0)) : 0;
    return { wins: wins.length, losses: losses.length, beEvens: beEvens.length, totalPnl, winRate, avgWin, avgLoss, rr, expectancy, profitFactor, bestTradeVal, count: trades.length };
  }, [trades]);

  // ── Best Day insight ──────────────────────────────────────────
  const bestDayInsight = useMemo(() => {
    const dayMap: Record<number, { wins: number; total: number }> = {};
    trades.forEach(tr => {
      if (!tr.close_time) return;
      const dow = new Date(tr.close_time).getDay();
      if (!dayMap[dow]) dayMap[dow] = { wins: 0, total: 0 };
      dayMap[dow].total++;
      if ((tr.profit ?? 0) > 0) dayMap[dow].wins++;
    });
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    let best: { name: string; wr: number } | null = null;
    Object.entries(dayMap).forEach(([dow, v]) => {
      if (v.total < 2) return;
      const wr = Math.round((v.wins / v.total) * 100);
      if (!best || wr > best.wr) best = { name: l.days[dayNames[+dow] as keyof typeof l.days] || dayNames[+dow], wr };
    });
    return best;
  }, [trades, l]);

  // ── Best Session insight ──────────────────────────────────────
  const bestSessionInsight = useMemo(() => {
    const sesMap: Record<string, number> = {};
    trades.forEach(tr => {
      const ses = getTradeSession(tr);
      if (!ses) return;
      if (!sesMap[ses]) sesMap[ses] = 0;
      sesMap[ses] += tr.profit ?? 0;
    });
    const best = Object.entries(sesMap).sort((a, b) => b[1] - a[1])[0];
    if (!best) return null;
    const name = l.sessions[best[0] as keyof typeof l.sessions] || best[0];
    return { name, pnl: best[1] };
  }, [trades, l]);

  // ── Best Setup insight ────────────────────────────────────────
  const bestSetupInsight = useMemo(() => {
    const setupMap: Record<string, { wins: number; total: number }> = {};
    trades.forEach(tr => {
      const s = getTradeSetup(tr);
      if (s === 'Other') return;
      if (!setupMap[s]) setupMap[s] = { wins: 0, total: 0 };
      setupMap[s].total++;
      if ((tr.profit ?? 0) > 0) setupMap[s].wins++;
    });
    let best: { name: string; wr: number } | null = null;
    Object.entries(setupMap).forEach(([name, v]) => {
      if (v.total < 2) return;
      const wr = Math.round((v.wins / v.total) * 100);
      if (!best || wr > best.wr) best = { name: name.length > 16 ? name.slice(0,16)+'…' : name, wr };
    });
    return best;
  }, [trades]);

  // ── Donut chart data ──────────────────────────────────────────
  const donutData = [
    { name: l.wins,     value: stats.wins,    color: '#22c55e' },
    { name: l.losses,   value: stats.losses,  color: '#ef4444' },
    { name: l.breakeven, value: stats.beEvens, color: '#475569' },
  ].filter(d => d.value > 0);

  // ── Heatmap: session × day ────────────────────────────────────
  const HEATMAP_DAYS = ['Mon','Tue','Wed','Thu','Fri'] as const;

  const heatmap = useMemo(() => {
    const pnl:    Record<string, Record<string, number>>   = {};
    const counts: Record<string, Record<string, number>>   = {};
    const wins:   Record<string, Record<string, number>>   = {};
    const tradesList: Record<string, Record<string, Trade[]>> = {};

    SESSIONS.forEach(ses => {
      pnl[ses] = {}; counts[ses] = {}; wins[ses] = {}; tradesList[ses] = {};
      HEATMAP_DAYS.forEach(d => { pnl[ses][d] = 0; counts[ses][d] = 0; wins[ses][d] = 0; tradesList[ses][d] = []; });
    });

    trades.forEach(tr => {
      const ses = getTradeSession(tr);
      if (!ses || !(SESSIONS as readonly string[]).includes(ses)) return;
      if (!tr.close_time) return;
      const dow = new Date(tr.close_time).getDay();
      const dayIdx = dow - 1;
      if (dayIdx < 0 || dayIdx > 4) return;
      const day = HEATMAP_DAYS[dayIdx];
      pnl[ses][day]    += tr.profit ?? 0;
      counts[ses][day] += 1;
      tradesList[ses][day].push(tr);
      if ((tr.profit ?? 0) > 0) wins[ses][day]++;
    });
    return { pnl, counts, wins, tradesList };
  }, [trades]);

  // Heatmap cell classes — Tailwind only, theme-aware
  function heatCellClass(val: number, cnt: number): string {
    if (cnt === 0) return 'bg-muted text-muted-foreground';
    if (val > 100)  return 'bg-green-900/40 text-green-400';
    if (val > 0)    return 'bg-green-900/20 text-green-500';
    if (val < -100) return 'bg-red-900/40 text-red-400';
    if (val < 0)    return 'bg-red-900/20 text-red-400';
    return 'bg-muted text-muted-foreground'; // breakeven
  }

  // Heatmap detail popover state
  const [heatDetail, setHeatDetail] = useState<{
    ses: string; day: string; totalPnl: number; cnt: number; winRate: number;
    avgPnl: number; symbols: string[]; bestTrade: number;
  } | null>(null);

  const openHeatDetail = (ses: string, day: string) => {
    const cnt  = heatmap.counts[ses][day];
    if (cnt === 0) return;
    const pnlV = heatmap.pnl[ses][day];
    const winsV = heatmap.wins[ses][day];
    const trs  = heatmap.tradesList[ses][day];
    const symbols = [...new Set(trs.map(t => t.symbol).filter(Boolean))];
    const profits = trs.map(t => t.profit ?? 0);
    setHeatDetail({
      ses, day,
      totalPnl: pnlV,
      cnt,
      winRate: Math.round((winsV / cnt) * 100),
      avgPnl: pnlV / cnt,
      symbols,
      bestTrade: Math.max(...profits),
    });
  };

  // ── Setup table ───────────────────────────────────────────────
  const setupTableData = useMemo(() => {
    const map: Record<string, { wins: number; total: number; pnls: number[] }> = {};
    trades.forEach(tr => {
      const s = getTradeSetup(tr);
      if (!map[s]) map[s] = { wins: 0, total: 0, pnls: [] };
      map[s].total++;
      map[s].pnls.push(tr.profit ?? 0);
      if ((tr.profit ?? 0) > 0) map[s].wins++;
    });
    return Object.entries(map).map(([name, v]) => ({
      name,
      total: v.total,
      wr: Math.round((v.wins / v.total) * 100),
      totalPnl: v.pnls.reduce((s, x) => s + x, 0),
      avgPnl: v.pnls.reduce((s, x) => s + x, 0) / v.total,
      bestTrade: Math.max(...v.pnls),
    })).sort((a, b) => b.wr - a.wr);
  }, [trades]);

  // ── Symbol bars ───────────────────────────────────────────────
  const symbolData = useMemo(() => {
    const map: Record<string, { pnl: number; count: number; wins: number }> = {};
    trades.forEach(tr => {
      const sym = tr.symbol || 'Unknown';
      if (!map[sym]) map[sym] = { pnl: 0, count: 0, wins: 0 };
      map[sym].pnl += tr.profit ?? 0;
      map[sym].count++;
      if ((tr.profit ?? 0) > 0) map[sym].wins++;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, pnl: +v.pnl.toFixed(2), count: v.count, winRate: Math.round((v.wins / v.count) * 100) }))
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
      .slice(0, 12);
  }, [trades]);

  // ── By day of week bars ───────────────────────────────────────
  const byDayData = useMemo(() => {
    const entries = ['Mon','Tue','Wed','Thu','Fri'].map((day, i) => {
      const dow = i + 1;
      const ts = trades.filter(tr => tr.close_time && new Date(tr.close_time).getDay() === dow);
      return { name: l.days[day as keyof typeof l.days], pnl: +ts.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2) };
    });
    return entries;
  }, [trades, l]);

  // ── By time group ─────────────────────────────────────────────
  const byTimeData = useMemo(() => {
    const groups = [
      { key: 'Morning', hours: [6,7,8,9,10], label: l.timeGroups.Morning },
      { key: 'London',  hours: [10,11,12,13], label: l.timeGroups.London },
      { key: 'NY',      hours: [14,15,16,17,18], label: l.timeGroups.NY },
      { key: 'Evening', hours: [18,19,20,21,22], label: l.timeGroups.Evening },
    ];
    return groups.map(g => {
      const ts = trades.filter(tr => {
        if (!tr.open_time) return false;
        const h = new Date(tr.open_time).getHours();
        return g.hours.includes(h);
      });
      const wins = ts.filter(tr => (tr.profit ?? 0) > 0).length;
      return {
        name: g.label,
        count: ts.length,
        winRate: ts.length ? Math.round((wins / ts.length) * 100) : 0,
        pnl: +ts.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2),
      };
    });
  }, [trades, l]);

  // ── Weekly consistency ────────────────────────────────────────
  const weeklyData = useMemo(() => {
    const map: Record<string, number> = {};
    trades.forEach(tr => {
      if (!tr.close_time) return;
      const d = new Date(tr.close_time);
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      const key = startOfWeek.toLocaleDateString('en-CA');
      if (!map[key]) map[key] = 0;
      map[key] += tr.profit ?? 0;
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, pnl], i) => ({
        name: `${l.week} ${i + 1}`,
        pnl: +pnl.toFixed(2),
      }));
  }, [trades, l]);

  // ── Certificate ───────────────────────────────────────────────
  const certStats = useMemo(() => ({
    totalTrades: stats.count,
    winRate: stats.winRate.toFixed(1),
    totalPnl: stats.totalPnl,
    bestTrade: stats.bestTradeVal,
    profitFactor: stats.profitFactor,
  }), [stats]);

  const downloadCertificate = async () => {
    if (!isPro) {
      navigate('/settings?tab=subscription');
      return;
    }
    const el = certRef.current;
    if (!el) return;
    setCertLoading(true);
    const prevLeft = el.style.left;
    el.style.left = '0px';
    el.style.zIndex = '9999';
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: null, width: 1200, height: 850 });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1200, 850] });
      pdf.addImage(imgData, 'JPEG', 0, 0, 1200, 850);
      pdf.save(`tradesmartdz-certificate-${new Date().toISOString().slice(0,10)}.pdf`);
    } finally {
      el.style.left = prevLeft;
      el.style.zIndex = '';
      setCertLoading(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const noDataMsg = l.noData;

  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    const isNegative = value < 0;
    const label = `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(0)}`;
    return (
      <text
        x={isNegative ? x - 8 : x + width + 8}
        y={y + height / 2}
        textAnchor={isNegative ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={700}
        fill={value >= 0 ? '#10b981' : '#ef4444'}
      >
        {label}
      </text>
    );
  };

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── TOP BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{l.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date range */}
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {ranges.map(r => (
              <button
                key={r.key}
                onClick={() => setTimeRange(r.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${timeRange === r.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {/* Account selector */}
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{l.allAccounts}</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.account_name || a.firm || 'Account'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Certificate */}
          <Button variant="outline" size="sm" onClick={downloadCertificate} disabled={certLoading} className="gap-1.5 h-9">
            {certLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            <span className="hidden sm:inline">{l.certificate}</span>
          </Button>
        </div>
      </div>

      {/* ── SECTION 1: INSIGHT CARDS ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Best Day */}
        <Card className="border-border bg-card">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{l.bestDay}</p>
              {bestDayInsight ? (
                <>
                  <p className="text-lg font-bold text-foreground truncate">{bestDayInsight.name}</p>
                  <p className="text-xs text-[#22c55e]">{bestDayInsight.wr}% {l.winRate}</p>
                </>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
          </CardContent>
        </Card>

        {/* Best Session */}
        <Card className="border-border bg-card">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{l.bestSession}</p>
              {bestSessionInsight ? (
                <>
                  <p className="text-lg font-bold text-foreground truncate">{bestSessionInsight.name}</p>
                  <p className={`text-xs ${bestSessionInsight.pnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{fmtPnl(bestSessionInsight.pnl)}</p>
                </>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
          </CardContent>
        </Card>

        {/* Best Setup */}
        <Card className="border-border bg-card">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{l.bestSetup}</p>
              {bestSetupInsight ? (
                <>
                  <p className="text-lg font-bold text-foreground truncate">{bestSetupInsight.name}</p>
                  <p className="text-xs text-[#22c55e]">{bestSetupInsight.wr}% {l.winRate}</p>
                </>
              ) : <p className="text-sm text-muted-foreground">{l.minTradesNote}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── SECTION 2: DONUT + AVERAGES ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Donut */}
        <Section title={l.winRateDonut}>
          {trades.length === 0 ? <EmptyState msg={noDataMsg} /> : (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <ResponsiveContainer width={220} height={220}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={62} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">{stats.winRate.toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground">{l.winRate}</span>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" /><span className="text-muted-foreground">{stats.wins} {l.wins}</span></span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /><span className="text-muted-foreground">{stats.losses} {l.losses}</span></span>
                {stats.beEvens > 0 && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#475569]" /><span className="text-muted-foreground">{stats.beEvens} {l.breakeven}</span></span>}
              </div>
            </div>
          )}
        </Section>

        {/* Averages */}
        <Section title={l.avgWin + ' / ' + l.avgLoss}>
          {trades.length === 0 ? <EmptyState msg={noDataMsg} /> : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.15)] p-4">
                <span className="text-sm text-muted-foreground">{l.avgWin}</span>
                <span className="text-xl font-bold text-[#22c55e]">+${stats.avgWin.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)] p-4">
                <span className="text-sm text-muted-foreground">{l.avgLoss}</span>
                <span className="text-xl font-bold text-[#ef4444]">-${stats.avgLoss.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{l.rrRatio}</p>
                  <p className="text-lg font-bold text-foreground">{stats.rr.toFixed(2)}:1</p>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{l.expectancy}</p>
                  <p className={`text-lg font-bold ${stats.expectancy >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>${stats.expectancy.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* ── SECTION 3: HEATMAP ── */}
      <div className="relative">
      {!isPro && <ProLockOverlay feature={l.heatmap} />}
      <Section title={l.heatmap}>
        {trades.length === 0 ? <EmptyState msg={noDataMsg} /> : (
          <>
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 pr-3 w-24" />
                    {HEATMAP_DAYS.map(d => (
                      <th key={d} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground pb-2 text-center">
                        {l.days[d]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SESSIONS.map(ses => (
                    <tr key={ses}>
                      <td className="text-sm font-medium text-foreground pr-3 text-right w-24 flex-shrink-0 whitespace-nowrap align-middle py-1">
                        {l.sessions[ses]}
                      </td>
                      {HEATMAP_DAYS.map(d => {
                        const val = heatmap.pnl[ses][d];
                        const cnt = heatmap.counts[ses][d];
                        const hasTrades = cnt > 0;
                        const cellStyle = hasTrades
                          ? val > 0
                            ? { background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.22))', border: '1px solid rgba(16,185,129,0.25)', boxShadow: '0 0 10px rgba(16,185,129,0.08)' }
                            : val < 0
                            ? { background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.22))', border: '1px solid rgba(239,68,68,0.25)', boxShadow: '0 0 10px rgba(239,68,68,0.08)' }
                            : {}
                          : {};
                        return (
                          <td key={d} className="p-1">
                            <div
                              onClick={() => openHeatDetail(ses, d)}
                              className={`rounded-xl flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-[60px] md:min-w-[72px] md:h-[72px] transition-transform duration-150 ${hasTrades ? 'cursor-pointer hover:scale-105' : 'cursor-default bg-muted/20 border border-transparent'}`}
                              style={cellStyle}
                            >
                              {hasTrades ? (
                                <>
                                  <span className={`text-xs font-bold ${val >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {val >= 0 ? '+' : ''}{val.toFixed(0)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">{cnt}</span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground/30">—</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>

            {/* Heatmap detail modal — premium theme-aware card */}
            {heatDetail && (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-4"
                onClick={() => setHeatDetail(null)}
              >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200" />
                {/* Card */}
                <div
                  className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-5 z-10 animate-in fade-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:zoom-in-95 duration-300"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="font-bold text-foreground text-lg leading-tight">
                        {l.days[heatDetail.day as keyof typeof l.days]} — {l.sessions[heatDetail.ses as keyof typeof l.sessions]}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{heatDetail.cnt} {l.trades}</p>
                    </div>
                    <button
                      onClick={() => setHeatDetail(null)}
                      className="p-2 rounded-xl hover:bg-muted transition-colors -mt-1 -mr-1"
                    >
                      <XIcon className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>

                  {/* Win rate ring + stats */}
                  <div className="flex items-center gap-5 mb-5">
                    {/* SVG ring */}
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                        <circle cx="18" cy="18" r="14" fill="none"
                          stroke="currentColor" strokeOpacity="0.08" strokeWidth="3.5" />
                        <circle cx="18" cy="18" r="14" fill="none"
                          stroke={heatDetail.winRate >= 50 ? '#10b981' : '#ef4444'}
                          strokeWidth="3.5"
                          strokeDasharray={`${(heatDetail.winRate / 100) * 87.96} 87.96`}
                          strokeLinecap="round"
                          className="transition-all duration-700" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-sm font-black leading-none ${heatDetail.winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                          {heatDetail.winRate}%
                        </span>
                        <span className="text-[9px] text-muted-foreground mt-0.5">{l.winRate}</span>
                      </div>
                    </div>
                    {/* Stats column */}
                    <div className="flex-1 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{l.totalPnl}</span>
                        <span className={`text-sm font-bold ${heatDetail.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {heatDetail.totalPnl >= 0 ? '+' : ''}${heatDetail.totalPnl.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{l.avgPnl}</span>
                        <span className={`text-sm font-medium ${heatDetail.avgPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {heatDetail.avgPnl >= 0 ? '+' : ''}${heatDetail.avgPnl.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{l.bestTrade}</span>
                        <span className="text-sm font-medium text-green-500">
                          +${heatDetail.bestTrade.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border mb-4" />

                  {/* Symbols */}
                  {heatDetail.symbols.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Symbols</p>
                      <div className="flex flex-wrap gap-1.5">
                        {heatDetail.symbols.map(sym => (
                          <span key={sym} className="px-2.5 py-1 bg-muted rounded-full text-xs font-semibold text-foreground">
                            {sym}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Section>
      </div>

      {/* ── SECTION 4: SETUP TABLE ── */}
      <div className="relative">
      {!isPro && <ProLockOverlay feature={l.setupTable} />}
      <Section title={l.setupTable}>
        {setupTableData.length === 0 ? <EmptyState msg={noDataMsg} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[l.setup, l.trades, l.winRate, l.totalPnl, l.avgPnl, l.bestTrade].map(h => (
                    <th key={h} className="pb-2 text-start text-xs font-medium text-muted-foreground first:ps-0 px-3 first:px-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {setupTableData.map((row, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                    <td className="py-2.5 text-sm font-medium text-foreground max-w-[120px] truncate">{row.name}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{row.total}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${row.wr >= 60 ? 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]' : row.wr >= 40 ? 'bg-[rgba(234,179,8,0.15)] text-yellow-400' : 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]'}`}>
                        {row.wr}%
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 text-xs font-semibold ${row.totalPnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{fmtPnl(row.totalPnl)}</td>
                    <td className={`py-2.5 px-3 text-xs ${row.avgPnl >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{fmtPnl(row.avgPnl)}</td>
                    <td className="py-2.5 px-3 text-xs text-[#22c55e]">+${row.bestTrade.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      </div>

      {/* ── SECTION 5: SYMBOL BARS ── */}
      <div className="relative">
      {!isPro && <ProLockOverlay feature={l.symbolChart} />}
      <Section title={l.symbolChart}>
        {symbolData.length === 0 ? <EmptyState msg={noDataMsg} /> : (
          <div className="w-full overflow-hidden">
            <ResponsiveContainer width="100%" height={Math.max(150, symbolData.length * 64)}>
              <BarChart
                layout="vertical"
                data={symbolData}
                margin={{ top: 8, right: 70, left: 70, bottom: 8 }}
                cursor={false}
              >
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.2} horizontal={false} />
                <XAxis
                  type="number"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={55}
                  tick={{ fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(value) => value.length > 7 ? value.substring(0, 7) + '…' : value}
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <ReferenceLine x={0} stroke="#6b7280" strokeOpacity={0.4} strokeDasharray="3 3" />
                <Bar dataKey="pnl" name="PnL" radius={[0, 6, 6, 0]} cursor={false}>
                  {symbolData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'}
                      fillOpacity={0.9}
                    />
                  ))}
                  <LabelList content={renderCustomLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>
      </div>

      {/* ── SECTION 6: TIME ANALYSIS ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Day */}
        <Section title={l.byDayTitle}>
          {byDayData.every(d => d.pnl === 0) ? <EmptyState msg={noDataMsg} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byDayData} cursor={false}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.2} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Bar dataKey="pnl" name="PnL" radius={[4,4,0,0]} cursor={false}>
                  {byDayData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.9} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* By Time Group — single teal P&L bars */}
        <div className="relative">
        {!isPro && <ProLockOverlay feature={l.byHourTitle} />}
        <Section title={l.byHourTitle}>
          {byTimeData.every(d => d.pnl === 0) ? <EmptyState msg={noDataMsg} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byTimeData} cursor={false}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.2} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Bar dataKey="pnl" name="PnL" radius={[6,6,0,0]} cursor={false}>
                  {byTimeData.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? '#14b8a6' : '#ef4444'} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
        </div>
      </div>

      {/* ── SECTION 7: WEEKLY CONSISTENCY ── */}
      <Section title={l.weeklyConsistency}>
        {weeklyData.length === 0 ? <EmptyState msg={noDataMsg} /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData} cursor={false}>
              <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity={0.2} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="pnl" name="PnL" radius={[4,4,0,0]} cursor={false}>
                {weeklyData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.9} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* Hidden certificate */}
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
