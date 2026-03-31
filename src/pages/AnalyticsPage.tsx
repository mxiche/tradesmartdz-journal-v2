import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockTrades, setupTags } from '@/lib/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const AnalyticsPage = () => {
  const { t } = useLanguage();
  const [timeRange, setTimeRange] = useState('allTime');

  const ranges = [
    { key: 'thisWeek', label: t('thisWeek') },
    { key: 'thisMonth', label: t('thisMonth') },
    { key: 'last3Months', label: t('last3Months') },
    { key: 'allTime', label: t('allTime') },
  ];

  // By Setup
  const bySetup = setupTags.map(tag => {
    const trades = mockTrades.filter(tr => tr.setup_tag === tag);
    const wins = trades.filter(tr => tr.profit > 0).length;
    return { name: tag, pnl: trades.reduce((s, tr) => s + tr.profit, 0), winRate: trades.length ? Math.round((wins / trades.length) * 100) : 0, count: trades.length };
  }).filter(s => s.count > 0);

  // By Symbol
  const symbols = [...new Set(mockTrades.map(tr => tr.symbol))];
  const bySymbol = symbols.map(sym => {
    const trades = mockTrades.filter(tr => tr.symbol === sym);
    return { name: sym, pnl: trades.reduce((s, tr) => s + tr.profit, 0), count: trades.length };
  });

  // By Session
  const sessions = ['London', 'NY', 'Asia', 'NY Lunch'];
  const bySession = sessions.map(ses => {
    const trades = mockTrades.filter(tr => tr.session === ses);
    return { name: ses, pnl: trades.reduce((s, tr) => s + tr.profit, 0), count: trades.length };
  }).filter(s => s.count > 0);

  // By Day
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byDay = days.map((day, i) => {
    const trades = mockTrades.filter(tr => new Date(tr.close_time).getDay() === (i + 1) % 7);
    return { name: day, pnl: trades.reduce((s, tr) => s + tr.profit, 0) };
  });

  const renderBarChart = (data: { name: string; pnl: number }[], title: string) => (
    <Card className="border-border bg-card">
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 20%)" />
            <XAxis dataKey="name" stroke="hsl(220, 10%, 55%)" fontSize={11} />
            <YAxis stroke="hsl(220, 10%, 55%)" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(225, 18%, 12%)', border: '1px solid hsl(225, 15%, 20%)', borderRadius: '8px', color: 'hsl(220, 10%, 90%)' }} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(142, 71%, 45%)' : 'hsl(0, 84%, 60%)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{t('analytics')}</h1>
        <div className="flex gap-2">
          {ranges.map(r => (
            <Button key={r.key} variant={timeRange === r.key ? 'default' : 'outline'} size="sm"
              className={timeRange === r.key ? 'gradient-primary text-primary-foreground' : ''}
              onClick={() => setTimeRange(r.key)}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {renderBarChart(bySetup, t('bySetup'))}
        {renderBarChart(bySymbol, t('bySymbol'))}
        {renderBarChart(bySession, t('bySession'))}
        {renderBarChart(byDay, t('byDay'))}
      </div>

      {/* Monthly Calendar */}
      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="text-lg">{t('monthlyCalendar')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 31 }, (_, i) => {
              const trade = mockTrades.find(tr => new Date(tr.close_time).getDate() === i + 1);
              const pnl = trade?.profit ?? 0;
              return (
                <div key={i} className={`flex h-10 items-center justify-center rounded-md text-xs font-medium ${pnl > 0 ? 'bg-profit/20 text-profit' : pnl < 0 ? 'bg-loss/20 text-loss' : 'bg-secondary text-muted-foreground'}`}>
                  {i + 1}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
