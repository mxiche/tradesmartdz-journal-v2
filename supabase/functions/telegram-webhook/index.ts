/**
 * telegram-webhook — Supabase Edge Function
 *
 * Registered as the Telegram Bot webhook endpoint.
 * Set with:
 *   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<SUPABASE_URL>/functions/v1/telegram-webhook
 *
 * Behaviour:
 *  - Photo message → forward to owner (1873113234) + notify owner with sender info; NO auto-reply
 *  - Text / /start / any other message → send Arabic auto-reply to sender
 */

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const OWNER_CHAT_ID = Deno.env.get('OWNER_TELEGRAM_CHAT_ID')!; // 1873113234

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId: string | number, text: string): Promise<void> {
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function forwardMessage(fromChatId: string | number, messageId: number): Promise<void> {
  await fetch(`${TG_API}/forwardMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: OWNER_CHAT_ID,
      from_chat_id: fromChatId,
      message_id: messageId,
    }),
  });
}

Deno.serve(async (req) => {
  try {
    const update = await req.json();
    const message = update?.message;

    if (!message) {
      return new Response('ok', { status: 200 });
    }

    const chatId: string | number = message.chat?.id;
    const messageId: number = message.message_id;
    const firstName: string = message.from?.first_name ?? 'مجهول';

    // Photo → forward to owner + notify; skip auto-reply
    if (message.photo && message.photo.length > 0) {
      await forwardMessage(chatId, messageId);
      await sendMessage(
        OWNER_CHAT_ID,
        `📸 إثبات دفع جديد!\nمن: ${firstName}\nID: ${chatId}`,
      );
      return new Response('ok', { status: 200 });
    }

    // All other messages (text, /start, stickers, etc.) → Arabic auto-reply
    const autoReply =
      `مرحباً بك في TradeSmartDz 👋\n\n` +
      `لتفعيل اشتراكك Pro، يرجى إرسال صورة إثبات الدفع هنا.\n\n` +
      `سيتم مراجعة طلبك وتفعيل الاشتراك خلال 24 ساعة كحد أقصى. ✅\n\n` +
      `للاستفسار: tradesmartdz2@gmail.com`;

    await sendMessage(chatId, autoReply);

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('telegram-webhook error:', err);
    // Always return 200 to Telegram to avoid repeated delivery
    return new Response('ok', { status: 200 });
  }
});
