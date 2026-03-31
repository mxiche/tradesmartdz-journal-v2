import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockTrades, mockStats, mockEquityCurve, mockAccounts, killZoneStats } from '@/lib/mockData';
import { TrendingUp, TrendingDown, Percent, BarChart3, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DashboardPage = () => {
  const { t } = useLanguage();

  const statCards = [
    { label: t('totalPnl'), value: `$${mockStats.totalPnl}`, icon: TrendingUp, positive: mockStats.totalPnl > 0 },
    { label: t('winRate'), value: `${mockStats.winRate}%`, icon: Percent, positive: true },
    { label: t('profitFactor'), value: mockStats.profitFactor.toString(), icon: BarChart3, positive: true },
    { label: t('drawdown'), value: `${mockStats.maxDrawdown}%`, icon: TrendingDown, positive: false },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s, i) => (
          <Card key={i} className="border-border bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.positive ? 'bg-profit/10' : 'bg-loss/10'}`}>
                <s.icon className={`h-5 w-5 ${s.positive ? 'text-profit' : 'text-loss'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${i === 0 ? (mockStats.totalPnl >= 0 ? 'text-profit' : 'text-loss') : 'text-foreground'}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Connected Accounts */}
      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-lg">{t('connectedAccounts')}</CardTitle></CardHeader>
        <CardContent>
          {mockAccounts.length === 0 ? (
            <p className="text-muted-foreground">{t('noAccounts')}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {mockAccounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-profit" />
                    <div>
                      <p className="font-medium text-foreground">{acc.firm}</p>
                      <p className="text-sm text-muted-foreground">****{String(acc.login).slice(-4)}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="font-medium text-foreground">${acc.balance.toLocaleString()}</p>
                    <p className={`text-sm ${acc.todayPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {acc.todayPnl >= 0 ? '+' : ''}${acc.todayPnl}
                    </p>
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
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockEquityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 20%)" />
              <XAxis dataKey="date" stroke="hsl(220, 10%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 55%)" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(225, 18%, 12%)', border: '1px solid hsl(225, 15%, 20%)', borderRadius: '8px', color: 'hsl(220, 10%, 90%)' }} />
              <Line type="monotone" dataKey="balance" stroke="hsl(165, 100%, 42%)" strokeWidth={2} dot={{ fill: 'hsl(165, 100%, 42%)', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kill Zones */}
        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="text-lg">{t('killZones')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {killZoneStats.map(kz => (
              <div key={kz.session} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm font-medium text-foreground">{t(kz.session as any)}</span>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">{kz.winRate}%</span>
                  <span className={kz.pnl >= 0 ? 'text-profit' : 'text-loss'}>${kz.pnl}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">{t('recentTrades')}</CardTitle></CardHeader>
          <CardContent>
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
                  {mockTrades.slice(0, 10).map(trade => (
                    <TableRow key={trade.id} className="cursor-pointer hover:bg-secondary/50">
                      <TableCell className="font-medium">{trade.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={trade.direction === 'BUY' ? 'default' : 'destructive'} className={trade.direction === 'BUY' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'}>
                          {trade.direction === 'BUY' ? t('buy') : t('sell')}
                        </Badge>
                      </TableCell>
                      <TableCell>{trade.entry}</TableCell>
                      <TableCell>{trade.exit_price}</TableCell>
                      <TableCell className={trade.profit >= 0 ? 'text-profit font-medium' : 'text-loss font-medium'}>
                        {trade.profit >= 0 ? '+' : ''}${trade.profit}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{trade.duration}</TableCell>
                      <TableCell><Badge variant="secondary">{trade.setup_tag}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
