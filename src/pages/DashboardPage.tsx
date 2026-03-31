import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Percent, BarChart3, RefreshCw, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tables } from '@/integrations/supabase/types';

type Trade = Tables<'trades'>;
type Account = Tables<'mt5_accounts'>;

const DashboardPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const [{ data: tradesData }, { data: accountsData }] = await Promise.all([
        supabase.from('trades').select('*').eq('user_id', user.id).order('close_time', { ascending: true }),
        supabase.from('mt5_accounts').select('*').eq('user_id', user.id),
      ]);
      setTrades(tradesData ?? []);
      setAccounts(accountsData ?? []);
      setLoading(false);
    };
    fetchData();
  }, [user]);

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
                  <Button variant="ghost" size="sm"><RefreshCw className="h-4 w-4" /> {t('syncNow')}</Button>
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
