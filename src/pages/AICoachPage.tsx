import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, RefreshCw, Send, Loader2, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';

type Lang = 'ar' | 'fr' | 'en';

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openrouter/auto';

// ─── Translations ─────────────────────────────────────────────
const L = {
  ar: {
    title: 'المدرب الذكي',
    autoAnalysis: 'تحليل تلقائي لصفقاتك',
    analyzeBtn: 'حلّل صفقاتي',
    regenerate: 'إعادة التحليل',
    analyzing: 'الذكاء الاصطناعي يحلل صفقاتك...',
    noTrades: 'لا توجد صفقات بعد. أضف بعض الصفقات لبدء التحليل.',
    chatTitle: 'الدردشة مع المدرب',
    chatPlaceholder: 'اسأل سؤالاً عن صفقاتك...',
    send: 'إرسال',
    chatEmpty: 'ابدأ المحادثة مع مدربك الذكي',
    suggestions: ['ما هو أفضل إعداد لديّ؟', 'لماذا خسارتي أكثر في يوم الإثنين؟', 'ما هي جلسة التداول الأفضل لي؟'],
    errorApi: 'خطأ في الاتصال بالذكاء الاصطناعي. حاول مجدداً.',
    thinking: 'يفكر...',
    you: 'أنت',
    coach: 'المدرب',
  },
  fr: {
    title: 'Coach IA',
    autoAnalysis: 'Analyse automatique de vos trades',
    analyzeBtn: 'Analyser mes trades',
    regenerate: 'Régénérer l\'analyse',
    analyzing: 'L\'IA analyse vos trades...',
    noTrades: 'Aucun trade pour l\'instant. Ajoutez des trades pour commencer l\'analyse.',
    chatTitle: 'Chat avec le Coach',
    chatPlaceholder: 'Posez une question sur vos trades...',
    send: 'Envoyer',
    chatEmpty: 'Commencez la conversation avec votre coach IA',
    suggestions: ['Quel est mon meilleur setup?', 'Pourquoi je perds plus le lundi?', 'Quelle session est la plus profitable pour moi?'],
    errorApi: 'Erreur de connexion à l\'IA. Réessayez.',
    thinking: 'Réflexion...',
    you: 'Vous',
    coach: 'Coach',
  },
  en: {
    title: 'AI Coach',
    autoAnalysis: 'Auto Analysis of Your Trades',
    analyzeBtn: 'Analyze My Trading',
    regenerate: 'Regenerate Analysis',
    analyzing: 'AI is analyzing your trades...',
    noTrades: 'No trades yet. Add some trades to start the analysis.',
    chatTitle: 'Chat with the Coach',
    chatPlaceholder: 'Ask a question about your trades...',
    send: 'Send',
    chatEmpty: 'Start chatting with your AI trading coach',
    suggestions: ['What is my best setup?', 'Why do I lose more on Mondays?', 'Which session is most profitable for me?'],
    errorApi: 'Error connecting to AI. Please try again.',
    thinking: 'Thinking...',
    you: 'You',
    coach: 'Coach',
  },
};

// ─── Build trade summary for context ─────────────────────────
function buildTradeSummary(trades: any[], lang: Lang): string {
  if (!trades.length) return lang === 'ar' ? 'لا توجد صفقات' : lang === 'fr' ? 'Aucun trade' : 'No trades';

  const closed = trades.filter(t => t.profit !== null && t.profit !== undefined);
  const wins = closed.filter(t => t.profit > 0);
  const losses = closed.filter(t => t.profit <= 0);
  const totalPnl = closed.reduce((s, t) => s + (t.profit || 0), 0);
  const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(1) : '0';
  const avgWin = wins.length > 0 ? (wins.reduce((s, t) => s + t.profit, 0) / wins.length).toFixed(2) : '0';
  const avgLoss = losses.length > 0 ? (losses.reduce((s, t) => s + t.profit, 0) / losses.length).toFixed(2) : '0';

  // By day of week
  const byDay: Record<string, { pnl: number; count: number }> = {};
  closed.forEach(t => {
    const d = new Date(t.open_time || t.created_at);
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    if (!byDay[day]) byDay[day] = { pnl: 0, count: 0 };
    byDay[day].pnl += t.profit || 0;
    byDay[day].count++;
  });

  // By setup
  const bySetup: Record<string, { pnl: number; count: number }> = {};
  closed.forEach(t => {
    const tag = t.setup_tag || t.session || 'Unknown';
    if (!bySetup[tag]) bySetup[tag] = { pnl: 0, count: 0 };
    bySetup[tag].pnl += t.profit || 0;
    bySetup[tag].count++;
  });

  // By symbol
  const bySymbol: Record<string, { pnl: number; count: number }> = {};
  closed.forEach(t => {
    const sym = t.symbol || 'Unknown';
    if (!bySymbol[sym]) bySymbol[sym] = { pnl: 0, count: 0 };
    bySymbol[sym].pnl += t.profit || 0;
    bySymbol[sym].count++;
  });

  const dayLines = Object.entries(byDay).map(([d, v]) => `${d}: ${v.count} trades, PnL ${v.pnl.toFixed(2)}`).join(', ');
  const setupLines = Object.entries(bySetup).map(([s, v]) => `${s}: ${v.count} trades, PnL ${v.pnl.toFixed(2)}`).join(', ');
  const symbolLines = Object.entries(bySymbol).slice(0, 8).map(([s, v]) => `${s}: ${v.count} trades, PnL ${v.pnl.toFixed(2)}`).join(', ');

  return `
Total trades: ${closed.length}
Win rate: ${winRate}%
Total PnL: ${totalPnl.toFixed(2)}
Avg win: ${avgWin} | Avg loss: ${avgLoss}
By day: ${dayLines}
By setup/tag: ${setupLines}
By symbol: ${symbolLines}
`.trim();
}

// ─── Call OpenRouter ──────────────────────────────────────────
async function callOpenRouter(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://tradesmartdz.com',
      'X-Title': 'TradeSmart DZ',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 800 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Render markdown-like sections ───────────────────────────
function AnalysisDisplay({ text }: { text: string }) {
  // Split by lines and style headers (lines starting with # or **)
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return <h3 key={i} className="mt-3 text-base font-bold text-primary">{trimmed.replace(/^#+\s*/, '')}</h3>;
        }
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return <p key={i} className="font-semibold text-foreground">{trimmed.slice(2, -2)}</p>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span className="text-muted-foreground">{trimmed.replace(/^[-•]\s*/, '')}</span>
            </div>
          );
        }
        return <p key={i} className="text-muted-foreground">{trimmed}</p>;
      })}
    </div>
  );
}

// ─── Chat message type ────────────────────────────────────────
interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

// ─── Main page ────────────────────────────────────────────────
export default function AICoachPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const lang = language as Lang;
  const t = L[lang];

  const [trades, setTrades] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<string>('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const cacheKey = user ? `tradesmartdz_ai_${user.id}` : null;

  // Load trades
  useEffect(() => {
    if (!user) return;
    supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('open_time', { ascending: false })
      .limit(200)
      .then(({ data }) => setTrades(data || []));
  }, [user]);

  // Load cached analysis
  useEffect(() => {
    if (!cacheKey) return;
    const cached = localStorage.getItem(cacheKey);
    if (cached) setAnalysis(cached);
  }, [cacheKey]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  const tradeSummary = buildTradeSummary(trades, lang);

  const handleAnalyze = useCallback(async () => {
    if (!trades.length) return;
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const langInstruction =
        lang === 'ar' ? 'Respond entirely in Arabic (العربية).' :
        lang === 'fr' ? 'Respond entirely in French.' :
        'Respond in English.';
      const result = await callOpenRouter([
        {
          role: 'system',
          content: `You are a professional forex/trading coach analyzing a trader's performance data. ${langInstruction}
Provide structured analysis with sections: strengths, weaknesses, best/worst patterns, and 3 actionable improvement tips.
Use clear headers and bullet points. Be specific and data-driven. Keep it under 600 words.`,
        },
        {
          role: 'user',
          content: `Here is my trading data summary:\n\n${tradeSummary}\n\nPlease analyze my trading performance and give me actionable coaching feedback.`,
        },
      ]);
      setAnalysis(result);
      if (cacheKey) localStorage.setItem(cacheKey, result);
    } catch {
      setAnalysisError(t.errorApi);
    } finally {
      setAnalysisLoading(false);
    }
  }, [trades, tradeSummary, lang, t.errorApi, cacheKey]);

  const handleSendChat = useCallback(async (text?: string) => {
    const message = (text ?? chatInput).trim();
    if (!message || chatLoading) return;
    setChatInput('');

    const now = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMsg = { role: 'user', content: message, ts: now };
    setChatMsgs(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const langInstruction =
        lang === 'ar' ? 'Respond entirely in Arabic (العربية).' :
        lang === 'fr' ? 'Respond entirely in French.' :
        'Respond in English.';

      // Build context: last 20 messages
      const history = [...chatMsgs.slice(-19), userMsg];
      const messages = [
        {
          role: 'system',
          content: `You are a professional forex trading coach. ${langInstruction}
The trader's data summary:\n${tradeSummary}\nAnswer questions about their trading clearly and concisely. Max 300 words.`,
        },
        ...history.map(m => ({ role: m.role, content: m.content })),
      ];

      const reply = await callOpenRouter(messages);
      const replyTs = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      setChatMsgs(prev => [...prev, { role: 'assistant', content: reply, ts: replyTs }]);
    } catch {
      const errTs = new Date().toLocaleTimeString();
      setChatMsgs(prev => [...prev, { role: 'assistant', content: t.errorApi, ts: errTs }]);
    } finally {
      setChatLoading(false);
      inputRef.current?.focus();
    }
  }, [chatInput, chatLoading, chatMsgs, tradeSummary, lang, t.errorApi]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
      </div>

      {/* ── TOP: Auto Analysis ── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            {t.autoAnalysis}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action button */}
          <div className="flex gap-2">
            {!analysis ? (
              <Button
                onClick={handleAnalyze}
                disabled={analysisLoading || trades.length === 0}
                className="gap-2"
              >
                {analysisLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t.analyzing}</>
                ) : (
                  <><TrendingUp className="h-4 w-4" />{t.analyzeBtn}</>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleAnalyze}
                disabled={analysisLoading}
                className="gap-2"
              >
                {analysisLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t.analyzing}</>
                ) : (
                  <><RefreshCw className="h-4 w-4" />{t.regenerate}</>
                )}
              </Button>
            )}
          </div>

          {/* No trades notice */}
          {trades.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.noTrades}</p>
          )}

          {/* Error */}
          {analysisError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {analysisError}
            </div>
          )}

          {/* Loading skeleton */}
          {analysisLoading && (
            <div className="space-y-2 animate-pulse">
              {[80, 60, 90, 50, 70].map((w, i) => (
                <div key={i} className="h-3 rounded bg-muted" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {/* Analysis result */}
          {analysis && !analysisLoading && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <AnalysisDisplay text={analysis} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── BOTTOM: Chat ── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            {t.chatTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4">
          {/* Messages */}
          <div className="flex h-[420px] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-background p-3">
            {chatMsgs.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <Bot className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t.chatEmpty}</p>
                {/* Suggestion chips */}
                <div className="flex flex-wrap justify-center gap-2">
                  {t.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendChat(s)}
                      className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {chatMsgs.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    {msg.role === 'assistant' && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-1">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    {/* Bubble */}
                    <div className={`max-w-[78%] space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'rounded-tr-sm bg-primary text-primary-foreground'
                            : 'rounded-tl-sm bg-card border border-border text-foreground'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-muted-foreground px-1">{msg.ts}</span>
                    </div>
                  </div>
                ))}
                {/* Typing indicator */}
                {chatLoading && (
                  <div className="flex gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 150, 300].map(d => (
                          <span key={d} className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </>
            )}
          </div>

          {/* Input row */}
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.chatPlaceholder}
              rows={1}
              disabled={chatLoading}
              className="min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              style={{ maxHeight: 120 }}
            />
            <Button
              onClick={() => handleSendChat()}
              disabled={!chatInput.trim() || chatLoading}
              size="icon"
              className="h-[42px] w-[42px] shrink-0 rounded-xl"
            >
              {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
