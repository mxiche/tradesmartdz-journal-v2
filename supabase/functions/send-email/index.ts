/**
 * send-email — Supabase Edge Function
 *
 * Handles two event types:
 *
 *  1. payment_confirmation  — triggered from frontend after subscription insert
 *     Body: { type, userEmail, paymentMethod, amount }
 *
 *  2. pro_activated          — triggered by Postgres trigger on subscriptions table
 *     when status changes to 'active'.
 *
 * ─── Postgres trigger setup ────────────────────────────────────────────────
 *
 * Enable pg_net extension (once):
 *   CREATE EXTENSION IF NOT EXISTS pg_net;
 *
 * Function:
 *   CREATE OR REPLACE FUNCTION notify_pro_activated()
 *   RETURNS trigger LANGUAGE plpgsql AS $$
 *   DECLARE
 *     user_email text;
 *   BEGIN
 *     -- Only fire when status transitions to 'active'
 *     IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
 *       SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
 *       PERFORM net.http_post(
 *         url     := current_setting('app.supabase_url') || '/functions/v1/send-email',
 *         headers := jsonb_build_object(
 *           'Content-Type',  'application/json',
 *           'Authorization', 'Bearer ' || current_setting('app.service_role_key')
 *         ),
 *         body    := jsonb_build_object(
 *           'type',          'pro_activated',
 *           'userEmail',     user_email,
 *           'paymentMethod', NEW.payment_method,
 *           'amount',        NEW.amount
 *         )
 *       );
 *     END IF;
 *     RETURN NEW;
 *   END;
 *   $$;
 *
 * Trigger:
 *   CREATE TRIGGER trg_notify_pro_activated
 *   AFTER UPDATE ON subscriptions
 *   FOR EACH ROW EXECUTE FUNCTION notify_pro_activated();
 *
 * Set app settings (run once per environment):
 *   ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
 *   ALTER DATABASE postgres SET app.service_role_key = '<service-role-key>';
 *
 * ───────────────────────────────────────────────────────────────────────────
 */

import { Resend } from 'npm:resend';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = 'TradeSmartDz <noreply@neuroport.xyz>';
const resend = new Resend(RESEND_API_KEY);

// ── HTML email builders ────────────────────────────────────────────────────

function buildPaymentConfirmationEmail(userEmail: string, paymentMethod: string, amount: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تأكيد طلب الدفع</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#14b8a6,#0d9488);padding:32px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:40px;">📋</p>
              <h1 style="margin:12px 0 0;color:#fff;font-size:22px;font-weight:800;">تم استلام طلبك</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:#e5e7eb;font-size:15px;line-height:1.7;margin:0 0 24px;">
                مرحباً، شكراً لك على اشتراكك في <strong style="color:#14b8a6;">TradeSmartDz Pro</strong>.
                لقد استلمنا طلب الدفع الخاص بك وسنقوم بالتحقق منه في أقرب وقت ممكن.
              </p>

              <!-- Summary box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;border-radius:12px;margin-bottom:24px;">
                <tr><td style="padding:20px;">
                  <p style="margin:0 0 12px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">ملخص الطلب</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">الحساب</td>
                      <td style="color:#f3f4f6;font-size:14px;font-weight:600;text-align:left;">${userEmail}</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">الخطة</td>
                      <td style="color:#14b8a6;font-size:14px;font-weight:800;text-align:left;">Pro ⭐</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">طريقة الدفع</td>
                      <td style="color:#f3f4f6;font-size:14px;font-weight:600;text-align:left;">${paymentMethod === 'baridimob' ? 'BaridiMob' : 'USDT'}</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">المبلغ</td>
                      <td style="color:#f3f4f6;font-size:14px;font-weight:600;text-align:left;">${amount}</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">الحالة</td>
                      <td style="color:#f59e0b;font-size:14px;font-weight:600;text-align:left;">⏳ قيد التحقق</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <p style="color:#e5e7eb;font-size:14px;line-height:1.7;margin:0 0 24px;">
                سيتم تفعيل حسابك خلال <strong>24 ساعة</strong> وستصلك رسالة تأكيد بالبريد الإلكتروني.
                للمتابعة، يمكنك التواصل معنا عبر Telegram.
              </p>

              <!-- Telegram CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 24px;">
                    <a href="https://t.me/tradesmartdzz"
                       style="display:inline-block;background:#229ED9;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">
                      📸 أرسل صورة إثبات الدفع على Telegram
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
                للمساعدة: <a href="mailto:tradesmartdz2@gmail.com" style="color:#14b8a6;">tradesmartdz2@gmail.com</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#111;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#4b5563;font-size:12px;">TradeSmartDz © ${new Date().getFullYear()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildProActivatedEmail(userEmail: string, paymentMethod: string, amount: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تم تفعيل Pro</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#14b8a6,#0d9488);padding:32px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:48px;">🎉</p>
              <h1 style="margin:12px 0 0;color:#fff;font-size:24px;font-weight:800;">تم تفعيل Pro!</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:#e5e7eb;font-size:15px;line-height:1.7;margin:0 0 24px;">
                مرحباً! 🚀 يسعدنا إبلاغك بأن حسابك في <strong style="color:#14b8a6;">TradeSmartDz</strong>
                قد تم ترقيته إلى <strong style="color:#14b8a6;">Pro ⭐</strong>. يمكنك الآن الاستمتاع بجميع الميزات الحصرية.
              </p>

              <!-- Summary box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;border-radius:12px;margin-bottom:24px;">
                <tr><td style="padding:20px;">
                  <p style="margin:0 0 12px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">تفاصيل الاشتراك</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">الحساب</td>
                      <td style="color:#f3f4f6;font-size:14px;font-weight:600;text-align:left;">${userEmail}</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">الخطة</td>
                      <td style="color:#14b8a6;font-size:14px;font-weight:800;text-align:left;">Pro ⭐</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">طريقة الدفع</td>
                      <td style="color:#f3f4f6;font-size:14px;font-weight:600;text-align:left;">${paymentMethod === 'baridimob' ? 'BaridiMob' : 'USDT'}</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">المبلغ</td>
                      <td style="color:#f3f4f6;font-size:14px;font-weight:600;text-align:left;">${amount}</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">الحالة</td>
                      <td style="color:#22c55e;font-size:14px;font-weight:700;text-align:left;">✅ مفعّل</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- Open app CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 24px;">
                    <a href="https://neuroport.xyz"
                       style="display:inline-block;background:#14b8a6;color:#000;text-decoration:none;padding:14px 40px;border-radius:12px;font-weight:800;font-size:16px;">
                      🚀 افتح التطبيق
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
                للمساعدة: <a href="mailto:tradesmartdz2@gmail.com" style="color:#14b8a6;">tradesmartdz2@gmail.com</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#111;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#4b5563;font-size:12px;">TradeSmartDz © ${new Date().getFullYear()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildRenewalReminderEmail(userEmail: string, expiresAt: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تجديد الاشتراك</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#1a1a1a;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b,#d97706);
              padding:32px;text-align:center;">
              <p style="margin:0;font-size:48px;">⏰</p>
              <h1 style="margin:12px 0 0;color:#fff;font-size:22px;font-weight:800;">
                اشتراكك على وشك الانتهاء
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#e5e7eb;font-size:15px;line-height:1.7;margin:0 0 24px;">
                مرحباً! نود إعلامك بأن اشتراكك في
                <strong style="color:#14b8a6;">TradeSmartDz Pro</strong>
                سينتهي قريباً.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#0f0f0f;border-radius:12px;margin-bottom:24px;">
                <tr><td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">الحساب</td>
                      <td style="color:#f3f4f6;font-size:14px;font-weight:600;
                        text-align:left;">${userEmail}</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">
                        تاريخ الانتهاء</td>
                      <td style="color:#f59e0b;font-size:14px;font-weight:700;
                        text-align:left;">${expiresAt}</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:14px;padding:6px 0;">
                        المتبقي</td>
                      <td style="color:#ef4444;font-size:14px;font-weight:700;
                        text-align:left;">3 أيام أو أقل</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <p style="color:#e5e7eb;font-size:14px;line-height:1.7;margin:0 0 24px;">
                لتجديد اشتراكك والحفاظ على وصولك لجميع الميزات،
                قم بالدفع وأرسل لنا الإثبات عبر Telegram.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 16px;">
                    <a href="https://neuroport.xyz/settings?tab=subscription"
                      style="display:inline-block;background:#14b8a6;color:#000;
                      text-decoration:none;padding:14px 40px;border-radius:12px;
                      font-weight:800;font-size:16px;">
                      🔄 جدد اشتراكك الآن
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 24px;">
                    <a href="https://t.me/tradesmartdzz"
                      style="display:inline-block;background:#229ED9;color:#fff;
                      text-decoration:none;padding:12px 32px;border-radius:12px;
                      font-weight:700;font-size:14px;">
                      📱 تواصل معنا على Telegram
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
                للمساعدة:
                <a href="mailto:tradesmartdz2@gmail.com"
                  style="color:#14b8a6;">tradesmartdz2@gmail.com</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#111;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#4b5563;font-size:12px;">
                TradeSmartDz © ${new Date().getFullYear()}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildTrialReminderEmail(userEmail: string, daysLeft: number): string {
  const urgentColor = daysLeft <= 1 ? '#ef4444' : daysLeft <= 2 ? '#f59e0b' : '#14b8a6';
  const daysText = daysLeft <= 0 ? 'انتهت تجربتك' : daysLeft === 1 ? 'يوم واحد متبقي' : `${daysLeft} أيام متبقية`;
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تجربتك المجانية على وشك الانتهاء</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#1a1a1a;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,${urgentColor},${daysLeft <= 1 ? '#dc2626' : daysLeft <= 2 ? '#d97706' : '#0d9488'});
              padding:32px;text-align:center;">
              <p style="margin:0;font-size:48px;">${daysLeft <= 0 ? '😢' : '⚡'}</p>
              <h1 style="margin:12px 0 0;color:#fff;font-size:22px;font-weight:800;">
                ${daysLeft <= 0 ? 'انتهت تجربتك المجانية' : 'تجربتك المجانية على وشك الانتهاء'}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="color:#e5e7eb;font-size:15px;line-height:1.7;margin:0 0 24px;">
                مرحباً! ${daysLeft <= 0
                  ? 'انتهت تجربتك المجانية في <strong style="color:#14b8a6;">TradeSmartDz Pro</strong>. قم بالترقية الآن للحفاظ على وصولك لجميع الميزات.'
                  : `لديك <strong style="color:${urgentColor};">${daysText}</strong> في تجربتك المجانية لـ<strong style="color:#14b8a6;">TradeSmartDz Pro</strong>. لا تفوّت الفرصة!`
                }
              </p>

              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#0f0f0f;border-radius:12px;margin-bottom:24px;">
                <tr><td style="padding:20px;text-align:center;">
                  <p style="margin:0 0 4px;color:#9ca3af;font-size:13px;">الوقت المتبقي</p>
                  <p style="margin:0;color:${urgentColor};font-size:32px;font-weight:900;">${daysText}</p>
                </td></tr>
              </table>

              <div style="background:#14b8a6/10;border:1px solid #14b8a6;border-radius:12px;padding:16px;margin-bottom:24px;">
                <p style="margin:0 0 10px;color:#14b8a6;font-size:13px;font-weight:700;">ما ستفقده بعد انتهاء التجربة:</p>
                <ul style="margin:0;padding-right:20px;color:#e5e7eb;font-size:14px;line-height:2;">
                  <li>حسابات غير محدودة</li>
                  <li>صفقات غير محدودة</li>
                  <li>AI Coach — تحليل يومي</li>
                  <li>إشعارات Telegram اليومية</li>
                  <li>تحليلات متقدمة كاملة</li>
                </ul>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 16px;">
                    <a href="https://neuroport.xyz/settings?tab=subscription"
                      style="display:inline-block;background:#14b8a6;color:#000;
                      text-decoration:none;padding:14px 40px;border-radius:12px;
                      font-weight:800;font-size:16px;">
                      ⭐ ترقية إلى Pro الآن
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
                للمساعدة:
                <a href="mailto:tradesmartdz2@gmail.com"
                  style="color:#14b8a6;">tradesmartdz2@gmail.com</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#111;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#4b5563;font-size:12px;">
                TradeSmartDz © ${new Date().getFullYear()}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── CORS ───────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const userEmail = body.userEmail || body.to;
    const { type, paymentMethod, amount } = body;

    if (!userEmail || !type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let subject: string;
    let html: string;

    if (type === 'payment_confirmation') {
      subject = '📋 TradeSmartDz — تأكيد استلام طلب الدفع';
      html = buildPaymentConfirmationEmail(userEmail, paymentMethod ?? '', amount ?? '');
    } else if (type === 'pro_activated') {
      subject = '🎉 TradeSmartDz — تم تفعيل حسابك Pro!';
      html = buildProActivatedEmail(userEmail, paymentMethod ?? '', amount ?? '');
    } else if (type === 'renewal_reminder') {
      subject = '⏰ TradeSmartDz — اشتراكك على وشك الانتهاء';
      html = buildRenewalReminderEmail(userEmail, body.expiresAt || '');
    } else if (type === 'trial_reminder') {
      subject = '⚡ TradeSmartDz — تجربتك المجانية على وشك الانتهاء';
      html = buildTrialReminderEmail(userEmail, body.daysLeft ?? 1);
    } else {
      return new Response(JSON.stringify({ error: 'Unknown type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [userEmail],
      subject,
      html,
    });

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
