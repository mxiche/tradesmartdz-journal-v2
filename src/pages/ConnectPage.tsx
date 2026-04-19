import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, TrendingUp, TrendingDown, Wallet, Lock, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Account = Tables<'mt5_accounts'>;

// --- Forex / CFD ---
const PROP_FIRMS_FOREX = ['FTMO', 'FundingPips', 'Alpha Capital', 'FundedNext', 'Exness', 'Other'];
const ACCOUNT_TYPES_FOREX = ['Challenge Phase 1', 'Challenge Phase 2', 'Instant Funded', 'Funded', 'Live', 'Demo'];
const ACCOUNT_SIZES_FOREX = ['2500', '5000', '6000', '10000', '15000', '25000', '50000', '100000', '200000'];

// --- Futures ---
const PROP_FIRMS_FUTURES = ['Apex Trader Funding', 'Topstep', 'Earn2Trade', 'BluSky Trading', 'Other'];
const ACCOUNT_TYPES_FUTURES = ['Evaluation', 'PA', 'Live', 'Demo'];
const ACCOUNT_SIZES_FUTURES = ['25000', '50000', '100000', '150000', '200000', '300000'];

// --- Shared ---
const DRAWDOWN_TYPES = ['static', 'eod_trailing', 'intraday_trailing'];
const CONSISTENCY_OPTIONS = ['0', '25', '30', '40', '50'];

const PROFIT_TARGET_REQUIRED_TYPES = ['Challenge Phase 1', 'Challenge Phase 2', 'Evaluation'];
const SHOWS_PROFIT_PROGRESS = ['Challenge Phase 1', 'Challenge Phase 2', 'Evaluation'];

export function typeBadgeClass(type: string | null): string {
  switch (type) {
    case 'Challenge Phase 1': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    case 'Challenge Phase 2': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    case 'Instant Funded':    return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    case 'Funded':            return 'bg-teal-500/20 text-teal-600 border border-teal-500/30';
    case 'Live':              return 'bg-blue-500/20 text-blue-500 border border-blue-500/30';
    case 'Demo':              return 'bg-gray-100 text-gray-500 border border-gray-200';
    case 'Evaluation':        return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    case 'PA':                return 'bg-teal-500/20 text-teal-600 border border-teal-500/30';
    default:                  return 'bg-gray-100 text-gray-500 border border-gray-200';
  }
}

export function profitProgressPct(acc: Account): number {
  const start = acc.starting_balance ?? 0;
  const curr = acc.balance ?? 0;
  const target = acc.profit_target ?? 10;
  if (!start || !target) return 0;
  return Math.min(Math.max(((curr - start) / start * 100) / target * 100, 0), 100);
}

export function drawdownProgressPct(acc: Account): number {
  const start = acc.starting_balance ?? 0;
  const curr = acc.balance ?? 0;
  const limit = acc.max_drawdown_limit ?? 10;
  if (!start || !limit || curr >= start) return 0;
  return Math.min(((start - curr) / start * 100) / limit * 100, 100);
}

export function ddBarColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-400';
  return 'bg-teal-500';
}

const DEFAULT_FORM = {
  account_category: '',
  account_name: '',
  firm: '',
  customFirm: '',
  account_type: '',
  account_size: '',
  customSize: '',
  currency: 'USD',
  starting_balance: '',
  balance: '',
  // Forex rules (%)
  profit_target: '10',
  max_drawdown_limit: '10',
  daily_loss_limit: '5',
  drawdown_type: 'static',
  trailing_floor: '',
  consistency_rule_pct: '0',
  profit_split_pct: '80',
  min_trading_days: '10',
  // Futures rules ($)
  profit_target_dollars: '',
  max_loss_limit_dollars: '',
  daily_loss_dollars: '',
  trailing_floor_dollars: '',
  contract_limit: '',
  position_close_time: '',
  min_winning_days: '',
  winning_day_threshold: '',
  profit_split_pct_futures: '80',
};

const ConnectPage = () => {
  const { language, t } = useLanguage();
  const lang = language as 'ar' | 'fr' | 'en';
  const { user, userPlan, userStatus } = useAuth();
  const isPro = userPlan === 'pro' || userStatus === 'trial';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const fetchAccounts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('mt5_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setAccounts(data ?? []);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchAccounts().finally(() => setLoading(false));
  }, [user]);

  const openAdd = () => {
    if (!isPro && accounts.length >= 1) {
      toast.error(
        lang === 'ar'
          ? 'الخطة المجانية: حساب واحد فقط. ترقّ إلى Pro للحسابات غير المحدودة.'
          : lang === 'fr'
          ? 'Plan gratuit: 1 compte seulement. Passez à Pro pour des comptes illimités.'
          : 'Free plan: 1 account only. Upgrade to Pro for unlimited accounts.'
      );
      return;
    }
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setFormStep(1);
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditingId(acc.id);
    const a = acc as any;
    const category = a.account_category ?? 'forex_cfd';
    const firms = category === 'futures' ? PROP_FIRMS_FUTURES : PROP_FIRMS_FOREX;
    const sizes = category === 'futures' ? ACCOUNT_SIZES_FUTURES : ACCOUNT_SIZES_FOREX;
    const firmKnown = firms.slice(0, -1).includes(acc.firm);
    const accSizeStr = String(Math.round(acc.account_size ?? 0));
    const sizeKnown = sizes.includes(accSizeStr);
    setForm({
      account_category: category,
      account_name: acc.account_name ?? '',
      firm: firmKnown ? acc.firm : 'Other',
      customFirm: firmKnown ? '' : acc.firm,
      account_type: acc.account_type ?? '',
      account_size: sizeKnown ? accSizeStr : 'Custom',
      customSize: sizeKnown ? '' : String(acc.account_size ?? ''),
      currency: acc.currency ?? 'USD',
      starting_balance: String(acc.starting_balance ?? ''),
      balance: String(acc.balance ?? ''),
      profit_target: String(acc.profit_target ?? 10),
      max_drawdown_limit: String(acc.max_drawdown_limit ?? 10),
      daily_loss_limit: String(acc.daily_loss_limit ?? 5),
      drawdown_type: a.drawdown_type ?? 'static',
      trailing_floor: String(a.trailing_floor ?? ''),
      consistency_rule_pct: String(a.consistency_rule ?? 0),
      profit_split_pct: String(a.profit_split ?? 80),
      min_trading_days: String(a.min_trading_days ?? 10),
      profit_target_dollars: String(a.profit_target_dollars ?? ''),
      max_loss_limit_dollars: String(a.max_loss_limit_dollars ?? ''),
      daily_loss_dollars: String(a.daily_loss_limit_dollars ?? ''),
      trailing_floor_dollars: String(a.trailing_floor_dollars ?? ''),
      contract_limit: String(a.contract_limit ?? ''),
      position_close_time: a.position_close_time ?? '',
      min_winning_days: String(a.min_winning_days ?? ''),
      winning_day_threshold: String(a.winning_day_threshold ?? ''),
      profit_split_pct_futures: String(a.profit_split ?? 80),
    });
    setFormStep(1);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const firmValue = form.firm === 'Other' ? form.customFirm.trim() : form.firm;
    const sizeValue = form.account_size === 'Custom'
      ? (parseFloat(form.customSize) || null)
      : (parseFloat(form.account_size) || null);

    if (!form.account_name.trim() || !firmValue || !form.account_type || !form.starting_balance || !form.balance) {
      toast.error(
        lang === 'ar' ? 'يرجى إكمال جميع الحقول المطلوبة' :
        lang === 'fr' ? 'Veuillez remplir tous les champs obligatoires' :
        'Please complete all required fields'
      );
      return;
    }
    setSubmitting(true);
    try {
      const isTrailing = form.drawdown_type === 'eod_trailing' || form.drawdown_type === 'intraday_trailing';
      const payload: any = {
        user_id: user.id,
        account_name: form.account_name.trim(),
        firm: firmValue,
        account_type: form.account_type,
        account_size: sizeValue,
        starting_balance: parseFloat(form.starting_balance) || null,
        balance: parseFloat(form.balance) || null,
        currency: form.currency,
        account_category: form.account_category,
        drawdown_type: form.drawdown_type,
        profit_split: parseFloat(
          form.account_category === 'futures' ? form.profit_split_pct_futures : form.profit_split_pct
        ) || 80,
        trailing_floor: isTrailing && form.trailing_floor ? parseFloat(form.trailing_floor) : null,
        min_trading_days: parseFloat(form.min_trading_days) || null,
        profit_target: form.account_category !== 'futures' ? parseFloat(form.profit_target) || null : null,
        max_drawdown_limit: form.account_category !== 'futures' ? parseFloat(form.max_drawdown_limit) || null : null,
        daily_loss_limit: form.account_category !== 'futures' ? parseFloat(form.daily_loss_limit) || null : null,
        profit_target_dollars: form.account_category === 'futures' ? parseFloat(form.profit_target_dollars) || null : null,
        max_loss_limit_dollars: form.account_category === 'futures' ? parseFloat(form.max_loss_limit_dollars) || null : null,
        daily_loss_limit_dollars: form.account_category === 'futures' ? parseFloat(form.daily_loss_dollars) || null : null,
        contract_limit: parseFloat(form.contract_limit) || null,
        position_close_time: form.position_close_time.trim() || null,
        min_winning_days: parseFloat(form.min_winning_days) || null,
        winning_day_threshold: parseFloat(form.winning_day_threshold) || null,
        consistency_rule: parseFloat(form.consistency_rule_pct) || null,
      };

      if (editingId) {
        await supabase.from('mt5_accounts').update(payload).eq('id', editingId);
      } else {
        await supabase.from('mt5_accounts').insert({ ...payload, login: null, password_encrypted: null, server: null });
      }

      toast.success(
        lang === 'ar' ? 'تم حفظ الحساب بنجاح ✅' :
        lang === 'fr' ? 'Compte enregistré ✅' :
        'Account saved successfully ✅'
      );
      setDialogOpen(false);
      setFormStep(1);
      await fetchAccounts();
    } catch {
      toast.error(lang === 'ar' ? 'حدث خطأ' : lang === 'fr' ? 'Une erreur est survenue' : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteAccountId(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteAccountId) return;
    const { error } = await supabase.from('mt5_accounts').delete().eq('id', deleteAccountId);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success(lang === 'ar' ? 'تم الحذف' : lang === 'fr' ? 'Supprimé' : 'Account deleted');
    setAccounts(prev => prev.filter(a => a.id !== deleteAccountId));
    setDeleteAccountId(null);
    setShowDeleteModal(false);
  };

  const labelAdd = lang === 'ar' ? 'إضافة حساب' : lang === 'fr' ? 'Ajouter un compte' : 'Add Account';
  const labelEdit = lang === 'ar' ? 'تعديل الحساب' : lang === 'fr' ? 'Modifier le compte' : 'Edit Account';
  const reviewLabel = lang === 'ar' ? 'مراجعة' : lang === 'fr' ? 'Révision' : 'Review';

  // Step labels: 1=Category, 2=Firm+Details, 3=Rules, 4=Balance, 5=Review
  const stepLabels = [t('step_category'), t('step_firm'), t('step_rules'), t('step_balance'), reviewLabel];

  const isFutures = form.account_category === 'futures';
  const firms = isFutures ? PROP_FIRMS_FUTURES : PROP_FIRMS_FOREX;
  const accountTypes = isFutures ? ACCOUNT_TYPES_FUTURES : ACCOUNT_TYPES_FOREX;
  const accountSizes = isFutures ? ACCOUNT_SIZES_FUTURES : ACCOUNT_SIZES_FOREX;
  const isTrailing = form.drawdown_type === 'eod_trailing' || form.drawdown_type === 'intraday_trailing';
  const currSymbol = form.currency === 'EUR' ? '€' : '$';

  const chipBase = 'px-3 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer select-none';
  const chipActive = 'border-teal-500 bg-teal-50 text-teal-700';
  const chipInactive = 'border-gray-200 bg-gray-50 text-gray-600 hover:border-teal-300 hover:text-gray-900';

  const canAdvance = (step: number) => {
    if (step === 1) return !!form.account_category;
    if (step === 2) {
      const fv = form.firm === 'Other' ? form.customFirm.trim() : form.firm;
      return !!fv && !!form.account_name.trim() && !!form.account_type && !!form.account_size && (form.account_size !== 'Custom' || !!form.customSize);
    }
    if (step === 3) return true;
    if (step === 4) return !!form.starting_balance && !!form.balance;
    if (step === 5) return true;
    return false;
  };

  const inputCls = 'w-full py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold bg-white px-3';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          {lang === 'ar' ? 'إدارة الحسابات' : lang === 'fr' ? 'Gestionnaire de comptes' : 'Account Manager'}
        </h1>
        {!isPro && accounts.length >= 1 ? (
          <div className="relative group">
            <button className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-white opacity-60 cursor-not-allowed" disabled>
              <Plus className="h-4 w-4" /> {labelAdd}
            </button>
            <div className="absolute bottom-full mb-2 end-0 z-10 hidden group-hover:block w-56 rounded-lg border border-gray-100 bg-white p-2 text-xs text-gray-500 shadow-lg">
              {lang === 'ar' ? 'الخطة المجانية: حساب واحد فقط. ترقّ إلى Pro.' : lang === 'fr' ? 'Plan gratuit: 1 compte. Passez à Pro.' : 'Free plan: 1 account only. Upgrade to Pro.'}
            </div>
          </div>
        ) : (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-colors"
          >
            <Plus className="h-4 w-4" /> {labelAdd}
          </button>
        )}
      </div>

      {/* Overview bar */}
      {!loading && accounts.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">
                {lang === 'ar' ? 'إجمالي الحسابات' : lang === 'fr' ? 'Total comptes' : 'Total Accounts'}
              </p>
              <p className="text-xl font-black text-gray-900">{accounts.length}</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <p className="text-xs text-gray-400 mb-1">
                {lang === 'ar' ? 'إجمالي رأس المال' : lang === 'fr' ? 'Capital total' : 'Total Capital'}
              </p>
              <p className="text-xl font-black text-gray-900">
                ${accounts.reduce((s, a) => s + (a.account_size || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">
                {lang === 'ar' ? 'الحالة' : lang === 'fr' ? 'Statut' : 'Status'}
              </p>
              <p className="text-sm font-black text-teal-600">
                ✅ {lang === 'ar' ? 'آمن' : lang === 'fr' ? 'Sûr' : 'Safe'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Account list */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Wallet className="h-12 w-12 text-gray-300" />
          <div className="space-y-1">
            <p className="font-bold text-gray-800">{t('noAccountsYet')}</p>
            <p className="text-sm text-gray-400">
              {lang === 'ar' ? 'أضف حسابك الأول لتتبع أدائك' :
               lang === 'fr' ? 'Ajoutez votre premier compte pour suivre vos performances' :
               'Add your first account to track your performance'}
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-colors"
          >
            <Plus className="h-4 w-4" /> {labelAdd}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acc, index) => (
            <div key={acc.id} className="relative">
              <div className={!isPro && index >= 1 ? 'blur-sm pointer-events-none select-none' : ''}>
                <AccountCard acc={acc} lang={lang} onEdit={openEdit} onDelete={handleDelete} userId={user?.id} onRefresh={fetchAccounts} />
              </div>
              {!isPro && index >= 1 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-white/70 backdrop-blur-sm">
                  <Lock className="h-8 w-8 text-teal-500" />
                  <p className="text-sm font-bold text-gray-800">
                    {lang === 'ar' ? 'متاح في Pro' : lang === 'fr' ? 'Disponible en Pro' : 'Pro only'}
                  </p>
                  <a
                    href="/settings?tab=subscription"
                    className="rounded-xl bg-teal-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-600 transition-colors"
                  >
                    {lang === 'ar' ? 'ترقية' : lang === 'fr' ? 'Mettre à niveau' : 'Upgrade'}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setFormStep(1); setForm(DEFAULT_FORM); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg font-black text-gray-900">{editingId ? labelEdit : labelAdd}</DialogTitle>
          </DialogHeader>

          {/* Step progress */}
          <div className="flex items-start gap-1 px-6 pb-4">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full transition-all ${s <= formStep ? 'bg-teal-500' : 'bg-gray-100'}`} />
                <span className={`text-[10px] text-center leading-tight ${s === formStep ? 'text-teal-600 font-bold' : 'text-gray-400'}`}>
                  {stepLabels[s - 1]}
                </span>
              </div>
            ))}
          </div>

          <div className="px-6 pb-4 space-y-4">

            {/* ── STEP 1: Category ── */}
            {formStep === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-black text-gray-800">
                  {lang === 'ar' ? 'اختر نوع الحساب' : lang === 'fr' ? 'Choisissez le type de compte' : 'Choose account category'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: 'forex_cfd', label: 'Forex / CFD', icon: '💱', sub: lang === 'ar' ? 'أسواق العملات والعقود' : lang === 'fr' ? 'Devises & contrats' : 'Currency & CFD markets' },
                    { val: 'futures', label: 'Futures', icon: '📈', sub: lang === 'ar' ? 'العقود الآجلة' : lang === 'fr' ? 'Marchés à terme' : 'Futures markets' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setForm({ ...DEFAULT_FORM, account_category: opt.val })}
                      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all ${
                        form.account_category === opt.val ? 'border-teal-500 bg-teal-50' : 'border-gray-100 bg-gray-50 hover:border-teal-200'
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="font-black text-gray-900 text-sm">{opt.label}</span>
                      <span className="text-[11px] text-gray-400">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 2: Firm + Details ── */}
            {formStep === 2 && (
              <div className="space-y-4">
                {/* Firm */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {lang === 'ar' ? 'شركة التمويل *' : lang === 'fr' ? 'Société *' : 'Prop Firm *'}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {firms.map(f => (
                      <button key={f} type="button"
                        onClick={() => setForm(prev => ({ ...prev, firm: f, customFirm: '' }))}
                        className={`${chipBase} ${form.firm === f ? chipActive : chipInactive}`}
                      >{f}</button>
                    ))}
                  </div>
                  {form.firm === 'Other' && (
                    <input
                      className={inputCls}
                      placeholder={lang === 'ar' ? 'اسم الشركة' : lang === 'fr' ? 'Nom de la société' : 'Firm name'}
                      value={form.customFirm}
                      onChange={e => setForm(f => ({ ...f, customFirm: e.target.value }))}
                    />
                  )}
                </div>

                {/* Account name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {lang === 'ar' ? 'اسم الحساب *' : lang === 'fr' ? 'Surnom *' : 'Account Nickname *'}
                  </Label>
                  <input
                    className={inputCls}
                    placeholder={lang === 'ar' ? 'FTMO تحدي #1' : 'FTMO Challenge #1'}
                    value={form.account_name}
                    onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                  />
                </div>

                {/* Account type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {lang === 'ar' ? 'نوع الحساب *' : lang === 'fr' ? 'Type *' : 'Account Type *'}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {accountTypes.map(at => (
                      <button key={at} type="button"
                        onClick={() => setForm(f => ({ ...f, account_type: at }))}
                        className={`${chipBase} ${form.account_type === at ? chipActive : chipInactive}`}
                      >{at}</button>
                    ))}
                  </div>
                </div>

                {/* Account size */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {lang === 'ar' ? 'حجم الحساب *' : lang === 'fr' ? 'Taille *' : 'Account Size *'}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {accountSizes.map(s => (
                      <button key={s} type="button"
                        onClick={() => setForm(f => ({ ...f, account_size: s, customSize: '' }))}
                        className={`${chipBase} ${form.account_size === s ? chipActive : chipInactive}`}
                      >${parseInt(s).toLocaleString()}</button>
                    ))}
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, account_size: 'Custom' }))}
                      className={`${chipBase} ${form.account_size === 'Custom' ? chipActive : chipInactive}`}
                    >{lang === 'ar' ? 'مخصص' : lang === 'fr' ? 'Personnalisé' : 'Custom'}</button>
                  </div>
                  {form.account_size === 'Custom' && (
                    <input type="number" className={inputCls} placeholder="50000"
                      value={form.customSize}
                      onChange={e => setForm(f => ({ ...f, customSize: e.target.value }))}
                    />
                  )}
                </div>

                {/* Currency */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {lang === 'ar' ? 'العملة' : lang === 'fr' ? 'Devise' : 'Currency'}
                  </Label>
                  <div className="flex gap-2">
                    {['USD', 'EUR'].map(cur => (
                      <button key={cur} type="button"
                        onClick={() => setForm(f => ({ ...f, currency: cur }))}
                        className={`${chipBase} ${form.currency === cur ? chipActive : chipInactive}`}
                      >{cur === 'USD' ? 'USD ($)' : 'EUR (€)'}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Rules ── */}
            {formStep === 3 && (
              <div className="space-y-4">
                {/* Drawdown type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('drawdown_type')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {DRAWDOWN_TYPES.map(dt => (
                      <button key={dt} type="button"
                        onClick={() => setForm(f => ({ ...f, drawdown_type: dt }))}
                        className={`${chipBase} ${form.drawdown_type === dt ? chipActive : chipInactive}`}
                      >
                        {dt === 'static' ? t('static_dd') : dt === 'eod_trailing' ? t('eod_trailing') : t('intraday_trailing')}
                      </button>
                    ))}
                  </div>
                  {isTrailing && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                      {lang === 'ar'
                        ? '⚠️ الحد الأدنى المتتبع يرتفع مع الرصيد ولا ينخفض أبدًا. ستُدخله في خطوة الرصيد.'
                        : lang === 'fr'
                        ? '⚠️ Le plancher trailing monte avec le solde, ne descend jamais. Vous le saisirez à l\'étape solde.'
                        : '⚠️ Trailing floor rises with balance, never falls. You\'ll enter it in the balance step.'}
                    </div>
                  )}
                </div>

                {!isFutures ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                          {lang === 'ar' ? 'حد السحب %' : lang === 'fr' ? 'DD max %' : 'Max DD %'}
                        </Label>
                        <input type="number" step="0.1" className={inputCls}
                          value={form.max_drawdown_limit}
                          onChange={e => setForm(f => ({ ...f, max_drawdown_limit: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                          {lang === 'ar' ? 'خسارة يومية %' : lang === 'fr' ? 'Perte/jour %' : 'Daily Loss %'}
                        </Label>
                        <input type="number" step="0.1" className={inputCls}
                          value={form.daily_loss_limit}
                          onChange={e => setForm(f => ({ ...f, daily_loss_limit: e.target.value }))}
                        />
                      </div>
                    </div>
                    {PROFIT_TARGET_REQUIRED_TYPES.includes(form.account_type) && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                          {lang === 'ar' ? 'هدف الربح % *' : lang === 'fr' ? 'Objectif profit % *' : 'Profit Target % *'}
                        </Label>
                        <input type="number" step="0.1" className={inputCls}
                          value={form.profit_target}
                          onChange={e => setForm(f => ({ ...f, profit_target: e.target.value }))}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('consistency_rule_pct')}</Label>
                      <div className="flex flex-wrap gap-2">
                        {CONSISTENCY_OPTIONS.map(opt => (
                          <button key={opt} type="button"
                            onClick={() => setForm(f => ({ ...f, consistency_rule_pct: opt }))}
                            className={`${chipBase} ${form.consistency_rule_pct === opt ? chipActive : chipInactive}`}
                          >{opt === '0' ? t('no_consistency') : `${opt}%`}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('profit_split_pct')}</Label>
                        <input type="number" step="1" className={inputCls}
                          value={form.profit_split_pct}
                          onChange={e => setForm(f => ({ ...f, profit_split_pct: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('min_trading_days_label')}</Label>
                        <input type="number" step="1" className={inputCls}
                          value={form.min_trading_days}
                          onChange={e => setForm(f => ({ ...f, min_trading_days: e.target.value }))}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('max_loss_limit_dollars')}</Label>
                        <input type="number" step="1" placeholder="2500" className={inputCls}
                          value={form.max_loss_limit_dollars}
                          onChange={e => setForm(f => ({ ...f, max_loss_limit_dollars: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('daily_loss_dollars')}</Label>
                        <input type="number" step="1" placeholder="500" className={inputCls}
                          value={form.daily_loss_dollars}
                          onChange={e => setForm(f => ({ ...f, daily_loss_dollars: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('profit_target_dollars')}</Label>
                        <input type="number" step="1" placeholder="3000" className={inputCls}
                          value={form.profit_target_dollars}
                          onChange={e => setForm(f => ({ ...f, profit_target_dollars: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('contract_limit')}</Label>
                        <input type="number" step="1" placeholder="10" className={inputCls}
                          value={form.contract_limit}
                          onChange={e => setForm(f => ({ ...f, contract_limit: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('min_winning_days')}</Label>
                        <input type="number" step="1" placeholder="10" className={inputCls}
                          value={form.min_winning_days}
                          onChange={e => setForm(f => ({ ...f, min_winning_days: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('winning_day_threshold')}</Label>
                        <input type="number" step="1" placeholder="200" className={inputCls}
                          value={form.winning_day_threshold}
                          onChange={e => setForm(f => ({ ...f, winning_day_threshold: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('position_close_time')}</Label>
                      <input type="time" className={inputCls}
                        value={form.position_close_time}
                        onChange={e => setForm(f => ({ ...f, position_close_time: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('profit_split_pct')}</Label>
                      <input type="number" step="1" className={inputCls}
                        value={form.profit_split_pct_futures}
                        onChange={e => setForm(f => ({ ...f, profit_split_pct_futures: e.target.value }))}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── STEP 4: Balance ── */}
            {formStep === 4 && (
              <div className="space-y-4">
                {/* Starting Balance */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {lang === 'ar' ? 'الرصيد الابتدائي *' : lang === 'fr' ? 'Solde de départ *' : 'Starting Balance *'}
                  </Label>
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currSymbol}</span>
                    <input type="number" value={form.starting_balance}
                      onChange={e => setForm(p => ({ ...p, starting_balance: e.target.value }))}
                      placeholder="10000"
                      className="w-full ps-7 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold bg-white"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {lang === 'ar' ? 'الرصيد عند بدء التحدي أو الحساب الممول' : lang === 'fr' ? 'Le solde au début du challenge ou du compte financé' : 'Balance when you started the challenge or funded account'}
                  </p>
                </div>

                {/* Current Balance */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {lang === 'ar' ? 'الرصيد الحالي *' : lang === 'fr' ? 'Solde actuel *' : 'Current Balance *'}
                  </Label>
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currSymbol}</span>
                    <input type="number" value={form.balance}
                      onChange={e => setForm(p => ({ ...p, balance: e.target.value }))}
                      placeholder="10000"
                      className="w-full ps-7 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold bg-white"
                    />
                  </div>
                </div>

                {/* Trailing floor — only if trailing drawdown type selected */}
                {isTrailing && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      {lang === 'ar' ? 'الحد الأدنى المتتبع الحالي ($)' : lang === 'fr' ? 'Plancher trailing actuel ($)' : 'Current Trailing Floor ($)'}
                    </Label>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 mb-2">
                      <p className="text-xs text-amber-700 font-semibold">
                        {lang === 'ar'
                          ? '⚠️ هذا الحد يرتفع مع نمو رصيدك ولا ينخفض أبداً. أدخله من لوحة تحكم شركتك.'
                          : lang === 'fr'
                          ? "⚠️ Ce plancher monte avec votre solde et ne descend jamais. Vérifiez sur le dashboard de votre firme."
                          : "⚠️ This floor rises as your balance grows and never goes down. Check your firm's dashboard for the exact value."}
                      </p>
                    </div>
                    <div className="relative">
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                      <input type="number" value={form.trailing_floor}
                        onChange={e => setForm(p => ({ ...p, trailing_floor: e.target.value }))}
                        placeholder="48000"
                        className="w-full ps-7 py-3 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-semibold bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* P&L Summary */}
                {form.starting_balance && form.balance && (
                  <div className={`rounded-2xl p-4 border ${
                    parseFloat(form.balance) >= parseFloat(form.starting_balance)
                      ? 'bg-teal-50 border-teal-100'
                      : 'bg-red-50 border-red-100'
                  }`}>
                    <p className="text-xs font-bold text-gray-500 mb-2 uppercase">
                      {lang === 'ar' ? 'ملخص' : lang === 'fr' ? 'Résumé' : 'Summary'}
                    </p>
                    <div className="flex justify-between">
                      <p className="text-xs text-gray-600">{lang === 'ar' ? 'الربح/الخسارة' : 'P&L'}</p>
                      <p className={`text-sm font-black ${
                        parseFloat(form.balance) >= parseFloat(form.starting_balance) ? 'text-teal-700' : 'text-red-600'
                      }`}>
                        {parseFloat(form.balance) >= parseFloat(form.starting_balance) ? '+' : ''}
                        {currSymbol}{(parseFloat(form.balance) - parseFloat(form.starting_balance)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 5: Review & Save ── */}
            {formStep === 5 && (
              <div className="space-y-3">
                <p className="text-sm font-black text-gray-900">
                  {lang === 'ar' ? 'مراجعة الحساب' : lang === 'fr' ? 'Révision du compte' : 'Review Account'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: form.account_name || (lang === 'ar' ? 'بدون اسم' : 'No name') },
                    { label: (form.firm === 'Other' ? form.customFirm : form.firm) || '—' },
                    { label: form.account_type || '—' },
                    { label: form.account_category === 'futures' ? 'Futures' : 'Forex/CFD' },
                  ].map((chip, i) => (
                    <span key={i} className="bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full">{chip.label}</span>
                  ))}
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                  {form.account_category !== 'futures' ? (
                    <>
                      {form.starting_balance && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">{lang === 'ar' ? 'الرصيد الابتدائي' : 'Starting Balance'}</span>
                          <span className="font-bold">{currSymbol}{parseFloat(form.starting_balance).toLocaleString()}</span>
                        </div>
                      )}
                      {form.max_drawdown_limit && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Max DD</span>
                          <span className="font-bold text-red-500">{form.max_drawdown_limit}%</span>
                        </div>
                      )}
                      {form.daily_loss_limit && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Daily Loss</span>
                          <span className="font-bold text-red-500">{form.daily_loss_limit}%</span>
                        </div>
                      )}
                      {parseFloat(form.consistency_rule_pct) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Consistency</span>
                          <span className="font-bold text-amber-500">{form.consistency_rule_pct}%</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {form.max_loss_limit_dollars && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Max Loss Limit</span>
                          <span className="font-bold text-red-500">${parseFloat(form.max_loss_limit_dollars).toLocaleString()}</span>
                        </div>
                      )}
                      {form.contract_limit && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Contract Limit</span>
                          <span className="font-bold">{form.contract_limit} contracts</span>
                        </div>
                      )}
                      {form.position_close_time && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Close By</span>
                          <span className="font-bold">{form.position_close_time}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={submitting}
                  className="w-full py-4 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black text-base rounded-2xl transition-all shadow-sm shadow-teal-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId
                    ? (lang === 'ar' ? 'حفظ التغييرات' : lang === 'fr' ? 'Enregistrer' : 'Save Changes')
                    : (lang === 'ar' ? 'إضافة الحساب' : lang === 'fr' ? 'Ajouter le compte' : 'Add Account')}
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-2 pt-2 border-t border-gray-50">
              {formStep > 1 && (
                <button
                  type="button"
                  onClick={() => setFormStep(s => s - 1)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {lang === 'ar' ? 'رجوع' : lang === 'fr' ? 'Retour' : 'Back'}
                </button>
              )}
              {formStep < 5 && (
                <button
                  type="button"
                  onClick={() => {
                    if (formStep === 2) {
                      const firmVal = form.firm === 'Other' ? form.customFirm : form.firm;
                      if (!firmVal.trim() || !form.account_name.trim() || !form.account_type) {
                        toast.error(
                          lang === 'ar' ? 'يرجى إكمال جميع الحقول المطلوبة' :
                          lang === 'fr' ? 'Veuillez remplir tous les champs obligatoires' :
                          'Please complete all required fields'
                        );
                        return;
                      }
                    }
                    if (!canAdvance(formStep)) return;
                    setFormStep(s => s + 1);
                  }}
                  disabled={!canAdvance(formStep)}
                  className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-100 disabled:text-gray-400 rounded-2xl text-sm font-bold text-white transition-colors flex items-center justify-center gap-1"
                >
                  {lang === 'ar' ? 'التالي' : lang === 'fr' ? 'Suivant' : 'Next'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              {lang === 'ar' ? 'تأكيد الحذف' : lang === 'fr' ? 'Confirmer la suppression' : 'Confirm Delete'}
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              {lang === 'ar' ? 'هل تريد حذف هذا الحساب؟ لا يمكن التراجع عن هذا الإجراء.' : lang === 'fr' ? 'Supprimer ce compte ? Cette action est irréversible.' : 'Delete this account? This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 mt-2 sm:gap-2">
            <button type="button" onClick={() => setShowDeleteModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
              {lang === 'ar' ? 'إلغاء' : lang === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            <button type="button" onClick={() => { setShowDeleteModal(false); handleDeleteConfirmed(); }}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors">
              {lang === 'ar' ? 'حذف' : lang === 'fr' ? 'Supprimer' : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---- Account Card (exported for reuse in Dashboard) ----
interface AccountCardProps {
  acc: Account;
  lang: 'ar' | 'fr' | 'en';
  onEdit?: (acc: Account) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
  userId?: string;
  onRefresh?: () => void;
}

export function AccountCard({ acc, lang, onEdit, onDelete, compact, userId, onRefresh }: AccountCardProps) {
  const [tradePnl, setTradePnl] = useState<number | null>(null);
  const [todayPnl, setTodayPnl] = useState<number | null>(null);
  const [monthlyTrades, setMonthlyTrades] = useState<any[]>([]);

  useEffect(() => {
    if (!userId || !acc.id) return;
    supabase
      .from('trades')
      .select('profit, commission, close_time')
      .eq('account_id', acc.id)
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!data) return;
        const total = data.reduce((s, tr) => s + (tr.profit ?? 0), 0);
        const todayStr = new Date().toLocaleDateString('en-CA');
        const todaySum = data
          .filter(tr => tr.close_time && new Date(tr.close_time).toLocaleDateString('en-CA') === todayStr)
          .reduce((s, tr) => s + (tr.profit ?? 0), 0);
        setTradePnl(total);
        setTodayPnl(todaySum);
      });
  }, [userId, acc.id]);

  useEffect(() => {
    if (!userId || !acc.id) return;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    supabase
      .from('trades')
      .select('profit, commission, close_time')
      .eq('account_id', acc.id)
      .eq('user_id', userId)
      .gte('close_time', monthStart.toISOString())
      .then(({ data }) => setMonthlyTrades(data || []));
  }, [userId, acc.id]);

  const a = acc as any;
  const isFuturesCard = a.account_category === 'futures';
  const start = acc.starting_balance ?? 0;
  const curr = acc.balance ?? 0;
  const accountSize = acc.account_size ?? start;
  const symbol = (acc.currency ?? 'USD') === 'EUR' ? '€' : '$';

  const effectivePnl = tradePnl !== null ? tradePnl : curr - start;
  const effectiveTodayPnl = todayPnl ?? 0;

  // Forex DD
  const ddLimitPct = acc.max_drawdown_limit ?? 0;
  const ddLimitAmt = start * (ddLimitPct / 100);
  const ddUsedAmt = Math.max(0, start - curr);
  const ddPct = ddLimitAmt > 0 ? Math.min((ddUsedAmt / ddLimitAmt) * 100, 100) : 0;

  // Forex Daily Loss
  const dailyLossPctLimit = acc.daily_loss_limit ?? 0;
  const dailyLossLimitAmt = start * (dailyLossPctLimit / 100);
  const todayLossAmt = Math.max(0, -effectiveTodayPnl);
  const dailyLossPct = dailyLossLimitAmt > 0 ? Math.min((todayLossAmt / dailyLossLimitAmt) * 100, 100) : 0;

  // Forex Profit
  const profitTarget = acc.profit_target ?? 10;
  const profitLimitAmt = accountSize * profitTarget / 100;
  const profitBarPct = Math.min(effectivePnl > 0 && profitLimitAmt > 0 ? (effectivePnl / profitLimitAmt) * 100 : 0, 100);
  const profitPct = accountSize > 0 ? (effectivePnl / accountSize) * 100 : 0;

  // Futures
  const futuresTrailingFloor = a.trailing_floor ?? null;
  const futuresBuffer = futuresTrailingFloor != null ? curr - futuresTrailingFloor : null;
  const futuresDDLimit = a.max_loss_limit_dollars ?? 0;
  const futuresDDUsed = Math.max(0, start - curr);
  const futuresDDPct = futuresDDLimit > 0 ? Math.min((futuresDDUsed / futuresDDLimit) * 100, 100) : 0;
  const futuresDailyLimit = a.daily_loss_limit_dollars ?? 0;
  const futuresDailyPct = futuresDailyLimit > 0 ? Math.min((todayLossAmt / futuresDailyLimit) * 100, 100) : 0;
  const futuresProfitTarget = a.profit_target_dollars ?? 0;
  const futuresProfitPct = futuresProfitTarget > 0 ? Math.min((effectivePnl / futuresProfitTarget) * 100, 100) : 0;

  // Monthly consistency + winning days
  const byDay: Record<string, number> = {};
  monthlyTrades.forEach(tr => {
    if (!tr.close_time) return;
    const d = new Date(tr.close_time).toDateString();
    byDay[d] = (byDay[d] || 0) + ((tr.profit || 0) - (tr.commission || 0));
  });
  const totalMonthPnl = Object.values(byDay).reduce((s, v) => s + v, 0);
  const bestDayPnl = Math.max(0, ...Object.values(byDay), 0);
  const consistencyPct = totalMonthPnl > 0 ? (bestDayPnl / totalMonthPnl) * 100 : 0;
  const consistencyRule = a.consistency_rule ?? 0;
  const winningThreshold = a.winning_day_threshold ?? 0;
  const winningDays = Object.values(byDay).filter(pnl => pnl >= winningThreshold).length;
  const minWinningDays = a.min_winning_days ?? 0;

  // Status
  const isDanger = ddPct >= 90 || dailyLossPct >= 90 || futuresDDPct >= 90 || futuresDailyPct >= 90 ||
    (futuresBuffer != null && futuresBuffer < 500);
  const isWarning = !isDanger && (ddPct >= 70 || dailyLossPct >= 70 || futuresDDPct >= 70 || futuresDailyPct >= 70 ||
    (futuresBuffer != null && futuresBuffer < 1000));
  const barColor = isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-teal-500';
  const iconBg = isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-teal-500';

  const handleQuickBalance = async () => {
    const newBalStr = window.prompt(
      lang === 'ar' ? 'أدخل الرصيد الجديد:' : lang === 'fr' ? 'Entrez le nouveau solde:' : 'Enter new balance:',
      String(curr)
    );
    if (!newBalStr) return;
    const newBal = parseFloat(newBalStr);
    if (isNaN(newBal)) return;

    const update: any = { balance: newBal };

    const hasTrailing = a.drawdown_type === 'eod_trailing' || a.drawdown_type === 'intraday_trailing';
    if (isFuturesCard && hasTrailing) {
      const newFloorStr = window.prompt(
        lang === 'ar' ? 'أدخل الحد الأدنى المتتبع الحالي ($):' : lang === 'fr' ? 'Plancher trailing actuel ($):' : 'Current trailing floor ($):',
        String(futuresTrailingFloor ?? '')
      );
      if (newFloorStr) {
        const nf = parseFloat(newFloorStr);
        if (!isNaN(nf)) update.trailing_floor = nf;
      }
    }

    await supabase.from('mt5_accounts').update(update).eq('id', acc.id);
    if (onRefresh) onRefresh(); else window.location.reload();
  };

  const progressBar = (pct: number, danger = 90, warn = 70) => {
    const col = pct >= danger ? 'bg-red-500' : pct >= warn ? 'bg-amber-400' : 'bg-teal-500';
    return (
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all ${col}`} style={{ width: `${pct}%` }} />
      </div>
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md overflow-hidden transition-shadow">
      {/* Top color bar */}
      <div className={`h-1 w-full ${barColor}`} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center text-white text-lg shrink-0`}>
            {isFuturesCard ? '📊' : '📈'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-900 truncate">{acc.account_name ?? acc.firm}</p>
            <p className="text-xs text-gray-400">{acc.firm}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isDanger ? 'bg-red-50 text-red-500' : isWarning ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-600'
            }`}>
              {isDanger ? `🔴 ${lang === 'ar' ? 'خطر' : 'Danger'}` : isWarning ? `⚠️ ${lang === 'ar' ? 'تحذير' : 'Avertissement'}` : `✅ ${lang === 'ar' ? 'آمن' : 'Safe'}`}
            </span>
            {onEdit && (
              <button onClick={() => onEdit(acc)}
                className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(acc.id)}
                className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Type badge */}
        {acc.account_type && (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeBadgeClass(acc.account_type)}`}>
            {acc.account_type}
          </span>
        )}

        {/* Balance tiles */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400">{lang === 'ar' ? 'الرصيد الحالي' : lang === 'fr' ? 'Solde actuel' : 'Current'}</p>
            <p className="mt-0.5 font-black text-gray-900 text-sm">
              {symbol}{(start + effectivePnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className={`text-xs font-bold mt-0.5 ${effectivePnl >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
              {effectivePnl >= 0 ? '+' : ''}{symbol}{effectivePnl.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400">{lang === 'ar' ? 'الرصيد الابتدائي' : lang === 'fr' ? 'Initial' : 'Starting'}</p>
            <p className="mt-0.5 font-black text-gray-900 text-sm">{symbol}{start.toLocaleString()}</p>
            <p className={`text-xs font-bold mt-0.5 ${effectiveTodayPnl >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
              {lang === 'ar' ? 'اليوم: ' : lang === 'fr' ? 'Auj: ' : 'Today: '}
              {effectiveTodayPnl >= 0 ? '+' : ''}{symbol}{effectiveTodayPnl.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Forex panels */}
        {!isFuturesCard && (
          <>
            {/* Max Drawdown */}
            {ddLimitPct > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1 text-gray-400">
                    <TrendingDown className="h-3 w-3" />
                    {lang === 'ar' ? 'حد السحب' : 'Max DD'} {ddLimitPct}%
                  </span>
                  <span className={`font-bold ${ddPct >= 70 ? 'text-red-500' : 'text-gray-500'}`}>
                    {symbol}{ddUsedAmt.toFixed(0)} / {symbol}{ddLimitAmt.toFixed(0)}
                  </span>
                </div>
                {progressBar(ddPct)}
              </div>
            )}
            {/* Daily Loss */}
            {dailyLossPctLimit > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1 text-gray-400">
                    <TrendingDown className="h-3 w-3 opacity-60" />
                    {lang === 'ar' ? 'خسارة اليوم' : 'Daily Loss'} {dailyLossPctLimit}%
                  </span>
                  <span className={`font-bold ${dailyLossPct >= 70 ? 'text-red-500' : 'text-gray-500'}`}>
                    {symbol}{todayLossAmt.toFixed(2)} / {symbol}{dailyLossLimitAmt.toFixed(0)}
                  </span>
                </div>
                {progressBar(dailyLossPct)}
              </div>
            )}
            {/* Profit target */}
            {SHOWS_PROFIT_PROGRESS.includes(acc.account_type ?? '') && profitTarget > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1 text-gray-400">
                    <TrendingUp className="h-3 w-3" />
                    {lang === 'ar' ? 'هدف الربح' : 'Profit Target'} {profitTarget}%
                  </span>
                  <span className={`font-bold ${effectivePnl >= 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                    {effectivePnl >= 0 ? '+' : ''}{profitPct.toFixed(2)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${profitBarPct}%` }} />
                </div>
              </div>
            )}
            {/* Consistency panel */}
            {consistencyRule > 0 && totalMonthPnl > 0 && (
              <div className="rounded-2xl bg-gray-50 p-3 space-y-1">
                <p className="text-xs font-bold text-gray-500 uppercase">
                  {lang === 'ar' ? 'الاتساق الشهري' : lang === 'fr' ? 'Cohérence mensuelle' : 'Monthly Consistency'}
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">{lang === 'ar' ? 'أفضل يوم' : 'Best day'}</span>
                  <span className={`font-bold ${consistencyPct > consistencyRule ? 'text-amber-500' : 'text-teal-600'}`}>
                    {consistencyPct.toFixed(1)}% / {consistencyRule}%
                  </span>
                </div>
                {progressBar(Math.min((consistencyPct / consistencyRule) * 100, 100), 100, 80)}
              </div>
            )}
          </>
        )}

        {/* Futures panels */}
        {isFuturesCard && (
          <>
            {/* Trailing buffer */}
            {futuresBuffer != null && (
              <div className={`rounded-2xl p-3 border ${
                futuresBuffer < 500 ? 'bg-red-50 border-red-100' : futuresBuffer < 1000 ? 'bg-amber-50 border-amber-100' : 'bg-teal-50 border-teal-100'
              }`}>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                  {lang === 'ar' ? 'المساحة المتبقية' : lang === 'fr' ? 'Marge restante' : 'Trailing Buffer'}
                </p>
                <p className={`text-lg font-black ${futuresBuffer < 500 ? 'text-red-600' : futuresBuffer < 1000 ? 'text-amber-600' : 'text-teal-700'}`}>
                  ${futuresBuffer.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
            {/* Max Loss */}
            {futuresDDLimit > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">{lang === 'ar' ? 'حد الخسارة القصوى' : 'Max Loss Limit'}</span>
                  <span className={`font-bold ${futuresDDPct >= 70 ? 'text-red-500' : 'text-gray-500'}`}>
                    ${futuresDDUsed.toFixed(0)} / ${futuresDDLimit.toLocaleString()}
                  </span>
                </div>
                {progressBar(futuresDDPct)}
              </div>
            )}
            {/* Daily Loss */}
            {futuresDailyLimit > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">{lang === 'ar' ? 'خسارة اليوم' : 'Daily Loss'}</span>
                  <span className={`font-bold ${futuresDailyPct >= 70 ? 'text-red-500' : 'text-gray-500'}`}>
                    ${todayLossAmt.toFixed(0)} / ${futuresDailyLimit.toLocaleString()}
                  </span>
                </div>
                {progressBar(futuresDailyPct)}
              </div>
            )}
            {/* Profit Target */}
            {futuresProfitTarget > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1 text-gray-400">
                    <TrendingUp className="h-3 w-3" />
                    {lang === 'ar' ? 'هدف الربح' : 'Profit Target'}
                  </span>
                  <span className={`font-bold ${effectivePnl >= 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                    ${effectivePnl.toFixed(0)} / ${futuresProfitTarget.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${futuresProfitPct}%` }} />
                </div>
              </div>
            )}
            {/* Info chips */}
            <div className="flex flex-wrap gap-1.5">
              {a.contract_limit > 0 && (
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-semibold">
                  {a.contract_limit} {lang === 'ar' ? 'عقد' : 'contracts'}
                </span>
              )}
              {a.position_close_time && (
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-semibold">
                  ⏰ {a.position_close_time}
                </span>
              )}
              {minWinningDays > 0 && (
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  winningDays >= minWinningDays ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {winningDays}/{minWinningDays} {lang === 'ar' ? 'أيام رابحة' : 'win days'}
                </span>
              )}
            </div>
            {/* Consistency panel for futures */}
            {consistencyRule > 0 && totalMonthPnl > 0 && (
              <div className="rounded-2xl bg-gray-50 p-3 space-y-1">
                <p className="text-xs font-bold text-gray-500 uppercase">
                  {lang === 'ar' ? 'الاتساق الشهري' : lang === 'fr' ? 'Cohérence mensuelle' : 'Monthly Consistency'}
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">{lang === 'ar' ? 'أفضل يوم' : 'Best day'}</span>
                  <span className={`font-bold ${consistencyPct > consistencyRule ? 'text-amber-500' : 'text-teal-600'}`}>
                    {consistencyPct.toFixed(1)}% / {consistencyRule}%
                  </span>
                </div>
                {progressBar(Math.min((consistencyPct / consistencyRule) * 100, 100), 100, 80)}
              </div>
            )}
          </>
        )}

        {/* Quick Update Balance */}
        <button
          onClick={handleQuickBalance}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {lang === 'ar' ? 'تحديث الرصيد' : lang === 'fr' ? 'Mettre à jour' : 'Update Balance'}
        </button>
      </div>
    </div>
  );
}

export default ConnectPage;
