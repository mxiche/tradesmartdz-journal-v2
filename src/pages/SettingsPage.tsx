import { useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Trash2, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Language } from '@/lib/i18n';
import { Tables } from '@/integrations/supabase/types';

type Account = Tables<'mt5_accounts'>;

const SettingsPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const lang = language as 'ar' | 'fr' | 'en';
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Telegram
  const [telegramChatId, setTelegramChatId] = useState('');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingSend, setTestingSend] = useState(false);

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

  const saveTelegramChatId = async () => {
    if (!user) return;
    setSavingTelegram(true);
    const { error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, telegram_chat_id: telegramChatId.trim() || null }, { onConflict: 'user_id' });
    setSavingTelegram(false);
    if (error) { toast.error('Failed to save'); return; }
    toast.success(lang === 'ar' ? 'تم الحفظ!' : lang === 'fr' ? 'Sauvegardé !' : 'Saved!');
  };

  const sendTestMessage = async () => {
    const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
    if (!botToken) { toast.error('VITE_TELEGRAM_BOT_TOKEN not configured'); return; }
    if (!telegramChatId.trim()) {
      toast.error(lang === 'ar' ? 'أدخل Chat ID أولاً' : lang === 'fr' ? 'Entrez un Chat ID d\'abord' : 'Enter a Chat ID first');
      return;
    }
    setTestingSend(true);
    const text = lang === 'ar'
      ? '✅ مرحباً من TradeSmartDz! الإشعارات تعمل بشكل صحيح.'
      : lang === 'fr'
      ? '✅ Bonjour de TradeSmartDz ! Les notifications fonctionnent correctement.'
      : '✅ Hello from TradeSmartDz! Notifications are working correctly.';
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramChatId.trim(), text }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(lang === 'ar' ? 'تم الإرسال! تحقق من Telegram' : lang === 'fr' ? 'Envoyé ! Vérifiez Telegram' : 'Sent! Check your Telegram');
      } else {
        toast.error('Telegram error: ' + (data.description ?? 'Unknown'));
      }
    } catch (e: any) {
      toast.error('Failed to send: ' + e.message);
    }
    setTestingSend(false);
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
                <Input defaultValue={user?.user_metadata?.full_name || ''} />
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input defaultValue={user?.email || ''} disabled />
              </div>
              <Button className="gradient-primary text-primary-foreground" onClick={() => toast.success('Saved!')}>{t('save')}</Button>

              <div className="border-t border-border pt-4">
                <h3 className="mb-3 font-medium">{t('changePassword')}</h3>
                <div className="space-y-3">
                  <Input type="password" placeholder={t('password')} />
                  <Input type="password" placeholder={t('confirmPassword')} />
                  <Button variant="outline">{t('changePassword')}</Button>
                </div>
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
              {/* How-to instruction */}
              <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground leading-relaxed">
                {lang === 'ar'
                  ? 'افتح Telegram وابحث عن @userinfobot وأرسل له /start للحصول على Chat ID الخاص بك.'
                  : lang === 'fr'
                  ? 'Ouvrez Telegram, cherchez @userinfobot et envoyez /start pour obtenir votre Chat ID.'
                  : 'Open Telegram, search @userinfobot and send /start to get your Chat ID.'}
              </div>

              {/* Chat ID input */}
              <div className="space-y-2">
                <Label>
                  {lang === 'ar' ? 'معرّف المحادثة (Chat ID)' : lang === 'fr' ? 'Chat ID Telegram' : 'Telegram Chat ID'}
                </Label>
                <Input
                  placeholder="123456789"
                  value={telegramChatId}
                  onChange={e => setTelegramChatId(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="gradient-primary text-primary-foreground"
                  onClick={saveTelegramChatId}
                  disabled={savingTelegram}
                >
                  {savingTelegram ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="me-2 h-4 w-4" />}
                  {lang === 'ar' ? 'حفظ' : lang === 'fr' ? 'Enregistrer' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  onClick={sendTestMessage}
                  disabled={testingSend || !telegramChatId.trim()}
                >
                  {testingSend ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
                  {lang === 'ar' ? 'إرسال رسالة تجريبية' : lang === 'fr' ? 'Envoyer un test' : 'Send Test Message'}
                </Button>
              </div>

              {/* What triggers notifications */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {lang === 'ar' ? 'متى يتم الإرسال؟' : lang === 'fr' ? 'Quand les notifications sont-elles envoyées ?' : 'When are notifications sent?'}
                </p>
                <div className="space-y-1.5">
                  {[
                    {
                      icon: '✅',
                      text: lang === 'ar' ? 'عند تسجيل صفقة رابحة' : lang === 'fr' ? 'Lors d\'un trade gagnant' : 'When a winning trade is saved',
                    },
                    {
                      icon: '❌',
                      text: lang === 'ar' ? 'عند تسجيل صفقة خاسرة' : lang === 'fr' ? 'Lors d\'un trade perdant' : 'When a losing trade is saved',
                    },
                    {
                      icon: '⚠️',
                      text: lang === 'ar' ? 'عند اقتراب حد الخسارة اليومي (70%)' : lang === 'fr' ? 'Quand la limite de perte quotidienne approche (70%)' : 'When daily loss limit approaches 70%',
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
          <Card className="border-border bg-card">
            <CardHeader><CardTitle>{t('subscription')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">{t('currentPlan')}</p>
                  <Badge variant="secondary">{t('free')}</Badge>
                </div>
                <Button className="gradient-primary text-primary-foreground">{t('upgrade')}</Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-primary p-4">
                  <div>
                    <p className="font-medium text-foreground">{t('pro')}</p>
                    <p className="text-sm text-muted-foreground">2,500 DA/{t('month')}</p>
                  </div>
                  <Button className="gradient-primary text-primary-foreground">{t('choosePlan')}</Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium text-foreground">{t('journalOnly')}</p>
                    <p className="text-sm text-muted-foreground">1,200 DA/{t('month')}</p>
                  </div>
                  <Button variant="outline">{t('choosePlan')}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
