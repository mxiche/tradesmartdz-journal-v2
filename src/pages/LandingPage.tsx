import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Tag, Languages, Building2, BarChart3, Clock, Check, Star, ArrowRight, Menu, X, TrendingUp, Zap, LineChart } from 'lucide-react';
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

// Candlestick SVG pattern for hero background
const CandlestickPattern = () => (
  <svg
    className="absolute inset-0 h-full w-full opacity-[0.04]"
    preserveAspectRatio="xMidYMid slice"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern id="candles" x="0" y="0" width="48" height="80" patternUnits="userSpaceOnUse">
        {/* Bullish candle */}
        <line x1="8" y1="10" x2="8" y2="70" stroke="currentColor" strokeWidth="1" />
        <rect x="4" y="25" width="8" height="30" fill="currentColor" rx="1" />
        {/* Bearish candle */}
        <line x1="24" y1="15" x2="24" y2="65" stroke="currentColor" strokeWidth="1" />
        <rect x="20" y="30" width="8" height="20" fill="none" stroke="currentColor" strokeWidth="1" rx="1" />
        {/* Bullish candle */}
        <line x1="40" y1="20" x2="40" y2="60" stroke="currentColor" strokeWidth="1" />
        <rect x="36" y="28" width="8" height="22" fill="currentColor" rx="1" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#candles)" className="text-primary" />
  </svg>
);

// Dashboard mockup component
const DashboardMockup = () => (
  <div className="relative mx-auto w-full max-w-3xl">
    {/* Glow behind mockup */}
    <div className="absolute -inset-4 rounded-2xl bg-primary/10 blur-2xl" />
    <div className="relative rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
      {/* Fake browser chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-background/60 px-4 py-2.5">
        <div className="h-3 w-3 rounded-full bg-red-500/70" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <div className="h-3 w-3 rounded-full bg-green-500/70" />
        <div className="mx-auto flex h-5 w-48 items-center rounded bg-secondary px-2">
          <span className="text-[10px] text-muted-foreground">app.tradesmartdz.com/dashboard</span>
        </div>
      </div>

      {/* Mockup content */}
      <div className="p-4">
        {/* Stat cards row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Total P&L', value: '+$2,847', color: 'text-emerald-400' },
            { label: 'Win Rate', value: '70%', color: 'text-foreground' },
            { label: 'Profit Factor', value: '1.84', color: 'text-foreground' },
            { label: 'Drawdown', value: '3.2%', color: 'text-foreground' },
          ].map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-background/50 p-2">
              <p className="text-[9px] text-muted-foreground mb-0.5">{s.label}</p>
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Equity curve */}
        <div className="rounded-lg border border-border bg-background/50 p-3 mb-3">
          <p className="text-[9px] text-muted-foreground mb-2">Equity Curve</p>
          <svg viewBox="0 0 300 60" className="w-full h-12">
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(165,100%,42%)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(165,100%,42%)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,50 L30,45 L60,40 L90,42 L120,30 L150,28 L180,20 L210,22 L240,12 L270,8 L300,5"
              fill="none" stroke="hsl(165,100%,42%)" strokeWidth="2" strokeLinecap="round" />
            <path d="M0,50 L30,45 L60,40 L90,42 L120,30 L150,28 L180,20 L210,22 L240,12 L270,8 L300,5 L300,60 L0,60Z"
              fill="url(#lineGrad)" />
          </svg>
        </div>

        {/* Mini trades table */}
        <div className="rounded-lg border border-border bg-background/50 overflow-hidden">
          <div className="grid grid-cols-5 gap-2 px-3 py-1.5 border-b border-border">
            {['Symbol', 'Dir', 'Entry', 'P&L', 'Setup'].map(h => (
              <span key={h} className="text-[8px] font-medium text-muted-foreground">{h}</span>
            ))}
          </div>
          {[
            { sym: 'XAUUSD', dir: 'BUY', entry: '2341.5', pnl: '+$180', setup: 'FVG', win: true },
            { sym: 'EURUSD', dir: 'SELL', entry: '1.0892', pnl: '-$45', setup: 'OB', win: false },
            { sym: 'XAUUSD', dir: 'BUY', entry: '2318.0', pnl: '+$220', setup: 'MSS', win: true },
          ].map((tr, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 px-3 py-1.5 border-b border-border/50 last:border-0">
              <span className="text-[9px] font-medium text-foreground">{tr.sym}</span>
              <span className={`text-[9px] font-medium ${tr.dir === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{tr.dir}</span>
              <span className="text-[9px] text-muted-foreground">{tr.entry}</span>
              <span className={`text-[9px] font-medium ${tr.win ? 'text-emerald-400' : 'text-red-400'}`}>{tr.pnl}</span>
              <span className="text-[9px] rounded bg-secondary px-1 text-muted-foreground w-fit">{tr.setup}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

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

  const steps = [
    { icon: RefreshCw, num: '01', title: 'Connect MT5', desc: 'Enter your account number and investor password. We connect read-only — no risk to your funds.' },
    { icon: Zap, num: '02', title: 'Trades Sync Automatically', desc: 'Your full trade history imports instantly. New trades sync whenever you click Sync Now.' },
    { icon: LineChart, num: '03', title: 'Analyze & Improve', desc: 'See your win rate by setup, session, and symbol. Discover what actually works for you.' },
  ];

  const floatingStats = [
    { icon: TrendingUp, label: 'Win Rate', value: '70%', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { icon: BarChart3, label: 'This Month', value: '+$2,400', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { icon: RefreshCw, label: 'Trades Analyzed', value: '847', color: 'text-primary', bg: 'bg-primary/10' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border glass">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Logo />
            <div className="hidden gap-6 md:flex">
              <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">How it works</a>
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
              <a href="#how-it-works" className="min-h-[44px] flex items-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>How it works</a>
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
      <section className="relative min-h-[90vh] overflow-hidden flex flex-col justify-center">
        {/* Animated background */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ transform: `translateY(${parallaxOffset}px)`, willChange: 'transform' }}
        >
          {/* Candlestick pattern */}
          <CandlestickPattern />
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
          {/* Glow blobs */}
          <div className="absolute top-1/4 left-1/3 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
          <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 h-48 w-48 rounded-full bg-primary/6 blur-2xl" />
        </div>

        <div
          className="container mx-auto px-4 py-16 md:py-24"
          style={{
            transform: `translateY(${parallaxOffset * 0.15}px)`,
            opacity: Math.max(0, 1 - parallaxOffset * 0.003),
            willChange: 'transform, opacity',
          }}
        >
          {/* Text + CTAs */}
          <div className="text-center mb-12">
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
            {/* Firm badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 md:mt-8">
              {firms.map(f => (
                <Badge key={f} variant="secondary" className="px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm">{f}</Badge>
              ))}
            </div>
          </div>

          {/* Floating stat cards */}
          <div className="flex flex-wrap justify-center gap-3 mb-10 md:gap-4">
            {floatingStats.map((s, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3 shadow-lg backdrop-blur-sm">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Dashboard mockup */}
          <DashboardMockup />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="container mx-auto px-4 py-12 md:py-20">
        <h2 className="mb-8 text-center text-2xl font-bold text-foreground md:mb-12 md:text-3xl">How It Works</h2>
        <div className="relative mx-auto max-w-4xl">
          {/* Connector line (desktop only) */}
          <div className="absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] hidden h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent md:block" />
          <div className="grid gap-8 md:grid-cols-3 md:gap-6">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10">
                  <step.icon className="h-8 w-8 text-primary" />
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {step.num}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
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
