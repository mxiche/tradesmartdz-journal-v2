import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Tag, Languages, Building2, BarChart3, Clock, Check, Star, ArrowRight, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';

const useParallax = (speed = 0.3) => {
  const [offset, setOffset] = useState(0);
  const rafRef = useRef<number>();

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setOffset(window.scrollY * speed);
    });
  }, [speed]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  return offset;
};

const LandingPage = () => {
  const { t, isRtl } = useLanguage();
  const parallaxOffset = useParallax(0.35);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    { icon: RefreshCw, title: { ar: 'مزامنة MT5 تلقائية', fr: 'Sync MT5 auto', en: 'MT5 Auto-Sync' }, desc: { ar: 'اربط حسابك مرة واحدة وستتم المزامنة تلقائياً', fr: 'Connectez une fois, les trades se synchronisent', en: 'Connect once, trades sync automatically' } },
    { icon: Tag, title: { ar: 'علامات ICT', fr: 'Tags ICT', en: 'ICT Setup Tags' }, desc: { ar: 'FVG, IFVG, Order Block, Liquidity Sweep', fr: 'FVG, IFVG, Order Block, Liquidity Sweep', en: 'FVG, IFVG, Order Block, Liquidity Sweep' } },
    { icon: Languages, title: { ar: 'عربي أولاً', fr: 'Arabe en premier', en: 'Arabic First' }, desc: { ar: 'دعم كامل للغة العربية واتجاه RTL', fr: 'Support complet RTL et interface arabe', en: 'Full RTL support, Arabic UI' } },
    { icon: Building2, title: { ar: 'جاهز لشركات التمويل', fr: 'Prêt pour les prop firms', en: 'Prop Firm Ready' }, desc: { ar: 'FTMO, FundingPips, Alpha Capital, FundedNext', fr: 'FTMO, FundingPips, Alpha Capital, FundedNext', en: 'FTMO, FundingPips, Alpha Capital, FundedNext' } },
    { icon: BarChart3, title: { ar: 'تحليلات متقدمة', fr: 'Analytiques avancées', en: 'Advanced Analytics' }, desc: { ar: 'نسبة الربح حسب الإعداد والجلسة والرمز', fr: 'Win rate par setup, session, symbole', en: 'Win rate by setup, session, symbol' } },
    { icon: Clock, title: { ar: 'تحليل Kill Zone', fr: 'Analyse Kill Zone', en: 'Kill Zone Analysis' }, desc: { ar: 'أداء جلسات لندن، نيويورك، آسيا', fr: 'Performance Londres, NY, Asie', en: 'London, NY, Asia session performance' } },
  ];

  const firms = ['FTMO', 'FundingPips', 'Alpha Capital', 'FundedNext'];

  const plans = [
    { name: t('free'), price: '0', features: ['20 trades/month', '1 account', 'Basic stats', 'Manual entry'], featured: false },
    { name: t('pro'), price: '2,500', features: ['Unlimited trades', '5 accounts', 'MT5 auto-sync', 'ICT tags', 'Advanced analytics', 'Kill zone analysis', 'Chart screenshots', 'Priority support'], featured: true },
    { name: t('journalOnly'), price: '1,200', features: ['Unlimited trades', '3 accounts', 'MT5 auto-sync', 'ICT tags', 'Basic analytics'], featured: false },
  ];

  const testimonials = [
    { name: 'أحمد بن سعيد', role: 'FTMO Trader', text: 'أفضل مجلة تداول استخدمتها. الواجهة العربية ممتازة والتحليلات ساعدتني أطور أدائي بشكل كبير.' },
    { name: 'ياسين مهدي', role: 'FundingPips Trader', text: 'المزامنة التلقائية مع MT5 وفرت عليّ وقت كبير. أنصح بها كل متداول عربي.' },
    { name: 'كريم عبد الرحمن', role: 'Alpha Capital Trader', text: 'تحليل Kill Zone غيّر طريقة تداولي. الآن أعرف أي جلسة تناسبني أكثر.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border glass">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Logo />
            <div className="hidden gap-6 md:flex">
              <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">{t('features')}</a>
              <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">{t('pricing')}</a>
              <a href="#testimonials" className="text-sm text-muted-foreground transition-colors hover:text-foreground">{t('about')}</a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login"><Button variant="outline" size="sm" className="min-h-[44px]">{t('login')}</Button></Link>
              <Link to="/register"><Button size="sm" className="min-h-[44px] gradient-primary text-primary-foreground">{t('getStarted')}</Button></Link>
            </div>
            <button
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-border sm:hidden"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border bg-card px-4 pb-4 sm:hidden">
            <div className="flex flex-col gap-1 pt-2">
              <a href="#features" className="min-h-[44px] flex items-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>{t('features')}</a>
              <a href="#pricing" className="min-h-[44px] flex items-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>{t('pricing')}</a>
              <a href="#testimonials" className="min-h-[44px] flex items-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>{t('about')}</a>
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full min-h-[44px]">{t('login')}</Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full min-h-[44px] gradient-primary text-primary-foreground">{t('getStarted')}</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Parallax background layer */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            transform: `translateY(${parallaxOffset}px)`,
            willChange: 'transform',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute top-20 left-1/4 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-40 right-1/4 h-48 w-48 rounded-full bg-primary/3 blur-3xl" />
        </div>

        <div
          className="container mx-auto px-4 py-12 text-center md:py-32"
          style={{
            transform: `translateY(${parallaxOffset * 0.15}px)`,
            opacity: Math.max(0, 1 - parallaxOffset * 0.003),
            willChange: 'transform, opacity',
          }}
        >
        <Badge variant="secondary" className="mb-4 md:mb-6">{t('tagline')}</Badge>
        <h1 className="mx-auto max-w-4xl text-2xl font-bold leading-tight text-foreground sm:text-4xl md:text-6xl">
          {t('heroTitle')}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:mt-6 md:text-lg">{t('heroSub')}</p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:mt-8 md:gap-4">
          <Link to="/register" className="w-full sm:w-auto">
            <Button size="lg" className="w-full min-h-[44px] gradient-primary text-primary-foreground sm:w-auto sm:px-8">
              {t('getStarted')} <ArrowRight className="ms-2 h-4 w-4" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="w-full min-h-[44px] sm:w-auto">{t('watchDemo')}</Button>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 md:mt-12 md:gap-4">
          {firms.map(f => (
            <Badge key={f} variant="secondary" className="px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm">{f}</Badge>
          ))}
        </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-12 md:py-20">
        <h2 className="mb-8 text-center text-2xl font-bold text-foreground md:mb-12 md:text-3xl">{t('features')}</h2>
        <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {features.map((f, i) => (
            <Card key={i} className="border-border bg-card transition-all hover:border-primary/50" style={{ animationDelay: `${i * 100}ms` }}>
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{f.title[isRtl ? 'ar' : 'en']}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.desc[isRtl ? 'ar' : 'en']}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto px-4 py-12 md:py-20">
        <h2 className="mb-8 text-center text-2xl font-bold text-foreground md:mb-12 md:text-3xl">{t('pricing')}</h2>
        <div className="mx-auto grid max-w-lg gap-4 md:max-w-none md:grid-cols-3 md:gap-6">
          {plans.map((plan, i) => (
            <Card key={i} className={`relative border-border bg-card ${plan.featured ? 'border-primary ring-1 ring-primary animate-pulse-glow' : ''}`}>
              {plan.featured && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-primary text-primary-foreground">{t('popular')}</Badge>}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground"> DA{t('perMonth')}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 shrink-0 text-primary" /> {feat}
                    </li>
                  ))}
                </ul>
                <Button className={`mt-6 w-full min-h-[44px] ${plan.featured ? 'gradient-primary text-primary-foreground' : ''}`} variant={plan.featured ? 'default' : 'outline'}>
                  {t('choosePlan')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="container mx-auto px-4 py-12 md:py-20">
        <h2 className="mb-8 text-center text-2xl font-bold text-foreground md:mb-12 md:text-3xl">{t('testimonials')}</h2>
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          {testimonials.map((test, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="pt-6">
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-primary text-primary" />)}
                </div>
                <p className="mb-4 text-sm text-muted-foreground leading-relaxed" dir="rtl">{test.text}</p>
                <div>
                  <p className="font-semibold text-foreground" dir="rtl">{test.name}</p>
                  <p className="text-xs text-muted-foreground">{test.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 text-center md:flex-row md:justify-between">
          <Logo size="sm" />
          <p className="text-sm text-muted-foreground">© 2025 TradeSmartDz</p>
          <div className="flex gap-4">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">{t('features')}</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">{t('pricing')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
