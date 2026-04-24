import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bot, X, Loader2, SendHorizonal } from 'lucide-react';

type Lang = 'ar' | 'fr' | 'en';

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.0-flash-lite-001';
const DAILY_LIMIT = 4;

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

async function callOpenRouter(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://tradesmartdz.com',
      'X-Title': 'TradeSmartDz',
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 300 }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export default function FloatingAIChat() {
  const { language } = useLanguage();
  const { user, userPlan, userStatus } = useAuth();
  const navigate = useNavigate();
  const lang = language as Lang;
  const isPro = userPlan === 'pro' || userStatus === 'trial';

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messagesUsedToday, setMessagesUsedToday] = useState(0);
  const [trades, setTrades] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('ai_messages_date, ai_messages_count')
        .eq('user_id', user.id)
        .maybeSingle();
      const today = new Date().toISOString().split('T')[0];
      if (prefs?.ai_messages_date === today) {
        setMessagesUsedToday(prefs.ai_messages_count || 0);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !isPro) return;
    supabase
      .from('trades')
      .select('symbol, direction, profit, session, setup_tag')
      .eq('user_id', user.id)
      .order('open_time', { ascending: false })
      .limit(20)
      .then(({ data }) => setTrades(data || []));
  }, [user, isPro]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading || messagesUsedToday >= DAILY_LIMIT) return;

    setInput('');
    const userMsg: ChatMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const closed = trades.filter(tr => tr.profit !== null);
      const wins = closed.filter(tr => tr.profit > 0);
      const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
      const totalPnl = closed.reduce((s, tr) => s + (tr.profit || 0), 0).toFixed(2);

      const tradesContext = trades.map(tr =>
        [tr.symbol, tr.direction, `P&L:${tr.profit}`, `Session:${tr.session}`, `Setup:${tr.setup_tag}`]
          .filter(Boolean).join(' ')
      ).join('\n');

      const langLabel = lang === 'ar' ? 'Arabic' : lang === 'fr' ? 'French' : 'English';

      const systemPrompt = `You are an elite trading coach for prop firm traders specializing in ICT concepts.
Respond in ${langLabel}.
Rules:
- Maximum 100 words per response
- Be direct and specific, never vague
- Reference their actual trade data when relevant
- Give actionable advice only
- No long introductions or conclusions
- Talk like a coach, not a professor

Trader context:
- Win rate: ${winRate}%
- Total P&L: $${totalPnl}
- Recent trades:
${tradesContext || 'No trades yet'}`;

      const history = [...messages.slice(-9), userMsg];
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({ role: m.role, content: m.content })),
      ];

      const reply = await callOpenRouter(apiMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

      const newCount = messagesUsedToday + 1;
      setMessagesUsedToday(newCount);
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('user_preferences')
        .update({ ai_messages_date: today, ai_messages_count: newCount })
        .eq('user_id', user!.id);

    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: lang === 'ar' ? 'حدث خطأ. حاول مجدداً.' : lang === 'fr' ? 'Erreur. Réessayez.' : 'Error. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const remaining = DAILY_LIMIT - messagesUsedToday;
  const isLimitReached = messagesUsedToday >= DAILY_LIMIT;

  // Shared inner panel content (used by both mobile & desktop)
  const panelContent = (
    <>
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
            <Bot className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-900">
              {lang === 'ar' ? 'مساعد التداول' : lang === 'fr' ? 'Assistant Trading' : 'Trading Assistant'}
            </p>
            <p className="text-xs text-gray-400">
              {!isPro
                ? (lang === 'ar' ? 'Pro فقط' : lang === 'fr' ? 'Pro uniquement' : 'Pro only')
                : isLimitReached
                ? (lang === 'ar' ? 'وصلت الحد اليومي' : lang === 'fr' ? 'Limite quotidienne atteinte' : 'Daily limit reached')
                : lang === 'ar' ? `${remaining} رسائل متبقية` : lang === 'fr' ? `${remaining} messages restants` : `${remaining} messages left`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Free user lock screen */}
      {!isPro ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto">
            <Bot className="w-8 h-8 text-teal-500" />
          </div>
          <p className="text-lg font-black text-gray-900">
            {lang === 'ar' ? 'مساعد AI للمحترفين' : lang === 'fr' ? 'Assistant AI Pro' : 'AI Assistant — Pro Only'}
          </p>
          <p className="text-sm text-gray-500 max-w-[200px]">
            {lang === 'ar'
              ? 'اشترك في Pro للحصول على مساعد تداول ذكي في كل صفحة'
              : lang === 'fr'
              ? 'Abonnez-vous à Pro pour un assistant IA sur chaque page'
              : 'Upgrade to Pro for an AI trading assistant on every page'}
          </p>
          <div className="space-y-2 w-full max-w-[200px]">
            {([
              { ar: '4 رسائل يومياً',   fr: '4 messages par jour',    en: '4 messages per day'       },
              { ar: 'سياق من صفقاتك',   fr: 'Contexte de vos trades', en: 'Context from your trades' },
              { ar: 'نصائح فورية',       fr: 'Conseils instantanés',   en: 'Instant coaching tips'    },
            ] as const).map(({ ar, fr, en }) => (
              <div key={en} className="flex items-center gap-2 text-sm text-teal-700">
                <span className="text-teal-500 font-bold flex-shrink-0">✓</span>
                <span>{lang === 'ar' ? ar : lang === 'fr' ? fr : en}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setIsOpen(false); navigate('/settings?tab=subscription'); }}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-2xl mt-2 transition-colors"
          >
            {lang === 'ar' ? 'ترقية إلى Pro' : lang === 'fr' ? 'Passer à Pro' : 'Upgrade to Pro'}
          </button>
        </div>

      ) : (
        <>
          {/* Chat messages area */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                <Bot className="w-10 h-10 text-teal-200" />
                <p className="text-sm text-gray-400">
                  {lang === 'ar'
                    ? 'مرحباً! اسألني عن صفقاتك أو أدائك'
                    : lang === 'fr'
                    ? 'Bonjour ! Posez-moi des questions sur vos trades'
                    : 'Hi! Ask me about your trades or performance'}
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={
                      msg.role === 'user'
                        ? 'bg-teal-500 text-white rounded-2xl rounded-ee-sm px-4 py-2.5 text-sm ms-auto max-w-[80%] w-fit'
                        : 'bg-gray-50 text-gray-900 rounded-2xl rounded-es-sm px-4 py-2.5 text-sm me-auto max-w-[80%] w-fit'
                    }>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-50 rounded-2xl rounded-es-sm me-auto w-fit">
                      <div className="flex gap-1 items-center px-4 py-3">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input or limit message */}
          {isLimitReached ? (
            <div className="p-4 text-center text-sm text-gray-400 border-t border-gray-100 flex-shrink-0">
              {lang === 'ar'
                ? 'وصلت الحد اليومي — تجدد غداً'
                : lang === 'fr'
                ? 'Limite atteinte — renouvellement demain'
                : 'Daily limit reached — resets tomorrow'}
            </div>
          ) : (
            <div className="p-4 border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-2 items-end bg-gray-50 rounded-2xl px-3 py-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={
                    lang === 'ar' ? 'اسأل عن صفقاتك...' :
                    lang === 'fr' ? 'Posez une question...' :
                    'Ask about your trades...'
                  }
                  maxLength={250}
                  rows={1}
                  className="flex-1 resize-none bg-transparent py-1.5 text-sm focus:outline-none min-h-[28px] text-gray-800 placeholder:text-gray-400"
                  style={{ maxHeight: '96px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="w-8 h-8 rounded-xl bg-teal-500 hover:bg-teal-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mb-0.5"
                >
                  {isLoading
                    ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                    : <SendHorizonal className="w-4 h-4 text-white" />
                  }
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <>
      {/* ── Floating button ── */}
      <div className="fixed bottom-20 end-4 z-50 md:bottom-8 md:end-6">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 rounded-2xl bg-teal-500 hover:bg-teal-600 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center active:scale-95"
        >
          <Bot className="w-6 h-6 text-white" />
          {messagesUsedToday > 0 && (
            <span className="absolute -top-1 -end-1 w-5 h-5 bg-teal-900 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {messagesUsedToday}
            </span>
          )}
        </button>
      </div>

      {/* ── MOBILE: iOS-style bottom sheet ── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />
      {/* Sheet */}
      <div className={`md:hidden fixed inset-x-0 bottom-0 z-50 h-[85vh] bg-white rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        {/* Drag handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
        {panelContent}
      </div>

      {/* ── DESKTOP: slide-in panel (bottom-right corner) ── */}
      <div className={`hidden md:flex fixed bottom-28 end-6 z-40 w-96 h-[600px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex-col transition-all duration-300 ease-out ${
        isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
      }`}>
        {panelContent}
      </div>
    </>
  );
}
