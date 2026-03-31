import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { setupTags } from '@/lib/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tables } from '@/integrations/supabase/types';
import { Loader2 } from 'lucide-react';

type Trade = Tables<'trades'>;

const AnalyticsPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('allTime');

  useEffect(() => {
    if (!user) return;
    const fetchTrades = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('close_time', { ascending: true });
      setTrades(data ?? []);
      setLoading(false);
    };
    fetchTrades();
  }, [user]);

  const ranges = [
    { key: 'thisWeek', label: t('thisWeek') },
    { key: 'thisMonth', label: t('thisMonth') },
    { key: 'last3Months', label: t('last3Months') },
    { key: 'allTime', label: t('allTime') },
  ];

  const filteredTrades = trades.filter(tr => {
    if (!tr.close_time || timeRange === 'allTime') return true;
    const now = new Date();
    const d = new Date(tr.close_time);
    if (timeRange === 'thisWeek') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return d >= start;
    }
    if (timeRange === 'thisMonth') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (timeRange === 'last3Months') {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      return d >= start;
    }
    return true;
  });

  // By Setup
  const bySetup = setupTags.map(tag => {
    const ts = filteredTrades.filter(tr => tr.setup_tag === tag);
    const wins = ts.filter(tr => (tr.profit ?? 0) > 0).length;
    return { name: tag, pnl: +ts.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2), winRate: ts.length ? Math.round((wins / ts.length) * 100) : 0, count: ts.length };
  }).filter(s => s.count > 0);

  // By Symbol
  const symbols = [...new Set(filteredTrades.map(tr => tr.symbol))];
  const bySymbol = symbols.map(sym => {
    const ts = filteredTrades.filter(tr => tr.symbol === sym);
    return { name: sym, pnl: +ts.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2), count: ts.length };
  });

  // By Session
  const sessions = ['London', 'NY', 'Asia', 'NY Lunch'];
  const bySession = sessions.map(ses => {
    const ts = filteredTrades.filter(tr => (tr as any).session === ses);
    return { name: ses, pnl: +ts.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2), count: ts.length };
  }).filter(s => s.count > 0);

  // By Day
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byDay = days.map((day, i) => {
    const ts = filteredTrades.filter(tr => tr.close_time && new Date(tr.close_time).getDay() === (i + 1) % 7);
    return { name: day, pnl: +ts.reduce((s, tr) => s + (tr.profit ?? 0), 0).toFixed(2) };
  });

  // Monthly calendar — current month
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const calendarData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dayTrades = filteredTrades.filter(tr => {
      if (!tr.close_time) return false;
      const d = new Date(tr.close_time);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === day;
    });
    const pnl = dayTrades.reduce((s, tr) => s + (tr.profit ?? 0), 0);
    return { day, pnl, hasTrades: dayTrades.length > 0 };
  });

  const renderBarChart = (data: { name: string; pnl: number }[], title: string) => (
    <Card className="border-border bg-card">
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No data yet.</p>
          </div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            {calendarData.map(({ day, pnl, hasTrades }) => (
              <div key={day} className={`flex h-10 items-center justify-center rounded-md text-xs font-medium ${hasTrades ? (pnl > 0 ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss') : 'bg-secondary text-muted-foreground'}`}>
                {day}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
