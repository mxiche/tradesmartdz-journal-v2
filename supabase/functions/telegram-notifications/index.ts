// ── SQL: Run in Supabase SQL Editor before deploying ────────────────────────
//
// ALTER TABLE user_preferences
// ADD COLUMN IF NOT EXISTS news_alerts_enabled boolean DEFAULT false,
// ADD COLUMN IF NOT EXISTS news_alert_currencies text[] DEFAULT ARRAY['USD','EUR','GBP'],
// ADD COLUMN IF NOT EXISTS news_alert_impact text[] DEFAULT ARRAY['High'],
// ADD COLUMN IF NOT EXISTS news_alert_minutes_before integer DEFAULT 15;
//
// CREATE TABLE IF NOT EXISTS sent_news_alerts (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id text NOT NULL,
//   event_key text NOT NULL,
//   sent_at timestamptz DEFAULT now(),
//   UNIQUE(user_id, event_key)
// );
//
// ── CRON JOBS: Run in Supabase SQL Editor ────────────────────────────────────
//
// SELECT cron.unschedule('daily-telegram-notification');
//
// -- Morning motivation 8:00 AM Algeria (7:00 UTC)
// SELECT cron.schedule('morning-motivation','0 7 * * *',$$
//   SELECT net.http_post(
//     url := 'https://vikqwycjqqoobteslbxp.supabase.co/functions/v1/telegram-notifications',
//     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE_KEY'),
//     body := '{"job":"morning_motivation"}'::jsonb
//   );$$);
//
// -- Trade reminder 8:00 PM Algeria (19:00 UTC)
// SELECT cron.schedule('trade-reminder','0 19 * * *',$$
//   SELECT net.http_post(
//     url := 'https://vikqwycjqqoobteslbxp.supabase.co/functions/v1/telegram-notifications',
//     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE_KEY'),
//     body := '{"job":"trade_reminder"}'::jsonb
//   );$$);
//
// -- Daily report 10:00 PM Algeria (21:00 UTC)
// SELECT cron.schedule('daily-report','0 21 * * *',$$
//   SELECT net.http_post(
//     url := 'https://vikqwycjqqoobteslbxp.supabase.co/functions/v1/telegram-notifications',
//     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE_KEY'),
//     body := '{"job":"daily_report"}'::jsonb
//   );$$);
//
// -- Weekly summary Saturday 00:00 Algeria (Friday 23:00 UTC)
// SELECT cron.schedule('weekly-summary','0 23 * * 5',$$
//   SELECT net.http_post(
//     url := 'https://vikqwycjqqoobteslbxp.supabase.co/functions/v1/telegram-notifications',
//     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE_KEY'),
//     body := '{"job":"weekly_summary"}'::jsonb
//   );$$);
//
// -- Monthly recap 1st of month 9:00 AM (8:00 UTC)
// SELECT cron.schedule('monthly-recap','0 8 1 * *',$$
//   SELECT net.http_post(
//     url := 'https://vikqwycjqqoobteslbxp.supabase.co/functions/v1/telegram-notifications',
//     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE_KEY'),
//     body := '{"job":"monthly_recap"}'::jsonb
//   );$$);
//
// -- News alerts every 15 minutes
// SELECT cron.schedule('news-alerts','*/15 * * * *',$$
//   SELECT net.http_post(
//     url := 'https://vikqwycjqqoobteslbxp.supabase.co/functions/v1/telegram-notifications',
//     headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer SERVICE_ROLE_KEY'),
//     body := '{"job":"news_alerts"}'::jsonb
//   );$$);

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
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getUserTrades(
  supabase: any,
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const { data } = await supabase
    .from('trades')
    .select(
      'profit, commission, symbol, close_time, ' +
      'setup_tag, session, emotion_tag, ' +
      'followed_rules, strategy_id'
    )
    .eq('user_id', userId)
    .gte('close_time', startDate.toISOString())
    .lt('close_time', endDate.toISOString());
  return data || [];
}

function netPnl(trade: any): number {
  return (trade.profit ?? 0) - (trade.commission ?? 0);
}

async function getUserAccount(supabase: any, userId: string) {
  const { data } = await supabase
    .from('mt5_accounts')
    .select('firm, account_name, account_size, starting_balance, balance, daily_loss_limit, max_drawdown_limit')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return data;
}

// ── Job 1: Morning Motivation (8:00 AM Algeria / 7:00 UTC) ───────────────────

async function runMorningMotivation(supabase: any, botToken: string, users: any[]) {
  const now = new Date();
  console.log(`[MORNING_MOTIVATION] Starting at ${now.toISOString()}`);
  console.log(`[MORNING_MOTIVATION] Found ${users.length} eligible users`);

  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(now);
  yesterdayEnd.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  console.log(`[MORNING_MOTIVATION] Date range: ${yesterdayStart.toISOString()} to ${yesterdayEnd.toISOString()}`);

  for (const user of users) {
    try {
      const yesterdayTrades = await getUserTrades(supabase, user.user_id, yesterdayStart, yesterdayEnd);
      console.log(`[MORNING_MOTIVATION] User ${user.user_id}: found ${yesterdayTrades.length} trades`);
      const weekTrades = await getUserTrades(supabase, user.user_id, weekStart, now);

      const yesterdayPnl = yesterdayTrades.reduce((s: number, t: any) => s + netPnl(t), 0);
      const weekPnl = weekTrades.reduce((s: number, t: any) => s + netPnl(t), 0);

      const { data: recentTrades } = await supabase
        .from('trades')
        .select('profit, commission, close_time, emotion_tag, followed_rules')
        .eq('user_id', user.user_id)
        .not('profit', 'is', null)
        .order('close_time', { ascending: false })
        .limit(30);

      let streak = 0;
      let streakType = '';
      if (recentTrades && recentTrades.length > 0) {
        const firstNet = netPnl(recentTrades[0]);
        streakType = firstNet >= 0 ? 'win' : 'loss';
        for (const t of recentTrades) {
          const n = netPnl(t);
          if (streakType === 'win' && n >= 0) streak++;
          else if (streakType === 'loss' && n < 0) streak++;
          else break;
        }
      }

      const streakEmoji = streakType === 'win' ? '🔥' : '❄️';
      const streakText = streak > 0
        ? `${streakEmoji} ${streak} ${streakType === 'win' ? 'أيام رابحة متتالية' : 'أيام خاسرة متتالية'}`
        : '📊 ابدأ سلسلتك اليوم';

      // Yesterday psychology summary
      const yesterdayRuled = yesterdayTrades.filter(
        (t: any) => t.followed_rules !== null,
      );
      const yesterdayFollowed = yesterdayRuled.filter(
        (t: any) => t.followed_rules === true,
      ).length;
      const yesterdayAdherence = yesterdayRuled.length > 0
        ? Math.round((yesterdayFollowed / yesterdayRuled.length) * 100)
        : null;

      const dangerEmotions = ['revenge', 'fomo', 'frustrated'];
      const yesterdayHadDanger = yesterdayTrades.some(
        (t: any) => dangerEmotions.includes(t.emotion_tag),
      );

      let morningTip = '';
      if (yesterdayHadDanger && yesterdayPnl < 0) {
        morningTip = '🧠 أمس تداولت بمشاعر عاطفية وخسرت. اليوم ركز على الانضباط أولاً.';
      } else if (yesterdayAdherence !== null && yesterdayAdherence < 50) {
        morningTip = '📋 اليوم التزم بخطتك 100%. الانضباط يبني الربح.';
      } else if (yesterdayAdherence !== null && yesterdayAdherence >= 80) {
        morningTip = '🏆 أمس التزمت بخطتك بشكل ممتاز! استمر على هذا النهج.';
      } else {
        const tips = [
          '💪 أنت قادر على تحقيق أهدافك اليوم!',
          '🎯 ركز على الإعداد الجيد وليس فقط الربح',
          '🧠 التريدر الناجح يتحكم في عواطفه أولاً',
          '📈 كل صفقة هي فرصة للتعلم والتطور',
          '⚡ انضباطك اليوم هو ربحك غداً',
        ];
        morningTip = tips[Math.floor(Math.random() * tips.length)];
      }

      const msg =
        `🌅 <b>صباح الخير!</b>\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `${yesterdayTrades.length > 0
          ? `📊 الأمس: <b>${yesterdayPnl >= 0 ? '+' : ''}$${yesterdayPnl.toFixed(2)}</b>`
          : '📊 لم تسجل صفقات أمس'}\n` +
        `📅 هذا الأسبوع: ${weekPnl >= 0 ? '+' : ''}$${weekPnl.toFixed(2)}\n` +
        `${streakText}\n` +
        (yesterdayAdherence !== null
          ? `${yesterdayAdherence >= 70 ? '✅' : '⚠️'} الالتزام بالخطة أمس: ${yesterdayAdherence}%\n`
          : '') +
        `\n${morningTip}\n\n` +
        `<i>سجّل صفقاتك اليوم على TradeSmartDz 📱</i>`;

      await sendMessage(botToken, user.telegram_chat_id, msg);
    } catch (err) {
      console.error(`Morning motivation error for ${user.user_id}:`, err);
    }
  }
}

// ── Job 2: Trade Reminder (8:00 PM Algeria / 19:00 UTC) ─────────────────────

async function runTradeReminder(supabase: any, botToken: string, users: any[]) {
  const now = new Date();
  console.log(`[TRADE_REMINDER] Starting at ${now.toISOString()}`);
  console.log(`[TRADE_REMINDER] Found ${users.length} eligible users`);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  console.log(`[TRADE_REMINDER] Date range: ${todayStart.toISOString()} to ${now.toISOString()}`);

  for (const user of users) {
    try {
      const todayTrades = await getUserTrades(supabase, user.user_id, todayStart, now);
      console.log(`[TRADE_REMINDER] User ${user.user_id}: found ${todayTrades.length} trades`);

      if (todayTrades.length === 0) {
        const msg =
          `📝 <b>تذكير: لم تسجل أي صفقة اليوم</b>\n\n` +
          `هل تداولت اليوم؟\n` +
          `لا تنسى توثيق صفقاتك على TradeSmartDz 📊\n\n` +
          `التوثيق اليومي هو مفتاح التطور المستمر 💡`;

        await sendMessage(botToken, user.telegram_chat_id, msg);
      }
    } catch (err) {
      console.error(`Trade reminder error for ${user.user_id}:`, err);
    }
  }
}

// ── Job 3: Daily Report (10:00 PM Algeria / 21:00 UTC) ──────────────────────

async function runDailyReport(supabase: any, botToken: string, users: any[]) {
  const now = new Date();
  console.log(`[DAILY_REPORT] Starting at ${now.toISOString()}`);
  console.log(`[DAILY_REPORT] Found ${users.length} eligible users`);

  const algeriaOffset = 60 * 60 * 1000;
  const nowAlgeria = new Date(now.getTime() + algeriaOffset);

  // Today in Algeria
  const todayAlgeria = new Date(nowAlgeria);
  todayAlgeria.setUTCHours(0, 0, 0, 0);

  // Convert to UTC for DB query
  const todayStart = new Date(todayAlgeria.getTime() - algeriaOffset);
  const todayEnd = new Date(
    todayAlgeria.getTime() - algeriaOffset + (24 * 60 * 60 * 1000) - 1
  );

  console.log(`[DAILY_REPORT] Date range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);

  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  for (const user of users) {
    try {
      const todayTrades = await getUserTrades(supabase, user.user_id, todayStart, todayEnd);
      console.log(`[DAILY_REPORT] User ${user.user_id}: found ${todayTrades.length} trades`);
      const monthTrades = await getUserTrades(supabase, user.user_id, monthStart, now);

      const todayPnl = todayTrades.reduce((s: number, t: any) => s + netPnl(t), 0);
      const todayWins = todayTrades.filter((t: any) => netPnl(t) > 0).length;
      const todayLosses = todayTrades.filter((t: any) => netPnl(t) < 0).length;
      const todayWinRate = todayTrades.length > 0
        ? Math.round((todayWins / todayTrades.length) * 100) : 0;

      const bestTrade = todayTrades.length > 0
        ? todayTrades.reduce((best: any, t: any) => netPnl(t) > netPnl(best) ? t : best)
        : null;

      const monthPnl = monthTrades.reduce((s: number, t: any) => s + netPnl(t), 0);
      const monthTradingDays = new Set(
        monthTrades
          .filter((t: any) => t.close_time)
          .map((t: any) => new Date(t.close_time).toDateString()),
      ).size;

      const { data: recentTrades } = await supabase
        .from('trades')
        .select('profit, commission, close_time, emotion_tag, followed_rules')
        .eq('user_id', user.user_id)
        .not('profit', 'is', null)
        .order('close_time', { ascending: false })
        .limit(30);

      let streak = 0;
      let streakType = '';
      if (recentTrades && recentTrades.length > 0) {
        const firstNet = netPnl(recentTrades[0]);
        streakType = firstNet >= 0 ? 'win' : 'loss';
        for (const t of recentTrades) {
          const n = netPnl(t);
          if (streakType === 'win' && n >= 0) streak++;
          else if (streakType === 'loss' && n < 0) streak++;
          else break;
        }
      }

      const account = await getUserAccount(supabase, user.user_id);
      let propFirmWarning = '';
      if (account && account.daily_loss_limit > 0) {
        const acctSize = account.account_size || account.starting_balance || 0;
        const dailyLossAmount = acctSize * (account.daily_loss_limit / 100);
        const todayLoss = Math.abs(Math.min(0, todayTrades.reduce((s: number, t: any) => s + netPnl(t), 0)));
        const pct = dailyLossAmount > 0 ? (todayLoss / dailyLossAmount) * 100 : 0;

        if (pct >= 70) {
          propFirmWarning = pct >= 90
            ? `\n\n🚨 <b>تحذير عاجل!</b> وصلت لـ ${pct.toFixed(0)}% من حد الخسارة اليومية!\nتوقف عن التداول فوراً.`
            : `\n\n⚠️ <b>تحذير:</b> استخدمت ${pct.toFixed(0)}% من حد الخسارة اليومية.\nكن حذراً غداً.`;
        }
      }

      // === EMOTION ANALYSIS ===
      const emotionMap: Record<string, string> = {
        disciplined: '🎯', confident: '💪', neutral: '😐',
        fearful: '😰', fomo: '⚡', bored: '😴',
        revenge: '🔥', frustrated: '😤',
      };

      const emotionCounts: Record<string, number> = {};
      todayTrades.forEach((t: any) => {
        if (t.emotion_tag) {
          emotionCounts[t.emotion_tag] = (emotionCounts[t.emotion_tag] || 0) + 1;
        }
      });
      const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];

      const rulesTagged = todayTrades.filter(
        (t: any) => t.followed_rules !== null && t.followed_rules !== undefined,
      );
      const rulesFollowed = rulesTagged.filter((t: any) => t.followed_rules === true).length;
      const adherenceRate = rulesTagged.length > 0
        ? Math.round((rulesFollowed / rulesTagged.length) * 100)
        : null;

      const pnlFollowed = todayTrades
        .filter((t: any) => t.followed_rules === true)
        .reduce((s: number, t: any) => s + netPnl(t), 0);
      const pnlBroken = todayTrades
        .filter((t: any) => t.followed_rules === false)
        .reduce((s: number, t: any) => s + netPnl(t), 0);

      const dangerEmotions = ['revenge', 'fomo', 'frustrated'];
      const hasDangerEmotion = todayTrades.some(
        (t: any) => dangerEmotions.includes(t.emotion_tag),
      );
      const dangerTradesPnl = todayTrades
        .filter((t: any) => dangerEmotions.includes(t.emotion_tag))
        .reduce((s: number, t: any) => s + netPnl(t), 0);

      const symbolPnl: Record<string, number> = {};
      todayTrades.forEach((t: any) => {
        symbolPnl[t.symbol] = (symbolPnl[t.symbol] || 0) + netPnl(t);
      });
      const bestSymbol = Object.entries(symbolPnl).sort((a, b) => b[1] - a[1])[0];

      if (todayTrades.length === 0) {
        const msg =
          `📊 <b>ملخصك اليومي</b>\n\n` +
          `لم تسجل أي صفقة اليوم.\n\n` +
          `📅 هذا الشهر: ${monthPnl >= 0 ? '+' : ''}$${monthPnl.toFixed(2)} (${monthTradingDays} أيام)\n\n` +
          `<i>TradeSmartDz 🎯</i>`;

        await sendMessage(botToken, user.telegram_chat_id, msg);
        continue;
      }

      const streakText = streak > 1
        ? (streakType === 'win'
          ? `🔥 ${streak} أيام رابحة متتالية!`
          : `❄️ ${streak} أيام خاسرة متتالية`)
        : '';

      let psychologyLine = '';
      if (topEmotion) {
        const emoji = emotionMap[topEmotion[0]] || '😐';
        psychologyLine = `\n${emoji} المشاعر السائدة: ${topEmotion[0]}`;
      }
      if (adherenceRate !== null) {
        psychologyLine += `\n${adherenceRate >= 70 ? '✅' : '⚠️'} الالتزام بالخطة: ${adherenceRate}%`;
      }
      if (hasDangerEmotion && dangerTradesPnl < 0) {
        psychologyLine += `\n🚨 الصفقات العاطفية كلّفتك $${Math.abs(dangerTradesPnl).toFixed(0)}`;
      } else if (hasDangerEmotion) {
        psychologyLine += `\n⚠️ انتبه: تداول بمشاعر عاطفية اليوم`;
      }

      let planLine = '';
      if (rulesTagged.length >= 2 && rulesFollowed > 0 && rulesTagged.length - rulesFollowed > 0) {
        planLine = `\n\n📋 <b>اتباع الخطة:</b>\n` +
          `✅ مع الخطة: ${pnlFollowed >= 0 ? '+' : ''}$${pnlFollowed.toFixed(0)}\n` +
          `❌ بدون الخطة: ${pnlBroken >= 0 ? '+' : ''}$${pnlBroken.toFixed(0)}`;
      }

      const msg =
        `📊 <b>ملخصك اليومي</b>\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `💰 الربح اليوم: <b>${todayPnl >= 0 ? '+' : ''}$${todayPnl.toFixed(2)}</b>\n` +
        `📈 الصفقات: ${todayTrades.length} (${todayWins} ربح / ${todayLosses} خسارة)\n` +
        `🎯 نسبة الفوز: ${todayWinRate}%\n` +
        (bestTrade
          ? `⭐ أفضل صفقة: ${bestTrade.symbol} ${netPnl(bestTrade) >= 0 ? '+' : ''}$${netPnl(bestTrade).toFixed(2)}\n`
          : '') +
        (bestSymbol && symbolPnl[bestSymbol[0]] > 0
          ? `📊 أفضل رمز: ${bestSymbol[0]}\n`
          : '') +
        (streakText ? `${streakText}\n` : '') +
        psychologyLine +
        planLine +
        `\n\n📅 <b>هذا الشهر حتى الآن:</b>\n` +
        `💵 ${monthPnl >= 0 ? '+' : ''}$${monthPnl.toFixed(2)} | ${monthTradingDays} أيام تداول` +
        propFirmWarning +
        `\n\n<i>TradeSmartDz 🎯</i>`;

      await sendMessage(botToken, user.telegram_chat_id, msg);
    } catch (err) {
      console.error(`Daily report error for ${user.user_id}:`, err);
    }
  }
}

// ── Job 4: Weekly Summary (Saturday 00:00 Algeria / Friday 23:00 UTC) ────────

async function runWeeklySummary(supabase: any, botToken: string, users: any[]) {
  const now = new Date();
  console.log(`[WEEKLY_SUMMARY] Starting at ${now.toISOString()}`);
  console.log(`[WEEKLY_SUMMARY] Found ${users.length} eligible users`);

  // Algeria is UTC+1
  // Cron fires Friday 23:00 UTC = Saturday 00:00 Algeria
  // We want: this past week = Monday to Friday Algeria time

  const algeriaOffset = 60 * 60 * 1000; // 1 hour in ms
  const nowAlgeria = new Date(now.getTime() + algeriaOffset);

  // Day of week in Algeria (0=Sun, 1=Mon ... 6=Sat)
  const dayOfWeek = nowAlgeria.getUTCDay();

  // Days since Monday (if today is Saturday=6, days since Monday=5)
  const daysSinceMonday = dayOfWeek === 0
    ? 6  // Sunday
    : dayOfWeek - 1;

  // Monday 00:00:00 Algeria = Monday 23:00:00 UTC (prev day)
  const mondayAlgeria = new Date(nowAlgeria);
  mondayAlgeria.setUTCDate(nowAlgeria.getUTCDate() - daysSinceMonday);
  mondayAlgeria.setUTCHours(0, 0, 0, 0);

  // Convert back to UTC for DB query
  const weekStart = new Date(mondayAlgeria.getTime() - algeriaOffset);

  // Friday 23:59:59 Algeria = Friday 22:59:59 UTC
  const fridayAlgeria = new Date(mondayAlgeria);
  fridayAlgeria.setUTCDate(mondayAlgeria.getUTCDate() + 4);
  fridayAlgeria.setUTCHours(23, 59, 59, 999);

  const weekEnd = new Date(fridayAlgeria.getTime() - algeriaOffset);

  console.log(`[WEEKLY_SUMMARY] Date range: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

  for (const user of users) {
    try {
      const trades = await getUserTrades(supabase, user.user_id, weekStart, weekEnd);
      console.log(`[WEEKLY_SUMMARY] User ${user.user_id}: found ${trades.length} trades`);

      if (trades.length === 0) {
        const msg =
          `📅 <b>ملخص الأسبوع الماضي</b>\n\n` +
          `لم تسجل أي صفقات الأسبوع الماضي.\n\n` +
          `ابدأ هذا الأسبوع بقوة! 💪\n\n` +
          `<i>TradeSmartDz 🎯</i>`;
        await sendMessage(botToken, user.telegram_chat_id, msg);
        continue;
      }

      const totalPnl = trades.reduce((s: number, t: any) => s + netPnl(t), 0);
      const wins = trades.filter((t: any) => netPnl(t) > 0);
      const losses = trades.filter((t: any) => netPnl(t) < 0);
      const winRate = Math.round((wins.length / trades.length) * 100);

      const byDay: Record<string, number> = {};
      trades.forEach((t: any) => {
        if (!t.close_time) return;
        const d = new Date(t.close_time).toDateString();
        byDay[d] = (byDay[d] || 0) + netPnl(t);
      });
      const days = Object.entries(byDay);
      const bestDay = [...days].sort((a, b) => b[1] - a[1])[0];
      const worstDay = [...days].sort((a, b) => a[1] - b[1])[0];
      const winningDays = days.filter(d => d[1] > 0).length;
      const losingDays = days.filter(d => d[1] < 0).length;

      const bySymbol: Record<string, number> = {};
      trades.forEach((t: any) => {
        if (!t.symbol) return;
        bySymbol[t.symbol] = (bySymbol[t.symbol] || 0) + netPnl(t);
      });
      const bestSymbol = Object.entries(bySymbol).sort((a, b) => b[1] - a[1])[0];

      const msg =
        `📅 <b>ملخص الأسبوع الماضي</b>\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `💰 صافي الربح: <b>${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</b>\n` +
        `📊 الصفقات: ${trades.length} | نسبة الفوز: ${winRate}%\n` +
        `✅ أيام رابحة: ${winningDays} | ❌ أيام خاسرة: ${losingDays}\n\n` +
        (bestDay
          ? `🏆 أفضل يوم: ${bestDay[0].split(' ')[0]} +$${bestDay[1].toFixed(2)}\n`
          : '') +
        (worstDay && worstDay[1] < 0
          ? `📉 أسوأ يوم: ${worstDay[0].split(' ')[0]} $${worstDay[1].toFixed(2)}\n`
          : '') +
        (bestSymbol
          ? `⭐ أفضل رمز: ${bestSymbol[0]} +$${bestSymbol[1].toFixed(2)}\n`
          : '') +
        `\n💪 استمر في التطور هذا الأسبوع!\n\n` +
        `<i>TradeSmartDz 🎯</i>`;

      await sendMessage(botToken, user.telegram_chat_id, msg);
    } catch (err) {
      console.error(`Weekly summary error for ${user.user_id}:`, err);
    }
  }
}

// ── Job 5: Monthly Recap (1st of month 9:00 AM / 8:00 UTC) ─────────────────

async function runMonthlyRecap(supabase: any, botToken: string, users: any[]) {
  const now = new Date();
  console.log(`[MONTHLY_RECAP] Starting at ${now.toISOString()}`);
  console.log(`[MONTHLY_RECAP] Found ${users.length} eligible users`);

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  console.log(`[MONTHLY_RECAP] Date range: ${lastMonthStart.toISOString()} to ${lastMonthEnd.toISOString()}`);

  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];
  const monthName = monthNames[lastMonthStart.getMonth()];

  for (const user of users) {
    try {
      const trades = await getUserTrades(supabase, user.user_id, lastMonthStart, lastMonthEnd);
      console.log(`[MONTHLY_RECAP] User ${user.user_id}: found ${trades.length} trades`);

      if (trades.length === 0) {
        const msg =
          `🏆 <b>ملخص شهر ${monthName}</b>\n\n` +
          `لم تسجل أي صفقات هذا الشهر.\n\n` +
          `ابدأ الشهر الجديد بنشاط! 💪\n\n` +
          `<i>TradeSmartDz 🎯</i>`;
        await sendMessage(botToken, user.telegram_chat_id, msg);
        continue;
      }

      const totalPnl = trades.reduce((s: number, t: any) => s + netPnl(t), 0);
      const wins = trades.filter((t: any) => netPnl(t) > 0);
      const winRate = Math.round((wins.length / trades.length) * 100);
      const tradingDays = new Set(
        trades.filter((t: any) => t.close_time).map((t: any) => new Date(t.close_time).toDateString()),
      ).size;
      const bestTrade = trades.reduce((best: any, t: any) => netPnl(t) > netPnl(best) ? t : best);
      const grossProfit = wins.reduce((s: number, t: any) => s + netPnl(t), 0);
      const grossLoss = Math.abs(
        trades.filter((t: any) => netPnl(t) < 0).reduce((s: number, t: any) => s + netPnl(t), 0),
      );
      const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞';

      const msg =
        `🏆 <b>ملخص شهر ${monthName}</b>\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `💰 صافي الربح: <b>${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</b>\n` +
        `📊 ${trades.length} صفقة | نسبة الفوز: ${winRate}%\n` +
        `📅 أيام التداول: ${tradingDays}\n` +
        `📈 معامل الربح: ${profitFactor}\n` +
        (bestTrade
          ? `⭐ أفضل صفقة: ${bestTrade.symbol} +$${netPnl(bestTrade).toFixed(2)}\n`
          : '') +
        `\n🎓 شهادتك جاهزة للتحميل!\n` +
        `افتح التطبيق على tradesmartdz.com\n\n` +
        `<i>TradeSmartDz 🎯</i>`;

      await sendMessage(botToken, user.telegram_chat_id, msg);
    } catch (err) {
      console.error(`Monthly recap error for ${user.user_id}:`, err);
    }
  }
}

// ── Job 6: News Alerts (every 15 minutes) ───────────────────────────────────

async function runNewsAlerts(supabase: any, botToken: string, users: any[]) {
  console.log(`[NEWS_ALERTS] Starting at ${new Date().toISOString()}`);
  console.log(`[NEWS_ALERTS] Found ${users.length} eligible users`);
  let events: any[] = [];
  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
    events = await res.json();
  } catch (err) {
    console.error('Failed to fetch forex calendar:', err);
    return;
  }

  const now = new Date();
  const alertWindowEnd = new Date(now.getTime() + 20 * 60 * 1000);
  const alertWindowStart = new Date(now.getTime() + 10 * 60 * 1000);
  console.log(`[NEWS_ALERTS] Date range: ${alertWindowStart.toISOString()} to ${alertWindowEnd.toISOString()}`);

  const upcomingEvents = events.filter((event: any) => {
    const eventTime = new Date(event.date);
    return eventTime >= alertWindowStart &&
      eventTime <= alertWindowEnd &&
      event.impact !== 'Holiday';
  });

  if (upcomingEvents.length === 0) {
    console.log('No upcoming events in window');
    return;
  }

  console.log(`Found ${upcomingEvents.length} upcoming events`);

  const flagMap: Record<string, string> = {
    USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧',
    JPY: '🇯🇵', CHF: '🇨🇭', AUD: '🇦🇺',
    CAD: '🇨🇦', NZD: '🇳🇿', CNY: '🇨🇳',
  };

  for (const user of users) {
    if (!user.news_alerts_enabled) continue;

    const userCurrencies = user.news_alert_currencies || ['USD', 'EUR', 'GBP'];
    const userImpact = user.news_alert_impact || ['High'];

    for (const event of upcomingEvents) {
      const currencyMatch = userCurrencies.includes(event.country);
      const impactMatch = userImpact.includes(event.impact);
      if (!currencyMatch || !impactMatch) continue;

      const eventKey = `${event.country}_${event.title}_${event.date}`;
      const { data: alreadySent } = await supabase
        .from('sent_news_alerts')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('event_key', eventKey)
        .maybeSingle();

      if (alreadySent) continue;

      const impactEmoji = event.impact === 'High' ? '🔴' : event.impact === 'Medium' ? '🟡' : '🟢';
      const flag = flagMap[event.country] || '🌍';

      const eventTime = new Date(event.date);
      const timeStr = eventTime.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
      const minutesLeft = Math.round((eventTime.getTime() - now.getTime()) / 60000);

      const msg =
        `${impactEmoji} <b>تنبيه خبر اقتصادي</b>\n\n` +
        `${flag} <b>${event.title}</b>\n` +
        `العملة: ${event.country}\n` +
        `التأثير: ${event.impact === 'High' ? 'عالي 🔴' : event.impact === 'Medium' ? 'متوسط 🟡' : 'منخفض 🟢'}\n` +
        `⏰ في ${minutesLeft} دقيقة (${timeStr})\n` +
        (event.forecast ? `📊 التوقعات: ${event.forecast}\n` : '') +
        (event.previous ? `📌 السابق: ${event.previous}\n` : '') +
        `\n⚡ <b>توقع تحركات حادة في السوق</b>\n` +
        `احرص على وضع وقف خسارة محكم 🛡️\n\n` +
        `<i>TradeSmartDz 🎯</i>`;

      try {
        await sendMessage(botToken, user.telegram_chat_id, msg);
        await supabase
          .from('sent_news_alerts')
          .insert({ user_id: user.user_id, event_key: eventKey });
      } catch (err) {
        console.error(`News alert send error for ${user.user_id}:`, err);
      }
    }
  }
}

// ── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('TG_SERVICE_KEY') || '';
    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
    const OWNER_CHAT_ID = Deno.env.get('OWNER_TELEGRAM_CHAT_ID') ?? '';

    console.log('ENV CHECK:', {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceKey: !!SERVICE_KEY,
      hasBotToken: !!BOT_TOKEN,
    });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let body: any = {};
    try { body = await req.json(); } catch { /* no-op */ }

    // Handle payment_request from frontend (SettingsPage.tsx)
    if (body?.type === 'payment_request') {
      if (OWNER_CHAT_ID) {
        const trialNote = body.isTrial ? '\n⚡ هذا المستخدم على التجربة المجانية حالياً' : '';
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

    const job = body.job;
    console.log('Running job:', job);

    if (!job) {
      console.log('No job specified — ignoring request');
      return new Response(
        JSON.stringify({ error: 'No job specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get all users with telegram connected
    const { data: userPrefs } = await supabase
      .from('user_preferences')
      .select('user_id, telegram_chat_id, news_alerts_enabled, news_alert_currencies, news_alert_impact, news_alert_minutes_before')
      .not('telegram_chat_id', 'is', null);

    if (!userPrefs || userPrefs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter only active/trial subscribers — pick best row per user
    const eligibleUsers: any[] = [];
    for (const pref of userPrefs) {
      // Priority: active > trial, latest expires_at first
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('status, plan, expires_at')
        .eq('user_id', pref.user_id)
        .in('status', ['active', 'trial'])
        .order('status', { ascending: true }) // 'active' sorts before 'trial'
        .order('expires_at', { ascending: false })
        .limit(1);

      const sub = subs?.[0];

      if (!sub) {
        console.log(`User ${pref.user_id} has no active/trial sub — skipping`);
        continue;
      }

      if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
        console.log(`User ${pref.user_id} subscription expired — skipping`);
        continue;
      }

      console.log(`User ${pref.user_id} eligible — status: ${sub.status}`);
      eligibleUsers.push({ ...pref, subscription: sub });
    }

    console.log(`Eligible users: ${eligibleUsers.length}`);

    if (job === 'morning_motivation') {
      await runMorningMotivation(supabase, BOT_TOKEN, eligibleUsers);
    } else if (job === 'trade_reminder') {
      await runTradeReminder(supabase, BOT_TOKEN, eligibleUsers);
    } else if (job === 'daily_report') {
      await runDailyReport(supabase, BOT_TOKEN, eligibleUsers);
    } else if (job === 'weekly_summary') {
      await runWeeklySummary(supabase, BOT_TOKEN, eligibleUsers);
    } else if (job === 'monthly_recap') {
      await runMonthlyRecap(supabase, BOT_TOKEN, eligibleUsers);
    } else if (job === 'news_alerts') {
      await runNewsAlerts(supabase, BOT_TOKEN, eligibleUsers);
    }

    return new Response(JSON.stringify({ ok: true, job }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('FATAL ERROR:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
