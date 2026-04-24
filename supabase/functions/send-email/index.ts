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
const FROM_EMAIL = 'TradeSmartDz <noreply@tradesmartdz.com>';
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
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:24px;overflow:hidden;max-width:520px;width:100%;
          box-shadow:0 4px 24px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#14b8a6,#0d9488);padding:40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:40px;">📋</p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:900;">TradeSmartDz</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">تأكيد استلام طلب الدفع</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;font-weight:800;text-align:center;">
                تم استلام طلبك ✅
              </h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;text-align:center;">
                شكراً لك على اشتراكك في TradeSmartDz Pro.
                سنقوم بالتحقق من دفعتك في أقرب وقت ممكن.
              </p>

              <!-- Summary box -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 12px;color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">ملخص الطلب</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#64748b;font-size:14px;padding:6px 0;border-bottom:1px solid #f1f5f9;">الحساب</td>
                    <td style="color:#0f172a;font-size:14px;font-weight:600;text-align:left;border-bottom:1px solid #f1f5f9;">${userEmail}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:14px;padding:6px 0;border-bottom:1px solid #f1f5f9;">الخطة</td>
                    <td style="color:#0d9488;font-size:14px;font-weight:800;text-align:left;border-bottom:1px solid #f1f5f9;">Pro ⭐</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:14px;padding:6px 0;border-bottom:1px solid #f1f5f9;">طريقة الدفع</td>
                    <td style="color:#0f172a;font-size:14px;font-weight:600;text-align:left;border-bottom:1px solid #f1f5f9;">${paymentMethod === 'baridimob' ? 'BaridiMob' : 'USDT'}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:14px;padding:6px 0;">المبلغ</td>
                    <td style="color:#0f172a;font-size:14px;font-weight:600;text-align:left;">${amount}</td>
                  </tr>
                </table>
              </div>

              <!-- Status badge -->
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:16px;padding:16px;margin-bottom:24px;text-align:center;">
                <p style="margin:0;color:#92400e;font-size:14px;font-weight:700;">
                  ⏳ قيد التحقق — سيتم التفعيل خلال 24 ساعة
                </p>
              </div>

              <!-- Telegram CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="https://t.me/Tradesmartdzbot?start=payment_verify"
                      style="display:inline-block;background:#229ED9;color:#ffffff;text-decoration:none;
                      padding:14px 32px;border-radius:12px;font-weight:700;font-size:14px;">
                      📸 أرسل صورة إثبات الدفع
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                للمساعدة:
                <a href="mailto:tradesmartdz2@gmail.com" style="color:#14b8a6;text-decoration:none;">tradesmartdz2@gmail.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © ${new Date().getFullYear()} TradeSmartDz —
                <a href="mailto:tradesmartdz2@gmail.com" style="color:#14b8a6;text-decoration:none;">tradesmartdz2@gmail.com</a>
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

function buildProActivatedEmail(userEmail: string, paymentMethod: string, amount: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تم تفعيل Pro</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:24px;overflow:hidden;max-width:520px;width:100%;
          box-shadow:0 4px 24px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#14b8a6,#0d9488);padding:40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:48px;">🎉</p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:900;">تم تفعيل Pro!</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">TradeSmartDz</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;font-weight:800;text-align:center;">
                مرحباً بك في Pro! 🚀
              </h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;text-align:center;">
                تم ترقية حسابك إلى TradeSmartDz Pro.
                يمكنك الآن الاستمتاع بجميع الميزات الحصرية.
              </p>

              <!-- Pro features -->
              <div style="background:#f0fdf9;border:1px solid #99f6e4;border-radius:16px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 12px;color:#0d9488;font-size:13px;font-weight:700;text-align:center;">
                  ما يمكنك فعله الآن ⭐
                </p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="50%" style="padding:4px 4px 4px 0;">
                      <div style="background:#ffffff;border-radius:12px;padding:12px;text-align:center;">
                        <p style="margin:0;font-size:20px;">🤖</p>
                        <p style="margin:4px 0 0;font-size:12px;color:#475569;font-weight:600;">AI Coach</p>
                      </div>
                    </td>
                    <td width="50%" style="padding:4px 0 4px 4px;">
                      <div style="background:#ffffff;border-radius:12px;padding:12px;text-align:center;">
                        <p style="margin:0;font-size:20px;">📱</p>
                        <p style="margin:4px 0 0;font-size:12px;color:#475569;font-weight:600;">إشعارات Telegram</p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" style="padding:4px 4px 0 0;">
                      <div style="background:#ffffff;border-radius:12px;padding:12px;text-align:center;">
                        <p style="margin:0;font-size:20px;">📊</p>
                        <p style="margin:4px 0 0;font-size:12px;color:#475569;font-weight:600;">تحليلات متقدمة</p>
                      </div>
                    </td>
                    <td width="50%" style="padding:4px 0 0 4px;">
                      <div style="background:#ffffff;border-radius:12px;padding:12px;text-align:center;">
                        <p style="margin:0;font-size:20px;">🏆</p>
                        <p style="margin:4px 0 0;font-size:12px;color:#475569;font-weight:600;">شهادات الأداء</p>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Subscription details -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin-bottom:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#64748b;font-size:13px;padding:4px 0;">طريقة الدفع</td>
                    <td style="color:#0f172a;font-size:13px;font-weight:600;text-align:left;">${paymentMethod === 'baridimob' ? 'BaridiMob' : 'USDT'}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:13px;padding:4px 0;">المبلغ</td>
                    <td style="color:#0f172a;font-size:13px;font-weight:600;text-align:left;">${amount}</td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="https://tradesmartdz.com"
                      style="display:inline-block;background:#14b8a6;color:#ffffff;text-decoration:none;
                      padding:16px 48px;border-radius:14px;font-weight:900;font-size:16px;
                      box-shadow:0 4px 12px rgba(20,184,166,0.3);">
                      🚀 افتح التطبيق الآن
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                للمساعدة:
                <a href="mailto:tradesmartdz2@gmail.com" style="color:#14b8a6;text-decoration:none;">tradesmartdz2@gmail.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © ${new Date().getFullYear()} TradeSmartDz —
                <a href="mailto:tradesmartdz2@gmail.com" style="color:#14b8a6;text-decoration:none;">tradesmartdz2@gmail.com</a>
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

function buildRenewalReminderEmail(userEmail: string, expiresAt: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تجديد الاشتراك</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:24px;overflow:hidden;max-width:520px;width:100%;
          box-shadow:0 4px 24px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:40px;">⏰</p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:900;">اشتراكك على وشك الانتهاء</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">TradeSmartDz Pro</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;text-align:center;">
                اشتراكك في TradeSmartDz Pro سينتهي قريباً.
                جدد الآن للحفاظ على وصولك لجميع الميزات.
              </p>

              <!-- Expiry info -->
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:16px;padding:20px;margin-bottom:24px;text-align:center;">
                <p style="margin:0 0 4px;color:#92400e;font-size:13px;font-weight:700;">تاريخ الانتهاء</p>
                <p style="margin:0;color:#0f172a;font-size:20px;font-weight:900;">${expiresAt}</p>
                <p style="margin:4px 0 0;color:#d97706;font-size:13px;font-weight:600;">⚠️ 3 أيام أو أقل متبقية</p>
              </div>

              <!-- CTA Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="https://tradesmartdz.com/settings?tab=subscription"
                      style="display:inline-block;background:#14b8a6;color:#ffffff;text-decoration:none;
                      padding:16px 40px;border-radius:14px;font-weight:900;font-size:16px;
                      box-shadow:0 4px 12px rgba(20,184,166,0.3);">
                      🔄 جدد اشتراكك الآن
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="https://t.me/tradesmartdzz"
                      style="display:inline-block;background:#229ED9;color:#ffffff;text-decoration:none;
                      padding:12px 32px;border-radius:12px;font-weight:700;font-size:14px;">
                      📱 تواصل معنا على Telegram
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                للمساعدة:
                <a href="mailto:tradesmartdz2@gmail.com" style="color:#14b8a6;text-decoration:none;">tradesmartdz2@gmail.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © ${new Date().getFullYear()} TradeSmartDz —
                <a href="mailto:tradesmartdz2@gmail.com" style="color:#14b8a6;text-decoration:none;">tradesmartdz2@gmail.com</a>
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
  const headerGradient = daysLeft <= 1
    ? 'linear-gradient(135deg,#ef4444,#dc2626)'
    : daysLeft <= 2
    ? 'linear-gradient(135deg,#f59e0b,#d97706)'
    : 'linear-gradient(135deg,#14b8a6,#0d9488)';
  const emoji = daysLeft <= 0 ? '😢' : '⚡';
  const daysText = daysLeft <= 0 ? 'انتهت تجربتك' : daysLeft === 1 ? 'يوم واحد متبقي' : `${daysLeft} أيام متبقية`;
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تجربتك المجانية</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:24px;overflow:hidden;max-width:520px;width:100%;
          box-shadow:0 4px 24px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background:${headerGradient};padding:40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:40px;">${emoji}</p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:900;">
                ${daysLeft <= 0 ? 'انتهت تجربتك المجانية' : 'تجربتك المجانية على وشك الانتهاء'}
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">TradeSmartDz</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">

              <!-- Days remaining badge -->
              <div style="text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 4px;color:#94a3b8;font-size:13px;">الوقت المتبقي</p>
                <p style="margin:0;font-size:32px;font-weight:900;color:${urgentColor};">${daysText}</p>
              </div>

              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;text-align:center;">
                ${daysLeft <= 0
                  ? 'انتهت تجربتك المجانية. قم بالترقية الآن للحفاظ على وصولك.'
                  : 'لا تفوّت الفرصة! اشترك في Pro للاستمرار في تطوير أدائك.'}
              </p>

              <!-- What you lose -->
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:16px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;color:#dc2626;font-size:13px;font-weight:700;text-align:center;">
                  ما ستفقده بعد انتهاء التجربة
                </p>
                <p style="margin:0;font-size:13px;color:#7f1d1d;">
                  ❌ AI Coach · إشعارات Telegram · تحليلات متقدمة · حسابات متعددة · تصدير البيانات
                </p>
              </div>

              <!-- Price box -->
              <div style="background:#f0fdf9;border:1px solid #99f6e4;border-radius:16px;padding:16px 20px;margin-bottom:24px;text-align:center;">
                <p style="margin:0 0 4px;color:#0d9488;font-size:13px;font-weight:700;">اشترك الآن</p>
                <p style="margin:0;color:#0f172a;font-size:22px;font-weight:900;">2,200 دج / شهر</p>
                <p style="margin:4px 0 0;color:#64748b;font-size:12px;">أو 9 USDT / شهر</p>
              </div>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="https://tradesmartdz.com/settings?tab=subscription"
                      style="display:inline-block;background:#14b8a6;color:#ffffff;text-decoration:none;
                      padding:16px 48px;border-radius:14px;font-weight:900;font-size:16px;
                      box-shadow:0 4px 12px rgba(20,184,166,0.3);">
                      ⭐ ترقية إلى Pro الآن
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                للمساعدة:
                <a href="mailto:tradesmartdz2@gmail.com" style="color:#14b8a6;text-decoration:none;">tradesmartdz2@gmail.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © ${new Date().getFullYear()} TradeSmartDz —
                <a href="mailto:tradesmartdz2@gmail.com" style="color:#14b8a6;text-decoration:none;">tradesmartdz2@gmail.com</a>
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

function buildTrialExpiredEmail(to: string): string {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    </head>
    <body style="margin:0;padding:0;background:#f8fafc;
      font-family:Arial,sans-serif;direction:rtl;">
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8fafc;padding:40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#ffffff;border-radius:24px;
              overflow:hidden;max-width:520px;width:100%;
              box-shadow:0 4px 24px rgba(0,0,0,0.06);
              border:1px solid #e2e8f0;">

              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#64748b,#475569);
                  padding:40px 32px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:40px;">⏰</p>
                  <h1 style="margin:0;color:#ffffff;font-size:22px;
                    font-weight:900;">
                    TradeSmartDz
                  </h1>
                  <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);
                    font-size:14px;">
                    انتهت فترة التجربة المجانية
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:40px 32px;">

                  <h2 style="margin:0 0 12px;color:#0f172a;
                    font-size:20px;font-weight:800;text-align:center;">
                    انتهت الـ 7 أيام المجانية 😔
                  </h2>

                  <p style="margin:0 0 24px;color:#64748b;
                    font-size:15px;line-height:1.7;text-align:center;">
                    لقد انتهت فترة تجربتك المجانية في TradeSmartDz.
                    نأمل أنك استمتعت بتجربة المنصة!
                  </p>

                  <!-- What you lose box -->
                  <div style="background:#fef2f2;border:1px solid #fecaca;
                    border-radius:16px;padding:20px;margin-bottom:24px;">
                    <p style="margin:0 0 12px;color:#dc2626;font-size:13px;
                      font-weight:700;text-align:center;">
                      ما الذي فقدته الآن؟
                    </p>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                      ${['❌ AI Coach والتحليل الذكي',
                         '❌ إشعارات Telegram اليومية',
                         '❌ تصدير البيانات والشهادات',
                         '❌ أكثر من حساب واحد',
                         '❌ تحليلات متقدمة'].map(item => `
                        <p style="margin:0;font-size:13px;color:#7f1d1d;">
                          ${item}
                        </p>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Upgrade CTA -->
                  <div style="background:#f0fdf9;border:1px solid #99f6e4;
                    border-radius:16px;padding:20px;margin-bottom:28px;
                    text-align:center;">
                    <p style="margin:0 0 4px;color:#0d9488;font-size:13px;
                      font-weight:700;">
                      اشترك الآن
                    </p>
                    <p style="margin:0 0 16px;color:#0f172a;font-size:22px;
                      font-weight:900;">
                      2,200 دج / شهر
                    </p>
                    <p style="margin:0 0 4px;color:#64748b;font-size:12px;">
                      أو 9 USDT / شهر
                    </p>
                  </div>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding-bottom:24px;">
                        <a href="https://tradesmartdz.com/settings?tab=subscription"
                          style="display:inline-block;background:#14b8a6;
                          color:#ffffff;text-decoration:none;
                          padding:16px 48px;border-radius:14px;
                          font-weight:900;font-size:16px;">
                          ترقية إلى Pro ⭐
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:0;color:#94a3b8;font-size:12px;
                    text-align:center;">
                    بياناتك وصفقاتك محفوظة بأمان.
                    ستعود كل المميزات فور الاشتراك.
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f8fafc;padding:20px 32px;
                  border-top:1px solid #e2e8f0;text-align:center;">
                  <p style="margin:0;color:#cbd5e1;font-size:11px;">
                    © 2026 TradeSmartDz —
                    <a href="mailto:tradesmartdz2@gmail.com"
                      style="color:#14b8a6;text-decoration:none;">
                      tradesmartdz2@gmail.com
                    </a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;
}

function buildGiftDaysEmail(
  userEmail: string,
  expiresAt: string
): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>هدية من TradeSmartDz</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;
  font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0"
    style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:24px;
          overflow:hidden;max-width:520px;width:100%;
          box-shadow:0 4px 24px rgba(0,0,0,0.06);
          border:1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#14b8a6,#0d9488);
              padding:40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:52px;">🎁</p>
              <h1 style="margin:0;color:#ffffff;font-size:26px;
                font-weight:900;letter-spacing:-0.5px;">
                هدية خاصة لك!
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);
                font-size:14px;">من فريق TradeSmartDz</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">

              <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px;
                font-weight:900;text-align:center;">
                أضفنا 7 أيام مجانية لحسابك 🎉
              </h2>

              <p style="margin:0 0 28px;color:#64748b;font-size:15px;
                line-height:1.7;text-align:center;">
                نقدّر ثقتك في TradeSmartDz ونريد أن نمنحك
                المزيد من الوقت لاكتشاف كامل إمكانيات المنصة
                وتطوير أدائك كتريدر.
              </p>

              <!-- Gift highlight box -->
              <div style="background:linear-gradient(135deg,#f0fdf9,#e6fffa);
                border:2px solid #99f6e4;border-radius:20px;
                padding:24px;margin-bottom:28px;text-align:center;">
                <p style="margin:0 0 6px;color:#0d9488;font-size:13px;
                  font-weight:700;text-transform:uppercase;
                  letter-spacing:1.5px;">
                  هديتك
                </p>
                <p style="margin:0 0 4px;color:#0f172a;font-size:36px;
                  font-weight:900;line-height:1;">
                  +7 أيام Pro
                </p>
                <p style="margin:8px 0 0;color:#64748b;font-size:13px;">
                  مجاناً — لا يلزم بطاقة ائتمانية
                </p>
              </div>

              <!-- New expiry date -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;
                border-radius:16px;padding:18px 24px;margin-bottom:28px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#64748b;font-size:14px;padding:6px 0;">
                      📅 تنتهي تجربتك الجديدة في
                    </td>
                    <td style="color:#0d9488;font-size:15px;
                      font-weight:900;text-align:left;">
                      ${expiresAt}
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:14px;padding:6px 0;">
                      ✅ الحالة
                    </td>
                    <td style="color:#0d9488;font-size:14px;
                      font-weight:700;text-align:left;">
                      Pro مفعّل
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Features reminder -->
              <p style="margin:0 0 16px;color:#94a3b8;font-size:12px;
                text-align:center;text-transform:uppercase;
                letter-spacing:1px;">
                استمتع بجميع ميزات Pro
              </p>
              <table width="100%" cellpadding="0" cellspacing="0"
                style="margin-bottom:28px;">
                <tr>
                  <td width="50%" style="padding:4px 4px 4px 0;">
                    <div style="background:#f8fafc;border-radius:14px;
                      padding:14px;text-align:center;">
                      <p style="margin:0;font-size:22px;">🤖</p>
                      <p style="margin:6px 0 0;font-size:12px;
                        color:#475569;font-weight:700;">
                        AI Coach
                      </p>
                    </div>
                  </td>
                  <td width="50%" style="padding:4px 0 4px 4px;">
                    <div style="background:#f8fafc;border-radius:14px;
                      padding:14px;text-align:center;">
                      <p style="margin:0;font-size:22px;">📊</p>
                      <p style="margin:6px 0 0;font-size:12px;
                        color:#475569;font-weight:700;">
                        تحليلات متقدمة
                      </p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:4px 4px 0 0;">
                    <div style="background:#f8fafc;border-radius:14px;
                      padding:14px;text-align:center;">
                      <p style="margin:0;font-size:22px;">📱</p>
                      <p style="margin:6px 0 0;font-size:12px;
                        color:#475569;font-weight:700;">
                        إشعارات Telegram
                      </p>
                    </div>
                  </td>
                  <td width="50%" style="padding:4px 0 0 4px;">
                    <div style="background:#f8fafc;border-radius:14px;
                      padding:14px;text-align:center;">
                      <p style="margin:0;font-size:22px;">🏆</p>
                      <p style="margin:6px 0 0;font-size:12px;
                        color:#475569;font-weight:700;">
                        شهادات الأداء
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="https://tradesmartdz.com"
                      style="display:inline-block;background:#14b8a6;
                      color:#ffffff;text-decoration:none;
                      padding:16px 48px;border-radius:14px;
                      font-weight:900;font-size:16px;
                      box-shadow:0 4px 12px rgba(20,184,166,0.3);">
                      🚀 افتح التطبيق الآن
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#94a3b8;font-size:13px;
                text-align:center;line-height:1.6;">
                بياناتك وصفقاتك محفوظة بأمان.
                استمر في التداول وتطوير أدائك! 💪
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;
              border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;">
                هذه الهدية تلقائية من فريق TradeSmartDz
                تقديراً لثقتك بنا.
              </p>
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © 2026 TradeSmartDz —
                <a href="mailto:tradesmartdz2@gmail.com"
                  style="color:#14b8a6;text-decoration:none;">
                  tradesmartdz2@gmail.com
                </a>
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
    } else if (type === 'trial_expired') {
      subject = 'انتهت فترة تجربتك المجانية — TradeSmartDz';
      html = buildTrialExpiredEmail(userEmail);
    } else if (type === 'gift_days') {
      subject = '🎁 TradeSmartDz — هدية خاصة لك!';
      html = buildGiftDaysEmail(userEmail, body.expiresAt || '');
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
