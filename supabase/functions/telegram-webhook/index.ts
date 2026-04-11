/**
 * telegram-webhook — Supabase Edge Function
 *
 * Registered as the Telegram Bot webhook endpoint.
 * Set with:
 *   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<SUPABASE_URL>/functions/v1/telegram-webhook
 *
 * Behaviour:
 *  - Any message containing a photo → forward photo to OWNER_CHAT_ID with caption
 *  - Every message → send Arabic auto-reply to the sender
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

async function sendCaption(fromChatId: string | number, fromUsername: string | undefined): Promise<void> {
  const label = fromUsername ? `@${fromUsername}` : String(fromChatId);
  const caption =
    `📸 صورة جديدة من المستخدم\n` +
    `👤 ${label}\n` +
    `🆔 Chat ID: ${fromChatId}`;
  await sendMessage(OWNER_CHAT_ID, caption);
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
    const username: string | undefined = message.from?.username;

    // 1. If the message contains a photo, forward it to the owner
    if (message.photo && message.photo.length > 0) {
      await forwardMessage(chatId, messageId);
      await sendCaption(chatId, username);
    }

    // 2. Send Arabic auto-reply to every message sender
    const autoReply =
      `مرحباً! 👋\n\n` +
      `شكراً على تواصلك مع <b>TradeSmartDz</b>.\n` +
      `لقد استلمنا رسالتك وسنرد عليك في أقرب وقت ممكن إن شاء الله.\n\n` +
      `إذا كنت ترسل إثبات الدفع، سيتم مراجعته وتفعيل حسابك خلال 24 ساعة. ⏳\n\n` +
      `TradeSmartDz 🎯`;

    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: autoReply,
        parse_mode: 'HTML',
      }),
    });

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('telegram-webhook error:', err);
    // Always return 200 to Telegram to avoid repeated delivery
    return new Response('ok', { status: 200 });
  }
});
