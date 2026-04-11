import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, RefreshCw, Send, Loader2, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type Lang = 'ar' | 'fr' | 'en';

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.0-flash-lite-001';
const DAILY_MESSAGE_LIMIT = 10;

/*
 * IMPORTANT: Run these SQL statements in Supabase SQL Editor before deploying:
 *
 * ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS ai_analysis_cache text;
 * ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS ai_analysis_date timestamptz;
 * ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS ai_messages_date date;
 * ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS ai_messages_count int default 0;
 */

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
    limitReached: 'لقد وصلت إلى حد 10 رسائل يومياً. عد غداً!',
    messagesLeft: (n: number) => `${n} رسائل متبقية اليوم`,
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
    limitReached: 'Limite de 10 messages par jour atteinte. Revenez demain!',
    messagesLeft: (n: number) => `${n} messages restants aujourd'hui`,
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
    limitReached: 'Daily limit of 10 messages reached. Come back tomorrow!',
    messagesLeft: (n: number) => `${n} messages remaining today`,
  },
};

// ─── Format time ago ──────────────────────────────────────────
function formatTimeAgo(isoString: string): string {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 400 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Render markdown-like sections ───────────────────────────
function AnalysisDisplay({ text }: { text: string }) {
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
  const { user, userPlan } = useAuth();
  const navigate = useNavigate();
  const lang = language as Lang;
  const t = L[lang];

  const [trades, setTrades] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<string>('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string | null>(null);
  const [cachedAnalysis, setCachedAnalysis] = useState<string | null>(null);

  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messagesUsedToday, setMessagesUsedToday] = useState(0);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load trades (ascending so slice(-20) gives the 20 most recent)
  useEffect(() => {
    if (!user) return;
    supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('open_time', { ascending: true })
      .limit(200)
      .then(({ data }) => setTrades(data || []));
  }, [user]);

  // Load cached analysis and daily message count from Supabase
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('ai_analysis_cache, ai_analysis_date, ai_messages_date, ai_messages_count')
        .eq('user_id', user.id)
        .single();

      if (prefs?.ai_analysis_cache && prefs?.ai_analysis_date) {
        const hoursDiff = (Date.now() - new Date(prefs.ai_analysis_date).getTime()) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
          setCachedAnalysis(prefs.ai_analysis_cache);
          setLastAnalysisTime(prefs.ai_analysis_date);
          setAnalysis(prefs.ai_analysis_cache);
        }
      }

      const today = new Date().toISOString().split('T')[0];
      if (prefs?.ai_messages_date === today) {
        setMessagesUsedToday(prefs.ai_messages_count || 0);
      }
    })();
  }, [user]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  // ─── Computed stats for chat system prompt ────────────────
  const closed = trades.filter(tr => tr.profit !== null && tr.profit !== undefined);
  const wins = closed.filter(tr => tr.profit > 0);
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const totalPnl = closed.reduce((s, tr) => s + (tr.profit || 0), 0).toFixed(2);

  const sessionCount: Record<string, number> = {};
  closed.forEach(tr => { const s = tr.session || 'Unknown'; sessionCount[s] = (sessionCount[s] || 0) + 1; });
  const topSession = Object.entries(sessionCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const setupCount: Record<string, number> = {};
  closed.forEach(tr => { const s = tr.setup_tag || 'Unknown'; setupCount[s] = (setupCount[s] || 0) + 1; });
  const topSetup = Object.entries(setupCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // ─── Run analysis ─────────────────────────────────────────
  // Always queries Supabase fresh — 24h limit applies regardless of force flag
  const runAnalysis = useCallback(async () => {
    if (!trades.length || !user) return;

    // Always check fresh from Supabase — never rely on stale state
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('ai_analysis_cache, ai_analysis_date')
      .eq('user_id', user.id)
      .single();

    if (prefs?.ai_analysis_cache && prefs?.ai_analysis_date) {
      const hoursDiff = (Date.now() - new Date(prefs.ai_analysis_date).getTime()) / (1000 * 60 * 60);

      if (hoursDiff < 24) {
        // Show cached result and block the call
        setAnalysis(prefs.ai_analysis_cache);
        setCachedAnalysis(prefs.ai_analysis_cache);
        setLastAnalysisTime(prefs.ai_analysis_date);
        const hoursRemaining = Math.ceil(24 - hoursDiff);
        toast.error(
          lang === 'ar'
            ? `يمكنك التحليل مرة واحدة يومياً. باقي ${hoursRemaining} ساعة`
            : lang === 'fr'
            ? `1 analyse par jour. Encore ${hoursRemaining}h à attendre`
            : `1 analysis per day. ${hoursRemaining}h remaining`
        );
        return;
      }
    }

    // No cache or cache expired — call the API
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const last20Trades = trades.slice(-20);
      const tradesContext = last20Trades.map(tr =>
        `${tr.symbol} ${tr.direction} ${tr.result} P&L:${tr.profit} RR:${tr.rr_ratio} Session:${tr.session} Setup:${tr.setup_tag}`
      ).join('\n');

      const analysisSystemPrompt = `You are an elite professional trading coach for prop firm traders. The user trades NQ/Nasdaq futures using ICT concepts.
Be extremely concise, direct, and specific. Use their actual numbers.
Respond in ${lang === 'ar' ? 'Arabic' : lang === 'fr' ? 'French' : 'English'}.

Format your response EXACTLY like this structure, nothing more:

📊 SNAPSHOT
[Win rate]% win rate • [total PnL] total P&L • [X] trades analyzed

⚠️ MAIN WEAKNESS
[One specific pattern from their losing trades - be specific with numbers]

✅ MAIN STRENGTH
[One specific pattern from their winning trades - be specific with numbers]

🎯 THIS WEEK'S FOCUS
[One single actionable improvement - concrete and specific]

💡 QUICK TIP
[One ICT-specific tip based on their data]

Maximum 180 words total. Never write essays. Be a coach not a reporter.`;

      const analysisUserMessage = `My last ${last20Trades.length} trades:\n${tradesContext}\n\nAnalyze my trading.`;

      const result = await callOpenRouter([
        { role: 'system', content: analysisSystemPrompt },
        { role: 'user', content: analysisUserMessage },
      ]);

      setAnalysis(result);
      setCachedAnalysis(result);
      const now = new Date().toISOString();
      setLastAnalysisTime(now);

      await supabase
        .from('user_preferences')
        .update({ ai_analysis_cache: result, ai_analysis_date: now })
        .eq('user_id', user.id);

    } catch {
      setAnalysisError(t.errorApi);
    } finally {
      setAnalysisLoading(false);
    }
  }, [trades, lang, t.errorApi, user]);

  // ─── Send chat message ────────────────────────────────────
  const handleSendChat = useCallback(async (text?: string) => {
    const message = (text ?? chatInput).trim();
    if (!message || chatLoading) return;

    if (messagesUsedToday >= DAILY_MESSAGE_LIMIT) {
      toast.error(t.limitReached);
      return;
    }

    setChatInput('');
    const now = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMsg = { role: 'user', content: message, ts: now };
    setChatMsgs(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const last20Trades = trades.slice(-20);
      const tradesContext = last20Trades.map(tr =>
        `${tr.symbol} ${tr.direction} ${tr.result} P&L:${tr.profit} RR:${tr.rr_ratio} Session:${tr.session} Setup:${tr.setup_tag}`
      ).join('\n');

      const chatSystemPrompt = `You are an elite trading coach for prop firm traders specializing in ICT concepts and NQ/Nasdaq futures.
Respond in ${lang === 'ar' ? 'Arabic' : lang === 'fr' ? 'French' : 'English'}.

Rules:
- Maximum 120 words per response
- Be direct and specific, never vague
- Reference their actual trade data when relevant
- Give actionable advice only
- No long introductions or conclusions
- Talk like a coach, not a professor

The trader's recent context:
- Last 20 trades win rate: ${winRate}%
- Total P&L: ${totalPnl}
- Most used session: ${topSession}
- Most used setup: ${topSetup}

Last 20 trades for reference:
${tradesContext}`;

      const history = [...chatMsgs.slice(-19), userMsg];
      const messages = [
        { role: 'system', content: chatSystemPrompt },
        ...history.map(m => ({ role: m.role, content: m.content })),
      ];

      const reply = await callOpenRouter(messages);
      const replyTs = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
      setChatMsgs(prev => [...prev, { role: 'assistant', content: reply, ts: replyTs }]);

      // Increment and persist daily counter
      const newCount = messagesUsedToday + 1;
      setMessagesUsedToday(newCount);
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('user_preferences')
        .update({ ai_messages_date: today, ai_messages_count: newCount })
        .eq('user_id', user!.id);

    } catch {
      const errTs = new Date().toLocaleTimeString();
      setChatMsgs(prev => [...prev, { role: 'assistant', content: t.errorApi, ts: errTs }]);
    } finally {
      setChatLoading(false);
      inputRef.current?.focus();
    }
  }, [chatInput, chatLoading, chatMsgs, trades, lang, t.errorApi, winRate, totalPnl, topSession, topSetup, messagesUsedToday, user]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const messagesRemaining = DAILY_MESSAGE_LIMIT - messagesUsedToday;
  const isLimitReached = messagesUsedToday >= DAILY_MESSAGE_LIMIT;

  if (userPlan === 'free') {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
        <div className="text-6xl">🔒</div>
        <h3 className="text-2xl font-black">
          {lang === 'ar' ? 'المدرب الذكي للمشتركين Pro فقط' : lang === 'fr' ? 'Coach IA réservé aux abonnés Pro' : 'AI Coach is Pro only'}
        </h3>
        <p className="text-muted-foreground max-w-sm">
          {lang === 'ar'
            ? 'ترقّ إلى Pro للحصول على تحليل مخصص لصفقاتك ودردشة مع المدرب الذكي'
            : lang === 'fr'
            ? 'Passez à Pro pour obtenir une analyse personnalisée de vos trades et discuter avec le Coach IA'
            : 'Upgrade to Pro to get personalized AI coaching based on your trades'}
        </p>
        <Button
          onClick={() => navigate('/settings?tab=subscription')}
          className="bg-teal-500 hover:bg-teal-600 text-black font-bold px-8 py-3 text-base"
        >
          {lang === 'ar' ? 'ترقية إلى Pro ⭐' : lang === 'fr' ? 'Passer à Pro ⭐' : 'Upgrade to Pro ⭐'}
        </Button>
      </div>
    );
  }

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
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {!analysis ? (
                <Button
                  onClick={() => runAnalysis()}
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
                  onClick={() => runAnalysis()}
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
            {lastAnalysisTime && (
              <p className="text-xs text-muted-foreground">
                {lang === 'ar'
                  ? `آخر تحليل: ${formatTimeAgo(lastAnalysisTime)}`
                  : lang === 'fr'
                  ? `Dernière analyse: ${formatTimeAgo(lastAnalysisTime)}`
                  : `Last analysis: ${formatTimeAgo(lastAnalysisTime)}`}
              </p>
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
                      disabled={isLimitReached}
                      className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
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

          {/* Messages remaining counter */}
          <p className={`text-xs ${isLimitReached ? 'text-destructive' : 'text-muted-foreground'}`}>
            {t.messagesLeft(messagesRemaining)}
          </p>

          {/* Input row */}
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.chatPlaceholder}
              rows={1}
              maxLength={500}
              disabled={chatLoading || isLimitReached}
              className="min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
              style={{ maxHeight: 120 }}
            />
            <Button
              onClick={() => handleSendChat()}
              disabled={!chatInput.trim() || chatLoading || isLimitReached}
              size="icon"
              className="h-[42px] w-[42px] shrink-0 rounded-xl"
            >
              {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {/* Character counter */}
          <p className="text-xs text-muted-foreground text-right -mt-1">
            {chatInput.length}/500
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
