import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

async function sendMessage(botToken: string, chatId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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

// Handle both GET (cron trigger) and POST (payment_request or manual)
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Log env var availability (not values) for debugging
    const hasSupabaseUrl = !!Deno.env.get('SUPABASE_URL');
    const hasServiceKey = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || !!Deno.env.get('TG_SERVICE_KEY');
    const hasBotToken = !!Deno.env.get('TELEGRAM_BOT_TOKEN');
    console.log('ENV CHECK:', { hasSupabaseUrl, hasServiceKey, hasBotToken });

    // Resolve env vars inside handler so missing vars don't crash at module load
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('TG_SERVICE_KEY') || '';
    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
    const OWNER_CHAT_ID = Deno.env.get('OWNER_TELEGRAM_CHAT_ID') ?? '';

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check for payment_request notification from frontend
    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (body?.type === 'payment_request') {
        if (OWNER_CHAT_ID) {
          const trialNote = body.isTrial
            ? '\n⚡ هذا المستخدم على التجربة المجانية حالياً'
            : '';
          const message =
            `💎 New Pro Payment Request!\n\n` +
            `👤 ${body.userEmail}\n` +
            `🆔 User ID: ${body.userId}\n` +
            `💳 Method: ${body.paymentMethod === 'baridimob' ? 'BaridiMob' : 'USDT'}\n` +
            `💰 Amount: ${body.amount}\n` +
            `📋 Reference: ${body.reference}` +
            trialNote +
            `\n\n➡️ Activate in Supabase → subscriptions table`;
          await sendMessage(BOT_TOKEN, OWNER_CHAT_ID, message);
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Step 1: Get all users with telegram_chat_id
    const { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('user_id, telegram_chat_id, language')
      .not('telegram_chat_id', 'is', null);

    if (prefsError) throw prefsError;
    if (!prefs || prefs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, total_users: 0, message: 'No users with Telegram connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Build today's date range (UTC midnight to midnight)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);

    let sent = 0;
    let total_users = 0;

    for (const pref of prefs) {
      // Step 2: Check if user has an active or trial subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan, status, expires_at')
        .eq('user_id', pref.user_id)
        .in('status', ['active', 'trial'])
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!sub) continue;
      total_users++;

      // Step 3: Fetch today's trades and send summary
      const { data: trades } = await supabase
        .from('trades')
        .select('profit')
        .eq('user_id', pref.user_id)
        .gte('close_time', todayStart.toISOString())
        .lt('close_time', todayEnd.toISOString());

      if (!trades || trades.length === 0) continue;

      const total = trades.length;
      const wins = trades.filter(t => (t.profit ?? 0) > 0).length;
      const losses = trades.filter(t => (t.profit ?? 0) < 0).length;
      const pnl = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
      const winRate = Math.round((wins / total) * 100);

      const lang = pref.language ?? 'en';
      const text = buildSummary(lang, total, wins, losses, winRate, pnl);

      await sendMessage(BOT_TOKEN, pref.telegram_chat_id, text);
      sent++;
    }

    return new Response(JSON.stringify({ sent, total_users }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('FATAL ERROR:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
