/**
 * telegram-webhook — Supabase Edge Function
 *
 * Registered as the Telegram Bot webhook endpoint.
 * Set with:
 *   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<SUPABASE_URL>/functions/v1/telegram-webhook
 *
 * Behaviour:
 *  - /start <uuid>   → save telegram_chat_id to user_preferences, confirm to user
 *  - /start (no UUID) → generic welcome message
 *  - Photo message   → forward to owner + confirm receipt to user
 *  - Any other text  → Arabic auto-reply with instructions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('TG_SERVICE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const ok = () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function sendMessage(chatId: string | number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const message = body.message;

    if (!message) return ok();

    const chatId = message.chat.id.toString();
    const text: string = message.text || '';
    const firstName: string = message.from?.first_name || '';

    // ── CASE 1: /start command ──────────────────────────────────────────────
    if (text.startsWith('/start')) {
      const parts = text.trim().split(' ');
      const payload = parts[1] || '';

      // Payment proof flow — payload starts with 'payment_'
      if (payload.startsWith('payment_')) {
        await sendMessage(
          chatId,
          `📸 لإتمام عملية الاشتراك Pro\n\n` +
          `يرجى إرسال صورة إثبات الدفع هنا مباشرة.\n\n` +
          `تأكد أن الصورة تظهر:\n` +
          `✓ المبلغ المحوّل\n` +
          `✓ التاريخ والوقت\n` +
          `✓ رقم العملية أو المرجع\n\n` +
          `سيتم مراجعة طلبك وتفعيل حسابك خلال 24 ساعة. ✅\n\n` +
          `للاستفسار: tradesmartdz2@gmail.com`
        );
        return ok();
      }

      // Account connection flow — payload is the user UUID
      const userId = payload;
      if (userId && userId.length > 20) {
        const { error } = await supabase
          .from('user_preferences')
          .upsert(
            { user_id: userId, telegram_chat_id: chatId },
            { onConflict: 'user_id' }
          );

        if (!error) {
          await sendMessage(
            chatId,
            `✅ تم ربط حسابك بنجاح يا ${firstName}!\n\n` +
            `مرحباً بك في TradeSmartDz 🎉\n\n` +
            `ستصلك الآن إشعارات يومية بملخص صفقاتك ` +
            `كل يوم في الساعة 22:00.\n\n` +
            `يمكنك الآن العودة إلى التطبيق ✨`
          );
        } else {
          await sendMessage(
            chatId,
            `❌ حدث خطأ في ربط الحساب.\n` +
            `يرجى المحاولة مرة أخرى من التطبيق.\n\n` +
            `للمساعدة: tradesmartdz2@gmail.com`
          );
        }
      } else {
        // /start with no payload — generic welcome
        await sendMessage(
          chatId,
          `مرحباً بك في TradeSmartDz 👋\n\n` +
          `لربط حسابك، يرجى الضغط على زر "ربط Telegram" ` +
          `داخل التطبيق.\n\n` +
          `للمساعدة: tradesmartdz2@gmail.com`
        );
      }

      return ok();
    }

    // ── CASE 2: Photo message → forward to owner ────────────────────────────
    if (message.photo && message.photo.length > 0) {
      const OWNER_CHAT_ID = Deno.env.get('OWNER_TELEGRAM_CHAT_ID') || '1873113234';

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/forwardMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: OWNER_CHAT_ID,
          from_chat_id: message.chat.id,
          message_id: message.message_id,
        }),
      });

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: OWNER_CHAT_ID,
          text: `📸 إثبات دفع جديد!\nمن: ${firstName}\nTelegram ID: ${chatId}`,
        }),
      });

      // Confirm receipt to user
      await sendMessage(
        chatId,
        `✅ تم استلام صورة الإثبات!\n\n` +
        `سيتم مراجعة دفعتك وتفعيل حسابك خلال 24 ساعة. ⏳\n\n` +
        `سنتواصل معك هنا فور التفعيل.\n\n` +
        `للاستفسار: tradesmartdz2@gmail.com`
      );

      return ok();
    }

    // ── CASE 3: Any other message → auto reply ──────────────────────────────
    await sendMessage(
      chatId,
      `مرحباً بك في TradeSmartDz 👋\n\n` +
      `إذا كنت تريد إرسال إثبات الدفع، ` +
      `يرجى إرسال الصورة هنا مباشرة.\n\n` +
      `للاستفسار: tradesmartdz2@gmail.com`
    );

    return ok();
  } catch (err) {
    console.error('telegram-webhook error:', err);
    // Always return 200 to Telegram to avoid repeated delivery
    return ok();
  }
});
