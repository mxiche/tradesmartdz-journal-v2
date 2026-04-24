import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/*
 * ─── SUPABASE CONFIRMATION EMAIL TEMPLATE ─────────────────────────────────
 * Dashboard → Authentication → Email Templates → Confirm signup
 * Replace the default template with the HTML below.
 * Tokens used: {{ .ConfirmationURL }}
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Subject: تأكيد حسابك في TradeSmart Dz ✅
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * <!DOCTYPE html>
 * <html dir="rtl" lang="ar">
 * <head>
 *   <meta charset="UTF-8" />
 *   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
 *   <title>تأكيد الحساب</title>
 * </head>
 * <body style="margin:0;padding:0;background:#f0fdf4;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;direction:rtl;">
 *   <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 16px;">
 *     <tr><td align="center">
 *       <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
 *
 *         <!-- Header gradient -->
 *         <tr>
 *           <td style="background:linear-gradient(135deg,#00b894 0%,#00cec9 100%);padding:36px 40px;text-align:center;">
 *             <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
 *               TradeSmart<span style="color:#d4fcf4;">Dz</span>
 *             </h1>
 *             <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">منصة تتبع المتداولين الاحترافيين</p>
 *           </td>
 *         </tr>
 *
 *         <!-- Trial badge -->
 *         <tr>
 *           <td style="padding:28px 40px 0;text-align:center;">
 *             <span style="display:inline-block;background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;border-radius:999px;padding:6px 18px;font-size:13px;font-weight:700;">
 *               🎁 تجربة Pro مجانية لمدة 7 أيام مفعّلة
 *             </span>
 *           </td>
 *         </tr>
 *
 *         <!-- Body -->
 *         <tr>
 *           <td style="padding:28px 40px;">
 *             <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">مرحباً بك! 👋</p>
 *             <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
 *               شكراً لتسجيلك في TradeSmart Dz. اضغط على الزر أدناه لتأكيد بريدك الإلكتروني وبدء رحلتك.
 *             </p>
 *
 *             <!-- CTA button -->
 *             <div style="text-align:center;margin-bottom:28px;">
 *               <a href="{{ .ConfirmationURL }}"
 *                  style="display:inline-block;background:linear-gradient(135deg,#00b894,#00cec9);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 36px;border-radius:12px;box-shadow:0 4px 14px rgba(0,184,148,0.35);">
 *                 تأكيد الحساب ✅
 *               </a>
 *             </div>
 *
 *             <!-- Feature grid -->
 *             <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8fafc;border-radius:12px;margin-bottom:24px;">
 *               <tr>
 *                 <td width="50%" style="font-size:13px;color:#374151;">📊 تتبع الصفقات</td>
 *                 <td width="50%" style="font-size:13px;color:#374151;">🤖 مدرب AI</td>
 *               </tr>
 *               <tr>
 *                 <td style="font-size:13px;color:#374151;">📈 تحليل الأداء</td>
 *                 <td style="font-size:13px;color:#374151;">🔔 إشعارات Telegram</td>
 *               </tr>
 *             </table>
 *
 *             <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
 *               هذا الرابط صالح لمدة 24 ساعة. إذا لم تُنشئ هذا الحساب يمكنك تجاهل هذا البريد.
 *             </p>
 *           </td>
 *         </tr>
 *
 *         <!-- Footer -->
 *         <tr>
 *           <td style="background:#f9fafb;padding:18px 40px;text-align:center;border-top:1px solid #e5e7eb;">
 *             <p style="margin:0;font-size:12px;color:#9ca3af;">
 *               TradeSmart Dz · tradesmartdz2@gmail.com
 *             </p>
 *           </td>
 *         </tr>
 *
 *       </table>
 *     </td></tr>
 *   </table>
 * </body>
 * </html>
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  userPlan: 'free' | 'pro';
  userStatus: 'free' | 'active' | 'trial' | 'expired';
  expiresAt: string | null;
  trialExpiresAt: string | null;
  trialDaysRemaining: number | null;
  showTrialWelcome: boolean;
  setShowTrialWelcome: (v: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<'free' | 'pro'>('free');
  const [userStatus, setUserStatus] = useState<'free' | 'active' | 'trial' | 'expired'>('free');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const [showTrialWelcome, setShowTrialWelcome] = useState(false);

  useEffect(() => {
    // Restore session from storage first — sets loading=false exactly once
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Then subscribe to future auth changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ensure trial exists and fetch subscription whenever user changes
  useEffect(() => {
    if (!user) {
      setUserPlan('free');
      setUserStatus('free');
      setExpiresAt(null);
      setTrialExpiresAt(null);
      setTrialDaysRemaining(null);
      return;
    }

    const init = async () => {
      // Step 1: create trial if NO subscription exists at all
      // Run in Supabase SQL Editor to prevent future duplicates:
      // CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_trial_unique
      //   ON subscriptions(user_id) WHERE status = 'trial';
      const { data: existingSubs, error: checkError } = await supabase
        .from('subscriptions')
        .select('id, status')
        .eq('user_id', user.id)
        .limit(1);

      if (!checkError && (!existingSubs || existingSubs.length === 0)) {
        // Small delay to prevent race condition on React StrictMode double-mount
        await new Promise(resolve => setTimeout(resolve, 500));

        // Double-check after delay
        const { data: checkAgain } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (!checkAgain || checkAgain.length === 0) {
          const { error: trialError } = await supabase.from('subscriptions').insert({
            user_id: user.id,
            plan: 'pro',
            status: 'trial',
            amount: '0',
            activated_at: new Date().toISOString(),
            // REMINDER: Update Supabase email template
            // Authentication → Email Templates → Confirm signup
            // Change "5 أيام" to "7 أيام" in the template
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
          if (trialError) {
            console.error('Trial creation error:', trialError);
          } else {
            console.log('Trial created for user:', user.id);
          }
        }
      }

      // Step 2: fetch active/trial subscription — prefer 'active' over 'trial'
      // 'active' < 'trial' alphabetically so ascending order puts active first
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan, status, expires_at')
        .eq('user_id', user.id)
        .in('status', ['active', 'trial'])
        .gte('expires_at', new Date().toISOString())
        .order('status', { ascending: true })
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const plan = (sub?.plan as 'free' | 'pro') || 'free';
      const status = (sub?.status as 'active' | 'trial') || 'free';

      setUserPlan(plan);
      setUserStatus(status as 'free' | 'active' | 'trial' | 'expired');
      setExpiresAt(sub?.expires_at || null);

      const trialExp = status === 'trial' ? (sub?.expires_at || null) : null;
      setTrialExpiresAt(trialExp);

      const daysRemaining = trialExp
        ? Math.ceil((new Date(trialExp).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null;
      setTrialDaysRemaining(daysRemaining);

      // Show welcome modal once per user on first login during trial
      if (status === 'trial') {
        const shownKey = `trial_welcome_shown_${user.id}`;
        if (!localStorage.getItem(shownKey)) {
          localStorage.setItem(shownKey, 'true');
          setShowTrialWelcome(true);
        }
      }
    };

    init();
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    // Supabase returns a fake success for existing emails when email
    // confirmation is enabled — detect it via empty identities array
    if (data?.user && !data?.session) {
      if (data.user.identities && data.user.identities.length === 0) {
        return { error: new Error('already registered') };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session, user, loading,
      userPlan, userStatus, expiresAt,
      trialExpiresAt, trialDaysRemaining,
      showTrialWelcome, setShowTrialWelcome,
      signIn, signUp, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
