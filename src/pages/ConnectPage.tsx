import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Account = Tables<'mt5_accounts'>;

const PROP_FIRMS = ['FTMO', 'FundingPips', 'Alpha Capital', 'FundedNext', 'Exness', 'Other'];
const ACCOUNT_TYPES = ['Challenge Phase 1', 'Challenge Phase 2', 'Instant Funded', 'Funded', 'Live', 'Demo'];

// Profit target: required for challenges, optional for Demo, hidden for others
const PROFIT_TARGET_REQUIRED = ['Challenge Phase 1', 'Challenge Phase 2'];
const PROFIT_TARGET_OPTIONAL = ['Demo'];
const SHOWS_PROFIT_TARGET = [...PROFIT_TARGET_REQUIRED, ...PROFIT_TARGET_OPTIONAL];
// Which account types have mandatory drawdown/daily loss rules
const HAS_REQUIRED_RULES = ['Challenge Phase 1', 'Challenge Phase 2', 'Instant Funded', 'Funded'];
// Only challenges show profit progress bar on card
const SHOWS_PROFIT_PROGRESS = ['Challenge Phase 1', 'Challenge Phase 2'];
const ACCOUNT_SIZES = ['2500', '5000', '6000', '10000', '15000', '25000', '50000', '100000', '200000'];

export function typeBadgeClass(type: string | null): string {
  switch (type) {
    case 'Challenge Phase 1': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    case 'Challenge Phase 2': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    case 'Instant Funded':    return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    case 'Funded':            return 'bg-profit/20 text-profit border border-profit/30';
    case 'Live':              return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'Demo':              return 'bg-muted text-muted-foreground border border-border';
    default:                  return 'bg-secondary text-muted-foreground border border-border';
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
  if (pct > 70) return 'bg-loss';
  if (pct > 50) return 'bg-yellow-500';
  return 'bg-profit';
}

const DEFAULT_FORM = {
  account_name: '',
  firm: '',
  customFirm: '',
  account_type: '',
  account_size: '',
  customSize: '',
  starting_balance: '',
  balance: '',
  profit_target: '10',
  max_drawdown_limit: '10',
  daily_loss_limit: '5',
  currency: 'USD',
};

const ConnectPage = () => {
  const { language } = useLanguage();
  const lang = language as 'ar' | 'fr' | 'en';
  const { user } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditingId(acc.id);
    const firmKnown = PROP_FIRMS.slice(0, -1).includes(acc.firm);
    const accSizeStr = String(Math.round(acc.account_size ?? 0));
    const sizeKnown = ACCOUNT_SIZES.includes(accSizeStr);
    setForm({
      account_name: acc.account_name ?? '',
      firm: firmKnown ? acc.firm : 'Other',
      customFirm: firmKnown ? '' : acc.firm,
      account_type: acc.account_type ?? '',
      account_size: sizeKnown ? accSizeStr : 'Custom',
      customSize: sizeKnown ? '' : String(acc.account_size ?? ''),
      starting_balance: String(acc.starting_balance ?? ''),
      balance: String(acc.balance ?? ''),
      profit_target: String(acc.profit_target ?? 10),
      max_drawdown_limit: String(acc.max_drawdown_limit ?? 10),
      daily_loss_limit: String(acc.daily_loss_limit ?? 5),
      currency: acc.currency ?? 'USD',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.account_name.trim() || !form.firm || !form.account_type || !form.starting_balance || !form.balance) {
      toast.error(
        lang === 'ar' ? 'يرجى ملء الحقول المطلوبة' :
        lang === 'fr' ? 'Veuillez remplir les champs obligatoires' :
        'Please fill all required fields'
      );
      return;
    }
    setSubmitting(true);

    const firmValue = form.firm === 'Other' ? (form.customFirm.trim() || 'Other') : form.firm;
    const sizeValue = form.account_size === 'Custom'
      ? (parseFloat(form.customSize) || null)
      : (parseFloat(form.account_size) || null);

    const payload = {
      user_id: user.id,
      account_name: form.account_name.trim(),
      firm: firmValue,
      account_type: form.account_type,
      account_size: sizeValue,
      starting_balance: parseFloat(form.starting_balance) || null,
      balance: parseFloat(form.balance) || null,
      profit_target: parseFloat(form.profit_target) || 10,
      max_drawdown_limit: parseFloat(form.max_drawdown_limit) || 10,
      daily_loss_limit: parseFloat(form.daily_loss_limit) || 5,
      currency: form.currency,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('mt5_accounts').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('mt5_accounts').insert({
        ...payload,
        login: null,
        password_encrypted: null,
        server: null,
      }));
    }

    setSubmitting(false);
    if (error) {
      console.error('[ConnectPage] save error:', error);
      toast.error('Failed to save: ' + error.message);
      return;
    }

    toast.success(
      editingId
        ? (lang === 'ar' ? 'تم التحديث' : lang === 'fr' ? 'Mis à jour' : 'Account updated!')
        : (lang === 'ar' ? 'تمت الإضافة' : lang === 'fr' ? 'Compte ajouté' : 'Account added!')
    );
    setDialogOpen(false);
    await fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(
      lang === 'ar' ? 'هل تريد حذف هذا الحساب؟' :
      lang === 'fr' ? 'Supprimer ce compte ?' :
      'Delete this account? This cannot be undone.'
    )) return;
    const { error } = await supabase.from('mt5_accounts').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success(lang === 'ar' ? 'تم الحذف' : lang === 'fr' ? 'Supprimé' : 'Account deleted');
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  const labelAdd = lang === 'ar' ? 'إضافة حساب' : lang === 'fr' ? 'Ajouter un compte' : 'Add Account';
  const labelEdit = lang === 'ar' ? 'تعديل الحساب' : lang === 'fr' ? 'Modifier le compte' : 'Edit Account';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          {lang === 'ar' ? 'إدارة الحسابات' : lang === 'fr' ? 'Gestionnaire de comptes' : 'Account Manager'}
        </h1>
        <Button className="gradient-primary text-primary-foreground gap-2" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          {labelAdd}
        </Button>
      </div>

      {/* Account list */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border py-16 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground/40" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {lang === 'ar' ? 'لا توجد حسابات بعد' : lang === 'fr' ? "Aucun compte pour l'instant" : 'No accounts yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              {lang === 'ar' ? 'أضف حسابك الأول لتتبع أدائك' :
               lang === 'fr' ? 'Ajoutez votre premier compte pour suivre vos performances' :
               'Add your first account to track your performance'}
            </p>
          </div>
          <Button className="gradient-primary text-primary-foreground gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> {labelAdd}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map(acc => <AccountCard key={acc.id} acc={acc} lang={lang} onEdit={openEdit} onDelete={handleDelete} />)}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? labelEdit : labelAdd}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Nickname */}
            <div className="space-y-1.5">
              <Label>
                {lang === 'ar' ? 'اسم الحساب' : lang === 'fr' ? 'Surnom' : 'Account Nickname'}
                <span className="text-destructive"> *</span>
              </Label>
              <Input
                placeholder={lang === 'ar' ? 'FTMO تحدي #1' : 'FTMO Challenge #1'}
                value={form.account_name}
                onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
              />
            </div>

            {/* Prop firm */}
            <div className="space-y-1.5">
              <Label>
                {lang === 'ar' ? 'شركة التمويل' : lang === 'fr' ? 'Société de financement' : 'Prop Firm'}
                <span className="text-destructive"> *</span>
              </Label>
              <Select value={form.firm} onValueChange={v => setForm(f => ({ ...f, firm: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === 'ar' ? 'اختر الشركة' : lang === 'fr' ? 'Choisir' : 'Select firm'} />
                </SelectTrigger>
                <SelectContent>
                  {PROP_FIRMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.firm === 'Other' && (
                <Input
                  placeholder={lang === 'ar' ? 'اسم الشركة' : lang === 'fr' ? 'Nom de la société' : 'Firm name'}
                  value={form.customFirm}
                  onChange={e => setForm(f => ({ ...f, customFirm: e.target.value }))}
                />
              )}
            </div>

            {/* Account type */}
            <div className="space-y-1.5">
              <Label>
                {lang === 'ar' ? 'نوع الحساب' : lang === 'fr' ? 'Type de compte' : 'Account Type'}
                <span className="text-destructive"> *</span>
              </Label>
              <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === 'ar' ? 'اختر النوع' : lang === 'fr' ? 'Choisir' : 'Select type'} />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Account size */}
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'حجم الحساب' : lang === 'fr' ? 'Taille du compte' : 'Account Size'}</Label>
              <Select value={form.account_size} onValueChange={v => setForm(f => ({ ...f, account_size: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === 'ar' ? 'اختر الحجم' : lang === 'fr' ? 'Choisir' : 'Select size'} />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_SIZES.map(s => (
                    <SelectItem key={s} value={s}>${parseInt(s).toLocaleString()}</SelectItem>
                  ))}
                  <SelectItem value="Custom">{lang === 'ar' ? 'مخصص' : lang === 'fr' ? 'Personnalisé' : 'Custom'}</SelectItem>
                </SelectContent>
              </Select>
              {form.account_size === 'Custom' && (
                <Input
                  type="number"
                  placeholder="50000"
                  value={form.customSize}
                  onChange={e => setForm(f => ({ ...f, customSize: e.target.value }))}
                />
              )}
            </div>

            {/* Starting & current balance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  {lang === 'ar' ? 'الرصيد الابتدائي' : lang === 'fr' ? 'Solde initial' : 'Starting Balance'}
                  <span className="text-destructive"> *</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="10000"
                  value={form.starting_balance}
                  onChange={e => setForm(f => ({ ...f, starting_balance: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {lang === 'ar' ? 'الرصيد الحالي' : lang === 'fr' ? 'Solde actuel' : 'Current Balance'}
                  <span className="text-destructive"> *</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="10000"
                  value={form.balance}
                  onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                />
              </div>
            </div>

            {/* Profit target — required for challenges, optional for Demo, hidden for others */}
            {SHOWS_PROFIT_TARGET.includes(form.account_type) && (
              <div className="space-y-1.5">
                <Label className="text-xs leading-tight">
                  {lang === 'ar' ? 'هدف الربح %' : lang === 'fr' ? 'Objectif profit %' : 'Profit Target %'}
                  {PROFIT_TARGET_REQUIRED.includes(form.account_type) && (
                    <span className="text-destructive"> *</span>
                  )}
                  {PROFIT_TARGET_OPTIONAL.includes(form.account_type) && (
                    <span className="ms-1 text-muted-foreground">
                      ({lang === 'ar' ? 'اختياري' : lang === 'fr' ? 'optionnel' : 'optional'})
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.profit_target}
                  onChange={e => setForm(f => ({ ...f, profit_target: e.target.value }))}
                />
              </div>
            )}

            {/* Max DD and Daily loss */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs leading-tight">
                  {lang === 'ar' ? 'حد السحب %' : lang === 'fr' ? 'DD max %' : 'Max DD %'}
                  {['Live', 'Demo'].includes(form.account_type) && (
                    <span className="ms-1 text-muted-foreground">
                      ({lang === 'ar' ? 'اختياري' : lang === 'fr' ? 'optionnel' : 'optional'})
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.max_drawdown_limit}
                  onChange={e => setForm(f => ({ ...f, max_drawdown_limit: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs leading-tight">
                  {lang === 'ar' ? 'خسارة يومية %' : lang === 'fr' ? 'Perte/jour %' : 'Daily Loss %'}
                  {['Live', 'Demo'].includes(form.account_type) && (
                    <span className="ms-1 text-muted-foreground">
                      ({lang === 'ar' ? 'اختياري' : lang === 'fr' ? 'optionnel' : 'optional'})
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.daily_loss_limit}
                  onChange={e => setForm(f => ({ ...f, daily_loss_limit: e.target.value }))}
                />
              </div>
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'العملة' : lang === 'fr' ? 'Devise' : 'Currency'}</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full min-h-[44px] gradient-primary text-primary-foreground"
              onClick={handleSave}
              disabled={submitting}
            >
              {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {lang === 'ar' ? 'حفظ' : lang === 'fr' ? 'Enregistrer' : 'Save Account'}
            </Button>
          </div>
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
}

export function AccountCard({ acc, lang, onEdit, onDelete, compact }: AccountCardProps) {
  const start = acc.starting_balance ?? 0;
  const curr = acc.balance ?? 0;
  const profitPct = start ? ((curr - start) / start) * 100 : 0;
  const profitProgress = profitProgressPct(acc);
  const ddProgress = drawdownProgressPct(acc);
  const symbol = (acc.currency ?? 'USD') === 'EUR' ? '€' : '$';

  return (
    <Card className="border-border bg-card">
      <CardContent className="space-y-4 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-bold text-foreground">{acc.account_name ?? acc.firm}</p>
            <p className="text-sm text-muted-foreground">{acc.firm}</p>
          </div>
          {(onEdit || onDelete) && (
            <div className="flex shrink-0 items-center gap-1">
              {onEdit && (
                <button
                  onClick={() => onEdit(acc)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(acc.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Type badge */}
        {acc.account_type && (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeBadgeClass(acc.account_type)}`}>
            {acc.account_type}
          </span>
        )}

        {/* Balance grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">
              {lang === 'ar' ? 'الرصيد الحالي' : lang === 'fr' ? 'Solde actuel' : 'Current'}
            </p>
            <p className="mt-0.5 font-bold text-foreground">{symbol}{(curr).toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">
              {lang === 'ar' ? 'الرصيد الابتدائي' : lang === 'fr' ? 'Initial' : 'Starting'}
            </p>
            <p className="mt-0.5 font-bold text-foreground">{symbol}{(start).toLocaleString()}</p>
          </div>
        </div>

        {/* Profit progress — only for Challenge Phase 1 & 2 */}
        {SHOWS_PROFIT_PROGRESS.includes(acc.account_type ?? '') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                {lang === 'ar' ? 'هدف الربح' : lang === 'fr' ? 'Objectif gain' : 'Profit Target'} {acc.profit_target ?? 10}%
              </span>
              <span className={`font-medium ${profitPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                {profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-profit transition-all" style={{ width: `${profitProgress}%` }} />
            </div>
          </div>
        )}

        {/* Drawdown progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <TrendingDown className="h-3 w-3" />
              {lang === 'ar' ? 'حد السحب' : lang === 'fr' ? 'Drawdown max' : 'Max Drawdown'} {acc.max_drawdown_limit ?? 10}%
            </span>
            <span className={`font-medium ${ddProgress > 50 ? 'text-loss' : 'text-muted-foreground'}`}>
              {ddProgress.toFixed(1)}% {lang === 'ar' ? 'مستخدم' : lang === 'fr' ? 'utilisé' : 'used'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all ${ddBarColor(ddProgress)}`}
              style={{ width: `${ddProgress}%` }}
            />
          </div>
        </div>

        {/* Daily loss limit — only show if not compact */}
        {!compact && (
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {lang === 'ar' ? 'حد الخسارة اليومية' : lang === 'fr' ? 'Perte journalière max' : 'Daily Loss Limit'}
            </span>
            <span className="font-medium text-foreground">{acc.daily_loss_limit ?? 5}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ConnectPage;
