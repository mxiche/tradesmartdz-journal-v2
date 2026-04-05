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

// ---- Mini Calendar ----
function MiniCalendar({ trades, lang }: { trades: Trade[]; lang: 'ar'|'fr'|'en' }) {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const { year, month } = calMonth;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay + 6) % 7; // Mon-start

  const dayData = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayTrades = trades.filter(tr => {
        if (!tr.close_time) return false;
        const d = new Date(tr.close_time);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
      });
      const pnl = dayTrades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
      return { day, pnl, count: dayTrades.length };
    });
  }, [trades, year, month]);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
    { month: 'long', year: 'numeric' }
  );
  const dayNames = lang === 'ar'
    ? ['إث','ثل','أر','خم','جم','سب','أح']
    : lang === 'fr'
    ? ['Lu','Ma','Me','Je','Ve','Sa','Di']
    : ['Mo','Tu','We','Th','Fr','Sa','Su'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        <button onClick={() => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {dayNames.map(d => (
          <div key={d} className="py-1 text-center text-[10px] font-medium text-muted-foreground">{d}</div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
        {dayData.map(({ day, pnl, count }) => {
          const today = new Date();
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          let bg = 'bg-secondary/30 text-muted-foreground';
          if (count > 0) bg = pnl > 0 ? 'bg-profit/20 text-profit' : pnl < 0 ? 'bg-loss/20 text-loss' : 'bg-yellow-500/15 text-yellow-400';
          return (
            <div key={day} className={`relative flex flex-col items-center rounded-md p-0.5 ${bg} ${isToday ? 'ring-1 ring-primary' : ''}`}>
              <span className="text-[10px] font-semibold leading-tight">{day}</span>
              {count > 0 && (
                <span className="text-[8px] leading-tight tabular-nums">
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Add Trade Form (reused from TradesPage) ----
function QuickAddTrade({
  open, onClose, accounts, lang, user, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  lang: 'ar'|'fr'|'en';
  user: any;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    symbol: '', direction: '' as 'BUY'|'SELL'|'', result: '', profit: '',
    tp1Amount: '', tp2Amount: '', risk: '', open_time: '', close_time: '',
    session: '', setup_tag: '', notes: '', account_id: '',
  });
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

      {/* ── THIRD ROW: Calendar + Accounts ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Calendar — 40% */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{lang === 'ar' ? 'التقويم الشهري' : lang === 'fr' ? 'Calendrier mensuel' : 'Monthly Calendar'}</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniCalendar trades={closedTrades} lang={lang} />
          </CardContent>
        </Card>

        {/* Connected Accounts — 60% */}
        <Card className="border-border bg-card lg:col-span-3">
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
              <div className="space-y-4 max-h-[360px] overflow-y-auto pe-1">
                {accounts.map(acc => (
                  <AccountCard key={acc.id} acc={acc} lang={lang} compact userId={user?.id} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
