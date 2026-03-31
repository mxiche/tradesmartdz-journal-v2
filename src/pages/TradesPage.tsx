import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { setupTags } from '@/lib/mockData';
import { Search, Download, Loader2 } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Trade = Tables<'trades'>;

const TradesPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState('all');
  const [setupFilter, setSetupFilter] = useState('all');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editSetup, setEditSetup] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchTrades = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('close_time', { ascending: false });
      setTrades(data ?? []);
      setLoading(false);
    };
    fetchTrades();
  }, [user]);

  const openTrade = (trade: Trade) => {
    setSelectedTrade(trade);
    setEditSetup(trade.setup_tag ?? '');
    setEditNotes(trade.notes ?? '');
  };

  const saveTrade = async () => {
    if (!selectedTrade) return;
    setSaving(true);
    const { error } = await supabase
      .from('trades')
      .update({ setup_tag: editSetup || null, notes: editNotes || null })
      .eq('id', selectedTrade.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
    } else {
      setTrades(prev => prev.map(tr => tr.id === selectedTrade.id
        ? { ...tr, setup_tag: editSetup || null, notes: editNotes || null }
        : tr
      ));
      toast.success('Saved!');
      setSelectedTrade(null);
    }
  };

  const filtered = trades.filter(tr => {
    if (search && !tr.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    if (dirFilter !== 'all' && tr.direction !== dirFilter) return false;
    if (setupFilter !== 'all' && tr.setup_tag !== setupFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{t('myTrades')}</h1>
        <Button variant="outline" size="sm"><Download className="me-2 h-4 w-4" /> {t('export')}</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
        </div>
        <Select value={dirFilter} onValueChange={setDirFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="BUY">{t('buy')}</SelectItem>
            <SelectItem value="SELL">{t('sell')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={setupFilter} onValueChange={setSetupFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t('setup')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            {setupTags.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-muted-foreground">
                {trades.length === 0
                  ? 'No trades yet. Connect your MT5 account to sync trades.'
                  : 'No trades match your filters.'}
              </p>
            </div>
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
                    <TableHead>{t('date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(trade => (
                    <TableRow key={trade.id} className="cursor-pointer hover:bg-secondary/50" onClick={() => openTrade(trade)}>
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
                      <TableCell className="text-muted-foreground">
                        {trade.close_time ? new Date(trade.close_time).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Panel */}
      <Sheet open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedTrade && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTrade.symbol} — {selectedTrade.direction === 'BUY' ? t('buy') : t('sell')}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">{t('entry')}</p><p className="font-medium">{selectedTrade.entry}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('exit')}</p><p className="font-medium">{selectedTrade.exit_price}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('pnl')}</p><p className={`font-bold ${(selectedTrade.profit ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>${selectedTrade.profit}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('duration')}</p><p className="font-medium">{selectedTrade.duration}</p></div>
                </div>
                <div className="space-y-2">
                  <Label>{t('setup')}</Label>
                  <Select value={editSetup} onValueChange={setEditSetup}>
                    <SelectTrigger><SelectValue placeholder="Select setup" /></SelectTrigger>
                    <SelectContent>
                      {setupTags.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('notes')}</Label>
                  <Textarea placeholder={t('notes')} rows={4} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                </div>
                <Button className="w-full gradient-primary text-primary-foreground" onClick={saveTrade} disabled={saving}>
                  {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t('save')}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TradesPage;
