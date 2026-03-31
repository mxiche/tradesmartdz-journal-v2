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
import { Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Language } from '@/lib/i18n';
import { Tables } from '@/integrations/supabase/types';

type Account = Tables<'mt5_accounts'>;

const SettingsPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      const { data } = await supabase.from('mt5_accounts').select('*').eq('user_id', user.id);
      setAccounts(data ?? []);
      setLoadingAccounts(false);
    };
    fetchAccounts();
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">{t('settings')}</h1>

      <Tabs defaultValue="profile">
        <TabsList className="w-full">
          <TabsTrigger value="profile" className="flex-1">{t('profile')}</TabsTrigger>
          <TabsTrigger value="preferences" className="flex-1">{t('preferences')}</TabsTrigger>
          <TabsTrigger value="subscription" className="flex-1">{t('subscription')}</TabsTrigger>
          <TabsTrigger value="accounts" className="flex-1">{t('connectedAccounts')}</TabsTrigger>
        </TabsList>

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

        <TabsContent value="accounts">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle>{t('connectedAccounts')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loadingAccounts ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No connected accounts yet.</p>
              ) : (
                accounts.map(acc => (
                  <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="font-medium">{acc.firm}</p>
                      <p className="text-sm text-muted-foreground">****{String(acc.login).slice(-4)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm"><RefreshCw className="me-1 h-3 w-3" /> {t('syncNow')}</Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteAccount(acc.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
