import { useEffect, useState, useRef, KeyboardEvent, DragEvent } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Search, Download, Loader2, Plus, X, Camera, Trash2 } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

const RESULT_OPTIONS = [
  { value: 'Win', label: { ar: 'ربح', fr: 'Gain', en: 'Win' } },
  { value: 'Loss', label: { ar: 'خسارة', fr: 'Perte', en: 'Loss' } },
  { value: 'Breakeven', label: { ar: 'تعادل', fr: 'Neutre', en: 'Breakeven' } },
  { value: 'Partial Win - TP1', label: { ar: 'ربح جزئي - TP1', fr: 'Gain partiel - TP1', en: 'Partial Win - TP1' } },
  { value: 'Partial Win - TP2', label: { ar: 'ربح جزئي - TP2', fr: 'Gain partiel - TP2', en: 'Partial Win - TP2' } },
];

const SESSION_OPTIONS = [
  { value: 'London', label: { ar: 'لندن', fr: 'Londres', en: 'London' } },
  { value: 'New York', label: { ar: 'نيويورك', fr: 'New York', en: 'New York' } },
  { value: 'Asia', label: { ar: 'آسيا', fr: 'Asie', en: 'Asia' } },
];

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      const maxWidth = 800;
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.5);
    };
    img.src = URL.createObjectURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function computeDuration(open: string, close: string): string {
  const diffMs = new Date(close).getTime() - new Date(open).getTime();
  if (isNaN(diffMs) || diffMs < 0) return '';
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

type Trade = Tables<'trades'>;

const DEFAULT_TAGS = ['FVG', 'IFVG', 'Liquidity Sweep', 'Order Block', 'BOS/CHoCH', 'MSS', 'Fair Value Gap + Sweep'];

const TradesPage = () => {
  const { t, language } = useLanguage();
  const lang = language as 'ar' | 'fr' | 'en';
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState('all');
  const [setupFilter, setSetupFilter] = useState('all');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Screenshot upload
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [compressedSize, setCompressedSize] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getStoragePath = (url: string) => {
    const marker = '/trade-screenshots/';
    const idx = url.indexOf(marker);
    return idx === -1 ? '' : url.slice(idx + marker.length);
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedTrade || !user) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error(lang === 'ar' ? 'صيغة غير مدعومة. استخدم JPG, PNG أو WEBP' : lang === 'fr' ? 'Format non supporté. Utilisez JPG, PNG ou WEBP' : 'Unsupported format. Use JPG, PNG or WEBP');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setCompressedSize(null);

    // Compress before uploading
    const compressed = await compressImage(file);
    const sizeLabel = formatBytes(compressed.size);
    setCompressedSize(sizeLabel);

    // Animate progress to 80% while uploading
    const interval = setInterval(() => {
      setUploadProgress(p => p < 80 ? p + 10 : p);
    }, 150);

    // Always store as .jpg since canvas compresses to JPEG
    const path = `${user.id}/${selectedTrade.id}/${Date.now()}.jpg`;

    // Delete old screenshot from storage if exists
    if (screenshotUrl) {
      const oldPath = getStoragePath(screenshotUrl);
      if (oldPath) await supabase.storage.from('trade-screenshots').remove([oldPath]);
    }

    const { error: uploadError } = await supabase.storage
      .from('trade-screenshots')
      .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });

    clearInterval(interval);

    if (uploadError) {
      setUploading(false);
      setUploadProgress(0);
      setCompressedSize(null);
      toast.error('Upload failed: ' + uploadError.message);
      return;
    }

    setUploadProgress(100);

    const { data: { publicUrl } } = supabase.storage
      .from('trade-screenshots')
      .getPublicUrl(path);

    const { error: dbError } = await supabase
      .from('trades')
      .update({ screenshot_url: publicUrl })
      .eq('id', selectedTrade.id);

    setUploading(false);
    setUploadProgress(0);

    if (dbError) {
      toast.error('Failed to save screenshot URL');
      return;
    }

    setScreenshotUrl(publicUrl);
    setTrades(prev => prev.map(tr =>
      tr.id === selectedTrade.id ? { ...tr, screenshot_url: publicUrl } : tr
    ));
    toast.success(
      lang === 'ar' ? `تم رفع الصورة (${sizeLabel})` :
      lang === 'fr' ? `Image uploadée (${sizeLabel})` :
      `Screenshot uploaded (${sizeLabel})`
    );
  };

  const handleDeleteScreenshot = async () => {
    if (!selectedTrade || !screenshotUrl) return;
    const path = getStoragePath(screenshotUrl);
    if (path) await supabase.storage.from('trade-screenshots').remove([path]);
    await supabase.from('trades').update({ screenshot_url: null }).eq('id', selectedTrade.id);
    setScreenshotUrl(null);
    setTrades(prev => prev.map(tr =>
      tr.id === selectedTrade.id ? { ...tr, screenshot_url: null } : tr
    ));
    toast.success(lang === 'ar' ? 'تم حذف الصورة' : lang === 'fr' ? 'Image supprimée' : 'Screenshot removed');
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // Add trade dialog
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    symbol: '',
    direction: '' as 'BUY' | 'SELL' | '',
    result: '',
    profit: '',
    risk: '',
    open_time: '',
    close_time: '',
    session: '',
    setup_tag: '',
    notes: '',
  });

  const rr = (() => {
    const p = parseFloat(form.profit);
    const r = parseFloat(form.risk);
    if (!r || r === 0 || isNaN(p) || isNaN(r)) return '';
    return (p / r).toFixed(2);
  })();

  const resetForm = () => setForm({
    symbol: '', direction: '', result: '', profit: '', risk: '',
    open_time: '', close_time: '', session: '', setup_tag: '', notes: '',
  });

  const handleAddTrade = async () => {
    if (!form.symbol.trim() || !form.direction || !form.result || form.profit === '' || !form.open_time || !form.close_time) {
      toast.error(lang === 'ar' ? 'يرجى ملء الحقول المطلوبة' : lang === 'fr' ? 'Veuillez remplir les champs obligatoires' : 'Please fill all required fields');
      return;
    }
    setSubmitting(true);

    // Build setup_tag: combine result + custom setup tag
    const tagParts = [form.result, form.session, form.setup_tag.trim()].filter(Boolean);
    const setupTagValue = tagParts.join(', ') || null;

    // Append risk/RR info to notes if provided
    const rrStr = rr ? `R:R ${rr}` : '';
    const riskStr = form.risk ? `Risk $${form.risk}` : '';
    const extraInfo = [riskStr, rrStr].filter(Boolean).join(' | ');
    const notesValue = [extraInfo, form.notes.trim()].filter(Boolean).join('\n') || null;

    const duration = computeDuration(form.open_time, form.close_time);

    const insertPayload = {
      user_id: user!.id,
      symbol: form.symbol.trim().toUpperCase(),
      direction: form.direction,
      profit: parseFloat(form.profit),
      open_time: new Date(form.open_time).toISOString(),
      close_time: new Date(form.close_time).toISOString(),
      duration: duration || null,
      setup_tag: setupTagValue,
      notes: notesValue,
      account_id: null,
      volume: 0,
    };
    console.log('[TradesPage] insert payload:', insertPayload);

    const { data: insertData, error } = await supabase.from('trades').insert(insertPayload).select();
    console.log('[TradesPage] insert response — data:', insertData, '| error:', error);

    setSubmitting(false);
    if (error) {
      console.error('[TradesPage] Supabase error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      toast.error(`Failed to save trade: ${error.message}`);
      return;
    }

    toast.success(lang === 'ar' ? 'تم حفظ الصفقة' : lang === 'fr' ? 'Trade enregistré' : 'Trade saved!');
    setAddOpen(false);
    resetForm();

    // Refresh trades list
    const { data } = await supabase.from('trades').select('*').eq('user_id', user!.id).order('close_time', { ascending: false });
    setTrades(data ?? []);
  };

  // Tag management — allTags is the single source of truth, persisted to user_preferences.custom_tags
  const [allTags, setAllTags] = useState<string[]>(DEFAULT_TAGS);
  const [newTagInput, setNewTagInput] = useState('');
  const [addingTag, setAddingTag] = useState(false);

  // Persist the full tag list to Supabase
  const saveTagList = async (tags: string[]) => {
    if (!user) return;
    await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, custom_tags: tags }, { onConflict: 'user_id' });
  };

  // Load trades and tag list from Supabase
  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: tradesData }, { data: prefsData }] = await Promise.all([
        supabase.from('trades').select('*').eq('user_id', user.id).order('close_time', { ascending: false }),
        supabase.from('user_preferences').select('custom_tags').eq('user_id', user.id).maybeSingle(),
      ]);
      setTrades(tradesData ?? []);

      // custom_tags is jsonb — Supabase returns it as a JS array directly
      const stored = prefsData?.custom_tags;
      if (Array.isArray(stored) && stored.length > 0) {
        setAllTags(stored as string[]);
      } else {
        setAllTags(DEFAULT_TAGS);
      }
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  const openTrade = (trade: Trade) => {
    setSelectedTrade(trade);
    const tags = trade.setup_tag
      ? trade.setup_tag.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    setEditTags(tags);
    setEditNotes(trade.notes ?? '');
    setScreenshotUrl(trade.screenshot_url ?? null);
    setUploadProgress(0);
    setIsDragging(false);
    setCompressedSize(null);
  };

  const toggleTag = (tag: string) => {
    setEditTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = async () => {
    const tag = newTagInput.trim();
    if (!tag || allTags.includes(tag)) {
      setNewTagInput('');
      return;
    }
    setAddingTag(true);
    const updated = [...allTags, tag];
    await saveTagList(updated);
    setAllTags(updated);
    setEditTags(prev => [...prev, tag]); // auto-select the new tag
    setNewTagInput('');
    setAddingTag(false);
  };

  const removeTag = async (tag: string) => {
    const updated = allTags.filter(t => t !== tag);
    await saveTagList(updated);
    setAllTags(updated);
    setEditTags(prev => prev.filter(t => t !== tag));
    if (setupFilter === tag) setSetupFilter('all');
  };

  const handleTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomTag();
    }
  };

  const saveTrade = async () => {
    if (!selectedTrade) return;
    setSaving(true);
    const setupTag = editTags.join(', ') || null;
    const { error } = await supabase
      .from('trades')
      .update({ setup_tag: setupTag, notes: editNotes || null })
      .eq('id', selectedTrade.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
    } else {
      setTrades(prev => prev.map(tr => tr.id === selectedTrade.id
        ? { ...tr, setup_tag: setupTag, notes: editNotes || null }
        : tr
      ));
      toast.success('Saved!');
      setSelectedTrade(null);
    }
  };

  const exportCsv = () => {
    // Always quote every field so Excel handles commas, special chars, and UTF-8 correctly
    const q = (val: string | number | null | undefined) => {
      const s = val == null ? '' : String(val);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const fmt = (n: number | null | undefined) =>
      n == null ? '' : Number(n).toFixed(2);

    const rows = [
      ['Date', 'Symbol', 'Direction', 'Entry Price', 'Exit Price', 'P&L ($)', 'Volume (Lots)', 'Duration', 'Setup Tags', 'Notes'],
      ...filtered.map(tr => [
        tr.close_time ? new Date(tr.close_time).toLocaleDateString() : '',
        tr.symbol,
        tr.direction,
        fmt(tr.entry),
        fmt(tr.exit_price),
        fmt(tr.profit),
        fmt(tr.volume),
        tr.duration ?? '',
        tr.setup_tag ?? '',
        tr.notes ?? '',
      ]),
    ];
    // \uFEFF BOM tells Excel this is UTF-8
    const csv = '\uFEFF' + rows.map(r => r.map(q).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter: check if trade's setup_tag contains the filter tag
  const filtered = trades.filter(tr => {
    if (search && !tr.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    if (dirFilter !== 'all' && tr.direction !== dirFilter) return false;
    if (setupFilter !== 'all') {
      const tradeTags = tr.setup_tag?.split(',').map(s => s.trim()) ?? [];
      if (!tradeTags.includes(setupFilter)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{t('myTrades')}</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gradient-primary text-primary-foreground gap-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            {lang === 'ar' ? 'إضافة صفقة' : lang === 'fr' ? 'Ajouter' : 'Add Trade'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="me-2 h-4 w-4" /> {t('export')}
          </Button>
        </div>
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
            {allTags.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
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
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {trade.setup_tag
                            ? trade.setup_tag.split(',').map(s => s.trim()).filter(Boolean).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))
                            : <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
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

      {/* Add Trade Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {lang === 'ar' ? 'إضافة صفقة يدوية' : lang === 'fr' ? 'Ajouter un trade manuel' : 'Add Manual Trade'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Symbol */}
            <div className="space-y-1.5">
              <Label>{t('symbol')} <span className="text-destructive">*</span></Label>
              <Input
                placeholder="NQ, XAUUSD, EURUSD..."
                value={form.symbol}
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))}
              />
            </div>

            {/* Direction */}
            <div className="space-y-1.5">
              <Label>{t('direction')} <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, direction: 'BUY' }))}
                  className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                    form.direction === 'BUY'
                      ? 'border-profit bg-profit/20 text-profit'
                      : 'border-border bg-secondary text-muted-foreground hover:border-profit/50'
                  }`}
                >
                  {t('buy')}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, direction: 'SELL' }))}
                  className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                    form.direction === 'SELL'
                      ? 'border-loss bg-loss/20 text-loss'
                      : 'border-border bg-secondary text-muted-foreground hover:border-loss/50'
                  }`}
                >
                  {t('sell')}
                </button>
              </div>
            </div>

            {/* Result */}
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'النتيجة' : lang === 'fr' ? 'Résultat' : 'Result'} <span className="text-destructive">*</span></Label>
              <Select value={form.result} onValueChange={v => setForm(f => ({ ...f, result: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === 'ar' ? 'اختر النتيجة' : lang === 'fr' ? 'Choisir' : 'Select result'} />
                </SelectTrigger>
                <SelectContent>
                  {RESULT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label[lang]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profit / Risk / RR */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{lang === 'ar' ? 'الربح/الخسارة ($)' : lang === 'fr' ? 'P&L ($)' : 'P&L ($)'} <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.profit}
                  onChange={e => setForm(f => ({ ...f, profit: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === 'ar' ? 'المخاطرة ($)' : lang === 'fr' ? 'Risque ($)' : 'Risk ($)'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.risk}
                  onChange={e => setForm(f => ({ ...f, risk: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>R:R</Label>
                <Input
                  readOnly
                  value={rr}
                  placeholder="—"
                  className="cursor-default bg-secondary text-muted-foreground"
                />
              </div>
            </div>

            {/* Open / Close time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lang === 'ar' ? 'وقت الفتح' : lang === 'fr' ? 'Ouverture' : 'Open time'} <span className="text-destructive">*</span></Label>
                <Input
                  type="datetime-local"
                  value={form.open_time}
                  onChange={e => setForm(f => ({ ...f, open_time: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === 'ar' ? 'وقت الإغلاق' : lang === 'fr' ? 'Clôture' : 'Close time'} <span className="text-destructive">*</span></Label>
                <Input
                  type="datetime-local"
                  value={form.close_time}
                  onChange={e => setForm(f => ({ ...f, close_time: e.target.value }))}
                />
              </div>
            </div>

            {/* Session */}
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'الجلسة' : lang === 'fr' ? 'Session' : 'Session'}</Label>
              <Select value={form.session} onValueChange={v => setForm(f => ({ ...f, session: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === 'ar' ? 'اختر الجلسة' : lang === 'fr' ? 'Choisir' : 'Select session'} />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label[lang]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Setup tag */}
            <div className="space-y-1.5">
              <Label>{t('setup')}</Label>
              <Input
                placeholder={lang === 'ar' ? 'FVG، Order Block، BOS...' : 'FVG, Order Block, BOS...'}
                value={form.setup_tag}
                onChange={e => setForm(f => ({ ...f, setup_tag: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>{t('notes')}</Label>
              <Textarea
                placeholder={t('notes')}
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <Button
              className="w-full min-h-[44px] gradient-primary text-primary-foreground"
              onClick={handleAddTrade}
              disabled={submitting}
            >
              {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {lang === 'ar' ? 'حفظ الصفقة' : lang === 'fr' ? 'Enregistrer' : 'Save Trade'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Panel */}
      <Sheet open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedTrade && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTrade.symbol} — {selectedTrade.direction === 'BUY' ? t('buy') : t('sell')}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                {/* Trade stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-muted-foreground">{t('entry')}</p><p className="font-medium">{selectedTrade.entry}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('exit')}</p><p className="font-medium">{selectedTrade.exit_price}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('pnl')}</p><p className={`font-bold ${(selectedTrade.profit ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>${selectedTrade.profit}</p></div>
                  <div><p className="text-sm text-muted-foreground">{t('duration')}</p><p className="font-medium">{selectedTrade.duration}</p></div>
                </div>

                {/* Multi-select tag picker */}
                <div className="space-y-3">
                  <Label>{t('setup')}</Label>

                  {/* Tag pills */}
                  <div className="flex flex-wrap gap-2">
                    {allTags.map(tag => {
                      const active = editTags.includes(tag);
                      return (
                        <div key={tag} className="group relative flex items-center">
                          <button
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`rounded-full border pe-6 ps-3 py-1 text-xs font-medium transition-colors ${
                              active
                                ? 'border-primary bg-primary/20 text-primary'
                                : 'border-border bg-secondary text-muted-foreground hover:border-primary/50 hover:text-foreground'
                            }`}
                          >
                            {tag}
                          </button>
                          {/* Delete tag from list */}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="absolute end-1 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            title="Remove tag"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected tags summary */}
                  {editTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {editTags.map(tag => (
                        <Badge key={tag} className="gap-1 bg-primary/20 text-primary">
                          {tag}
                          <button onClick={() => toggleTag(tag)} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Add new custom tag */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom tag…"
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2"
                      onClick={addCustomTag}
                      disabled={addingTag || !newTagInput.trim()}
                    >
                      {addingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>{t('notes')}</Label>
                  <Textarea
                    placeholder={t('notes')}
                    rows={4}
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                  />
                </div>

                {/* Screenshot */}
                <div className="space-y-2">
                  <Label>
                    {lang === 'ar' ? 'لقطة الشاشة' : lang === 'fr' ? 'Capture d\'écran' : 'Chart Screenshot'}
                  </Label>

                  {screenshotUrl ? (
                    <div className="relative overflow-hidden rounded-lg border border-border">
                      <img
                        src={screenshotUrl}
                        alt="Trade screenshot"
                        className="w-full object-contain max-h-64"
                      />
                      <button
                        type="button"
                        onClick={handleDeleteScreenshot}
                        className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-destructive hover:text-white"
                        title={lang === 'ar' ? 'حذف الصورة' : lang === 'fr' ? 'Supprimer' : 'Delete screenshot'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {/* Click to replace */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-2 end-2 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
                      >
                        {lang === 'ar' ? 'استبدال' : lang === 'fr' ? 'Remplacer' : 'Replace'}
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                        isDragging
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      } ${uploading ? 'cursor-default opacity-70' : ''}`}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm font-medium text-primary">
                            {compressedSize === null
                              ? (lang === 'ar' ? 'جاري ضغط الصورة...' : lang === 'fr' ? 'Compression...' : 'Compressing...')
                              : (lang === 'ar' ? 'جاري الرفع...' : lang === 'fr' ? 'Envoi en cours...' : 'Uploading...')
                            }
                          </p>
                          {compressedSize !== null && (
                            <p className="text-xs text-muted-foreground">
                              {lang === 'ar' ? `حجم الملف: ${compressedSize}` : lang === 'fr' ? `Taille: ${compressedSize}` : `Compressed to ${compressedSize}`}
                            </p>
                          )}
                          <div className="w-full max-w-[160px] overflow-hidden rounded-full bg-secondary h-1.5">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-150"
                              style={{ width: compressedSize === null ? '15%' : `${uploadProgress}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <Camera className="h-8 w-8" />
                          <p className="text-sm font-medium">
                            {lang === 'ar' ? 'أفلت لقطة الشاشة هنا' : lang === 'fr' ? 'Déposez votre capture ici' : 'Drop your chart screenshot here'}
                          </p>
                          <p className="text-xs">
                            {lang === 'ar' ? 'أو انقر للاختيار — JPG, PNG, WEBP' : lang === 'fr' ? 'ou cliquez — JPG, PNG, WEBP' : 'or click to browse — JPG, PNG, WEBP'}
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = '';
                    }}
                  />
                </div>

                <Button className="w-full min-h-[44px] gradient-primary text-primary-foreground" onClick={saveTrade} disabled={saving}>
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
