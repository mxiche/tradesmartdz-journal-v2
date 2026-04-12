import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProLockOverlayProps {
  feature?: string;
}

export function ProLockOverlay({ feature }: ProLockOverlayProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const label =
    language === 'ar'
      ? 'ميزة Pro'
      : language === 'fr'
      ? 'Fonctionnalité Pro'
      : 'Pro Feature';

  const desc =
    language === 'ar'
      ? (feature ? `${feature} متاح لمستخدمي Pro فقط` : 'هذه الميزة متاحة لمستخدمي Pro فقط')
      : language === 'fr'
      ? (feature ? `${feature} est réservé aux abonnés Pro` : 'Cette fonctionnalité est réservée aux abonnés Pro')
      : (feature ? `${feature} is available for Pro users only` : 'This feature is available for Pro users only');

  const btnLabel =
    language === 'ar' ? 'ترقية إلى Pro' : language === 'fr' ? 'Passer à Pro' : 'Upgrade to Pro';

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/75 backdrop-blur-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-6 w-6 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="max-w-[220px] text-center text-xs text-muted-foreground">{desc}</p>
      <Button
        size="sm"
        className="gradient-primary text-primary-foreground"
        onClick={() => navigate('/settings?tab=subscription')}
      >
        {btnLabel}
      </Button>
    </div>
  );
}
