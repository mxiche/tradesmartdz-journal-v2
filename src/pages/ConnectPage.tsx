import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Loader2, Lock, Info, Copy, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

const ConnectPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [firm, setFirm] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [server, setServer] = useState('');
  const [investorPass, setInvestorPass] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountBalance, setAccountBalance] = useState('');
  const [accountId, setAccountId] = useState('');

  const handleTest = async () => {
    if (!firm || !accountNumber || !server || !investorPass) {
      toast.error('Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      const requestBody = {
        account: parseInt(accountNumber, 10),
        password: investorPass,
        server,
        firm,
        user_id: user?.id,
      };
      console.log('[ConnectPage] Sending request body:', requestBody);
      const response = await fetch('http://127.0.0.1:8001/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json();
      console.log('[ConnectPage] API response:', data);
      if (data.success) {
        setAccountName(data.account_name ?? '');
        setAccountBalance(data.balance ?? '');
        setAccountId(data.account_id ?? '');

        // Upsert account directly from frontend so it's visible immediately
        if (user?.id) {
          await supabase.from('mt5_accounts').upsert({
            user_id: user.id,
            firm,
            login: parseInt(accountNumber, 10),
            server,
            password_encrypted: investorPass,
            account_name: data.account_name ?? null,
            balance: data.balance ?? null,
            last_sync: new Date().toISOString(),
          }, { onConflict: 'user_id,login' });
        }

        setStep(2);
      } else {
        toast.error(data.error ?? 'Connection failed. Check your credentials.');
      }
    } catch {
      toast.error('Could not reach MT5 sync server. Make sure the sync service is running.');
    } finally {
      setLoading(false);
    }
  };

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStartSync = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setStep(3);
  };

  const firms = ['FTMO', 'FundingPips', 'Alpha Capital', 'FundedNext', 'Other'];

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">{t('connectAccount')}</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${step >= s ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            {s}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle>{t('step')} 1</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('firm')}</Label>
              <Select value={firm} onValueChange={setFirm}>
                <SelectTrigger><SelectValue placeholder={t('firm')} /></SelectTrigger>
                <SelectContent>{firms.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('accountNumber')}</Label>
              <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="12345678" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t('serverName')}</Label>
                <Tooltip>
                  <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent>Find this in MT5 → File → Open Account</TooltipContent>
                </Tooltip>
              </div>
              <Input value={server} onChange={e => setServer(e.target.value)} placeholder="FTMO-Server" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t('investorPassword')}</Label>
                <Tooltip>
                  <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent>Read-only password from your prop firm</TooltipContent>
                </Tooltip>
              </div>
              <Input type="password" value={investorPass} onChange={e => setInvestorPass(e.target.value)} />
            </div>
            <Button onClick={handleTest} className="w-full min-h-[44px] gradient-primary text-primary-foreground" disabled={loading}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('testConnection')}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle>{t('step')} 2</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-profit" />
            <h3 className="text-xl font-bold text-foreground">{t('connectionSuccess')}</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              {accountName && <p>Account: {accountName}</p>}
              {accountBalance !== '' && <p>{t('balance')}: ${Number(accountBalance).toLocaleString()}</p>}
            </div>
            <Button onClick={handleStartSync} className="w-full min-h-[44px] gradient-primary text-primary-foreground" disabled={loading}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('startSync')}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-border bg-card">
          <CardHeader><CardTitle>{t('step')} 3</CardTitle></CardHeader>
          <CardContent className="space-y-5 text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-profit" />
            <h3 className="text-xl font-bold text-foreground">{t('connectionSuccess')}</h3>
            <Progress value={100} className="mx-auto w-48" />

            {/* EA IDs box */}
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-start space-y-3">
              <p className="text-sm font-medium text-foreground">
                {t('language') === 'language'
                  ? 'Copy these IDs into the TradeSmartDz EA settings in MT5'
                  : 'Copy these IDs and paste them into the TradeSmartDz EA settings in MT5'}
              </p>

              {/* User ID */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">User ID</p>
                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <code className="flex-1 truncate text-xs text-foreground">{user?.id ?? '—'}</code>
                  <button
                    onClick={() => copyToClipboard(user?.id ?? '', 'userId')}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    {copiedField === 'userId' ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Account ID */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Account ID</p>
                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <code className="flex-1 truncate text-xs text-foreground">{accountId || '—'}</code>
                  <button
                    onClick={() => copyToClipboard(accountId, 'accountId')}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    disabled={!accountId}
                  >
                    {copiedField === 'accountId' ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Find full setup instructions under <strong>EA Setup</strong> in the sidebar.
              </p>
            </div>

            <Button onClick={() => window.location.href = '/dashboard'} className="w-full min-h-[44px] gradient-primary text-primary-foreground">
              {t('goToDashboard')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Security note */}
      <div className="flex items-start gap-3 rounded-lg border border-border p-4">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">{t('securityNote')}</p>
      </div>
    </div>
  );
};

export default ConnectPage;
