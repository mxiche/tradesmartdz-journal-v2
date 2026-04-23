import { useEffect, useState, useRef, useCallback, useMemo, KeyboardEvent, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Search, Download, Loader2, Plus, X, Camera, Trash2, Pencil, CheckSquare, Upload, Star, Share2, Check, CheckCircle, Lock, BookOpen } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { t } from '@/lib/i18n';

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

const RESULT_VALUES = ['Win', 'Loss', 'Breakeven', 'Partial Win - TP1', 'Partial Win - TP2'];
const SESSION_VALUES = ['London', 'New York', 'Asia', 'NY Lunch'];

function parseSetupTag(setupTag: string | null) {
  if (!setupTag) return { result: null, session: null, setup: null };
  const parts = setupTag.split(',').map(s => s.trim()).filter(Boolean);
  let result: string | null = null;
  let session: string | null = null;
  const setup: string[] = [];
  for (const p of parts) {
    if (RESULT_VALUES.includes(p)) result = p;
    else if (SESSION_VALUES.includes(p)) session = p;
    else setup.push(p);
  }
  return { result, session, setup: setup.join(', ') || null };
}

function extractRR(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/R:R ([\d.]+)/);
  return m ? m[1] : null;
}

function notesPreview(notes: string | null): string | null {
  if (!notes) return null;
  const lines = notes.split('\n');
  const body = lines[0].includes('Risk $') || lines[0].includes('R:R')
    ? lines.slice(1).join(' ').trim()
    : lines.join(' ').trim();
  if (!body) return null;
  return body.length > 30 ? body.slice(0, 30) + '…' : body;
}

function resultBadgeClass(result: string): string {
  switch (result) {
    case 'Win': return 'bg-profit/20 text-profit border-profit/30';
    case 'Loss': return 'bg-loss/20 text-loss border-loss/30';
    case 'Breakeven': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Partial Win - TP1': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Partial Win - TP2': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default: return 'bg-secondary text-muted-foreground';
  }
}

function netPnlBadgeClass(netPnl: number): string {
  if (netPnl > 0) return 'bg-profit/20 text-profit border-profit/30';
  if (netPnl < 0) return 'bg-loss/20 text-loss border-loss/30';
  return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
}

function resultLabel(result: string, lang: 'ar' | 'fr' | 'en'): string {
  const map: Record<string, Record<string, string>> = {
    Win:                  { ar: 'ربح',         fr: 'Gain',    en: 'Win' },
    Loss:                 { ar: 'خسارة',        fr: 'Perte',   en: 'Loss' },
    Breakeven:            { ar: 'تعادل',        fr: 'Neutre',  en: 'BE' },
    'Partial Win - TP1':  { ar: 'TP1',          fr: 'TP1',     en: 'TP1' },
    'Partial Win - TP2':  { ar: 'TP2',          fr: 'TP2',     en: 'TP2' },
  };
  return map[result]?.[lang] ?? result;
}

function sessionBadgeClass(session: string): string {
  switch (session) {
    case 'London':   return 'bg-blue-500/15 text-blue-400';
    case 'New York': return 'bg-orange-500/15 text-orange-400';
    case 'Asia':     return 'bg-purple-500/15 text-purple-400';
    case 'NY Lunch': return 'bg-muted text-muted-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
}

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

function detectSession(openTimeISO: string): string {
  const date = new Date(openTimeISO);
  const utcHour = date.getUTCHours();
  if (utcHour >= 7 && utcHour < 12) return 'London';
  if (utcHour >= 12 && utcHour < 17) return 'New York';
  if (utcHour >= 17 && utcHour < 21) return 'NY Lunch';
  return 'Asia';
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

async function sendTelegramNotification(chatId: string, text: string) {
  const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch { /* silent — notifications are non-critical */ }
}

type Trade = Tables<'trades'>;
type Account = Tables<'mt5_accounts'>;

const DEFAULT_TAGS = ['FVG', 'IFVG', 'Liquidity Sweep', 'Order Block', 'BOS/CHoCH', 'MSS', 'Fair Value Gap + Sweep'];

export const EMOTIONS = [
  { key: 'disciplined', emoji: '🎯', color: '#0d9488' },
  { key: 'confident',   emoji: '💪', color: '#3b82f6' },
  { key: 'neutral',     emoji: '😐', color: '#94a3b8' },
  { key: 'fearful',     emoji: '😰', color: '#f59e0b' },
  { key: 'fomo',        emoji: '⚡', color: '#f59e0b' },
  { key: 'bored',       emoji: '😴', color: '#6b7280' },
  { key: 'revenge',     emoji: '🔥', color: '#ef4444' },
  { key: 'frustrated',  emoji: '😤', color: '#ef4444' },
] as const;

export type EmotionKey = typeof EMOTIONS[number]['key'];

// ── MT5 HTML parser ─────────────────────────────────────────────────────────

interface Mt5ParsedTrade {
  ticket: number | null;
  symbol: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  entry: number;
  exit_price: number;
  open_time: string;
  close_time: string;
  profit: number;
  commission: number;
  result: 'Win' | 'Loss' | 'Breakeven';
}

function parseMt5CellDate(s: string): string | null {
  const t = s.trim();
  // "2026.03.31 21:55:16"
  const m = t.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}`;
  // "2026-03-31 21:55:16"
  const m2 = t.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)$/);
  if (m2) return `${m2[1]}T${m2[2]}`;
  return null;
}

// Header row keywords (any language) — skip these rows
const HEADER_WORDS = ['time', 'heure', 'hora', 'время', 'open', 'ouverture', 'ticket', 'position', 'deal'];
// Trade type keywords
const BUY_WORDS  = ['buy', 'achat', 'شراء', 'compra'];
const SELL_WORDS = ['sell', 'vente', 'بيع', 'venta'];
const SKIP_WORDS = ['balance', 'solde', 'رصيد', 'deposit', 'dépôt', 'withdrawal', 'retrait', 'credit', 'correction'];

// MT5 "Trades" tab — 14 column layout (verified from real export):
//  0: Open Time      1: Ticket/Position  2: Symbol   3: Type (buy/sell/…)
//  4: empty          5: Volume           6: Entry Price  7: S/L
//  8: empty          9: Close Time       10: Close Price
//  11: Commission    12: Swap            13: Profit
function parseMt5Html(html: string): Mt5ParsedTrade[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table');
  const trades: Mt5ParsedTrade[] = [];

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'));

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td')).map(td => (td.textContent ?? '').trim());

      // ── 14-column format (MT5 Trades tab) ─────────────────────────
      if (cells.length === 14) {
        const col0 = cells[0].toLowerCase();

        // Skip header row (col 0 contains "time", "heure", etc.)
        if (HEADER_WORDS.some(w => col0.includes(w))) continue;

        // Col 3 = Type
        const typeCell = cells[3].toLowerCase().trim();
        if (SKIP_WORDS.some(w => typeCell.includes(w))) continue;

        let direction: 'BUY' | 'SELL' | null = null;
        if (BUY_WORDS.some(w => typeCell.includes(w)))        direction = 'BUY';
        else if (SELL_WORDS.some(w => typeCell.includes(w))) direction = 'SELL';
        if (!direction) continue;

        // Col 0 = Open Time
        const open_time = parseMt5CellDate(cells[0]);
        if (!open_time) continue;

        // Col 2 = Symbol (must be non-empty and not a pure number)
        const symbol = cells[2].trim();
        if (!symbol || symbol.length < 2 || /^\d+$/.test(symbol)) continue;

        // Col 1 = Ticket — must look like a number
        if (cells[1] && !/^\d+$/.test(cells[1].trim()) && cells[1].trim() !== '') {
          // might be a sub-header — skip
          if (isNaN(parseFloat(cells[1]))) continue;
        }

        const ticket      = parseInt(cells[1], 10) || null;
        const volume      = parseFloat(cells[5].replace(',', '.'))                         || 0;
        const entry       = parseFloat(cells[6].replace(',', '.'))                         || 0;
        const close_time  = parseMt5CellDate(cells[9])                                     ?? open_time;
        const exit_price  = parseFloat(cells[10].replace(',', '.'))                        || 0;
        const commission  = parseFloat(cells[11].replace(/\s/g, '').replace(',', '.'))     || 0;
        const profit      = parseFloat(cells[13].replace(/\s/g, '').replace(',', '.'))     || 0;
        const result: Mt5ParsedTrade['result'] = profit > 0 ? 'Win' : profit < 0 ? 'Loss' : 'Breakeven';

        trades.push({ ticket, symbol, direction, volume, entry, exit_price, open_time, close_time, profit, commission, result });
        continue;
      }

      // ── Generic fallback: ≥12 columns, col 1 = Type ───────────────
      if (cells.length >= 12) {
        const typeCell = cells[1].toLowerCase().trim();
        if (SKIP_WORDS.some(w => typeCell.includes(w))) continue;

        let direction: 'BUY' | 'SELL' | null = null;
        if (BUY_WORDS.some(w => typeCell.includes(w)))        direction = 'BUY';
        else if (SELL_WORDS.some(w => typeCell.includes(w))) direction = 'SELL';
        if (!direction) continue;

        const open_time = parseMt5CellDate(cells[0]);
        if (!open_time) continue;

        const symbol = cells[3].trim();
        if (!symbol || symbol.length < 2) continue;

        const volume     = parseFloat(cells[2].replace(',', '.'))                      || 0;
        const entry      = parseFloat(cells[4].replace(',', '.'))                      || 0;
        const close_time = parseMt5CellDate(cells[7])                                  ?? open_time;
        const exit_price = parseFloat(cells[8].replace(',', '.'))                      || 0;
        const profit     = parseFloat(cells[11].replace(/\s/g, '').replace(',', '.')) || 0;
        const result: Mt5ParsedTrade['result'] = profit > 0 ? 'Win' : profit < 0 ? 'Loss' : 'Breakeven';

        trades.push({ ticket: null, symbol, direction, volume, entry, exit_price, open_time, close_time, profit, commission: 0, result });
      }
    }
  }

  // Debug: if nothing parsed, log rows so the user can file a bug report
  if (trades.length === 0) {
    console.warn('[MT5 parser] 0 trades found. Table row dump:');
    for (const tbl of tables) {
      Array.from(tbl.querySelectorAll('tr')).forEach((row, ri) => {
        const cells = Array.from(row.querySelectorAll('td')).map(td => (td.textContent ?? '').trim());
        if (cells.length > 0) console.log(`  row[${ri}] (${cells.length} cols):`, cells);
      });
    }
  }

  return trades;
}

// ── Mt5ImportModal ───────────────────────────────────────────────────────────

function Mt5ImportModal({
  open,
  onClose,
  userId,
  accounts: initialAccounts,
  onImported,
  isPro,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  accounts: Account[];
  onImported: () => void;
  isPro: boolean;
}) {
  const { t, language: lang } = useLanguage();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedTrades, setParsedTrades] = useState<Mt5ParsedTrade[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [htmlDebug, setHtmlDebug] = useState<string | null>(null);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccFirm, setNewAccFirm] = useState('');
  const [newAccLogin, setNewAccLogin] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [creatingAcc, setCreatingAcc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-import review state
  interface ReviewRow {
    trade: Mt5ParsedTrade;
    result: string;             // editable (defaults from profit sign)
    session: string;            // user picks manually (empty by default)
    risk: number;               // user-entered risk $ amount
    rr_ratio: number;           // auto-calculated from risk (read-only display)
    setup_tag: string;
    notes: string;
    rating: number;             // 0–5 stars
    screenshot_file: File | null;
    screenshot_preview: string | null;  // local object URL for thumbnail
  }
  const [showReview, setShowReview] = useState(false);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [newTradesList, setNewTradesList] = useState<Mt5ParsedTrade[]>([]);
  const [userTags, setUserTags] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const reviewFileRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Post-import summary state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryRows, setSummaryRows] = useState<ReviewRow[]>([]);

  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  );

  const { sheetRef: importSheetRef, onTouchStart: importTouchStart, onTouchMove: importTouchMove, onTouchEnd: importTouchEnd } = useSwipeToDismiss(onClose);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setStep(1); setParsedTrades([]); setDuplicateCount(0);
      setSelectedAccountId(''); setImportProgress(0); setImportTotal(0);
      setImportedCount(0); setSkippedCount(0); setFileError(null); setHtmlDebug(null);
      setShowNewAccount(false); setNewAccFirm(''); setNewAccLogin(''); setNewAccName('');
      setShowReview(false); setReviewRows([]); setNewTradesList([]); setImporting(false);
      reviewFileRefs.current = [];
      setShowSummary(false); setSummaryRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  // Sync accounts prop
  useEffect(() => {
    setAccounts(initialAccounts);
    if (initialAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(initialAccounts[0].id);
    }
  }, [initialAccounts]);

  const handleFile = async (file: File) => {
    setFileError(null);
    setHtmlDebug(null);
    if (!file.name.match(/\.(html?|htm)$/i)) {
      setFileError(t('importInvalidFile'));
      return;
    }

    // Read as ArrayBuffer so we can detect UTF-16 BOM (MT5 exports UTF-16LE on Windows)
    let html: string;
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if ((bytes[0] === 0xFF && bytes[1] === 0xFE) || (bytes[0] === 0xFE && bytes[1] === 0xFF)) {
        // UTF-16 (little-endian FF FE  or  big-endian FE FF)
        const enc = bytes[0] === 0xFF ? 'utf-16le' : 'utf-16be';
        html = new TextDecoder(enc).decode(buffer);
      } else {
        // UTF-8 (or ASCII — TextDecoder handles both)
        html = new TextDecoder('utf-8').decode(buffer);
      }
    } catch {
      setFileError(t('importInvalidFile'));
      return;
    }
    const trades = parseMt5Html(html);
    if (trades.length === 0) {
      setFileError(t('importNoTrades'));
      setHtmlDebug(html.slice(0, 500));
      return;
    }

    // Duplicate check preview (by ticket)
    const { data: existingData } = await supabase
      .from('trades').select('ticket').eq('user_id', userId);
    const existingTickets = new Set((existingData ?? []).map(tr => String(tr.ticket)));
    const dupes = trades.filter(tr => tr.ticket !== null && existingTickets.has(String(tr.ticket))).length;

    setParsedTrades(trades);
    setDuplicateCount(dupes);
    if (accounts.length > 0 && !selectedAccountId) setSelectedAccountId(accounts[0].id);
    setStep(2);
  };

  const handleCreateAccount = async () => {
    if (!newAccFirm.trim()) return;
    setCreatingAcc(true);
    const payload: Record<string, unknown> = {
      user_id: userId,
      firm: newAccFirm.trim(),
      account_name: newAccName.trim() || null,
    };
    if (newAccLogin.trim()) payload.login = parseInt(newAccLogin);
    const { data, error } = await supabase.from('mt5_accounts').insert(payload).select().single();
    setCreatingAcc(false);
    if (error || !data) { toast.error(lang === 'ar' ? 'خطأ في إنشاء الحساب' : lang === 'fr' ? 'Erreur création compte' : 'Error creating account'); return; }
    const newAcc = data as Account;
    setAccounts(prev => [...prev, newAcc]);
    setSelectedAccountId(newAcc.id);
    setShowNewAccount(false);
    setNewAccFirm(''); setNewAccLogin(''); setNewAccName('');
  };

  // Opens the review modal instead of importing directly
  const handleReview = async () => {
    if (!selectedAccountId) return;

    const { data: existingData } = await supabase
      .from('trades').select('ticket').eq('user_id', userId);
    const existingTickets = new Set((existingData ?? []).map(tr => String(tr.ticket)));
    const newTrades = parsedTrades.filter(tr => tr.ticket === null || !existingTickets.has(String(tr.ticket)));
    const dupeCount = parsedTrades.length - newTrades.length;

    if (newTrades.length === 0) {
      toast.info(t('no_new_trades'));
      return;
    }

    // Fetch user custom tags for setup dropdown
    const { data: prefs } = await supabase
      .from('user_preferences').select('custom_tags').eq('user_id', userId).maybeSingle();
    setUserTags(Array.isArray((prefs as any)?.custom_tags) ? (prefs as any).custom_tags : DEFAULT_TAGS);

    setNewTradesList(newTrades);
    setDuplicateCount(dupeCount);
    setReviewRows(newTrades.map(tr => ({
      trade: tr,
      result: tr.result,        // default from profit sign, user can override
      session: '',              // user picks manually
      risk: 0,
      rr_ratio: 0,
      setup_tag: '',
      notes: '',
      rating: 0,
      screenshot_file: null,
      screenshot_preview: null,
    })));
    reviewFileRefs.current = new Array(newTrades.length).fill(null);
    setShowReview(true);
  };

  // Called from pre-import review modal
  const handleImportAll = async () => {
    setImporting(true);
    const BATCH = 50;
    // Track which reviewRow index maps to which inserted trade ID for screenshot upload
    const insertedIdByRowIndex: Map<number, string> = new Map();

    for (let i = 0; i < reviewRows.length; i += BATCH) {
      const slice = reviewRows.slice(i, i + BATCH);
      const batch = slice.map(row => {
        const tr = row.trade;
        const tagParts = [row.result, row.session, row.setup_tag].filter(Boolean);
        const notesVal = [
          row.risk > 0 ? `Risk $${row.risk}` : '',
          row.rr_ratio > 0 ? `R:R ${row.rr_ratio}` : '',
          row.notes.trim(),
        ].filter(Boolean).join('\n') || null;
        return {
          user_id: userId,
          symbol: tr.symbol,
          direction: tr.direction,
          volume: tr.volume || null,
          entry: tr.entry || null,
          exit_price: tr.exit_price || null,
          open_time: tr.open_time,
          close_time: tr.close_time,
          profit: tr.profit,
          commission: tr.commission || null,
          ticket: tr.ticket,
          account_id: selectedAccountId,
          duration: computeDuration(tr.open_time, tr.close_time) || null,
          session: row.session || null,
          setup_tag: tagParts.join(', ') || null,
          notes: notesVal,
          rating: row.rating || null,
        };
      });

      const { data: inserted, error } = await supabase
        .from('trades').insert(batch).select('id');
      if (!error && inserted) {
        inserted.forEach((rec, j) => {
          insertedIdByRowIndex.set(i + j, rec.id);
        });
      }
    }

    // Upload screenshots for rows that have a file attached
    for (let i = 0; i < reviewRows.length; i++) {
      const row = reviewRows[i];
      const tradeId = insertedIdByRowIndex.get(i);
      if (row.screenshot_file && tradeId) {
        try {
          const compressed = await compressImage(row.screenshot_file);
          const path = `${userId}/${tradeId}/${Date.now()}.jpg`;
          const { error: upErr } = await supabase.storage
            .from('trade-screenshots')
            .upload(path, compressed, { contentType: 'image/jpeg' });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage
              .from('trade-screenshots').getPublicUrl(path);
            await supabase.from('trades').update({ screenshot_url: publicUrl }).eq('id', tradeId);
          }
        } catch { /* screenshot upload is non-critical */ }
      }
    }

    setImporting(false);
    setSummaryRows([...reviewRows]);   // snapshot of what the user set in step 2
    setShowReview(false);
    setShowSummary(true);
    setStep(3);
    onImported();
  };


  const nonDupe = parsedTrades.length - duplicateCount;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[92vh] flex flex-col p-0 sm:overflow-hidden sm:max-w-lg">
        <div ref={importSheetRef} className="flex flex-col flex-1 min-h-0">
        {/* Mobile drag handle — swipe to dismiss */}
        <div
          className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
          onTouchStart={importTouchStart}
          onTouchMove={importTouchMove}
          onTouchEnd={importTouchEnd}
        >
          <div className="w-12 h-1.5 bg-muted-foreground/40 rounded-full" />
        </div>
        <div className="px-6 pb-2 pt-2 flex-shrink-0">
          <DialogTitle className="text-lg">{t('importMt5Title')}</DialogTitle>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6">

        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-4">
          {([1, 2, 3] as const).map((s, idx) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>{idx + 1}</div>
              {idx < 2 && <div className={`h-0.5 flex-1 transition-colors ${step > s ? 'bg-primary' : 'bg-secondary'}`} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Mobile warning */}
            {isMobile && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">
                {lang === 'ar' ? (
                  <div className="space-y-1">
                    <p className="font-semibold">⚠️ تصدير MT5 يعمل فقط على الكمبيوتر</p>
                    <p className="text-amber-300/80">👉 استخدم MT5 على الكمبيوتر:</p>
                    <ol className="list-decimal mr-4 space-y-0.5 text-amber-300/70 text-xs">
                      <li>اذهب إلى سجل المعاملات</li>
                      <li>انقر بزر الأيمن ← حفظ كتقرير</li>
                      <li>ارفع الملف هنا</li>
                    </ol>
                    <p className="text-xs text-amber-300/50 mt-1">يمكنك رفع الملف من هاتفك إذا نقلته من الكمبيوتر</p>
                  </div>
                ) : lang === 'fr' ? (
                  <div className="space-y-1">
                    <p className="font-semibold">⚠️ L'export MT5 fonctionne uniquement sur PC</p>
                    <p className="text-amber-300/80">👉 Utilisez MT5 sur ordinateur :</p>
                    <ol className="list-decimal ml-4 space-y-0.5 text-amber-300/70 text-xs">
                      <li>Allez dans Historique</li>
                      <li>Clic droit → Enregistrer en rapport</li>
                      <li>Uploadez le fichier ici</li>
                    </ol>
                    <p className="text-xs text-amber-300/50 mt-1">Vous pouvez quand même uploader si vous avez transféré le fichier</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-semibold">⚠️ MT5 export only works on desktop</p>
                    <p className="text-amber-300/80">👉 Use MT5 on desktop:</p>
                    <ol className="list-decimal ml-4 space-y-0.5 text-amber-300/70 text-xs">
                      <li>Go to History</li>
                      <li>Right-click → Save as Report</li>
                      <li>Upload the file here</li>
                    </ol>
                    <p className="text-xs text-amber-300/50 mt-1">You can still upload if you transferred the file to your phone</p>
                  </div>
                )}
              </div>
            )}

            <div
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-secondary/30'
              }`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">{t('importDropTitle')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('importOrBrowse')}</p>
                <p className="text-xs text-muted-foreground mt-2">{t('importFileHint')}</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".html,.htm" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            </div>

            {fileError && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <X className="h-4 w-4 shrink-0" />{fileError}
                </div>
                {htmlDebug && (
                  <details className="rounded-lg border border-border bg-secondary/30 text-xs">
                    <summary className="cursor-pointer px-3 py-2 text-muted-foreground hover:text-foreground">
                      {lang === 'ar' ? 'عرض تفاصيل الملف (للإبلاغ عن المشكلة)' : lang === 'fr' ? 'Voir les données du fichier (pour signaler)' : 'Show file debug info (for bug report)'}
                    </summary>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all px-3 pb-3 text-muted-foreground/70 leading-relaxed">
                      {htmlDebug}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="rounded-lg bg-secondary/50 p-4 text-sm">
              <p className="font-medium text-foreground mb-2">
                {lang === 'ar' ? 'كيفية تصدير تقرير MT5' : lang === 'fr' ? 'Comment exporter depuis MT5' : 'How to export from MT5'}
              </p>
              <ol className={`space-y-1 text-muted-foreground list-decimal ${lang === 'ar' ? 'mr-4' : 'ml-4'}`}>
                <li>{lang === 'ar' ? 'افتح MetaTrader 5' : lang === 'fr' ? 'Ouvrez MetaTrader 5' : 'Open MetaTrader 5'}</li>
                <li>{lang === 'ar' ? 'انقر على "سجل الحساب" (Account History)' : lang === 'fr' ? 'Cliquez sur "Historique du compte"' : 'Click "Account History" tab'}</li>
                <li>{lang === 'ar' ? 'انقر بزر الفأرة الأيمن ← حفظ كتقرير (HTML)' : lang === 'fr' ? 'Clic droit → Enregistrer comme rapport (HTML)' : 'Right-click → Save as Report (HTML)'}</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3">
              <span className="font-semibold text-foreground">
                {parsedTrades.length} {lang === 'ar' ? 'صفقة وجدت' : lang === 'fr' ? 'trades trouvés' : 'trades found'}
              </span>
              {duplicateCount > 0 && (
                <span className="text-sm text-yellow-400">
                  {duplicateCount} {t('importDuplicatesSkipped')}
                </span>
              )}
            </div>

            {/* Account selector */}
            <div className="space-y-2">
              <Label>{t('importSelectAccount')}</Label>
              {accounts.length > 0 ? (
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name || `${acc.firm}${acc.login ? ` · ${acc.login}` : ''}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {lang === 'ar' ? 'لا توجد حسابات — أضف حساباً أدناه' : lang === 'fr' ? 'Aucun compte — ajoutez-en un ci-dessous' : 'No accounts — add one below'}
                </p>
              )}

              <button
                type="button"
                onClick={() => setShowNewAccount(v => !v)}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />{t('importAddAccount')}
              </button>

              {showNewAccount && (
                <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
                  <Input placeholder={lang === 'ar' ? 'الشركة *' : lang === 'fr' ? 'Firme *' : 'Firm *'} value={newAccFirm} onChange={e => setNewAccFirm(e.target.value)} />
                  <Input placeholder={lang === 'ar' ? 'رقم الحساب (اختياري)' : lang === 'fr' ? 'N° compte (optionnel)' : 'Account number (optional)'} value={newAccLogin} onChange={e => setNewAccLogin(e.target.value)} />
                  <Input placeholder={lang === 'ar' ? 'اسم الحساب (اختياري)' : lang === 'fr' ? 'Nom du compte (optionnel)' : 'Account name (optional)'} value={newAccName} onChange={e => setNewAccName(e.target.value)} />
                  <Button size="sm" className="gradient-primary w-full" onClick={handleCreateAccount} disabled={creatingAcc || !newAccFirm.trim()}>
                    {creatingAcc ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
                    {lang === 'ar' ? 'إنشاء الحساب' : lang === 'fr' ? 'Créer le compte' : 'Create Account'}
                  </Button>
                </div>
              )}
            </div>

            {/* Preview table — first 5 */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-3 py-2 text-start font-medium text-muted-foreground">{lang === 'ar' ? 'الرمز' : 'Symbol'}</th>
                    <th className="px-3 py-2 text-start font-medium text-muted-foreground">{lang === 'ar' ? 'الاتجاه' : lang === 'fr' ? 'Dir.' : 'Dir.'}</th>
                    <th className="px-3 py-2 text-start font-medium text-muted-foreground">{lang === 'ar' ? 'الربح' : 'P&L'}</th>
                    <th className="px-3 py-2 text-start font-medium text-muted-foreground">{lang === 'ar' ? 'التاريخ' : lang === 'fr' ? 'Date' : 'Date'}</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTrades.slice(0, 5).map((tr, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-semibold text-foreground">{tr.symbol}</td>
                      <td className={`px-3 py-2 font-medium ${tr.direction === 'BUY' ? 'text-profit' : 'text-loss'}`}>{tr.direction}</td>
                      <td className={`px-3 py-2 tabular-nums ${tr.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {tr.profit >= 0 ? '+' : ''}${tr.profit.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{tr.close_time.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedTrades.length > 5 && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  {lang === 'ar' ? `و ${parsedTrades.length - 5} صفقة أخرى...` : lang === 'fr' ? `et ${parsedTrades.length - 5} de plus...` : `and ${parsedTrades.length - 5} more...`}
                </p>
              )}
            </div>

            <Button
              className="w-full min-h-[44px] gradient-primary text-primary-foreground"
              onClick={handleReview}
              disabled={!selectedAccountId || nonDupe === 0}
            >
              {t('importStartImport')} ({nonDupe} {lang === 'ar' ? 'صفقة' : lang === 'fr' ? 'trades' : 'trades'})
            </Button>
          </div>
        )}

        </div>{/* end flex-1 overflow-y-auto */}
        </div>{/* end importSheetRef */}
      </DialogContent>

      {/* ── Review Modal ── */}
      <Dialog open={showReview} onOpenChange={v => { if (!v && !importing) setShowReview(false); }}>
        <DialogContent className="sm:max-w-[95vw] sm:w-[95vw] sm:h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden">

          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Fixed header */}
          <div className="flex-shrink-0 px-6 sm:px-8 py-4 sm:py-5 border-b border-border">
            <DialogTitle className="text-xl font-bold">{t('review_modal_title')}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t('review_modal_subtitle')
                .replace('{new}', String(newTradesList.length))
                .replace('{dupes}', String(duplicateCount))}
            </p>
          </div>

          {/* Scrollable table area */}
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-card">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('col_symbol')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('col_direction')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('col_result')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('col_pnl')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('risk')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('col_rr')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('col_session')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('col_setup')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('col_rating')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('col_screenshot')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{t('col_notes')}</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((row, idx) => {
                  const tr = row.trade;
                  const resultColorClass =
                    row.result === 'Win'               ? 'text-profit' :
                    row.result === 'Loss'              ? 'text-loss' :
                    row.result === 'Breakeven'         ? 'text-yellow-400' :
                    row.result === 'Partial Win - TP1' ? 'text-yellow-500' :
                    row.result === 'Partial Win - TP2' ? 'text-blue-400' : '';
                  return (
                    <tr key={idx} className={`border-b border-border/30 hover:bg-secondary/40 transition-colors ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}>
                      {/* Symbol */}
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{tr.symbol}</td>
                      {/* Direction badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${
                          tr.direction === 'BUY'
                            ? 'bg-profit/20 text-profit border-profit/30'
                            : 'bg-loss/20 text-loss border-loss/30'
                        }`}>
                          {tr.direction === 'BUY' ? t('direction_long') : t('direction_short')}
                        </span>
                      </td>
                      {/* Result — editable Select */}
                      <td className="px-4 py-3">
                        <Select
                          value={row.result}
                          onValueChange={val => setReviewRows(prev => prev.map((r, i) => i === idx ? { ...r, result: val } : r))}
                        >
                          <SelectTrigger className={`h-8 w-36 text-xs font-medium ${resultColorClass}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Win"><span className="text-profit font-medium">{t('result_win')}</span></SelectItem>
                            <SelectItem value="Loss"><span className="text-loss font-medium">{t('result_loss')}</span></SelectItem>
                            <SelectItem value="Breakeven"><span className="text-yellow-400 font-medium">{t('result_be')}</span></SelectItem>
                            <SelectItem value="Partial Win - TP1"><span className="text-yellow-500 font-medium">Partial TP1</span></SelectItem>
                            <SelectItem value="Partial Win - TP2"><span className="text-blue-400 font-medium">Partial TP2</span></SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      {/* P&L */}
                      <td className={`px-4 py-3 tabular-nums font-medium whitespace-nowrap ${tr.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {tr.profit >= 0 ? '+' : ''}${tr.profit.toFixed(2)}
                      </td>
                      {/* Risk $ — editable, triggers RR recalculation */}
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.risk || ''}
                          onChange={e => {
                            const riskVal = parseFloat(e.target.value) || 0;
                            const rrVal = riskVal > 0 ? parseFloat(Math.abs(tr.profit / riskVal).toFixed(2)) : 0;
                            setReviewRows(prev => prev.map((r, i) => i === idx ? { ...r, risk: riskVal, rr_ratio: rrVal } : r));
                          }}
                          className="h-8 w-20 text-xs"
                          placeholder="0.00"
                        />
                      </td>
                      {/* RR — read-only, auto-calculated */}
                      <td className="px-4 py-3">
                        <Input
                          readOnly
                          value={row.rr_ratio > 0 ? row.rr_ratio.toFixed(2) : ''}
                          className="h-8 w-16 text-xs bg-secondary cursor-default text-muted-foreground"
                          placeholder="—"
                        />
                      </td>
                      {/* Session — shadcn Select, 3 options, empty default */}
                      <td className="px-4 py-3">
                        <Select
                          value={row.session || ''}
                          onValueChange={val => setReviewRows(prev => prev.map((r, i) => i === idx ? { ...r, session: val } : r))}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue placeholder={lang === 'ar' ? 'الجلسة...' : lang === 'fr' ? 'Session...' : 'Session...'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Asia">{t('session_asian')}</SelectItem>
                            <SelectItem value="London">{t('session_london')}</SelectItem>
                            <SelectItem value="New York">{t('session_new_york')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      {/* Setup — shadcn Select from userTags */}
                      <td className="px-4 py-3">
                        <Select
                          value={row.setup_tag || ''}
                          onValueChange={val => setReviewRows(prev => prev.map((r, i) => i === idx ? { ...r, setup_tag: val } : r))}
                        >
                          <SelectTrigger className="h-8 w-44 text-xs">
                            <SelectValue placeholder={lang === 'ar' ? 'الإعداد...' : lang === 'fr' ? 'Setup...' : 'Setup...'} />
                          </SelectTrigger>
                          <SelectContent position="popper" className="z-[9999]">
                            {(userTags.length > 0 ? userTags : DEFAULT_TAGS).map(tag => (
                              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {/* Star rating — same pattern as detail panel */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setReviewRows(prev => prev.map((r, i) => i === idx ? { ...r, rating: s === r.rating ? 0 : s } : r))}
                            >
                              <Star className={`h-4 w-4 transition-colors ${s <= row.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-400/60'}`} />
                            </button>
                          ))}
                        </div>
                      </td>
                      {/* Screenshot upload */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {!isPro ? (
                            <div className="h-9 w-9 flex items-center justify-center rounded border border-dashed border-border text-muted-foreground/40 cursor-not-allowed" title={lang === 'ar' ? 'Pro فقط' : 'Pro only'}>
                              <Lock className="h-4 w-4" />
                            </div>
                          ) : row.screenshot_preview ? (
                            <div className="relative group">
                              <img
                                src={row.screenshot_preview}
                                alt="preview"
                                className="h-9 w-14 object-cover rounded border border-border cursor-pointer"
                                onClick={() => reviewFileRefs.current[idx]?.click()}
                              />
                              <button
                                type="button"
                                className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] leading-none"
                                onClick={() => setReviewRows(prev => prev.map((r, i) => {
                                  if (i !== idx) return r;
                                  if (r.screenshot_preview) URL.revokeObjectURL(r.screenshot_preview);
                                  return { ...r, screenshot_file: null, screenshot_preview: null };
                                }))}
                              >×</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="h-9 w-9 flex items-center justify-center rounded border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                              onClick={() => reviewFileRefs.current[idx]?.click()}
                            >
                              <Camera className="h-4 w-4" />
                            </button>
                          )}
                          {isPro && (
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              ref={el => { reviewFileRefs.current[idx] = el; }}
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const preview = URL.createObjectURL(file);
                                setReviewRows(prev => prev.map((r, i) => {
                                  if (i !== idx) return r;
                                  if (r.screenshot_preview) URL.revokeObjectURL(r.screenshot_preview);
                                  return { ...r, screenshot_file: file, screenshot_preview: preview };
                                }));
                              }}
                            />
                          )}
                        </div>
                      </td>
                      {/* Notes */}
                      <td className="px-4 py-3">
                        <Input
                          type="text"
                          value={row.notes}
                          onChange={e => setReviewRows(prev => prev.map((r, i) => i === idx ? { ...r, notes: e.target.value } : r))}
                          className="h-8 w-44 text-xs"
                          placeholder={t('col_notes')}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Fixed footer */}
          <div className="flex-shrink-0 px-8 py-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {reviewRows.length} {lang === 'ar' ? 'صفقة جاهزة للاستيراد' : lang === 'fr' ? 'trades prêts à importer' : 'trades ready to import'}
            </span>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="min-h-[40px] px-6"
                onClick={() => setShowReview(false)}
                disabled={importing}
              >
                {t('cancel')}
              </Button>
              <Button
                className="min-h-[40px] px-8 bg-teal-500 hover:bg-teal-600 text-black font-semibold"
                onClick={handleImportAll}
                disabled={importing}
              >
                {importing ? (
                  <><Loader2 className="me-2 h-4 w-4 animate-spin" />{t('importing_in_progress')}</>
                ) : (
                  `${t('import_all')} (${reviewRows.length})`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Step 3: Import Summary ── */}
      {(() => {
        const importedCount = summaryRows.length;
        const winCount   = summaryRows.filter(r => r.result === 'Win').length;
        const lossCount  = summaryRows.filter(r => r.result === 'Loss').length;
        const totalPnl   = summaryRows.reduce((sum, r) => sum + r.trade.profit, 0);
        return (
          <Dialog open={showSummary} onOpenChange={v => { if (!v) { setShowSummary(false); onClose(); } }}>
            <DialogContent className="sm:max-w-[95vw] sm:w-[95vw] sm:h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden">

              {/* Mobile drag handle */}
              <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>

              {/* Fixed header */}
              <div className="flex-shrink-0 px-6 sm:px-8 py-5 sm:py-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-6 h-6 text-teal-500" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">
                      {lang === 'ar' ? 'تم الاستيراد بنجاح' : lang === 'fr' ? 'Importation réussie' : 'Import Successful'}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {lang === 'ar'
                        ? `تم إضافة ${importedCount} صفقة إلى مجلتك`
                        : lang === 'fr'
                        ? `${importedCount} trades ont été ajoutés à votre journal`
                        : `${importedCount} trades have been added to your journal`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-auto min-h-0 px-8 py-6 space-y-6">

                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-foreground">{importedCount}</div>
                    <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                      {lang === 'ar' ? 'صفقات مستوردة' : lang === 'fr' ? 'Trades importés' : 'Trades Imported'}
                    </div>
                  </div>
                  <div className="bg-card border border-green-500/20 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-profit">{winCount}</div>
                    <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                      {lang === 'ar' ? 'أرباح' : lang === 'fr' ? 'Gains' : 'Wins'}
                    </div>
                  </div>
                  <div className="bg-card border border-red-500/20 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-loss">{lossCount}</div>
                    <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                      {lang === 'ar' ? 'خسائر' : lang === 'fr' ? 'Pertes' : 'Losses'}
                    </div>
                  </div>
                  <div className={`bg-card border rounded-xl p-4 text-center ${totalPnl >= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
                    <div className={`text-3xl font-bold ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}$
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                      {lang === 'ar' ? 'إجمالي الربح' : lang === 'fr' ? 'P&L Total' : 'Total P&L'}
                    </div>
                  </div>
                </div>

                {/* Trades summary table */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">
                      {lang === 'ar' ? 'الصفقات المستوردة' : lang === 'fr' ? 'Trades importés' : 'Imported Trades'}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">{t('col_symbol')}</th>
                          <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">{t('col_direction')}</th>
                          <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">{t('col_result')}</th>
                          <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">{t('col_pnl')}</th>
                          <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">{t('col_session')}</th>
                          <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">{t('col_setup')}</th>
                          <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">{t('col_rr')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryRows.map((row, index) => {
                          const tr = row.trade;
                          const resultBadge =
                            row.result === 'Win'               ? { cls: 'bg-profit/20 text-profit border-profit/30',        label: t('result_win') } :
                            row.result === 'Loss'              ? { cls: 'bg-loss/20 text-loss border-loss/30',              label: t('result_loss') } :
                            row.result === 'Breakeven'         ? { cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: t('result_be') } :
                            row.result === 'Partial Win - TP1' ? { cls: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30', label: 'Partial TP1' } :
                            row.result === 'Partial Win - TP2' ? { cls: 'bg-blue-400/20 text-blue-400 border-blue-400/30',  label: 'Partial TP2' } :
                            { cls: 'bg-secondary text-muted-foreground border-border', label: row.result };
                          return (
                            <tr key={index} className={`border-b border-border/50 ${index % 2 === 0 ? 'bg-muted/10' : ''}`}>
                              <td className="px-4 py-3 text-sm font-semibold text-foreground whitespace-nowrap">{tr.symbol}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${
                                  tr.direction === 'BUY' ? 'bg-profit/20 text-profit border-profit/30' : 'bg-loss/20 text-loss border-loss/30'
                                }`}>
                                  {tr.direction === 'BUY' ? t('direction_long') : t('direction_short')}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${resultBadge.cls}`}>
                                  {resultBadge.label}
                                </span>
                              </td>
                              <td className={`px-4 py-3 text-sm font-medium tabular-nums whitespace-nowrap ${tr.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                                {tr.profit >= 0 ? '+' : ''}{tr.profit.toFixed(2)}$
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                {row.session || '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                {row.setup_tag || '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                {row.rr_ratio > 0 ? `${row.rr_ratio}R` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Fixed footer */}
              <div className="flex-shrink-0 px-8 py-4 border-t border-border flex justify-end">
                <Button
                  className="bg-teal-500 hover:bg-teal-600 text-black font-semibold px-10"
                  onClick={() => { setShowSummary(false); onClose(); }}
                >
                  {lang === 'ar' ? 'الذهاب إلى صفقاتي' : lang === 'fr' ? 'Voir mes trades' : 'Go to My Trades'}
                </Button>
              </div>

            </DialogContent>
          </Dialog>
        );
      })()}
    </Dialog>
  );
}

// ── TradesPage ───────────────────────────────────────────────────────────────

const TradesPage = () => {
  const { t, language } = useLanguage();
  const lang = language as 'ar' | 'fr' | 'en';
  const { user, userPlan, userStatus } = useAuth();
  const isPro = userPlan === 'pro' || userStatus === 'trial';
  const navigate = useNavigate();
  const shareUserName = (user?.user_metadata?.full_name as string | undefined)?.trim() || user?.email?.split('@')[0] || 'Trader';
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState('all');
  const [setupFilter, setSetupFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState(0);       // 0 = all, 1-5 = min stars
  const [unreviewedOnly, setUnreviewedOnly] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [editReviewed, setEditReviewed] = useState(false);
  const [editSymbol, setEditSymbol] = useState('');
  const [editDirection, setEditDirection] = useState<'BUY'|'SELL'>('BUY');
  const [editResult, setEditResult] = useState('');
  const [editProfit, setEditProfit] = useState('');
  const [editRisk, setEditRisk] = useState('');
  const [editSession, setEditSession] = useState('');
  const [editSetupTag, setEditSetupTag] = useState('');
  const [editOpenTime, setEditOpenTime] = useState('');
  const [editCloseTime, setEditCloseTime] = useState('');
  const [editCommission, setEditCommission] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'trade' | 'trades'; ids: string[]; label: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  // Strategy Playbook
  const [strategies, setStrategies] = useState<any[]>([]);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<any | null>(null);
  const [strategyForm, setStrategyForm] = useState({ name: '', description: '', rules: '', sessions: '', symbols: '', color: '#3b82f6' });
  const [savingStrategy, setSavingStrategy] = useState(false);

  // Edit panel emotion/plan fields
  const [editEmotion, setEditEmotion] = useState<string | null>(null);
  const [editFollowedRules, setEditFollowedRules] = useState<boolean | null>(null);
  const [editStrategyId, setEditStrategyId] = useState<string | null>(null);

  // Derived values for the detail panel — computed from edit state
  const pnlNum  = useMemo(() => parseFloat(editProfit) || 0, [editProfit]);
  const riskNum = useMemo(() => parseFloat(editRisk) || 0, [editRisk]);
  const rrCalc  = useMemo(
    () => riskNum > 0 ? (pnlNum / riskNum).toFixed(2) : '—',
    [pnlNum, riskNum]
  );
  const durCalc = useMemo(() => {
    if (editOpenTime && editCloseTime) return computeDuration(editOpenTime, editCloseTime) || '—';
    return selectedTrade?.duration ?? '—';
  }, [editOpenTime, editCloseTime, selectedTrade]);

  // Safe trade object — guarantees all optional fields have fallback values
  // so the detail panel never crashes on old trades missing new columns
  const safeTrade = useMemo(() => {
    if (!selectedTrade) return null;
    return {
      ...selectedTrade,
      rating:         (selectedTrade as any).rating         ?? 0,
      reviewed:       (selectedTrade as any).reviewed       ?? false,
      screenshot_url: selectedTrade.screenshot_url          ?? null,
      setup_tag:      selectedTrade.setup_tag               ?? '',
      notes:          selectedTrade.notes                   ?? '',
      session:        selectedTrade.session                 ?? '',
      entry:          selectedTrade.entry                   ?? null,
      exit_price:     selectedTrade.exit_price              ?? null,
      duration:       selectedTrade.duration                ?? null,
      profit:         selectedTrade.profit                  ?? 0,
    };
  }, [selectedTrade]);

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

  // MT5 Import modal
  const [importOpen, setImportOpen] = useState(false);

  // Add trade dialog
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addScreenshotFile, setAddScreenshotFile] = useState<File | null>(null);
  const addFileRef = useRef<HTMLInputElement>(null);
  const [addEmotion, setAddEmotion] = useState<string | null>(null);
  const [addFollowedRules, setAddFollowedRules] = useState<boolean | null>(null);
  const [addStrategyId, setAddStrategyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    symbol: '',
    direction: '' as 'BUY' | 'SELL' | '',
    result: '',
    profit: '',      // Win / Loss / BE
    tp1Amount: '',   // Partial TP1/TP2 — TP1 portion
    tp2Amount: '',   // Partial TP1/TP2 — TP2 portion (optional)
    commission: '',
    risk: '',
    open_time: '',
    close_time: '',
    session: '',
    setup_tag: '',
    notes: '',
    account_id: '',
  });

  const isPartial = form.result.startsWith('Partial');

  const rr = (() => {
    const r = parseFloat(form.risk);
    if (!r || r === 0) return '';
    const p = isPartial
      ? (parseFloat(form.tp1Amount) || 0) + (parseFloat(form.tp2Amount) || 0)
      : parseFloat(form.profit);
    if (isNaN(p) || isNaN(r)) return '';
    return (Math.abs(p) / r).toFixed(2);
  })();

  const resetForm = () => {
    setForm({
      symbol: '', direction: '', result: '', profit: '', tp1Amount: '', tp2Amount: '',
      commission: '', risk: '', open_time: '', close_time: '', session: '', setup_tag: '',
      notes: '', account_id: '',
    });
    setAddScreenshotFile(null);
    setAddEmotion(null);
    setAddFollowedRules(null);
    setAddStrategyId(null);
  };

  const { sheetRef: addSheetRef, onTouchStart: addTouchStart, onTouchMove: addTouchMove, onTouchEnd: addTouchEnd } = useSwipeToDismiss(() => { setAddOpen(false); resetForm(); });

  const handleAddTrade = async () => {
    const hasAmount = isPartial ? form.tp1Amount !== '' : form.profit !== '';
    if (!form.symbol.trim() || !form.direction || !form.result || !hasAmount || !form.open_time || !form.close_time) {
      toast.error(lang === 'ar' ? 'يرجى ملء الحقول المطلوبة' : lang === 'fr' ? 'Veuillez remplir les champs obligatoires' : 'Please fill all required fields');
      return;
    }
    if (!form.account_id) {
      toast.error(lang === 'ar' ? 'يرجى اختيار الحساب' : lang === 'fr' ? 'Veuillez sélectionner un compte' : 'Please select an account');
      return;
    }
    setSubmitting(true);

    // Compute final profit with sign
    let finalProfit: number;
    if (form.result === 'Win') {
      finalProfit = Math.abs(parseFloat(form.profit));
    } else if (form.result === 'Loss') {
      finalProfit = -Math.abs(parseFloat(form.profit));
    } else if (form.result === 'Breakeven') {
      finalProfit = parseFloat(form.profit) || 0;
    } else {
      // Partial TP1/TP2 — sum of both, always positive
      finalProfit = Math.abs(parseFloat(form.tp1Amount) || 0) + Math.abs(parseFloat(form.tp2Amount) || 0);
    }

    // setup_tag: result, session, custom tag
    const tagParts = [form.result, form.session, form.setup_tag.trim()].filter(Boolean);
    const setupTagValue = tagParts.join(', ') || null;

    // notes: auto-generated meta line + user notes
    const rrStr = rr ? `R:R ${rr}` : '';
    const riskStr = form.risk ? `Risk $${form.risk}` : '';
    const extraInfo = [riskStr, rrStr].filter(Boolean).join(' | ');
    const notesValue = [extraInfo, form.notes.trim()].filter(Boolean).join('\n') || null;

    const duration = computeDuration(form.open_time, form.close_time);

    const insertPayload = {
      user_id: user!.id,
      symbol: form.symbol.trim().toUpperCase(),
      direction: form.direction,
      profit: finalProfit,
      commission: parseFloat(form.commission) || null,
      open_time: new Date(form.open_time).toISOString(),
      close_time: new Date(form.close_time).toISOString(),
      duration: duration || null,
      setup_tag: setupTagValue,
      session: form.session || null,
      notes: notesValue,
      account_id: form.account_id || null,
      volume: 0,
      emotion_tag: addEmotion || null,
      followed_rules: addFollowedRules,
      strategy_id: addStrategyId || null,
    };

    const { data: inserted, error } = await supabase.from('trades').insert(insertPayload).select().single();

    // Upload screenshot if one was selected
    if (!error && inserted && addScreenshotFile) {
      const compressed = await compressImage(addScreenshotFile);
      const path = `${user!.id}/${inserted.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('trade-screenshots')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('trade-screenshots').getPublicUrl(path);
        await supabase.from('trades').update({ screenshot_url: publicUrl }).eq('id', inserted.id);
      }
    }

    setSubmitting(false);
    if (error) {
      console.error('[TradesPage] insert error:', error);
      toast.error(`Failed to save trade: ${error.message}`);
      return;
    }

    toast.success(lang === 'ar' ? 'تم حفظ الصفقة' : lang === 'fr' ? 'Trade enregistré' : 'Trade saved!');
    setAddOpen(false);
    resetForm();
    const { data } = await supabase.from('trades').select('*').eq('user_id', user!.id).order('close_time', { ascending: false });
    setTrades(data ?? []);

    // Telegram notifications
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('telegram_chat_id, daily_loss_limit')
      .eq('user_id', user!.id)
      .maybeSingle();
    const chatId = (prefs as any)?.telegram_chat_id;
    if (chatId) {
      const profitAbs = Math.abs(finalProfit).toFixed(2);
      if (finalProfit > 0) {
        const msg = lang === 'ar'
          ? `✅ صفقة رابحة: ${form.symbol.trim().toUpperCase()} +$${profitAbs}`
          : lang === 'fr'
          ? `✅ Trade gagnant: ${form.symbol.trim().toUpperCase()} +$${profitAbs}`
          : `✅ Winning trade: ${form.symbol.trim().toUpperCase()} +$${profitAbs}`;
        await sendTelegramNotification(chatId, msg);
      } else if (finalProfit < 0) {
        const msg = lang === 'ar'
          ? `❌ صفقة خاسرة: ${form.symbol.trim().toUpperCase()} -$${profitAbs}`
          : lang === 'fr'
          ? `❌ Trade perdant: ${form.symbol.trim().toUpperCase()} -$${profitAbs}`
          : `❌ Losing trade: ${form.symbol.trim().toUpperCase()} -$${profitAbs}`;
        await sendTelegramNotification(chatId, msg);

        // Check daily loss limit
        const todayTrades = (data ?? []).filter(tr => {
          if (!tr.close_time) return false;
          const d = new Date(tr.close_time);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        });
        const { data: accs } = await supabase.from('mt5_accounts').select('starting_balance, daily_loss_limit').eq('user_id', user!.id).limit(1).maybeSingle();
        if (accs?.starting_balance && accs?.daily_loss_limit) {
          const dailyLoss = Math.abs(todayTrades.filter(tr => (tr.profit ?? 0) < 0).reduce((s, tr) => s + (tr.profit ?? 0), 0));
          const dailyLimit = (accs.starting_balance * accs.daily_loss_limit) / 100;
          if (dailyLimit > 0 && dailyLoss / dailyLimit >= 0.7) {
            const warn = lang === 'ar'
              ? `⚠️ تحذير: اقتربت من حد الخسارة اليومي (${((dailyLoss / dailyLimit) * 100).toFixed(0)}% مستخدم)`
              : lang === 'fr'
              ? `⚠️ Attention: limite de perte quotidienne approchée (${((dailyLoss / dailyLimit) * 100).toFixed(0)}% utilisé)`
              : `⚠️ Warning: Daily loss limit approaching (${((dailyLoss / dailyLimit) * 100).toFixed(0)}% used)`;
            await sendTelegramNotification(chatId, warn);
          }
        }
      }
    }
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

  // Load trades, accounts, tag list, and strategies from Supabase
  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: tradesData }, { data: prefsData }, { data: accountsData }, { data: strategiesData }] = await Promise.all([
        supabase.from('trades').select('*').eq('user_id', user.id).order('close_time', { ascending: false }),
        supabase.from('user_preferences').select('custom_tags').eq('user_id', user.id).maybeSingle(),
        supabase.from('mt5_accounts').select('id, firm, login, account_name').eq('user_id', user.id),
        (supabase.from('strategies') as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);
      setTrades(tradesData ?? []);
      setAccounts((accountsData ?? []) as Account[]);
      setStrategies(strategiesData ?? []);

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
    const { result, session, setup } = parseSetupTag(trade.setup_tag);
    const tags = trade.setup_tag
      ? trade.setup_tag.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    setEditTags(tags);
    setEditNotes(trade.notes ?? '');
    setEditRating((trade as any).rating ?? 0);
    setEditReviewed((trade as any).reviewed ?? false);
    setEditSymbol(trade.symbol ?? '');
    setEditDirection((trade.direction as 'BUY'|'SELL') ?? 'BUY');
    setEditResult(result ?? '');
    setEditProfit(trade.profit != null ? String(Math.abs(trade.profit)) : '');
    // Extract risk from notes metadata line
    const riskMatch = (trade.notes ?? '').match(/Risk \$([0-9.]+)/);
    setEditRisk(riskMatch ? riskMatch[1] : '');
    setEditSession(session ?? 'none');
    setEditSetupTag(setup ?? '');
    setEditOpenTime(trade.open_time ? new Date(trade.open_time).toISOString().slice(0,16) : '');
    setEditCloseTime(trade.close_time ? new Date(trade.close_time).toISOString().slice(0,16) : '');
    setEditCommission((trade as any).commission != null ? String((trade as any).commission) : '');
    setScreenshotUrl(trade.screenshot_url ?? null);
    setUploadProgress(0);
    setIsDragging(false);
    setCompressedSize(null);
    setShareOpen(false);
    setEditEmotion((trade as any).emotion_tag ?? null);
    setEditFollowedRules((trade as any).followed_rules ?? null);
    setEditStrategyId((trade as any).strategy_id ?? null);
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

    // Rebuild setup_tag from result + session + custom tags
    const sessionVal = (editSession && editSession !== 'none') ? editSession : '';
    const tagParts = [editResult, sessionVal, ...editTags.filter(t => !RESULT_VALUES.includes(t) && !SESSION_VALUES.includes(t)), editSetupTag.trim()].filter(Boolean);
    const setupTag = [...new Set(tagParts)].join(', ') || null;

    // Rebuild notes: meta line + user notes
    const rrVal = editRisk ? (Math.abs(parseFloat(editProfit)||0) / parseFloat(editRisk)).toFixed(2) : '';
    const riskStr = editRisk ? `Risk $${editRisk}` : '';
    const rrStr   = rrVal && rrVal !== 'NaN' && parseFloat(rrVal) > 0 ? `R:R ${rrVal}` : '';
    const metaLine = [riskStr, rrStr].filter(Boolean).join(' | ');
    // Preserve user notes (lines after meta)
    const existingUserNotes = (editNotes ?? '').split('\n').filter(l => !l.startsWith('Risk $') && !l.startsWith('R:R')).join('\n').trim();
    const finalNotes = [metaLine, existingUserNotes].filter(Boolean).join('\n') || null;

    // Compute profit with sign
    const profitNum = parseFloat(editProfit) || 0;
    const finalProfit = editResult === 'Loss' ? -Math.abs(profitNum) : Math.abs(profitNum);
    const duration = (editOpenTime && editCloseTime) ? computeDuration(editOpenTime, editCloseTime) || null : selectedTrade.duration;

    const updatePayload: Record<string, unknown> = {
      symbol:        editSymbol.trim().toUpperCase() || selectedTrade.symbol,
      direction:     editDirection,
      profit:        finalProfit,
      commission:    parseFloat(editCommission) || null,
      setup_tag:     setupTag,
      notes:         finalNotes,
      session:       (editSession && editSession !== 'none') ? editSession : null,
      rating:        editRating || null,
      reviewed:      editReviewed,
      open_time:     editOpenTime ? new Date(editOpenTime).toISOString() : selectedTrade.open_time,
      close_time:    editCloseTime ? new Date(editCloseTime).toISOString() : selectedTrade.close_time,
      duration,
      emotion_tag:   editEmotion || null,
      followed_rules: editFollowedRules,
      strategy_id:   editStrategyId || null,
    };

    const { error } = await supabase.from('trades').update(updatePayload as any).eq('id', selectedTrade.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
    } else {
      const updated = { ...selectedTrade, ...updatePayload } as Trade;
      setTrades(prev => prev.map(tr => tr.id === selectedTrade.id ? updated : tr));
      toast.success(lang === 'ar' ? 'تم الحفظ' : lang === 'fr' ? 'Enregistré' : 'Saved!');
      setSelectedTrade(null);
    }
  };

  const handleSaveStrategy = async () => {
    if (!user || !strategyForm.name.trim()) return;
    setSavingStrategy(true);
    const payload = {
      user_id: user.id,
      name: strategyForm.name.trim(),
      description: strategyForm.description.trim() || null,
      rules: strategyForm.rules.trim() ? strategyForm.rules.split('\n').map(r => r.trim()).filter(Boolean) : [],
      sessions: strategyForm.sessions.trim() ? strategyForm.sessions.split(',').map(s => s.trim()).filter(Boolean) : [],
      symbols: strategyForm.symbols.trim() ? strategyForm.symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [],
      color: strategyForm.color,
    };
    if (editingStrategy) {
      const { data } = await (supabase.from('strategies') as any).update(payload).eq('id', editingStrategy.id).select().single();
      setStrategies(prev => prev.map(s => s.id === editingStrategy.id ? data : s));
    } else {
      const { data } = await (supabase.from('strategies') as any).insert(payload).select().single();
      if (data) setStrategies(prev => [data, ...prev]);
    }
    setSavingStrategy(false);
    setShowStrategyModal(false);
    setEditingStrategy(null);
    setStrategyForm({ name: '', description: '', rules: '', sessions: '', symbols: '', color: '#3b82f6' });
  };

  const handleDeleteStrategy = async (id: string) => {
    await (supabase.from('strategies') as any).delete().eq('id', id);
    setStrategies(prev => prev.filter(s => s.id !== id));
  };

  // Quick rating/reviewed save (from table row or panel toggle)
  const saveRating = useCallback(async (tradeId: string, rating: number) => {
    await supabase.from('trades').update({ rating } as any).eq('id', tradeId);
    setTrades(prev => prev.map(tr => tr.id === tradeId ? { ...tr, ...(({ rating } as any)) } : tr));
  }, []);

  const toggleReviewed = useCallback(async (tradeId: string, current: boolean) => {
    const reviewed = !current;
    await supabase.from('trades').update({ reviewed } as any).eq('id', tradeId);
    setTrades(prev => prev.map(tr => tr.id === tradeId ? { ...tr, ...(({ reviewed } as any)) } : tr));
    if (selectedTrade?.id === tradeId) setEditReviewed(reviewed);
  }, [selectedTrade]);

  const handleDeleteConfirmed = async (ids: string[]) => {
    if (ids.length === 1) {
      await supabase.from('trades').delete().eq('id', ids[0]);
      setTrades(prev => prev.filter(tr => tr.id !== ids[0]));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(ids[0]); return next; });
      toast.success(lang === 'ar' ? 'تم الحذف' : lang === 'fr' ? 'Supprimé' : 'Trade deleted');
    } else {
      setDeletingBulk(true);
      await supabase.from('trades').delete().in('id', ids);
      setTrades(prev => prev.filter(tr => !ids.includes(tr.id)));
      setSelectedIds(new Set());
      setDeletingBulk(false);
      toast.success(lang === 'ar' ? 'تم الحذف' : lang === 'fr' ? 'Supprimés' : `${ids.length} trade(s) deleted`);
    }
  };

  const handleDeleteTrade = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({
      type: 'trade',
      ids: [id],
      label: lang === 'ar' ? 'هل تريد حذف هذه الصفقة؟' : lang === 'fr' ? 'Supprimer ce trade ?' : 'Are you sure you want to delete this trade?',
    });
    setShowDeleteModal(true);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setDeleteTarget({
      type: 'trades',
      ids,
      label: lang === 'ar' ? `هل تريد حذف ${ids.length} صفقة؟` : lang === 'fr' ? `Supprimer ${ids.length} trade(s) ?` : `Delete ${ids.length} selected trade(s)?`,
    });
    setShowDeleteModal(true);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(tr => tr.id)));
    }
  };

  const FREE_MONTHLY_LIMIT = 50;

  const checkMonthlyLimit = (): boolean => {
    if (isPro) return true;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const thisMonthCount = trades.filter(tr => {
      const t = tr.close_time ? new Date(tr.close_time) : null;
      return t && t >= monthStart && t < monthEnd;
    }).length;
    if (thisMonthCount >= FREE_MONTHLY_LIMIT) {
      toast.error(
        lang === 'ar' ? `لقد وصلت إلى الحد الأقصى ${FREE_MONTHLY_LIMIT} صفقة شهرياً للحساب المجاني` :
        lang === 'fr' ? `Limite de ${FREE_MONTHLY_LIMIT} trades/mois atteinte. Passez à Pro pour continuer.` :
        `Free plan limit: ${FREE_MONTHLY_LIMIT} trades/month reached. Upgrade to Pro.`
      );
      return false;
    }
    return true;
  };

  const exportCsv = () => {
    if (!isPro) {
      toast.error(
        lang === 'ar' ? 'تصدير CSV متاح لمستخدمي Pro فقط' :
        lang === 'fr' ? 'L\'export CSV est réservé aux abonnés Pro' :
        'CSV export is available for Pro users only'
      );
      return;
    }
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

  // account map for name lookup
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));

  // Filter
  const filtered = trades.filter(tr => {
    if (search && !tr.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    if (dirFilter !== 'all' && tr.direction !== dirFilter) return false;
    if (setupFilter !== 'all') {
      const tradeTags = tr.setup_tag?.split(',').map(s => s.trim()) ?? [];
      if (!tradeTags.includes(setupFilter)) return false;
    }
    if (accountFilter !== 'all') {
      if (accountFilter === 'manual') { if (tr.account_id) return false; }
      else { if (tr.account_id !== accountFilter) return false; }
    }
    if (ratingFilter > 0 && ((tr as any).rating ?? 0) < ratingFilter) return false;
    if (unreviewedOnly && (tr as any).reviewed === true) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{t('myTrades')}</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button size="sm" variant="destructive" onClick={handleDeleteSelected} disabled={deletingBulk} className="gap-1">
              {deletingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {lang === 'ar' ? `حذف (${selectedIds.size})` : lang === 'fr' ? `Supprimer (${selectedIds.size})` : `Delete (${selectedIds.size})`}
            </Button>
          )}
          <Button size="sm" className="gradient-primary text-primary-foreground gap-1" onClick={() => { if (checkMonthlyLimit()) setAddOpen(true); }}>
            <Plus className="h-4 w-4" />
            {lang === 'ar' ? 'إضافة صفقة' : lang === 'fr' ? 'Ajouter' : 'Add Trade'}
          </Button>
          <button
            type="button"
            onClick={() => isPro
              ? setShowPlaybookModal(true)
              : navigate('/settings?tab=subscription')
            }
            className="relative flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm font-bold transition-all shadow-sm group hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/50"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">{t('strategy_playbook')}</span>
            {!isPro && (
              <span className="absolute -top-1.5 -right-1.5 bg-teal-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                PRO
              </span>
            )}
          </button>
          <Button variant="outline" size="sm" onClick={() => { if (checkMonthlyLimit()) setImportOpen(true); }}>
            <Upload className="me-2 h-4 w-4" /> {t('importMt5')}
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
        {accounts.length > 0 && (
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={lang === 'ar' ? 'الحساب' : lang === 'fr' ? 'Compte' : 'Account'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === 'ar' ? 'كل الحسابات' : lang === 'fr' ? 'Tous les comptes' : 'All accounts'}</SelectItem>
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.account_name ?? acc.login?.toString() ?? acc.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* Rating filter */}
        <Select value={String(ratingFilter)} onValueChange={v => setRatingFilter(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">{t('tradeRating')}</SelectItem>
            {[1,2,3,4,5].map(n => (
              <SelectItem key={n} value={String(n)}>{'⭐'.repeat(n)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Reviewed filter */}
        <button
          type="button"
          onClick={() => setUnreviewedOnly(v => !v)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
            unreviewedOnly ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
          }`}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {t('unreviewed')}
        </button>
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
                  ? t('noTradesYet')
                  : (lang === 'ar' ? 'لا توجد صفقات تطابق المرشحات' : lang === 'fr' ? 'Aucun trade ne correspond aux filtres' : 'No trades match your filters.')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-8 px-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-primary"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="font-semibold">{t('symbol')}</TableHead>
                    <TableHead className="font-semibold">{lang === 'ar' ? 'الحساب' : lang === 'fr' ? 'Compte' : 'Account'}</TableHead>
                    <TableHead className="font-semibold">{t('direction')}</TableHead>
                    <TableHead className="font-semibold">{lang === 'ar' ? 'النتيجة' : lang === 'fr' ? 'Résultat' : 'Result'}</TableHead>
                    <TableHead className="font-semibold">{t('pnl')}</TableHead>
                    <TableHead className="font-semibold">R:R</TableHead>
                    <TableHead className="font-semibold">{lang === 'ar' ? 'الجلسة' : lang === 'fr' ? 'Session' : 'Session'}</TableHead>
                    <TableHead className="font-semibold">{t('setup')}</TableHead>
                    <TableHead className="font-semibold">{t('notes')}</TableHead>
                    <TableHead className="font-semibold w-16">⭐</TableHead>
                    <TableHead className="font-semibold w-8"></TableHead>
                    <TableHead className="font-semibold">{t('date')}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(trade => {
                    const { result, session, setup } = parseSetupTag(trade.setup_tag);
                    const rrVal = extractRR(trade.notes);
                    const preview = notesPreview(trade.notes);
                    const pnl = trade.profit ?? 0;
                    const commission = (trade as any).commission ?? 0;
                    const netPnl = pnl - commission;
                    return (
                      <TableRow
                        key={trade.id}
                        className="cursor-pointer border-border transition-colors hover:bg-secondary/40"
                        onClick={() => openTrade(trade)}
                      >
                        {/* Checkbox */}
                        <TableCell className="w-8 px-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-primary"
                            checked={selectedIds.has(trade.id)}
                            onChange={() => setSelectedIds(prev => {
                              const next = new Set(prev);
                              next.has(trade.id) ? next.delete(trade.id) : next.add(trade.id);
                              return next;
                            })}
                          />
                        </TableCell>
                        {/* Symbol */}
                        <TableCell className="font-bold text-foreground">{trade.symbol}</TableCell>

                        {/* Account */}
                        <TableCell>
                          {trade.account_id && accountMap[trade.account_id] ? (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {accountMap[trade.account_id].account_name ?? accountMap[trade.account_id].login?.toString() ?? '—'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {lang === 'ar' ? 'يدوي' : lang === 'fr' ? 'Manuel' : 'Manual'}
                            </span>
                          )}
                        </TableCell>

                        {/* Direction */}
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            trade.direction === 'BUY'
                              ? 'border-profit/30 bg-profit/15 text-profit'
                              : 'border-loss/30 bg-loss/15 text-loss'
                          }`}>
                            {trade.direction === 'BUY' ? t('buy') : t('sell')}
                          </span>
                        </TableCell>

                        {/* Result */}
                        <TableCell>
                          {result ? (
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${netPnlBadgeClass(netPnl)}`}>
                              {resultLabel(result, lang)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* P&L */}
                        <TableCell className={`font-semibold tabular-nums ${netPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)}
                          {commission > 0 && (
                            <span className="block text-[10px] text-muted-foreground font-normal">−${commission.toFixed(2)} comm</span>
                          )}
                        </TableCell>

                        {/* R:R */}
                        <TableCell className="tabular-nums text-muted-foreground text-sm">
                          {rrVal ? `1:${parseFloat(rrVal).toFixed(1)}` : '—'}
                        </TableCell>

                        {/* Session */}
                        <TableCell>
                          {session ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sessionBadgeClass(session)}`}>
                              {session === 'New York' ? 'NY' : session}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Setup */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {setup ? (
                              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                                {setup.length > 14 ? setup.slice(0, 14) + '…' : setup}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {(trade as any).emotion_tag && (() => {
                              const em = EMOTIONS.find(e => e.key === (trade as any).emotion_tag);
                              return em ? <span title={em.key} className="text-sm leading-none">{em.emoji}</span> : null;
                            })()}
                          </div>
                        </TableCell>

                        {/* Notes preview */}
                        <TableCell className="max-w-[140px]">
                          {preview ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Pencil className="h-3 w-3 shrink-0 opacity-50" />
                              <span className="truncate">{preview}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Rating + Reviewed */}
                        <TableCell className="w-16" onClick={e => e.stopPropagation()}>
                          <div className="flex flex-col items-start gap-0.5">
                            <div className="flex">
                              {[1,2,3,4,5].map(s => (
                                <button key={s} type="button"
                                  onClick={() => saveRating(trade.id, s === (trade as any).rating ? 0 : s)}
                                  className="p-0 leading-none"
                                >
                                  <Star className={`h-3 w-3 ${s <= ((trade as any).rating ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                                </button>
                              ))}
                            </div>
                            {(trade as any).reviewed && (
                              <span className="flex items-center gap-0.5 rounded-full bg-profit/15 px-1.5 py-0.5 text-[9px] font-medium text-profit">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Screenshot icon */}
                        <TableCell className="w-8 text-center">
                          {trade.screenshot_url ? (
                            <button
                              type="button"
                              title="View screenshot"
                              onClick={e => { e.stopPropagation(); window.open(trade.screenshot_url!, '_blank'); }}
                              className="text-muted-foreground transition-colors hover:text-primary"
                            >
                              <Camera className="h-4 w-4" />
                            </button>
                          ) : null}
                        </TableCell>

                        {/* Date */}
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {trade.close_time ? new Date(trade.close_time).toLocaleDateString() : '—'}
                        </TableCell>
                        {/* Delete */}
                        <TableCell className="w-10 px-2" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            title="Delete trade"
                            onClick={e => handleDeleteTrade(trade.id, e)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-loss/20 hover:text-loss"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Trade Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[92vh] flex flex-col p-0 sm:overflow-hidden sm:max-w-lg max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:rounded-b-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300 ease-out bg-transparent shadow-none border-0">
          <div ref={addSheetRef} className="flex flex-col flex-1 min-h-0 bg-background rounded-t-3xl overflow-hidden shadow-2xl">
          {/* Mobile drag handle — swipe to dismiss */}
          <div
            className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
            onTouchStart={addTouchStart}
            onTouchMove={addTouchMove}
            onTouchEnd={addTouchEnd}
          >
            <div className="w-12 h-1.5 bg-muted-foreground/40 rounded-full" />
          </div>
          <div className="px-6 pb-2 pt-2 flex-shrink-0">
            <DialogTitle className="text-lg">
              {lang === 'ar' ? 'إضافة صفقة يدوية' : lang === 'fr' ? 'Ajouter un trade manuel' : 'Add Manual Trade'}
            </DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-4 pt-2">
            {/* Account */}
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'الحساب' : lang === 'fr' ? 'Compte' : 'Account'} <span className="text-destructive">*</span></Label>
              <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={lang === 'ar' ? 'اختر الحساب' : lang === 'fr' ? 'Sélectionner un compte' : 'Select account'} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {lang === 'ar' ? 'لا توجد حسابات — أضف حساباً أولاً' : lang === 'fr' ? 'Aucun compte — ajoutez-en un d\'abord' : 'No accounts — add one first'}
                    </SelectItem>
                  ) : (
                    accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name || `${acc.firm}${acc.login ? ` · ${acc.login}` : ''}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

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

            {/* Profit / Risk / RR — conditional on result type */}
            {isPartial ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>
                      {lang === 'ar' ? 'مبلغ TP1 ($)' : lang === 'fr' ? 'Montant TP1 ($)' : 'TP1 Amount ($)'}
                      <span className="text-destructive"> *</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.tp1Amount}
                      onChange={e => setForm(f => ({ ...f, tp1Amount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      {lang === 'ar' ? 'مبلغ TP2 ($) — اختياري' : lang === 'fr' ? 'Montant TP2 ($) — optionnel' : 'TP2 Amount ($) — optional'}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.tp2Amount}
                      onChange={e => setForm(f => ({ ...f, tp2Amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{lang === 'ar' ? 'المخاطرة ($)' : lang === 'fr' ? 'Risque ($)' : 'Risk ($)'}</Label>
                    <Input type="number" step="0.01" placeholder="0.00" value={form.risk}
                      onChange={e => setForm(f => ({ ...f, risk: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>R:R</Label>
                    <Input readOnly value={rr} placeholder="—" className="cursor-default bg-secondary text-muted-foreground" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    {form.result === 'Loss'
                      ? (lang === 'ar' ? 'مبلغ الخسارة ($)' : lang === 'fr' ? 'Montant perte ($)' : 'Loss Amount ($)')
                      : form.result === 'Breakeven'
                      ? (lang === 'ar' ? 'P&L ($)' : lang === 'fr' ? 'P&L ($)' : 'P&L ($)')
                      : (lang === 'ar' ? 'الربح ($)' : lang === 'fr' ? 'Gain ($)' : 'Profit ($)')
                    }
                    <span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={form.result === 'Loss' ? '100.00' : '0.00'}
                    value={form.profit}
                    onChange={e => setForm(f => ({ ...f, profit: e.target.value }))}
                  />
                  {form.result === 'Loss' && (
                    <p className="text-xs text-muted-foreground">
                      {lang === 'ar' ? 'أدخل رقماً موجباً — سيُحفظ كخسارة' : lang === 'fr' ? 'Entrez un positif — sauvegardé comme perte' : 'Enter positive — saved as negative'}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{lang === 'ar' ? 'المخاطرة ($)' : lang === 'fr' ? 'Risque ($)' : 'Risk ($)'}</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={form.risk}
                    onChange={e => setForm(f => ({ ...f, risk: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>R:R</Label>
                  <Input readOnly value={rr} placeholder="—" className="cursor-default bg-secondary text-muted-foreground" />
                </div>
              </div>
            )}

            {/* Commission */}
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'العمولة ($)' : lang === 'fr' ? 'Commission ($)' : 'Commission ($)'}
                <span className="ms-1 text-xs text-muted-foreground">({lang === 'ar' ? 'اختياري' : lang === 'fr' ? 'optionnel' : 'optional'})</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.commission}
                onChange={e => setForm(f => ({ ...f, commission: e.target.value }))}
              />
              {form.commission && parseFloat(form.commission) > 0 && form.profit && (
                <p className="text-xs text-gray-400 mt-1">
                  {(() => {
                    const netPnl = parseFloat(form.profit) - parseFloat(form.commission);
                    return lang === 'ar'
                      ? `صافي الربح: ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} (بعد خصم العمولة ${form.commission})`
                      : lang === 'fr'
                      ? `P&L net: ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} (après comm. ${form.commission})`
                      : `Net P&L: ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} (after ${form.commission} commission)`;
                  })()}
                </p>
              )}
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

            {/* Emotion */}
            <div className="space-y-1.5">
              <Label>{t('emotion_tag')}</Label>
              <div className="flex flex-wrap gap-2">
                {EMOTIONS.map(em => (
                  <button
                    key={em.key}
                    type="button"
                    onClick={() => setAddEmotion(addEmotion === em.key ? null : em.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      addEmotion === em.key
                        ? 'border-transparent text-white'
                        : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                    }`}
                    style={addEmotion === em.key ? { backgroundColor: em.color } : {}}
                  >
                    <span>{em.emoji}</span>
                    <span>{t(`emotion_${em.key}` as any)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Followed Rules */}
            <div className="space-y-1.5">
              <Label>{t('followed_rules')}</Label>
              <div className="flex gap-2">
                {([true, false] as const).map(val => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setAddFollowedRules(addFollowedRules === val ? null : val)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      addFollowedRules === val
                        ? val ? 'border-profit bg-profit/20 text-profit' : 'border-loss bg-loss/20 text-loss'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {val ? t('yes_followed') : t('no_followed')}
                  </button>
                ))}
              </div>
            </div>

            {/* Strategy */}
            {!isPro ? (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  {t('strategy_label')}
                  <span className="text-[10px] bg-teal-500 text-white px-1.5 py-0.5 rounded-full font-black">PRO</span>
                </Label>
                <div className="relative">
                  <div className="pointer-events-none opacity-40">
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder={lang === 'ar' ? 'اختر الاستراتيجية' : lang === 'fr' ? 'Choisir' : 'Select strategy'} />
                      </SelectTrigger>
                    </Select>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/settings?tab=subscription')}
                    className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl text-xs font-bold text-teal-600 hover:bg-white/80 transition-colors"
                  >
                    🔒 {lang === 'ar' ? 'ترقية للاستخدام' : lang === 'fr' ? 'Passer à Pro' : 'Upgrade to use'}
                  </button>
                </div>
              </div>
            ) : strategies.length > 0 ? (
              <div className="space-y-1.5">
                <Label>{t('strategy_label')}</Label>
                <Select value={addStrategyId ?? 'none'} onValueChange={v => setAddStrategyId(v === 'none' ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={lang === 'ar' ? 'اختر الاستراتيجية' : lang === 'fr' ? 'Choisir' : 'Select strategy'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {strategies.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color ?? '#3b82f6' }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* Screenshot upload */}
            <div className="space-y-1.5">
              <Label>
                {lang === 'ar' ? 'صورة الصفقة' : lang === 'fr' ? 'Capture d\'écran' : 'Screenshot'}
                <span className="ms-1 text-xs text-muted-foreground">{lang === 'ar' ? '(اختياري)' : lang === 'fr' ? '(optionnel)' : '(optional)'}</span>
              </Label>
              {!isPro ? (
                <div className="flex items-center justify-between rounded-md border border-dashed border-border bg-secondary px-3 py-2 text-sm text-muted-foreground cursor-not-allowed">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <span>{lang === 'ar' ? 'متاح في Pro فقط' : lang === 'fr' ? 'Disponible en Pro' : 'Pro only'}</span>
                  </div>
                  <a href="/settings?tab=subscription" className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity" onClick={e => e.stopPropagation()}>
                    {lang === 'ar' ? 'ترقية' : lang === 'fr' ? 'Upgrade' : 'Upgrade'}
                  </a>
                </div>
              ) : (
                <>
                  <input
                    ref={addFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setAddScreenshotFile(file);
                      e.target.value = '';
                    }}
                  />
                  {addScreenshotFile ? (
                    <div className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 text-foreground">
                        <Camera className="h-4 w-4 text-primary" />
                        <span className="truncate max-w-[200px]">{addScreenshotFile.name}</span>
                      </div>
                      <button type="button" onClick={() => setAddScreenshotFile(null)} className="text-muted-foreground hover:text-loss">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addFileRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      <Camera className="h-4 w-4" />
                      {lang === 'ar' ? 'إضافة صورة' : lang === 'fr' ? 'Ajouter une image' : 'Add screenshot'}
                    </button>
                  )}
                </>
              )}
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
          </div>
          </div>{/* end addSheetRef */}
        </DialogContent>
      </Dialog>

      {/* ── Strategy Playbook Modal ── */}
      <Dialog open={showPlaybookModal} onOpenChange={setShowPlaybookModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {t('strategy_playbook')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {strategies.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                {lang === 'ar' ? 'لا توجد استراتيجيات بعد' : lang === 'fr' ? 'Aucune stratégie' : 'No strategies yet'}
              </p>
            ) : (
              <div className="space-y-2">
                {strategies.map(s => {
                  const tradeCnt = trades.filter(tr => (tr as any).strategy_id === s.id).length;
                  const wins = trades.filter(tr => (tr as any).strategy_id === s.id && tr.profit != null && tr.profit > 0).length;
                  const wr = tradeCnt > 0 ? Math.round((wins / tradeCnt) * 100) : null;
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-secondary/20 p-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color ?? '#3b82f6' }} />
                        <div>
                          <p className="font-semibold text-sm">{s.name}</p>
                          {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tradeCnt} {t('strategy_no_trades')}
                            {wr !== null && <span className="ms-2 text-profit">{wr}% WR</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => {
                          setEditingStrategy(s);
                          setStrategyForm({
                            name: s.name, description: s.description ?? '',
                            rules: (s.rules ?? []).join('\n'),
                            sessions: (s.sessions ?? []).join(', '),
                            symbols: (s.symbols ?? []).join(', '),
                            color: s.color ?? '#3b82f6',
                          });
                          setShowStrategyModal(true);
                        }} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteStrategy(s.id)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/30 text-destructive/60 hover:bg-destructive/10 hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button className="w-full gap-2" onClick={() => {
              setEditingStrategy(null);
              setStrategyForm({ name: '', description: '', rules: '', sessions: '', symbols: '', color: '#3b82f6' });
              setShowStrategyModal(true);
            }}>
              <Plus className="h-4 w-4" /> {t('strategy_new')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Strategy Create/Edit Modal ── */}
      <Dialog open={showStrategyModal} onOpenChange={v => { setShowStrategyModal(v); if (!v) setEditingStrategy(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStrategy ? t('strategy_edit') : t('strategy_new')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('strategy_name')} <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. FVG Reversal" value={strategyForm.name} onChange={e => setStrategyForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('strategy_description')}</Label>
              <Textarea rows={2} value={strategyForm.description} onChange={e => setStrategyForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('strategy_rules')} <span className="text-xs text-muted-foreground">({lang === 'ar' ? 'سطر لكل قاعدة' : 'one per line'})</span></Label>
              <Textarea rows={4} placeholder="Wait for liquidity sweep&#10;Enter on FVG retest&#10;RR ≥ 2" value={strategyForm.rules} onChange={e => setStrategyForm(f => ({ ...f, rules: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('strategy_sessions')} <span className="text-xs text-muted-foreground">(,)</span></Label>
                <Input placeholder="London, New York" value={strategyForm.sessions} onChange={e => setStrategyForm(f => ({ ...f, sessions: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('strategy_symbols')} <span className="text-xs text-muted-foreground">(,)</span></Label>
                <Input placeholder="EURUSD, GBPUSD" value={strategyForm.symbols} onChange={e => setStrategyForm(f => ({ ...f, symbols: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('strategy_color')}</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={strategyForm.color} onChange={e => setStrategyForm(f => ({ ...f, color: e.target.value }))} className="h-9 w-14 cursor-pointer rounded border border-border bg-transparent p-0.5" />
                <span className="text-xs text-muted-foreground">{strategyForm.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => { setShowStrategyModal(false); setEditingStrategy(null); }}>
              {lang === 'ar' ? 'إلغاء' : lang === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveStrategy} disabled={savingStrategy || !strategyForm.name.trim()}>
              {savingStrategy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('strategy_save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MT5 Import Modal */}
      <Mt5ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        userId={user!.id}
        accounts={accounts}
        isPro={isPro}
        onImported={async () => {
          const { data } = await supabase.from('trades').select('*').eq('user_id', user!.id).order('close_time', { ascending: false });
          setTrades(data ?? []);
        }}
      />

      {/* ── Detail Panel ── */}
      <Sheet open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedTrade && safeTrade && (
              <>
                <SheetHeader className="pb-2">
                  {/* SheetTitle must be a plain text node (renders as h2) — no inputs/buttons inside */}
                  <SheetTitle className="sr-only">{editSymbol || selectedTrade.symbol} — Trade Detail</SheetTitle>
                  {/* Visual header row */}
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-0.5 text-sm font-bold ${editDirection === 'BUY' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'}`}>
                      {editDirection}
                    </span>
                    <Input
                      value={editSymbol}
                      onChange={e => setEditSymbol(e.target.value.toUpperCase())}
                      className="h-8 w-32 text-lg font-bold uppercase"
                    />
                    <div className="flex gap-1 ms-auto">
                      <button
                        type="button"
                        onClick={() => setShareOpen(v => !v)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title={t('shareTrade')}
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={e => { handleDeleteTrade(selectedTrade.id, e); }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 text-destructive/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title={lang === 'ar' ? 'حذف الصفقة' : 'Delete'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </SheetHeader>

                <div className="space-y-5 pt-2">

                  {/* ── Section: Core fields ── */}
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                    {/* Direction toggle */}
                    <div className="flex gap-2">
                      {(['BUY','SELL'] as const).map(d => (
                        <button key={d} type="button"
                          onClick={() => setEditDirection(d)}
                          className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${
                            editDirection === d
                              ? d === 'BUY' ? 'border-profit bg-profit/20 text-profit' : 'border-loss bg-loss/20 text-loss'
                              : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                          }`}
                        >{d === 'BUY' ? t('buy') : t('sell')}</button>
                      ))}
                    </div>

                    {/* Result */}
                    <div className="space-y-1">
                      <Label>{lang === 'ar' ? 'النتيجة' : lang === 'fr' ? 'Résultat' : 'Result'}</Label>
                      <Select value={editResult} onValueChange={setEditResult}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {RESULT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label[lang]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* PnL + Risk + RR */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('pnl')} ($)</Label>
                        <Input type="number" step="0.01" value={editProfit} onChange={e => setEditProfit(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('risk')}</Label>
                        <Input type="number" step="0.01" value={editRisk} onChange={e => setEditRisk(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">R:R</Label>
                        <Input readOnly value={rrCalc} className="h-8 text-sm bg-secondary cursor-default text-muted-foreground" />
                      </div>
                    </div>

                    {/* Commission */}
                    <div className="space-y-1">
                      <Label className="text-xs">{lang === 'ar' ? 'العمولة ($)' : lang === 'fr' ? 'Commission ($)' : 'Commission ($)'}</Label>
                      <Input type="number" step="0.01" placeholder="0.00" value={editCommission} onChange={e => setEditCommission(e.target.value)} className="h-8 text-sm" />
                      {editCommission && parseFloat(editCommission) > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {(() => {
                            const netPnl = parseFloat(editProfit || '0') - parseFloat(editCommission);
                            return lang === 'ar'
                              ? `صافي الربح: ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} (بعد خصم العمولة ${editCommission})`
                              : lang === 'fr'
                              ? `P&L net: ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} (après comm. ${editCommission})`
                              : `Net P&L: ${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)} (after ${editCommission} commission)`;
                          })()}
                        </p>
                      )}
                    </div>

                    {/* Open / Close time */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">{lang === 'ar' ? 'الفتح' : lang === 'fr' ? 'Ouverture' : 'Open'}</Label>
                        <Input type="datetime-local" value={editOpenTime} onChange={e => setEditOpenTime(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{lang === 'ar' ? 'الإغلاق' : lang === 'fr' ? 'Clôture' : 'Close'}</Label>
                        <Input type="datetime-local" value={editCloseTime} onChange={e => setEditCloseTime(e.target.value)} className="h-8 text-xs" />
                      </div>
                    </div>

                    {/* Duration read-only */}
                    <p className="text-xs text-muted-foreground">
                      {t('duration')}: <span className="font-medium text-foreground">{durCalc}</span>
                      {safeTrade.entry != null && safeTrade.entry > 0 && <span className="ms-3">{t('entry')}: {safeTrade.entry}</span>}
                      {safeTrade.exit_price != null && safeTrade.exit_price > 0 && <span className="ms-3">{t('exit')}: {safeTrade.exit_price}</span>}
                    </p>
                  </div>

                  {/* ── Section: Tags & Classification ── */}
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                    {/* Session */}
                    <div className="space-y-1">
                      <Label className="text-xs">{lang === 'ar' ? 'الجلسة' : lang === 'fr' ? 'Session' : 'Session'}</Label>
                      <Select value={editSession} onValueChange={setEditSession}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{lang === 'ar' ? 'لا شيء' : lang === 'fr' ? 'Aucune' : 'None'}</SelectItem>
                          {SESSION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label[lang]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Setup text */}
                    <div className="space-y-1">
                      <Label className="text-xs">{t('setup')}</Label>
                      <Input value={editSetupTag} onChange={e => setEditSetupTag(e.target.value)}
                        placeholder="FVG, Order Block..." className="h-8 text-sm" />
                    </div>

                    {/* Tag pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {allTags.map(tag => {
                        const active = editTags.includes(tag);
                        return (
                          <div key={tag} className="group relative flex items-center">
                            <button type="button" onClick={() => toggleTag(tag)}
                              className={`rounded-full border pe-5 ps-2.5 py-0.5 text-xs font-medium transition-colors ${
                                active ? 'border-primary bg-primary/20 text-primary' : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                              }`}>{tag}</button>
                            <button type="button" onClick={() => removeTag(tag)}
                              className="absolute end-0.5 h-4 w-4 flex items-center justify-center rounded-full opacity-0 text-muted-foreground hover:text-destructive group-hover:opacity-100 transition-opacity">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder={lang === 'ar' ? 'إضافة وسم...' : 'Add tag...'} value={newTagInput}
                        onChange={e => setNewTagInput(e.target.value)} onKeyDown={handleTagInputKeyDown} className="h-8 text-sm" />
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={addCustomTag} disabled={addingTag || !newTagInput.trim()}>
                        {addingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {/* ── Section: Psychology ── */}
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                    <Label className="text-sm font-semibold">{t('psychology_title')}</Label>

                    {/* Emotion */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('emotion_tag')}</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {EMOTIONS.map(em => (
                          <button
                            key={em.key}
                            type="button"
                            onClick={() => setEditEmotion(editEmotion === em.key ? null : em.key)}
                            className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                              editEmotion === em.key
                                ? 'border-transparent text-white'
                                : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                            }`}
                            style={editEmotion === em.key ? { backgroundColor: em.color } : {}}
                          >
                            <span>{em.emoji}</span>
                            <span>{t(`emotion_${em.key}` as any)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Followed Rules */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('followed_rules')}</Label>
                      <div className="flex gap-2">
                        {([true, false] as const).map(val => (
                          <button
                            key={String(val)}
                            type="button"
                            onClick={() => setEditFollowedRules(editFollowedRules === val ? null : val)}
                            className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                              editFollowedRules === val
                                ? val ? 'border-profit bg-profit/20 text-profit' : 'border-loss bg-loss/20 text-loss'
                                : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                            }`}
                          >
                            {val ? t('yes_followed') : t('no_followed')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Strategy */}
                    {strategies.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t('strategy_label')}</Label>
                        <Select value={editStrategyId ?? 'none'} onValueChange={v => setEditStrategyId(v === 'none' ? null : v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {strategies.map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                <span className="flex items-center gap-2">
                                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color ?? '#3b82f6' }} />
                                  {s.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {editStrategyId && (() => {
                          const strat = strategies.find(s => s.id === editStrategyId);
                          return strat ? (
                            <div className="rounded-lg border border-border bg-card p-2 text-xs space-y-1">
                              <div className="flex items-center gap-2 font-semibold">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: strat.color }} />
                                {strat.name}
                              </div>
                              {strat.description && <p className="text-muted-foreground">{strat.description}</p>}
                              {strat.rules?.length > 0 && (
                                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                                  {strat.rules.map((r: string, i: number) => <li key={i}>{r}</li>)}
                                </ul>
                              )}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>

                  {/* ── Section: Rating & Review ── */}
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                    {/* Stars */}
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">{t('tradeRating')}</Label>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(s => (
                          <button key={s} type="button" onClick={() => setEditRating(s === editRating ? 0 : s)}>
                            <Star className={`h-6 w-6 transition-colors ${s <= editRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-400/60'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Reviewed toggle */}
                    <button type="button" onClick={() => setEditReviewed(v => !v)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        editReviewed ? 'border-profit/40 bg-profit/10 text-profit' : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}>
                      <Check className="h-4 w-4 shrink-0" />
                      {editReviewed ? t('reviewed') : t('markReviewed')}
                    </button>
                  </div>

                  {/* ── Section: Notes ── */}
                  <div className="space-y-1.5">
                    <Label>{t('notes')}</Label>
                    <Textarea placeholder={t('notes')} rows={4} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                  </div>

                  {/* ── Section: Screenshot ── */}
                  <div className="space-y-2">
                    <Label>{lang === 'ar' ? 'لقطة الشاشة' : lang === 'fr' ? 'Capture d\'écran' : 'Screenshot'}</Label>
                    {!isPro ? (
                      <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border bg-secondary/30 p-5 text-center">
                        <Lock className="h-7 w-7 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {lang === 'ar' ? 'رفع لقطات الشاشة متاح لمستخدمي Pro فقط' : lang === 'fr' ? 'Upload de captures réservé aux abonnés Pro' : 'Screenshot upload is available for Pro users only'}
                        </p>
                        <a href="/settings?tab=subscription" className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                          {lang === 'ar' ? 'ترقية إلى Pro' : lang === 'fr' ? 'Passer à Pro' : 'Upgrade to Pro'}
                        </a>
                      </div>
                    ) : screenshotUrl ? (
                      <div className="relative overflow-hidden rounded-lg border border-border">
                        <img src={screenshotUrl} alt="Trade screenshot" className="w-full object-contain max-h-64" />
                        <button type="button" onClick={handleDeleteScreenshot}
                          className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-muted-foreground hover:bg-destructive hover:text-white transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="absolute bottom-2 end-2 rounded-md bg-background/80 px-2 py-1 text-xs backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors">
                          {lang === 'ar' ? 'استبدال' : lang === 'fr' ? 'Remplacer' : 'Replace'}
                        </button>
                      </div>
                    ) : (
                      <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
                          isDragging ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/50'
                        } ${uploading ? 'cursor-default opacity-70' : ''}`}>
                        {uploading ? (
                          <>
                            <Loader2 className="h-7 w-7 animate-spin text-primary" />
                            <p className="text-xs text-primary">{compressedSize === null ? (lang === 'ar' ? 'ضغط...' : 'Compressing...') : (lang === 'ar' ? 'رفع...' : 'Uploading...')}</p>
                            <div className="h-1 w-32 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: compressedSize === null ? '15%' : `${uploadProgress}%` }} /></div>
                          </>
                        ) : (
                          <>
                            <Camera className="h-7 w-7" />
                            <p className="text-xs">{lang === 'ar' ? 'أفلت أو انقر للاختيار — JPG, PNG' : lang === 'fr' ? 'Déposer ou cliquer — JPG, PNG' : 'Drop or click — JPG, PNG'}</p>
                          </>
                        )}
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); e.target.value = ''; }} />
                  </div>

                  {/* ── Share card ── */}
                  {shareOpen && (
                    <div className="rounded-xl border border-primary/20 bg-secondary/30 p-4 space-y-3">
                      {/* Preview card */}
                      <div ref={shareCardRef} style={{ width: 480, background: 'linear-gradient(135deg,#f0fdf9 0%,#ffffff 50%,#f0f9ff 100%)', borderRadius: 20, padding: 32, fontFamily: 'Arial,sans-serif', border: '2px solid #99f6e4', position: 'relative', overflow: 'hidden', ...(lang === 'ar' && { direction: 'rtl' }) }}>
                        {/* Background decoration */}
                        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, background: 'rgba(20,184,166,0.06)', borderRadius: '50%' }} />
                        {/* Header */}
                        <div style={{ display: 'flex', flexDirection: lang === 'ar' ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>TRADESMARTDZ</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
                              {safeTrade.close_time ? new Date(safeTrade.close_time).toLocaleDateString() : ''}
                            </p>
                          </div>
                          <div style={{ textAlign: lang === 'ar' ? 'left' : 'right' }}>
                            <p style={{ margin: '0 0 2px', fontSize: 13, color: '#0f172a', fontWeight: 700 }}>
                              {shareUserName}
                            </p>
                            <p style={{ margin: 0, fontSize: 11, color: '#14b8a6', fontWeight: 600 }}>
                              TradeSmartDz • tradesmartdz.com
                            </p>
                          </div>
                        </div>
                        {/* Symbol + Direction + Result */}
                        <div style={{ marginBottom: 20 }}>
                          <p style={{ margin: '0 0 8px', fontSize: 40, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{editSymbol || safeTrade.symbol}</p>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ background: editDirection === 'BUY' ? '#dcfce7' : '#fee2e2', color: editDirection === 'BUY' ? '#16a34a' : '#dc2626', padding: '4px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                              {editDirection === 'BUY' ? t('share_buy', lang) : t('share_sell', lang)}
                            </span>
                            {editResult && (
                              <span style={{ background: '#f8fafc', color: '#64748b', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0' }}>
                                {editResult === 'Win' ? t('share_win', lang) : editResult === 'Loss' ? t('share_loss', lang) : editResult === 'Breakeven' ? t('share_be', lang) : editResult}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Stats cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                          {[
                            { label: t('share_pnl', lang), val: `${pnlNum >= 0 ? '+' : ''}$${pnlNum.toFixed(2)}`, color: pnlNum >= 0 ? '#0d9488' : '#dc2626' },
                            { label: t('share_rr', lang), val: rrCalc || '—', color: '#0f172a' },
                            { label: t('share_duration', lang), val: durCalc || '—', color: '#0f172a' },
                          ].map((s, i) => (
                            <div key={i} style={{ background: '#f8fafc', borderRadius: 14, padding: '12px', border: '1px solid #e2e8f0' }}>
                              <p style={{ margin: '0 0 4px', fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</p>
                              <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: s.color }}>{s.val}</p>
                            </div>
                          ))}
                        </div>
                        {/* Setup tag */}
                        {editSetupTag && (
                          <div style={{ marginBottom: 16 }}>
                            <span style={{ background: '#f0fdf9', border: '1px solid #99f6e4', color: '#0d9488', padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                              {editSetupTag}
                            </span>
                          </div>
                        )}
                        {/* Star rating */}
                        {editRating > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            {[...Array(5)].map((_, i) => (
                              <span key={i} style={{ fontSize: 18, color: i < editRating ? '#f59e0b' : '#e2e8f0' }}>★</span>
                            ))}
                          </div>
                        )}
                        {/* Footer */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{t('share_analyzed_with', lang)}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#14b8a6', fontWeight: 700 }}>tradesmartdz.com</p>
                        </div>
                      </div>
                      <Button className="w-full gradient-primary text-primary-foreground" onClick={async () => {
                        if (!isPro) {
                          toast.error(
                            lang === 'ar' ? 'مشاركة الصورة متاحة لمستخدمي Pro فقط' :
                            lang === 'fr' ? 'Le partage en image est réservé aux abonnés Pro' :
                            'Image sharing is available for Pro users only'
                          );
                          return;
                        }
                        if (!shareCardRef.current) return;
                        const canvas = await html2canvas(shareCardRef.current, { scale: 2, backgroundColor: null, useCORS: true });
                        const a = document.createElement('a');
                        a.href = canvas.toDataURL('image/png');
                        a.download = `trade-${editSymbol || safeTrade.symbol}-${new Date().toISOString().slice(0,10)}.png`;
                        a.click();
                      }}>
                        <Download className="me-2 h-4 w-4" />{t('shareDownload')}
                      </Button>
                    </div>
                  )}

                  {/* Save + action bar */}
                  <Button className="w-full min-h-[44px] gradient-primary text-primary-foreground" onClick={saveTrade} disabled={saving}>
                    {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t('save')}
                  </Button>
                </div>
              </>
            )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              {lang === 'ar' ? 'تأكيد الحذف' : lang === 'fr' ? 'Confirmer la suppression' : 'Confirm Delete'}
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground">
              {deleteTarget?.label}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 mt-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground font-semibold text-sm hover:bg-secondary transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : lang === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                if (deleteTarget) handleDeleteConfirmed(deleteTarget.ids);
              }}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors"
            >
              {lang === 'ar' ? 'حذف' : lang === 'fr' ? 'Supprimer' : 'Delete'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TradesPage;
