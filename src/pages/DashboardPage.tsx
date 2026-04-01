import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Percent, BarChart3, RefreshCw, Loader2, Bot, Sparkles, RotateCcw, AlertCircle, Lightbulb, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tables } from '@/integrations/supabase/types';

// --- AI response renderer ---
// Parses the Claude markdown response into styled JSX sections
function renderAiResponse(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  const sectionIcons: Record<string, React.ReactNode> = {
    'Overall Performance': <BarChart3 className="h-4 w-4 text-primary" />,
    'Performance': <BarChart3 className="h-4 w-4 text-primary" />,
    'Strengths': <TrendingUp className="h-4 w-4 text-profit" />,
    'Areas to Improve': <AlertCircle className="h-4 w-4 text-yellow-500" />,
    'Actionable': <Lightbulb className="h-4 w-4 text-amber-400" />,
    'Tips': <Lightbulb className="h-4 w-4 text-amber-400" />,
  };

  const getSectionIcon = (heading: string) => {
    for (const [key, icon] of Object.entries(sectionIcons)) {
      if (heading.toLowerCase().includes(key.toLowerCase())) return icon;
    }
    return <Sparkles className="h-4 w-4 text-primary" />;
  };

  // Bold inline: **text**
  const parseBold = (line: string) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return parts.map((p, i) => i % 2 === 1 ? <strong key={i} className="font-semibold text-foreground">{p}</strong> : p);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { elements.push(<div key={key++} className="h-2" />); continue; }

    // Section heading: **1. Title** or **Title**
    const headingMatch = trimmed.match(/^\*\*(\d+\.\s*)?(.+?)\*\*\s*[-—:]?\s*$/);
    if (headingMatch) {
      const heading = headingMatch[2];
      elements.push(
        <div key={key++} className="mt-4 flex items-center gap-2 first:mt-0">
          {getSectionIcon(heading)}
          <h3 className="text-sm font-bold text-foreground">{heading}</h3>
        </div>
      );
      continue;
    }

    // Numbered point: "1. **Bold** text" or "1. text"
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      elements.push(
        <div key={key++} className="ms-1 flex gap-2 text-sm text-muted-foreground">
          <span className="shrink-0 font-medium text-primary">{numMatch[1]}.</span>
          <span>{parseBold(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet: "- text"
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      elements.push(
        <div key={key++} className="ms-1 flex gap-2 text-sm text-muted-foreground">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
          <span>{parseBold(trimmed.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Plain line
    elements.push(<p key={key++} className="text-sm text-muted-foreground">{parseBold(trimmed)}</p>);
  }

  return elements;
}

type Trade = Tables<'trades'>;
type Account = Tables<'mt5_accounts'>;

const DashboardPage = () => {
  const { t, language } = useLanguage();
  const lang = language as 'ar' | 'fr' | 'en';
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // AI Coach state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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

  const handleSync = async (accountId: string) => {
    if (!user) return;
    setSyncingId(accountId);
    try {
      const response = await fetch('http://127.0.0.1:8001/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, user_id: user.id }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Sync complete — ${data.trades_inserted} new trade${data.trades_inserted !== 1 ? 's' : ''} added`);
        await fetchData();
      } else {
        toast.error(data.error ?? 'Sync failed');
      }
    } catch {
      toast.error('Could not reach MT5 sync server. Make sure the sync service is running.');
    } finally {
      setSyncingId(null);
    }
  };

  // Load cached AI analysis on mount
  useEffect(() => {
    if (!user) return;
    const cached = localStorage.getItem(`tradesmartdz_ai_${user.id}`);
    if (cached) {
      try {
        const { text } = JSON.parse(cached);
        if (text) setAiAnalysis(text);
      } catch { /* ignore corrupted cache */ }
    }
  }, [user]);

  const runAiAnalysis = async () => {
    if (!trades.length) {
      toast.error(lang === 'ar' ? 'لا توجد صفقات للتحليل' : lang === 'fr' ? 'Aucun trade à analyser' : 'No trades to analyze');
      return;
    }
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey && import.meta.env.DEV) {
      toast.error('Add VITE_GEMINI_API_KEY to your .env file');
      return;
    }

    setAiLoading(true);
    setAiAnalysis(null);

    const langLabel = lang === 'ar' ? 'Arabic' : lang === 'fr' ? 'French' : 'English';

    // Send only relevant fields to keep the prompt concise
    const tradeData = trades.slice(-100).map(tr => ({
      symbol: tr.symbol,
      direction: tr.direction,
      profit: tr.profit,
      open_time: tr.open_time,
      close_time: tr.close_time,
      duration: tr.duration,
      setup_tag: tr.setup_tag,
    }));

    const prompt = `You are a professional trading performance coach analyzing a trader's journal data.

Here are the trader's recent trades:
${JSON.stringify(tradeData, null, 2)}

Analyze their trading performance and provide:
1. **Overall Performance Summary** - win rate, best/worst setups, best/worst sessions
2. **Strengths** - what they are doing well (2-3 specific points with data)
3. **Areas to Improve** - patterns showing weakness (2-3 specific points with data)
4. **Actionable Tips** - 3 specific recommendations based on the data

Important rules:
- Never give financial advice or tell them what trades to take
- Only analyze past performance patterns
- Be specific and reference actual numbers from their data
- Be encouraging but honest
- Keep response under 400 words
- Respond in ${langLabel}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${response.status}`);
      }

      const data = await response.json();
      const text: string = data.candidates[0].content.parts[0].text ?? '';
      setAiAnalysis(text);
      localStorage.setItem(`tradesmartdz_ai_${user!.id}`, JSON.stringify({ text, ts: Date.now(), tradeCount: trades.length }));
    } catch (err: any) {
      toast.error('AI analysis failed: ' + (err.message ?? 'Unknown error'));
    } finally {
      setAiLoading(false);
    }
  };

  // Stats
  const closedTrades = trades.filter(tr => tr.profit !== null);
  const totalPnl = closedTrades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const wins = closedTrades.filter(tr => (tr.profit ?? 0) > 0);
  const losses = closedTrades.filter(tr => (tr.profit ?? 0) < 0);
  const winRate = closedTrades.length ? Math.round((wins.length / closedTrades.length) * 100) : 0;
  const grossProfit = wins.reduce((s, tr) => s + (tr.profit ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, tr) => s + (tr.profit ?? 0), 0));
  const profitFactor = grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? Infinity : 0;

  // Max drawdown
  let peak = 0, maxDrawdown = 0, runningPnl = 0;
  for (const tr of closedTrades) {
    runningPnl += tr.profit ?? 0;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak > 0 ? ((peak - runningPnl) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Equity curve
  const startBalance = (accounts[0]?.balance ?? 0) - totalPnl;
  let running = startBalance;
  const equityCurve = closedTrades.map(tr => {
    running += tr.profit ?? 0;
    return {
      date: tr.close_time ? new Date(tr.close_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      balance: +running.toFixed(2),
    };
  });

  // Kill zones
  const sessions = ['London', 'NY', 'Asia', 'NY Lunch'];
  const killZoneStats = sessions.map(ses => {
    const st = closedTrades.filter(tr => (tr as any).session === ses);
    const w = st.filter(tr => (tr.profit ?? 0) > 0);
    return {
      session: ses,
      winRate: st.length ? Math.round((w.length / st.length) * 100) : 0,
      pnl: +st.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2),
      count: st.length,
    };
  }).filter(s => s.count > 0);

  const statCards = [
    { label: t('totalPnl'), value: `$${totalPnl.toFixed(2)}`, icon: TrendingUp, positive: totalPnl >= 0 },
    { label: t('winRate'), value: `${winRate}%`, icon: Percent, positive: true },
    { label: t('profitFactor'), value: isFinite(profitFactor) ? profitFactor.toString() : '∞', icon: BarChart3, positive: true },
    { label: t('drawdown'), value: `${maxDrawdown.toFixed(1)}%`, icon: TrendingDown, positive: false },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <Card key={i} className="border-border bg-card">
            <CardContent className="flex items-center gap-3 p-3 md:p-4">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg md:h-10 md:w-10 ${s.positive ? 'bg-profit/10' : 'bg-loss/10'}`}>
                <s.icon className={`h-4 w-4 md:h-5 md:w-5 ${s.positive ? 'text-profit' : 'text-loss'}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground md:text-sm">{s.label}</p>
                <p className={`text-lg font-bold md:text-2xl ${i === 0 ? (totalPnl >= 0 ? 'text-profit' : 'text-loss') : 'text-foreground'}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Connected Accounts */}
      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-lg">{t('connectedAccounts')}</CardTitle></CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground">{t('noAccounts')}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-profit" />
                    <div>
                      <p className="font-medium text-foreground">{acc.firm}</p>
                      <p className="text-sm text-muted-foreground">****{String(acc.login).slice(-4)}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="font-medium text-foreground">${(acc.balance ?? 0).toLocaleString()}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={syncingId === acc.id}
                    onClick={() => handleSync(acc.id)}
                  >
                    {syncingId === acc.id
                      ? <Loader2 className="me-1 h-4 w-4 animate-spin" />
                      : <RefreshCw className="me-1 h-4 w-4" />}
                    {t('syncNow')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equity Curve */}
      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-lg">{t('equityCurve')}</CardTitle></CardHeader>
        <CardContent>
          {equityCurve.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center">
              <p className="text-muted-foreground">No trade data yet.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 20%)" />
                <XAxis dataKey="date" stroke="hsl(220, 10%, 55%)" fontSize={12} />
                <YAxis stroke="hsl(220, 10%, 55%)" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(225, 18%, 12%)', border: '1px solid hsl(225, 15%, 20%)', borderRadius: '8px', color: 'hsl(220, 10%, 90%)' }} />
                <Line type="monotone" dataKey="balance" stroke="hsl(165, 100%, 42%)" strokeWidth={2} dot={{ fill: 'hsl(165, 100%, 42%)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* AI Coach */}
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-lg">
                {lang === 'ar' ? 'مدرب الذكاء الاصطناعي' : lang === 'fr' ? 'Coach IA' : 'AI Coach'}
              </CardTitle>
              <Badge variant="secondary" className="text-xs">Beta</Badge>
            </div>
            {aiAnalysis && !aiLoading && (
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={runAiAnalysis}>
                <RotateCcw className="h-3.5 w-3.5" />
                {lang === 'ar' ? 'إعادة التحليل' : lang === 'fr' ? 'Relancer' : 'Regenerate'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {aiLoading ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="relative">
                <div className="h-12 w-12 rounded-full bg-primary/10" />
                <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {lang === 'ar' ? 'الذكاء الاصطناعي يحلل صفقاتك...' : lang === 'fr' ? 'L\'IA analyse vos trades...' : 'AI is analyzing your trades...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {lang === 'ar' ? 'قد يستغرق هذا بضع ثوانٍ' : lang === 'fr' ? 'Cela peut prendre quelques secondes' : 'This may take a few seconds'}
              </p>
            </div>
          ) : aiAnalysis ? (
            <div className="space-y-1 rounded-lg border border-primary/10 bg-primary/5 p-4">
              {renderAiResponse(aiAnalysis)}
              <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {lang === 'ar'
                    ? 'هذا تحليل للأداء السابق فقط وليس نصيحة مالية.'
                    : lang === 'fr'
                    ? 'Analyse des performances passées uniquement — pas de conseil financier.'
                    : 'Past performance analysis only — not financial advice.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {lang === 'ar' ? 'احصل على تحليل ذكي لصفقاتك' : lang === 'fr' ? 'Obtenez une analyse IA de vos trades' : 'Get an AI-powered analysis of your trades'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lang === 'ar'
                    ? 'يحلل الذكاء الاصطناعي نقاط قوتك وضعفك ويقدم نصائح قابلة للتطبيق.'
                    : lang === 'fr'
                    ? 'L\'IA identifie vos forces, faiblesses et donne des conseils concrets.'
                    : 'AI identifies your strengths, weaknesses, and gives actionable coaching tips.'}
                </p>
              </div>
              <Button
                className="gradient-primary text-primary-foreground gap-2"
                onClick={runAiAnalysis}
                disabled={trades.length === 0}
              >
                <Bot className="h-4 w-4" />
                {lang === 'ar' ? 'تحليل صفقاتي' : lang === 'fr' ? 'Analyser mes trades' : 'Analyze My Trading'}
              </Button>
              {trades.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {lang === 'ar' ? 'قم بمزامنة صفقاتك أولاً' : lang === 'fr' ? 'Synchronisez vos trades d\'abord' : 'Sync your trades first to enable analysis'}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kill Zones */}
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-lg">{t('killZones')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {killZoneStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No session data yet.</p>
            ) : (
              killZoneStats.map(kz => (
                <div key={kz.session} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm font-medium text-foreground">{t(kz.session as any)}</span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-muted-foreground">{kz.winRate}%</span>
                    <span className={kz.pnl >= 0 ? 'text-profit' : 'text-loss'}>${kz.pnl}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">{t('recentTrades')}</CardTitle></CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <p className="text-muted-foreground">No trades yet. Connect your MT5 account to sync trades.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('symbol')}</TableHead>
                      <TableHead>{t('direction')}</TableHead>
                      <TableHead>{t('entry')}</TableHead>
                      <TableHead>{t('exit')}</TableHead>
                      <TableHead>{t('pnl')}</TableHead>
                      <TableHead>{t('duration')}</TableHead>
                      <TableHead>{t('setup')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...trades].reverse().slice(0, 10).map(trade => (
                      <TableRow key={trade.id} className="cursor-pointer hover:bg-secondary/50">
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge className={trade.direction === 'BUY' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'}>
                            {trade.direction === 'BUY' ? t('buy') : t('sell')}
                          </Badge>
                        </TableCell>
                        <TableCell>{trade.entry}</TableCell>
                        <TableCell>{trade.exit_price}</TableCell>
                        <TableCell className={(trade.profit ?? 0) >= 0 ? 'text-profit font-medium' : 'text-loss font-medium'}>
                          {(trade.profit ?? 0) >= 0 ? '+' : ''}${trade.profit}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{trade.duration}</TableCell>
                        <TableCell><Badge variant="secondary">{trade.setup_tag ?? '—'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
