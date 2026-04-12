import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Building2, BarChart2, CheckCircle2, X } from 'lucide-react';

type Lang = 'ar' | 'fr' | 'en';

interface Props {
  userId: string;
  lang: Lang;
  onClose: () => void;
}

const steps = [
  'welcome',
  'account',
  'trade',
  'ready',
] as const;

const content = {
  welcome: {
    ar: {
      title: 'مرحباً بك في TradeSmartDz',
      subtitle: 'منصة متكاملة لتتبع صفقاتك، تحليل أدائك، والارتقاء بمستواك كمتداول محترف.',
      cta: 'ابدأ الآن',
    },
    fr: {
      title: 'Bienvenue sur TradeSmartDz',
      subtitle: 'La plateforme complète pour suivre vos trades, analyser vos performances et progresser comme un trader professionnel.',
      cta: 'Commencer',
    },
    en: {
      title: 'Welcome to TradeSmartDz',
      subtitle: 'The complete platform to track your trades, analyze your performance, and level up as a professional trader.',
      cta: 'Get Started',
    },
  },
  account: {
    ar: {
      title: 'أضف حسابك الأول',
      subtitle: 'أضف حساب التداول الخاص بك لتتبع أهدافك ومؤشرات الأداء الرئيسية — يدعم حسابات Prop Firms والحسابات الحية.',
      cta: 'إضافة حساب',
    },
    fr: {
      title: 'Ajoutez votre premier compte',
      subtitle: 'Ajoutez votre compte de trading pour suivre vos objectifs et indicateurs de performance — prop firms et comptes live supportés.',
      cta: 'Ajouter un compte',
    },
    en: {
      title: 'Add your first account',
      subtitle: 'Add your trading account to track goals and key performance metrics — prop firm and live accounts supported.',
      cta: 'Add Account',
    },
  },
  trade: {
    ar: {
      title: 'سجّل أول صفقة',
      subtitle: 'أضف صفقاتك يدوياً مع النتيجة والجلسة والإعداد والملاحظات لبناء مجلة تداول كاملة.',
      cta: 'إضافة صفقة',
    },
    fr: {
      title: 'Enregistrez votre premier trade',
      subtitle: 'Ajoutez vos trades manuellement avec le résultat, la session, le setup et des notes pour construire un journal complet.',
      cta: 'Ajouter un trade',
    },
    en: {
      title: 'Log your first trade',
      subtitle: 'Add trades manually with result, session, setup and notes to build a complete trading journal.',
      cta: 'Add Trade',
    },
  },
  ready: {
    ar: {
      title: 'أنت جاهز!',
      subtitle: 'استكشف لوحة التحكم لمتابعة أدائك، استخدم مدرب الذكاء الاصطناعي للحصول على تحليل متخصص، وراجع التحليلات لاكتشاف أنماطك.',
      cta: 'الذهاب إلى لوحة التحكم',
    },
    fr: {
      title: 'Vous êtes prêt !',
      subtitle: 'Explorez le tableau de bord pour suivre vos performances, utilisez le Coach IA pour une analyse experte, et consultez les Analytics pour découvrir vos patterns.',
      cta: 'Aller au tableau de bord',
    },
    en: {
      title: "You're all set!",
      subtitle: 'Explore the Dashboard to track your performance, use the AI Coach for expert analysis, and check Analytics to discover your patterns.',
      cta: 'Go to Dashboard',
    },
  },
};

export function OnboardingModal({ userId, lang, onClose }: Props) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const completeOnboarding = async () => {
    localStorage.setItem(`onboarding_completed_${userId}`, 'true');
    await supabase
      .from('user_preferences')
      .upsert({ user_id: userId, onboarding_completed: true }, { onConflict: 'user_id' });
    onClose();
  };

  const handleSkip = () => completeOnboarding();

  const handleCta = async () => {
    if (step < 3) {
      if (step === 1) {
        await completeOnboarding();
        setTimeout(() => navigate('/connect'), 300);
        return;
      }
      if (step === 2) {
        await completeOnboarding();
        setTimeout(() => navigate('/trades'), 300);
        return;
      }
      setStep(s => s + 1);
    } else {
      await completeOnboarding();
    }
  };

  const c = content[steps[step]][lang];

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onInteractOutside={e => e.preventDefault()}
      >
        {/* Skip */}
        <button
          type="button"
          onClick={handleSkip}
          className="absolute end-4 top-4 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          {lang === 'ar' ? 'تخطي' : lang === 'fr' ? 'Passer' : 'Skip'}
        </button>

        {/* Step icon / logo */}
        <div className="flex flex-col items-center gap-6 py-4 text-center">
          {step === 0 && (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
              <span className="text-3xl font-extrabold tracking-tight text-primary">TS</span>
            </div>
          )}
          {step === 1 && (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/10">
              <Building2 className="h-10 w-10 text-blue-400" />
            </div>
          )}
          {step === 2 && (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-500/10">
              <BarChart2 className="h-10 w-10 text-purple-400" />
            </div>
          )}
          {step === 3 && (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-profit/10">
              <CheckCircle2 className="h-10 w-10 text-profit" />
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">{c.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{c.subtitle}</p>
          </div>

          {/* Ready step: feature highlights */}
          {step === 3 && (
            <div className="w-full space-y-2 text-start">
              {[
                { icon: '📊', label: lang === 'ar' ? 'لوحة التحكم — نظرة عامة شاملة' : lang === 'fr' ? 'Tableau de bord — vue d\'ensemble' : 'Dashboard — full performance overview' },
                { icon: '🤖', label: lang === 'ar' ? 'مدرب الذكاء الاصطناعي — تحليل ذكي' : lang === 'fr' ? 'Coach IA — analyse intelligente' : 'AI Coach — intelligent analysis' },
                { icon: '📈', label: lang === 'ar' ? 'التحليلات — أنماطك وتقدمك' : lang === 'fr' ? 'Analytics — vos patterns et progrès' : 'Analytics — your patterns & progress' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm">
                  <span>{item.icon}</span>
                  <span className="text-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          )}

          <Button className="w-full gradient-primary text-primary-foreground" onClick={handleCta}>
            {c.cta}
          </Button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 pb-2">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-2 bg-border'}`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
