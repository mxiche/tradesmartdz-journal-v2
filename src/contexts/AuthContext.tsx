import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
      // Step 1: create trial subscription if user has NO subscription at all
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id, status')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        // If trial insert fails, run this SQL in Supabase SQL Editor:
        // DROP POLICY IF EXISTS "Users can insert own subscription" ON subscriptions;
        // CREATE POLICY "Users can insert own subscription"
        // ON subscriptions FOR INSERT
        // WITH CHECK (auth.uid() = user_id);
        const { error: insertError } = await supabase.from('subscriptions').insert({
          user_id: user.id,
          plan: 'pro',
          status: 'trial',
          amount: '0',
          activated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (insertError) {
          console.error('Trial insert error:', insertError);
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
