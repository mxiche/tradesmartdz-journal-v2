import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('TG_SERVICE_KEY')!;
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function sendMessage(chatId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function buildSummary(
  lang: string,
  total: number,
  wins: number,
  losses: number,
  winRate: number,
  pnl: number,
): string {
  const pnlStr = (pnl >= 0 ? '+' : '') + pnl.toFixed(2);

  if (lang === 'ar') {
    return `📊 ملخص اليوم\n\nالصفقات: ${total} | الرابحة: ${wins} | الخاسرة: ${losses}\nنسبة الربح: ${winRate}%\nالربح والخسارة: ${pnlStr}$\n\nTradeSmartDz 🎯`;
  }
  if (lang === 'fr') {
    return `📊 Résumé du jour\n\nTrades: ${total} | Gagnants: ${wins} | Perdants: ${losses}\nTaux: ${winRate}%\nPnL: ${pnlStr}$\n\nTradeSmartDz 🎯`;
  }
  return `📊 Daily Summary\n\nTrades: ${total} | Wins: ${wins} | Losses: ${losses}\nWin Rate: ${winRate}%\nPnL: ${pnlStr}$\n\nTradeSmartDz 🎯`;
}

async function runNotifications(): Promise<{ sent: number; total_users: number; message?: string }> {
  // 1. Fetch all users with a telegram_chat_id
  const { data: prefs, error: prefsError } = await supabase
    .from('user_preferences')
    .select('user_id, telegram_chat_id, language')
    .not('telegram_chat_id', 'is', null);

  if (prefsError) throw prefsError;
  if (!prefs || prefs.length === 0) {
    return { sent: 0, total_users: 0, message: 'No users with Telegram connected' };
  }

  // 2. Build today's date range (UTC midnight to midnight)
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  let sent = 0;

  // 3. For each user, compute today's stats and send summary
  for (const pref of prefs) {
    const { data: trades } = await supabase
      .from('trades')
      .select('profit')
      .eq('user_id', pref.user_id)
      .gte('close_time', todayStart.toISOString())
      .lt('close_time', todayEnd.toISOString());

    // Skip users with no trades today
    if (!trades || trades.length === 0) continue;

    const total = trades.length;
    const wins = trades.filter(t => (t.profit ?? 0) > 0).length;
    const losses = trades.filter(t => (t.profit ?? 0) < 0).length;
    const pnl = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
    const winRate = Math.round((wins / total) * 100);

    const lang = pref.language ?? 'en';
    const text = buildSummary(lang, total, wins, losses, winRate, pnl);

    await sendMessage(pref.telegram_chat_id, text);
    sent++;
  }

  return { sent, total_users: prefs.length };
}

// Handle both GET (manual test) and POST (cron trigger)
Deno.serve(async (req) => {
  try {
    const result = await runNotifications();
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
