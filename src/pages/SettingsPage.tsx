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
import { Badge } from '@/components/ui/badge';
import { Trash2, Loader2, Send, CheckCircle2, Unlink } from 'lucide-react';
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
  const [polling, setPolling] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPolling(false);
  };

  // Clean up interval on unmount
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

              {/* Connection status */}
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
                    className="gradient-primary text-primary-foreground gap-2"
                    onClick={connectTelegram}
                    disabled={polling}
                  >
                    {polling
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />}
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

              {/* What triggers notifications */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {lang === 'ar' ? 'متى يتم الإرسال؟' : lang === 'fr' ? 'Quand les notifications sont-elles envoyées ?' : 'When are notifications sent?'}
                </p>
                <div className="space-y-1.5">
                  {[
                    { icon: '✅', text: lang === 'ar' ? 'عند تسجيل صفقة رابحة' : lang === 'fr' ? 'Lors d\'un trade gagnant' : 'When a winning trade is saved' },
                    { icon: '❌', text: lang === 'ar' ? 'عند تسجيل صفقة خاسرة' : lang === 'fr' ? 'Lors d\'un trade perdant' : 'When a losing trade is saved' },
                    { icon: '⚠️', text: lang === 'ar' ? 'عند اقتراب حد الخسارة اليومي (70%)' : lang === 'fr' ? 'Quand la limite de perte quotidienne approche (70%)' : 'When daily loss limit approaches 70%' },
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
