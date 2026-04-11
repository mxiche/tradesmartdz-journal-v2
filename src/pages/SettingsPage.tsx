import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Trash2, Loader2, Send, CheckCircle2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Language } from '@/lib/i18n';
import { Tables } from '@/integrations/supabase/types';

type Account = Tables<'mt5_accounts'>;

function formatTimeAgo(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SettingsPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const lang = language as 'ar' | 'fr' | 'en';
  const { theme, toggleTheme } = useTheme();
  const { user, userPlan, expiresAt } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Profile
  const [fullName, setFullName] = useState((user?.user_metadata?.full_name as string) || '');
  const [isSaving, setIsSaving] = useState(false);

  // Change password
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // Telegram
  const [telegramChatId, setTelegramChatId] = useState('');
  const [polling, setPolling] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscription / upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'baridimob' | 'usdt' | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<{ submitted_at: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      const { data } = await supabase.from('mt5_accounts').select('*').eq('user_id', user.id);
      setAccounts(data ?? []);
      setLoadingAccounts(false);
    };
    fetchAccounts();

    // Load telegram chat id
    supabase
      .from('user_preferences')
      .select('telegram_chat_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.telegram_chat_id) setTelegramChatId(data.telegram_chat_id);
      });

    // Load pending subscription request
    supabase
      .from('subscriptions')
      .select('submitted_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPendingSubmission(data);
      });
  }, [user]);

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.from('mt5_accounts').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete account');
    } else {
      setAccounts(prev => prev.filter(a => a.id !== id));
      toast.success('Account removed');
    }
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPolling(false);
  };

  useEffect(() => () => stopPolling(), []);

  const startPolling = () => {
    if (!user || pollIntervalRef.current) return;
    setPolling(true);
    pollIntervalRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('telegram_chat_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const chatId = data?.telegram_chat_id;
      if (chatId) {
        setTelegramChatId(chatId);
        stopPolling();
        toast.success(lang === 'ar' ? '✅ تم ربط Telegram بنجاح!' : lang === 'fr' ? '✅ Telegram connecté avec succès !' : '✅ Telegram connected successfully!');
      }
    }, 5000);
  };

  const connectTelegram = () => {
    if (!user) return;
    window.open(`https://t.me/Tradesmartdzbot?start=${user.id}`, '_blank');
    startPolling();
  };

  const handleSaveProfile = async () => {
    if (!user || !fullName.trim()) return;
    setIsSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, full_name: fullName.trim(), email: user.email });
      if (profileError) throw profileError;

      toast.success(t('saved_successfully') || 'Saved successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast.error(t('passwordsMismatch'));
      return;
    }
    if (!user?.email) return;
    setPwdLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPwd,
    });
    if (signInError) {
      setPwdLoading(false);
      toast.error(t('currentPasswordIncorrect'));
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setPwdLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('passwordChanged'));
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    }
  };

  const disconnectTelegram = async () => {
    if (!user) return;
    stopPolling();
    setDisconnecting(true);
    await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, telegram_chat_id: null }, { onConflict: 'user_id' });
    setTelegramChatId('');
    setDisconnecting(false);
    toast.success(lang === 'ar' ? 'تم قطع الاتصال' : lang === 'fr' ? 'Déconnecté' : 'Disconnected');
  };

  const handleSubmitPayment = async () => {
    if (!proofFile || !user) return;
    setIsSubmitting(true);
    try {
      // Upload screenshot to Supabase Storage
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `payment-proof/${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, proofFile, { contentType: proofFile.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('screenshots')
        .getPublicUrl(fileName);

      // Insert subscription request
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan: 'pro',
          status: 'pending',
          payment_method: paymentMethod,
          payment_reference: reference || null,
          payment_proof_url: urlData.publicUrl,
          amount: paymentMethod === 'baridimob' ? '3700 DA' : '15 USDT',
        });
      if (subError) throw subError;

      // Notify owner via Telegram edge function
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            type: 'payment_request',
            userEmail: user.email,
            userId: user.id,
            paymentMethod,
            amount: paymentMethod === 'baridimob' ? '3,700 DA' : '15 USDT',
            reference: reference || 'Not provided',
            proofUrl: urlData.publicUrl,
          }),
        }
      );

      // Send confirmation email via edge function
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            type: 'payment_confirmation',
            userEmail: user.email,
            paymentMethod,
            amount: paymentMethod === 'baridimob' ? '3,700 DA' : '15 USDT',
          }),
        }
      ).catch(() => { /* non-blocking */ });

      setUpgradeStep(4);
      setPendingSubmission({ submitted_at: new Date().toISOString() });
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModal = () => {
    setShowUpgradeModal(false);
    setUpgradeStep(1);
    setPaymentMethod(null);
    setProofFile(null);
    setReference('');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">{t('settings')}</h1>

      <Tabs defaultValue="profile">
        <TabsList className="w-full">
          <TabsTrigger value="profile" className="flex-1">{t('profile')}</TabsTrigger>
          <TabsTrigger value="preferences" className="flex-1">{t('preferences')}</TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1">
            {lang === 'ar' ? 'الإشعارات' : lang === 'fr' ? 'Notifications' : 'Notifications'}
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex-1">{t('subscription')}</TabsTrigger>
        </TabsList>

        {/* Profile tab */}
        <TabsContent value="profile">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle>{t('profile')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('fullName')}</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input defaultValue={user?.email || ''} disabled />
              </div>
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving || !fullName.trim()}
                className="bg-teal-500 hover:bg-teal-600 text-black font-semibold"
              >
                {isSaving ? <><Loader2 className="me-2 h-4 w-4 animate-spin" />{t('save')}</> : t('save')}
              </Button>

              <div className="border-t border-border pt-4">
                <h3 className="mb-3 font-medium">{t('changePassword')}</h3>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <Input
                    type="password"
                    placeholder={t('currentPassword')}
                    value={currentPwd}
                    onChange={e => setCurrentPwd(e.target.value)}
                    required
                  />
                  <Input
                    type="password"
                    placeholder={t('newPassword')}
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    required
                    minLength={6}
                  />
                  <Input
                    type="password"
                    placeholder={t('confirmPassword')}
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    required
                    minLength={6}
                  />
                  <Button type="submit" variant="outline" disabled={pwdLoading}>
                    {pwdLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t('changePassword')}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences tab */}
        <TabsContent value="preferences">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle>{t('preferences')}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('language')}</p>
                  <p className="text-sm text-muted-foreground">العربية / Français / English</p>
                </div>
                <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">🇩🇿 العربية</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('theme')}</p>
                  <p className="text-sm text-muted-foreground">{theme === 'dark' ? t('dark') : t('light')}</p>
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
              </div>

              <div className="flex items-center justify-between">
                <p className="font-medium">{t('timezone')}</p>
                <Select defaultValue="Africa/Algiers">
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Africa/Algiers">Africa/Algiers</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="America/New_York">America/New York</SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <p className="font-medium">{t('currency')}</p>
                <Select defaultValue="USD">
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="DZD">DZD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications tab */}
        <TabsContent value="notifications">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>
                {lang === 'ar' ? 'إشعارات Telegram' : lang === 'fr' ? 'Notifications Telegram' : 'Telegram Notifications'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {telegramChatId ? (
                <div className="flex items-center justify-between rounded-lg border border-profit/30 bg-profit/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-profit" />
                    <span className="font-medium text-profit">
                      {lang === 'ar' ? 'تم ربط Telegram بنجاح!' : lang === 'fr' ? 'Telegram connecté !' : 'Telegram Connected!'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectTelegram}
                    disabled={disconnecting}
                    className="gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                  >
                    {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                    {lang === 'ar' ? 'قطع الاتصال' : lang === 'fr' ? 'Déconnecter' : 'Disconnect'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Button
                    className="text-white gap-2"
                    style={{ backgroundColor: '#229ED9' }}
                    onClick={connectTelegram}
                    disabled={polling}
                  >
                    {polling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {lang === 'ar' ? 'ربط Telegram' : lang === 'fr' ? 'Connecter Telegram' : 'Connect Telegram'}
                  </Button>

                  {polling && (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                      <span>
                        {lang === 'ar'
                          ? 'انقر على Start في Telegram لإتمام الربط...'
                          : lang === 'fr'
                          ? 'Cliquez sur Start dans Telegram pour finaliser la connexion...'
                          : 'Click Start in Telegram to complete the connection...'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {lang === 'ar' ? 'متى يتم الإرسال؟' : lang === 'fr' ? 'Quand les notifications sont-elles envoyées ?' : 'When are notifications sent?'}
                </p>
                <div className="space-y-1.5">
                  {[
                    {
                      icon: '📊',
                      text: lang === 'ar' ? 'ملخص يومي كل يوم في الساعة 10 مساءً بتوقيت الجزائر'
                          : lang === 'fr' ? 'Résumé quotidien chaque jour à 22h (heure algérienne)'
                          : 'Daily summary every day at 10 PM Algiers time',
                    },
                    {
                      icon: '📈',
                      text: lang === 'ar' ? 'تقرير أسبوعي كل يوم أحد'
                          : lang === 'fr' ? 'Rapport hebdomadaire chaque dimanche'
                          : 'Weekly report every Sunday',
                    },
                    {
                      icon: '⚠️',
                      text: lang === 'ar' ? 'تنبيه عند اقتراب حد الخسارة'
                          : lang === 'fr' ? 'Alerte quand le drawdown approche de la limite'
                          : 'Warning when drawdown approaches limit',
                    },
                  ].map(item => (
                    <div key={item.text} className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                      <span>{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription tab */}
        <TabsContent value="subscription">
          <div className="space-y-0">

            {/* Current Plan Card */}
            <div className="rounded-2xl border border-border bg-card p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {lang === 'ar' ? 'الخطة الحالية' : lang === 'fr' ? 'Plan actuel' : 'Current Plan'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-foreground">
                      {userPlan === 'pro' ? 'Pro ⭐' : 'Free'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      userPlan === 'pro'
                        ? 'bg-teal-500/20 text-teal-500'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {userPlan === 'pro' ? 'ACTIVE' : 'LIMITED'}
                    </span>
                  </div>
                  {userPlan === 'pro' && expiresAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {lang === 'ar' ? `يتجدد في ${new Date(expiresAt).toLocaleDateString('ar')}` :
                       lang === 'fr' ? `Renouvellement le ${new Date(expiresAt).toLocaleDateString('fr')}` :
                       `Renews on ${new Date(expiresAt).toLocaleDateString()}`}
                    </p>
                  )}
                </div>
                {userPlan === 'free' && (
                  <Button
                    onClick={() => setShowUpgradeModal(true)}
                    className="bg-teal-500 hover:bg-teal-600 text-black font-bold px-6"
                  >
                    {lang === 'ar' ? 'ترقية إلى Pro' : lang === 'fr' ? 'Passer à Pro' : 'Upgrade to Pro'}
                  </Button>
                )}
              </div>
            </div>

            {/* Feature comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

              {/* Free card */}
              <div className={`rounded-2xl border p-5 ${
                userPlan === 'free'
                  ? 'border-teal-500/50 bg-teal-500/5'
                  : 'border-border bg-card'
              }`}>
                <h3 className="font-bold text-lg mb-1">Free</h3>
                <p className="text-2xl font-black mb-4">0 DA</p>
                <ul className="space-y-2.5 text-sm">
                  {[
                    { text: lang === 'ar' ? 'حساب واحد' : lang === 'fr' ? '1 compte connecté' : '1 connected account', ok: true },
                    { text: lang === 'ar' ? '50 صفقة/شهر' : lang === 'fr' ? '50 trades/mois' : '50 trades/month', ok: true },
                    { text: lang === 'ar' ? 'تحليلات أساسية' : lang === 'fr' ? 'Analytiques de base' : 'Basic analytics', ok: true },
                    { text: lang === 'ar' ? 'المدرب الذكي' : lang === 'fr' ? 'Coach IA' : 'AI Coach', ok: false },
                    { text: lang === 'ar' ? 'إشعارات Telegram' : lang === 'fr' ? 'Notifications Telegram' : 'Telegram notifications', ok: false },
                    { text: lang === 'ar' ? 'صفقات غير محدودة' : lang === 'fr' ? 'Trades illimités' : 'Unlimited trades', ok: false },
                    { text: lang === 'ar' ? 'تصدير PDF وCSV' : lang === 'fr' ? 'Export PDF & CSV' : 'PDF & CSV export', ok: false },
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={item.ok ? 'text-green-500' : 'text-muted-foreground'}>
                        {item.ok ? '✓' : '✗'}
                      </span>
                      <span className={item.ok ? 'text-foreground' : 'text-muted-foreground line-through'}>
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pro card */}
              <div className={`rounded-2xl border p-5 relative overflow-hidden ${
                userPlan === 'pro'
                  ? 'border-teal-500 bg-teal-500/5'
                  : 'border-teal-500/40 bg-gradient-to-br from-teal-500/5 to-transparent'
              }`}>
                <div className="absolute top-3 right-3 bg-teal-500 text-black text-xs font-black px-2 py-0.5 rounded-full">
                  BEST VALUE
                </div>
                <h3 className="font-bold text-lg mb-1">Pro ⭐</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-black">3,700 DA</span>
                  <span className="text-muted-foreground text-sm">/{lang === 'ar' ? 'شهر' : lang === 'fr' ? 'mois' : 'month'}</span>
                  <span className="text-xs text-muted-foreground">{lang === 'ar' ? 'أو 15 USDT' : 'or 15 USDT'}</span>
                </div>
                <ul className="space-y-2.5 text-sm">
                  {[
                    lang === 'ar' ? 'حسابات غير محدودة' : lang === 'fr' ? 'Comptes illimités' : 'Unlimited accounts',
                    lang === 'ar' ? 'صفقات غير محدودة' : lang === 'fr' ? 'Trades illimités' : 'Unlimited trades',
                    lang === 'ar' ? 'تحليلات كاملة' : lang === 'fr' ? 'Analytiques complètes' : 'Full analytics',
                    lang === 'ar' ? 'مدرب ذكي (تحليل/يوم، 10 رسائل/يوم)' : lang === 'fr' ? 'Coach IA (1 analyse/jour, 10 msgs/jour)' : 'AI Coach (1 analysis/day, 10 msgs/day)',
                    lang === 'ar' ? 'إشعارات Telegram' : lang === 'fr' ? 'Notifications Telegram' : 'Telegram notifications',
                    lang === 'ar' ? 'تصدير PDF وCSV' : lang === 'fr' ? 'Export PDF & CSV' : 'PDF & CSV export',
                    lang === 'ar' ? 'دعم أولوي' : lang === 'fr' ? 'Support prioritaire' : 'Priority support',
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-teal-500">✓</span>
                      <span className="text-foreground">{text}</span>
                    </li>
                  ))}
                </ul>
                {userPlan === 'free' && (
                  <Button
                    onClick={() => setShowUpgradeModal(true)}
                    className="w-full mt-5 bg-teal-500 hover:bg-teal-600 text-black font-bold"
                  >
                    {lang === 'ar' ? 'ترقية الآن' : lang === 'fr' ? 'Passer à Pro' : 'Upgrade Now'}
                  </Button>
                )}
              </div>
            </div>

            {/* Pending verification notice */}
            {pendingSubmission && userPlan === 'free' && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center gap-3">
                <span className="text-yellow-500 text-xl">⏳</span>
                <div>
                  <p className="font-semibold text-sm">
                    {lang === 'ar' ? 'الدفع قيد التحقق' : lang === 'fr' ? 'Paiement en cours de vérification' : 'Payment under verification'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'ar'
                      ? `تم الإرسال ${formatTimeAgo(pendingSubmission.submitted_at)} • يتم التفعيل عادةً خلال 24 ساعة`
                      : lang === 'fr'
                      ? `Soumis ${formatTimeAgo(pendingSubmission.submitted_at)} • Activé généralement sous 24h`
                      : `Submitted ${formatTimeAgo(pendingSubmission.submitted_at)} • Usually activated within 24h`}
                  </p>
                </div>
              </div>
            )}

            {/* Support footer */}
            <p className="text-xs text-center text-muted-foreground pt-2">
              {lang === 'ar' ? 'هل تحتاج مساعدة؟' : lang === 'fr' ? 'Besoin d\'aide ?' : 'Need help?'}{' '}
              <a href="mailto:support@tradesmartdz.com" className="text-teal-500 hover:underline">
                support@tradesmartdz.com
              </a>
            </p>

          </div>
        </TabsContent>
      </Tabs>

      {/* ── Upgrade Modal ── */}
      <Dialog open={showUpgradeModal} onOpenChange={(open) => { if (!open) resetModal(); else setShowUpgradeModal(true); }}>
        <DialogContent className="max-w-lg w-full md:rounded-2xl max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:rounded-t-2xl max-sm:rounded-b-none max-h-[90vh] flex flex-col overflow-hidden p-0">

          {/* Progress bar */}
          <div className="flex gap-1 p-4 pb-0 flex-shrink-0">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                s <= upgradeStep ? 'bg-teal-500' : 'bg-muted'
              }`} />
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">

            {/* STEP 1: Choose payment method */}
            {upgradeStep === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-xl font-black mb-1">
                  {lang === 'ar' ? 'ترقية إلى Pro ⭐' : lang === 'fr' ? 'Passer à Pro ⭐' : 'Upgrade to Pro ⭐'}
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  {lang === 'ar' ? 'اختر طريقة الدفع' : lang === 'fr' ? 'Choisissez votre méthode de paiement' : 'Choose your payment method'}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setPaymentMethod('baridimob'); setUpgradeStep(2); }}
                    className="border-2 border-border hover:border-teal-500 rounded-2xl p-5 text-left transition-all duration-200 hover:bg-teal-500/5"
                  >
                    <div className="text-3xl mb-3">💳</div>
                    <p className="font-bold text-base">BaridiMob</p>
                    <p className="text-teal-500 font-black text-lg mt-1">3,700 DA</p>
                    <p className="text-xs text-muted-foreground mt-1">/{lang === 'ar' ? 'شهر' : lang === 'fr' ? 'mois' : 'month'}</p>
                    <span className="inline-block mt-3 text-xs bg-teal-500/20 text-teal-600 px-2 py-0.5 rounded-full font-semibold">
                      🇩🇿 {lang === 'ar' ? 'موصى به' : lang === 'fr' ? 'Recommandé' : 'Recommended'}
                    </span>
                  </button>

                  <button
                    onClick={() => { setPaymentMethod('usdt'); setUpgradeStep(2); }}
                    className="border-2 border-border hover:border-teal-500 rounded-2xl p-5 text-left transition-all duration-200 hover:bg-teal-500/5"
                  >
                    <div className="text-3xl mb-3">₮</div>
                    <p className="font-bold text-base">USDT</p>
                    <p className="text-teal-500 font-black text-lg mt-1">15 USDT</p>
                    <p className="text-xs text-muted-foreground mt-1">/{lang === 'ar' ? 'شهر' : lang === 'fr' ? 'mois' : 'month'}</p>
                    <span className="inline-block mt-3 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">
                      TRC20 Network
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Payment instructions */}
            {upgradeStep === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <button
                  onClick={() => setUpgradeStep(1)}
                  className="text-sm text-muted-foreground mb-4 flex items-center gap-1 hover:text-foreground"
                >
                  ← {lang === 'ar' ? 'رجوع' : lang === 'fr' ? 'Retour' : 'Back'}
                </button>

                {paymentMethod === 'baridimob' && (
                  <>
                    <h2 className="text-xl font-black mb-1">
                      {lang === 'ar' ? 'الدفع عبر BaridiMob' : lang === 'fr' ? 'Payer via BaridiMob' : 'Pay via BaridiMob'}
                    </h2>
                    <p className="text-muted-foreground text-sm mb-5">
                      {lang === 'ar' ? 'أرسل 3,700 دج بالضبط إلى هذا الحساب' : lang === 'fr' ? 'Envoyez exactement 3 700 DA à ce compte' : 'Send exactly 3,700 DA to this account'}
                    </p>

                    <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 mb-4 text-center">
                      <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'المبلغ المطلوب' : lang === 'fr' ? 'Montant à envoyer' : 'Amount to send'}</p>
                      <p className="text-3xl font-black text-teal-500">3,700 DA</p>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-4 mb-4">
                      <p className="text-xs text-muted-foreground mb-1">RIP</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono font-bold text-sm tracking-wider">00799999002897521156</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText('00799999002897521156'); toast.success('Copied!'); }}
                          className="px-3 py-1.5 bg-teal-500 text-black text-xs font-bold rounded-lg hover:bg-teal-600 transition-colors flex-shrink-0"
                        >
                          {lang === 'ar' ? 'نسخ' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4 mb-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        {lang === 'ar' ? 'الخطوات' : lang === 'fr' ? 'Étapes' : 'Steps'}
                      </p>
                      {(lang === 'ar'
                        ? ['افتح تطبيق بريدي موب', 'اضغط تحويل', 'أدخل RIP: 00799999002897521156', 'المبلغ: 3,700 دج', 'خذ لقطة شاشة للإيصال']
                        : lang === 'fr'
                        ? ["Ouvrez l'app BaridiMob", 'Appuyez sur Virement', 'Entrez RIP: 00799999002897521156', 'Montant: 3 700 DA', 'Prenez une capture du reçu']
                        : ['Open BaridiMob app', 'Tap Virement / Transfer', 'Enter RIP: 00799999002897521156', 'Amount: 3,700 DA', 'Take a screenshot of the reçu']
                      ).map((step, i) => (
                        <div key={i} className="flex items-start gap-3 mb-2">
                          <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-500 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-sm">{step}</p>
                        </div>
                      ))}
                    </div>

                    <Button onClick={() => setUpgradeStep(3)} className="w-full bg-teal-500 hover:bg-teal-600 text-black font-bold py-3">
                      {lang === 'ar' ? 'لقد أرسلت الدفع ←' : lang === 'fr' ? "J'ai envoyé le paiement →" : "I've sent the payment →"}
                    </Button>
                  </>
                )}

                {paymentMethod === 'usdt' && (
                  <>
                    <h2 className="text-xl font-black mb-1">
                      {lang === 'ar' ? 'الدفع عبر USDT' : lang === 'fr' ? 'Payer via USDT' : 'Pay via USDT'}
                    </h2>
                    <p className="text-muted-foreground text-sm mb-5">
                      {lang === 'ar' ? 'أرسل 15 USDT على شبكة TRC20' : lang === 'fr' ? 'Envoyez exactement 15 USDT sur le réseau TRC20' : 'Send exactly 15 USDT on TRC20 network'}
                    </p>

                    <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 mb-4 text-center">
                      <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'المبلغ المطلوب' : lang === 'fr' ? 'Montant à envoyer' : 'Amount to send'}</p>
                      <p className="text-3xl font-black text-teal-500">15 USDT</p>
                      <p className="text-xs text-red-500 font-semibold mt-1">⚠️ TRC20 {lang === 'ar' ? 'فقط' : lang === 'fr' ? 'uniquement' : 'only'}</p>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-4 mb-4">
                      <p className="text-xs text-muted-foreground mb-1">USDT TRC20 Address</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-xs break-all text-foreground">TNHKJR5anHYYJc1ATZDKsnzAZLtPyWtf8i</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText('TNHKJR5anHYYJc1ATZDKsnzAZLtPyWtf8i'); toast.success('Copied!'); }}
                          className="px-3 py-1.5 bg-teal-500 text-black text-xs font-bold rounded-lg hover:bg-teal-600 transition-colors flex-shrink-0"
                        >
                          {lang === 'ar' ? 'نسخ' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
                      <p className="text-xs text-red-500 font-semibold">⚠️ {lang === 'ar' ? 'تحذيرات مهمة' : lang === 'fr' ? 'Avertissements importants' : 'Important warnings'}</p>
                      <ul className="text-xs text-red-400 mt-1 space-y-1">
                        <li>• {lang === 'ar' ? 'أرسل على شبكة TRC20 فقط' : lang === 'fr' ? 'Envoyez sur TRC20 uniquement' : 'Only send on TRC20 network'}</li>
                        <li>• {lang === 'ar' ? 'الإرسال على شبكة خاطئة = خسارة دائمة' : lang === 'fr' ? 'Mauvais réseau = perte permanente' : 'Sending on wrong network = permanent loss of funds'}</li>
                        <li>• {lang === 'ar' ? 'أرسل 15 USDT بالضبط' : lang === 'fr' ? 'Envoyez exactement 15 USDT' : 'Send exactly 15 USDT'}</li>
                      </ul>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4 mb-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        {lang === 'ar' ? 'الخطوات' : lang === 'fr' ? 'Étapes' : 'Steps'}
                      </p>
                      {(lang === 'ar'
                        ? ['افتح منصة العملات الرقمية', 'اذهب إلى سحب / إرسال USDT', 'اختر شبكة TRC20', 'الصق العنوان أعلاه', 'المبلغ: 15 USDT', 'خذ لقطة شاشة لمعرف المعاملة']
                        : lang === 'fr'
                        ? ['Ouvrez votre plateforme crypto', 'Allez dans Retirer / Envoyer USDT', 'Sélectionnez réseau TRC20', "Collez l'adresse ci-dessus", 'Montant: 15 USDT', 'Capturez le TXID']
                        : ['Open your crypto platform', 'Go to Withdraw / Send USDT', 'Select TRC20 network', 'Paste the address above', 'Amount: 15 USDT', 'Screenshot the transaction hash (TXID)']
                      ).map((step, i) => (
                        <div key={i} className="flex items-start gap-3 mb-2">
                          <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-500 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-sm">{step}</p>
                        </div>
                      ))}
                    </div>

                    <Button onClick={() => setUpgradeStep(3)} className="w-full bg-teal-500 hover:bg-teal-600 text-black font-bold py-3">
                      {lang === 'ar' ? 'لقد أرسلت الدفع ←' : lang === 'fr' ? "J'ai envoyé le paiement →" : "I've sent the payment →"}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* STEP 3: Submit proof */}
            {upgradeStep === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <button
                  onClick={() => setUpgradeStep(2)}
                  className="text-sm text-muted-foreground mb-4 flex items-center gap-1 hover:text-foreground"
                >
                  ← {lang === 'ar' ? 'رجوع' : lang === 'fr' ? 'Retour' : 'Back'}
                </button>

                <h2 className="text-xl font-black mb-1">
                  {lang === 'ar' ? 'تأكيد الدفع' : lang === 'fr' ? 'Confirmer le paiement' : 'Confirm Payment'}
                </h2>
                <p className="text-muted-foreground text-sm mb-5">
                  {lang === 'ar' ? 'ارفع لقطة شاشة الدفع للتحقق' : lang === 'fr' ? 'Uploadez votre capture de paiement' : 'Upload your payment screenshot so we can verify'}
                </p>

                <div className="bg-muted/50 rounded-xl p-4 mb-4">
                  <p className="text-xs text-muted-foreground mb-1">{lang === 'ar' ? 'حسابك' : lang === 'fr' ? 'Votre compte' : 'Your account'}</p>
                  <p className="font-semibold text-sm">{user?.email}</p>
                </div>

                <div className="mb-4">
                  <label className="text-sm font-semibold mb-2 block">
                    {lang === 'ar' ? 'مرجع المعاملة' : lang === 'fr' ? 'Référence de transaction' : 'Transaction Reference'}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({lang === 'ar' ? 'اختياري' : lang === 'fr' ? 'optionnel' : 'optional but helps verification'})
                    </span>
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={paymentMethod === 'baridimob'
                      ? (lang === 'ar' ? 'رقم الإيصال أو أي مرجع' : lang === 'fr' ? 'Numéro de reçu ou référence' : 'Reçu number or any reference')
                      : (lang === 'ar' ? 'معرف المعاملة / TXID' : lang === 'fr' ? 'TXID / Hash de transaction' : 'TXID / Transaction hash')}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>

                <div className="mb-6">
                  <label className="text-sm font-semibold mb-2 block">
                    {lang === 'ar' ? 'لقطة شاشة الدفع' : lang === 'fr' ? 'Capture du paiement' : 'Payment Screenshot'} <span className="text-red-500">*</span>
                  </label>
                  <label className={`block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                    proofFile ? 'border-teal-500 bg-teal-500/5' : 'border-border hover:border-teal-500/50 hover:bg-muted/50'
                  }`}>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    />
                    {proofFile ? (
                      <div>
                        <p className="text-teal-500 font-semibold text-sm">✓ {proofFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{lang === 'ar' ? 'اضغط للتغيير' : lang === 'fr' ? 'Appuyer pour changer' : 'Tap to change'}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-2xl mb-2">📎</p>
                        <p className="text-sm font-semibold">{lang === 'ar' ? 'رفع لقطة شاشة' : lang === 'fr' ? 'Uploader une capture' : 'Upload screenshot'}</p>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG — max 5MB</p>
                      </div>
                    )}
                  </label>
                </div>

                <Button
                  onClick={handleSubmitPayment}
                  disabled={!proofFile || isSubmitting}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-black font-bold py-3 disabled:opacity-50"
                >
                  {isSubmitting
                    ? <><Loader2 className="me-2 h-4 w-4 animate-spin" />{lang === 'ar' ? 'جاري الإرسال...' : lang === 'fr' ? 'Envoi...' : 'Submitting...'}</>
                    : (lang === 'ar' ? 'إرسال للتحقق ✓' : lang === 'fr' ? 'Soumettre pour vérification ✓' : 'Submit for Verification ✓')}
                </Button>
              </div>
            )}

            {/* STEP 4: Success */}
            {upgradeStep === 4 && (
              <div className="animate-in fade-in zoom-in-95 duration-300 text-center py-8">
                {/* ✅ icon in teal circle */}
                <div className="w-20 h-20 rounded-full bg-teal-500/15 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-10 h-10 text-teal-500" />
                </div>

                <h2 className="text-2xl font-black mb-2">
                  {lang === 'ar' ? 'تم الإرسال بنجاح!' : lang === 'fr' ? 'Soumis avec succès !' : 'Successfully Submitted!'}
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  {lang === 'ar'
                    ? 'يتم التحقق من دفعك. سنفعّل خطة Pro خلال 24 ساعة.'
                    : lang === 'fr'
                    ? 'Votre paiement est en cours de vérification. Activation sous 24h.'
                    : 'Your payment is being verified. We\'ll activate your Pro plan within 24 hours.'}
                </p>

                {/* Summary card */}
                <div className="bg-muted/50 rounded-xl p-4 mb-4 text-left">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                    {lang === 'ar' ? 'الملخص' : lang === 'fr' ? 'Résumé' : 'Summary'}
                  </p>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{lang === 'ar' ? 'الحساب' : lang === 'fr' ? 'Compte' : 'Account'}</span>
                    <span className="font-semibold truncate max-w-[55%] text-right">{user?.email}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{lang === 'ar' ? 'الخطة' : 'Plan'}</span>
                    <span className="font-bold">Pro ⭐</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{lang === 'ar' ? 'الطريقة' : lang === 'fr' ? 'Méthode' : 'Method'}</span>
                    <span className="font-bold capitalize">{paymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{lang === 'ar' ? 'المبلغ' : lang === 'fr' ? 'Montant' : 'Amount'}</span>
                    <span className="font-bold">{paymentMethod === 'baridimob' ? '3,700 DA' : '15 USDT'}</span>
                  </div>
                </div>

                {/* Telegram CTA */}
                <a
                  href="https://t.me/TradeSmartDz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl bg-blue-500/10 border border-blue-500/30 p-4 mb-4 text-left hover:bg-blue-500/15 transition-colors"
                >
                  <p className="font-semibold text-sm text-blue-400 mb-1">
                    📸 {lang === 'ar' ? 'أرسل لنا لقطة الشاشة عبر Telegram' : lang === 'fr' ? 'Envoyez la capture sur Telegram' : 'Send your screenshot on Telegram'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'ar'
                      ? 'للتسريع، أرسل إثبات الدفع مباشرة عبر Telegram @TradeSmartDz'
                      : lang === 'fr'
                      ? 'Pour accélérer, envoyez la preuve sur Telegram @TradeSmartDz'
                      : 'To speed things up, send your proof directly via Telegram @TradeSmartDz'}
                  </p>
                </a>

                {/* Support email */}
                <p className="text-xs text-muted-foreground mb-6">
                  {lang === 'ar' ? 'للمساعدة:' : lang === 'fr' ? 'Support :' : 'Need help?'}{' '}
                  <a href="mailto:support@tradesmartdz.com" className="text-teal-500 hover:underline">
                    support@tradesmartdz.com
                  </a>
                </p>

                <Button
                  variant="outline"
                  onClick={resetModal}
                  className="w-full font-bold"
                >
                  {lang === 'ar' ? 'العودة للتطبيق' : lang === 'fr' ? "Retour à l'app" : 'Back to App'}
                </Button>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
