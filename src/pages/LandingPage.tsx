import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Logo } from '@/components/Logo';
import { Language } from '@/lib/i18n';

// ── Intersection Observer hook ─────────────────────────────────
const useInView = (threshold = 0.1) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
};

// ── Count-up animation hook ────────────────────────────────────
const useCountUp = (end: number, duration = 2000, inView = false) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, end, duration]);

  return count;
};

// ── FAQ accordion item ─────────────────────────────────────────
const FaqItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${open ? 'border-teal-500/30' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-bold text-gray-900 text-sm pr-4">{question}</span>
        <span className={`text-teal-500 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-gray-500 text-sm leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────
const LandingPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const lang = language as 'ar' | 'fr' | 'en';
  const isAr = lang === 'ar';

  // Navbar scroll shadow
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Language selector dropdown
  const [showLangSelector, setShowLangSelector] = useState(false);
  const languages: { code: Language; label: string; flag: string; native: string }[] = [
    { code: 'ar', label: 'العربية', flag: '🇸🇦', native: 'Arabic' },
    { code: 'fr', label: 'Français', flag: '🇫🇷', native: 'French' },
    { code: 'en', label: 'English', flag: '🇬🇧', native: 'English' },
  ];

  // Section animations
  const statsAnim = useInView(0.3);
  const featuresAnim = useInView();
  const howAnim = useInView();
  const pricingAnim = useInView();
  const testimonialsAnim = useInView();

  // Count-up for stats
  const tradersCount = useCountUp(500, 1500, statsAnim.inView);
  const winRateCount = useCountUp(68, 1500, statsAnim.inView);
  const firmsCount = useCountUp(4, 800, statsAnim.inView);

  return (
    <div className="min-h-screen bg-white" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── NAVBAR ── */}
      <nav className={`sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 transition-all duration-300 ${scrolled ? 'shadow-lg shadow-gray-200/50' : 'shadow-none'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

          {/* Logo */}
          <Logo size="sm" />

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-600 hover:text-teal-600 transition-colors font-medium">
              {isAr ? 'المميزات' : lang === 'fr' ? 'Fonctionnalités' : 'Features'}
            </a>
            <a href="#how" className="text-sm text-gray-600 hover:text-teal-600 transition-colors font-medium">
              {isAr ? 'كيف يعمل' : lang === 'fr' ? 'Comment ça marche' : 'How it works'}
            </a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-teal-600 transition-colors font-medium">
              {isAr ? 'الأسعار' : lang === 'fr' ? 'Tarifs' : 'Pricing'}
            </a>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">

            {/* Premium language selector */}
            <div className="relative">
              <button
                onClick={() => setShowLangSelector(!showLangSelector)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all duration-200 group"
              >
                <span className="text-base">
                  {languages.find(l => l.code === language)?.flag}
                </span>
                <span className="text-xs font-bold text-gray-600 group-hover:text-teal-600 uppercase">{language}</span>
                <svg
                  className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${showLangSelector ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showLangSelector && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLangSelector(false)}
                  />
                  {/* Dropdown panel */}
                  <div className="absolute top-full mt-2 right-0 z-50 bg-white rounded-2xl shadow-xl shadow-gray-200/80 border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 w-48">
                    <div className="p-1.5">
                      {languages.map((langOption) => (
                        <button
                          key={langOption.code}
                          onClick={() => {
                            setLanguage(langOption.code);
                            setShowLangSelector(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                            language === langOption.code
                              ? 'bg-teal-50 text-teal-700'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span className="text-xl">{langOption.flag}</span>
                          <div>
                            <p className="text-sm font-bold">{langOption.label}</p>
                            <p className="text-xs text-gray-400">{langOption.native}</p>
                          </div>
                          {language === langOption.code && (
                            <span className="ml-auto text-teal-500 text-sm">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <Link
              to="/login"
              className="text-sm font-semibold text-gray-700 hover:text-teal-600 transition-colors px-3 py-2"
            >
              {t('login')}
            </Link>
            <Link
              to="/register"
              className="hidden sm:block bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm px-4 py-2 md:px-5 md:py-2.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/25 whitespace-nowrap"
            >
              {isAr ? 'ابدأ' : lang === 'fr' ? 'Commencer' : 'Start Free'}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-white pt-20 pb-16 md:pb-24">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-50 rounded-full blur-3xl opacity-40" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Text side */}
            <div className={isAr ? 'text-right' : 'text-left'}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-teal-100">
                <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
                {isAr ? 'مفكرة التداول العربية #1' : lang === 'fr' ? 'Journal de trading arabe #1' : 'The #1 Arab Trading Journal'}
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-tight mb-6">
                {isAr ? (
                  <>سجّل صفقاتك.<br /><span className="text-teal-500">اكتشف أخطاءك.</span><br />تطوّر كتريدر.</>
                ) : lang === 'fr' ? (
                  <>Journalisez vos trades.<br /><span className="text-teal-500">Découvrez vos erreurs.</span><br />Évoluez.</>
                ) : (
                  <>Journal your trades.<br /><span className="text-teal-500">Find your mistakes.</span><br />Grow as a trader.</>
                )}
              </h1>

              <p className="text-lg text-gray-500 mb-8 leading-relaxed max-w-lg">
                {t('landing_hero_subtitle')}
              </p>

              {/* Prop firm badges */}
              <div className="flex flex-wrap gap-2 mb-8">
                {['FTMO', 'FundingPips', 'Alpha Capital', 'FundedNext'].map(firm => (
                  <span key={firm} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                    {firm}
                  </span>
                ))}
              </div>

              {/* CTA buttons */}
              <div className="flex flex-wrap gap-3 mb-4">
                <Link
                  to="/register"
                  className="btn-pulse bg-teal-500 hover:bg-teal-600 text-white font-black text-base px-8 py-4 rounded-2xl transition-all duration-200 hover:shadow-xl hover:shadow-teal-500/30 hover:-translate-y-0.5 inline-block"
                >
                  {t('landing_hero_cta')}
                </Link>
                <a
                  href="#features"
                  className="border-2 border-gray-200 hover:border-teal-500 text-gray-700 hover:text-teal-600 font-bold text-base px-8 py-4 rounded-2xl transition-all duration-200 inline-block"
                >
                  {t('landing_hero_secondary')}
                </a>
              </div>

              <p className="text-xs text-gray-400 font-medium">{t('landing_trial_note')}</p>

              {/* Mobile-only app preview */}
              <div className="mt-8 lg:hidden">
                <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/80 border border-gray-100 overflow-hidden mx-auto max-w-sm">
                  <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <div className="w-2 h-2 rounded-full bg-yellow-400" />
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 bg-white rounded px-2 py-0.5 text-[10px] text-gray-400 text-center border border-gray-200">
                      app.tradesmartdz.com
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Win Rate', value: '68%', color: 'text-teal-600' },
                        { label: 'P&L', value: '+$2,847', color: 'text-green-600' },
                        { label: 'Trades', value: '47', color: 'text-gray-700' },
                      ].map((stat, i) => (
                        <div key={i} className="bg-white rounded-xl p-2 shadow-sm border border-gray-100 text-center">
                          <p className="text-[9px] text-gray-400">{stat.label}</p>
                          <p className={`text-xs font-black ${stat.color}`}>{stat.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl p-2 border border-gray-100 flex items-end gap-0.5 h-16">
                      {[40, 65, 45, 80, 60, 90, 75, 85, 70, 95, 60, 88].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: h > 70 ? '#14b8a6' : '#e2e8f0' }} />
                      ))}
                    </div>
                    {[
                      { symbol: 'NQ', result: 'Win', pnl: '+$125' },
                      { symbol: 'GOLD', result: 'Loss', pnl: '-$45' },
                    ].map((trade, i) => (
                      <div key={i} className="bg-white rounded-xl px-2 py-1.5 border border-gray-100 flex items-center justify-between">
                        <span className="font-bold text-[11px] text-gray-700">{trade.symbol}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${trade.result === 'Win' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {trade.result}
                          </span>
                          <span className={`text-[11px] font-bold ${trade.pnl.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>
                            {trade.pnl}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* App mockup — desktop only */}
            <div className="relative hidden lg:block">
              <div className="relative bg-white rounded-3xl shadow-2xl shadow-gray-200/80 border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-lg px-3 py-1 text-xs text-gray-400 text-center border border-gray-200">
                    app.tradesmartdz.com/dashboard
                  </div>
                </div>
                <div className="bg-gray-50 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Win Rate', value: '68%', color: 'text-teal-600' },
                      { label: 'Total P&L', value: '+$2,847', color: 'text-green-600' },
                      { label: 'Trades', value: '47', color: 'text-gray-700' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                        <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                        <p className={`text-sm font-black ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 h-32 flex items-end gap-1">
                    {[40, 65, 45, 80, 60, 90, 75, 85, 70, 95].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: h > 70 ? '#14b8a6' : '#e2e8f0' }} />
                    ))}
                  </div>
                  {[
                    { symbol: 'NQ', dir: 'Long', result: 'Win', pnl: '+$125' },
                    { symbol: 'GOLD', dir: 'Short', result: 'Loss', pnl: '-$45' },
                    { symbol: 'NQ', dir: 'Long', result: 'Win', pnl: '+$200' },
                  ].map((trade, i) => (
                    <div key={i} className="bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-700">{trade.symbol}</span>
                        <span className="text-xs text-gray-400">{trade.dir}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trade.result === 'Win' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {trade.result}
                        </span>
                        <span className={`text-xs font-bold ${trade.pnl.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>
                          {trade.pnl}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Floating badges */}
              <div className="animate-float absolute -top-4 -right-4 bg-white rounded-2xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-2">
                <span className="text-green-500 text-lg">✓</span>
                <div>
                  <p className="text-xs font-black text-gray-800">Win Rate</p>
                  <p className="text-xs text-gray-400">+12% this month</p>
                </div>
              </div>
              <div className="animate-float-delayed absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <div>
                  <p className="text-xs font-black text-gray-800">AI Coach</p>
                  <p className="text-xs text-gray-400">{isAr ? 'تحليل يومي جاهز' : 'Daily analysis ready'}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* ── STATS BAR ── */}
      <section className="bg-gray-50 border-b border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div ref={statsAnim.ref} className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-4xl md:text-3xl font-black text-teal-600">{tradersCount}+</p>
              <p className="text-sm text-gray-500 mt-1">{t('landing_stats_traders')}</p>
            </div>
            <div>
              <p className="text-4xl md:text-3xl font-black text-teal-600">{winRateCount}%</p>
              <p className="text-sm text-gray-500 mt-1">{t('landing_stats_winrate')}</p>
            </div>
            <div>
              <p className="text-4xl md:text-3xl font-black text-teal-600">{firmsCount}</p>
              <p className="text-sm text-gray-500 mt-1">{t('landing_stats_firms')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div ref={featuresAnim.ref}>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">{t('landing_features_title')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: '📊', title: t('landing_f1_title'), desc: t('landing_f1_desc') },
                { icon: '📈', title: t('landing_f2_title'), desc: t('landing_f2_desc') },
                { icon: '🤖', title: t('landing_f3_title'), desc: t('landing_f3_desc') },
                { icon: '📱', title: t('landing_f4_title'), desc: t('landing_f4_desc') },
                { icon: '🎯', title: t('landing_f5_title'), desc: t('landing_f5_desc') },
                { icon: '📓', title: t('landing_f6_title'), desc: t('landing_f6_desc') },
              ].map((feature, i) => (
                <div
                  key={i}
                  className={`group p-5 rounded-2xl border border-gray-100 hover:border-teal-500/30 hover:shadow-xl hover:shadow-teal-500/10 transition-all duration-300 hover:-translate-y-2 bg-white cursor-default flex gap-4 md:flex-col md:gap-0 ${
                    featuresAnim.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-teal-50 rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl flex-shrink-0 md:mb-4 group-hover:bg-teal-500 group-hover:scale-110 transition-all duration-300">
                    <span className="group-hover:scale-110 transition-transform duration-300 inline-block">
                      {feature.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 mb-1 text-base group-hover:text-teal-600 transition-colors duration-300">{feature.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div ref={howAnim.ref}>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">{t('landing_how_title')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-0.5 bg-teal-100" />
              {[
                { num: '01', title: t('landing_step1_title'), desc: t('landing_step1_desc') },
                { num: '02', title: t('landing_step2_title'), desc: t('landing_step2_desc') },
                { num: '03', title: t('landing_step3_title'), desc: t('landing_step3_desc') },
              ].map((step, i) => (
                <div
                  key={i}
                  className={`flex md:flex-col md:text-center items-start md:items-center gap-4 transition-all duration-700 ${
                    howAnim.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${i * 150}ms` }}
                >
                  <div className="w-12 h-12 bg-teal-500 text-white rounded-2xl flex items-center justify-center text-lg font-black flex-shrink-0 shadow-lg shadow-teal-500/30">
                    {step.num}
                  </div>
                  <div className="flex-1 md:mt-4">
                    <h3 className="font-black text-gray-900 text-lg mb-1">{step.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div ref={pricingAnim.ref}>
            <div className="text-center mb-6">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">{t('landing_pricing_title')}</h2>
              <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-bold px-4 py-2 rounded-full">
                ⚡ {t('landing_pricing_trial_note')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
              {/* Pro — first on mobile */}
              <div
                className={`order-first md:order-last rounded-3xl border-2 border-teal-500 p-8 relative bg-gradient-to-br from-teal-50/50 to-white shadow-xl shadow-teal-500/10 hover:scale-[1.03] hover:shadow-2xl hover:shadow-teal-500/20 transition-all duration-300 ${
                  pricingAnim.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: '0ms' }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-xs font-black px-4 py-1 rounded-full whitespace-nowrap">
                  {isAr ? 'الأفضل قيمة' : lang === 'fr' ? 'Meilleur rapport' : 'Best Value'}
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-1">Pro ⭐</h3>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-black text-gray-900">2,200</span>
                  <span className="text-gray-500">DA{t('landing_per_month')}</span>
                </div>
                <p className="text-sm text-gray-400 mb-6">{t('landing_or')} 9 USDT{t('landing_per_month')}</p>
                <ul className="space-y-3 mb-8">
                  {[
                    t('landing_pro_f1'), t('landing_pro_f2'), t('landing_pro_f3'),
                    t('landing_pro_f4'), t('landing_pro_f5'), t('landing_pro_f6'), t('landing_pro_f7'),
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-teal-500 font-bold">✓</span>
                      <span className="text-gray-700 font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className="block w-full text-center bg-teal-500 hover:bg-teal-600 text-white font-black py-3 rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/30"
                >
                  {isAr ? 'ابدأ 5 أيام مجاناً ←' : lang === 'fr' ? 'Commencer 5 jours gratuits ←' : 'Start 5 days free ←'}
                </Link>
              </div>

              {/* Free — second on mobile */}
              <div
                className={`order-last md:order-first rounded-3xl border-2 border-gray-200 p-8 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 cursor-default ${
                  pricingAnim.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: '150ms' }}
              >
                <h3 className="text-xl font-black text-gray-900 mb-1">{t('landing_free_plan')}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black text-gray-900">0</span>
                  <span className="text-gray-500">DA</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[t('landing_free_f1'), t('landing_free_f2'), t('landing_free_f3'), t('landing_free_f4')].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400">✓</span>
                      <span className="text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className="block w-full text-center border-2 border-gray-200 hover:border-teal-500 text-gray-700 hover:text-teal-600 font-bold py-3 rounded-2xl transition-all duration-200"
                >
                  {t('landing_hero_cta')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div ref={testimonialsAnim.ref}>
            <h2 className="text-3xl font-black text-gray-900 text-center mb-12">{t('landing_testimonials_title')}</h2>
            <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
              {[
                {
                  name: 'Ahmed K.',
                  country: '🇩🇿 الجزائر',
                  text: isAr
                    ? 'ساعدني TradeSmartDz على اكتشاف أن معظم خسائري في جلسة لندن. غيّرت استراتيجيتي وتحسّنت نتائجي بشكل كبير.'
                    : lang === 'fr'
                    ? "TradeSmartDz m'a aidé à découvrir que la plupart de mes pertes étaient en session Londres."
                    : 'TradeSmartDz helped me discover that most of my losses were in the London session.',
                  rating: 5,
                },
                {
                  name: 'Youssef M.',
                  country: '🇲🇦 المغرب',
                  text: isAr
                    ? 'أخيراً مفكرة تداول بالعربية وتفهم نظام ICT. الـ AI Coach أعطاني نصائح دقيقة جداً بعد تحليل صفقاتي.'
                    : lang === 'fr'
                    ? "Enfin un journal de trading en arabe qui comprend le système ICT."
                    : 'Finally a trading journal in Arabic that understands the ICT system.',
                  rating: 5,
                },
                {
                  name: 'Omar S.',
                  country: '🇸🇦 السعودية',
                  text: isAr
                    ? 'إشعارات Telegram اليومية ممتازة. أشعر أن لدي مدرب شخصي يتابعني كل يوم على تداولي في FundingPips.'
                    : lang === 'fr'
                    ? "Les notifications Telegram quotidiennes sont excellentes."
                    : 'Daily Telegram notifications are excellent. Feels like having a personal coach.',
                  rating: 5,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`min-w-[280px] md:min-w-0 snap-start bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex-shrink-0 md:flex-shrink transition-all duration-700 ${
                    testimonialsAnim.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(item.rating)].map((_, j) => (
                      <span key={j} className="text-yellow-400 text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">"{item.text}"</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-sm font-black text-teal-700">
                      {item.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.country}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      {/* ── FAQ ── */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-black text-gray-900 text-center mb-12">{t('landing_faq_title')}</h2>
          <div className="space-y-4">
            {[
              {
                q: isAr ? 'هل التجربة المجانية تتطلب بطاقة بنكية؟' : lang === 'fr' ? "L'essai gratuit nécessite-t-il une carte bancaire?" : 'Does the free trial require a credit card?',
                a: isAr ? 'لا، التجربة المجانية لمدة 5 أيام لا تتطلب أي معلومات دفع. ابدأ مباشرة بإنشاء حساب.' : lang === 'fr' ? "Non, l'essai de 5 jours ne nécessite aucune information de paiement." : 'No, the 5-day trial requires no payment information. Start directly by creating an account.',
              },
              {
                q: isAr ? 'كيف يمكنني الدفع من دولتي؟' : lang === 'fr' ? 'Comment puis-je payer depuis mon pays?' : 'How can I pay from my country?',
                a: isAr ? 'نقبل الدفع عبر BaridiMob (للجزائر) أو USDT TRC20 لجميع الدول العربية.' : lang === 'fr' ? 'Nous acceptons BaridiMob (Algérie) ou USDT TRC20 pour tous les pays arabes.' : 'We accept BaridiMob (Algeria) or USDT TRC20 for all Arab countries.',
              },
              {
                q: isAr ? 'هل يعمل مع شركات البروب فيرم؟' : lang === 'fr' ? 'Fonctionne-t-il avec les prop firms?' : 'Does it work with prop firms?',
                a: isAr ? 'نعم، يدعم FTMO وFundingPips وAlpha Capital وFundedNext. يمكنك تتبع حدود السحب وهدف الربح تلقائياً.' : lang === 'fr' ? 'Oui, supporte FTMO, FundingPips, Alpha Capital et FundedNext.' : 'Yes, supports FTMO, FundingPips, Alpha Capital and FundedNext.',
              },
              {
                q: isAr ? 'ماذا يحدث بعد انتهاء التجربة؟' : lang === 'fr' ? "Que se passe-t-il après la fin de l'essai?" : 'What happens after the trial ends?',
                a: isAr ? 'تنتقل تلقائياً للخطة المجانية (حساب واحد، 50 صفقة/شهر). بياناتك لا تُحذف أبداً.' : lang === 'fr' ? "Vous passez automatiquement au plan gratuit. Vos données ne sont jamais supprimées." : 'You automatically switch to the free plan. Your data is never deleted.',
              },
              {
                q: isAr ? 'هل يدعم اللغة العربية؟' : lang === 'fr' ? "Supporte-t-il l'arabe?" : 'Does it support Arabic?',
                a: isAr ? 'نعم، TradeSmartDz مصمم عربياً أولاً مع دعم كامل للغة العربية والفرنسية والإنجليزية.' : lang === 'fr' ? "Oui, TradeSmartDz est conçu en arabe en premier avec support complet AR/FR/EN." : 'Yes, TradeSmartDz is designed Arabic-first with full AR/FR/EN support.',
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="transition-all duration-700"
                style={{ transitionDelay: `${i * 75}ms` }}
              >
                <FaqItem question={faq.q} answer={faq.a} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-teal-600 to-teal-700">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">{t('landing_cta_title')}</h2>
          <p className="text-teal-100 text-lg mb-8">{t('landing_cta_subtitle')}</p>
          <Link
            to="/register"
            className="inline-block bg-white text-teal-600 font-black text-lg px-12 py-4 rounded-2xl hover:shadow-2xl hover:shadow-teal-900/30 transition-all duration-200 hover:-translate-y-1"
          >
            {t('landing_cta_btn')}
          </Link>
          <p className="text-teal-200 text-sm mt-4">{t('landing_trial_note')}</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="[&_.logo-text]:text-white [&_.logo-dz]:text-teal-400">
              <Logo size="sm" />
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="mailto:tradesmartdz2@gmail.com" className="hover:text-teal-400 transition-colors">
                {t('landing_footer_support')}
              </a>
              <a href="https://t.me/tradesmartdzz" className="hover:text-teal-400 transition-colors">
                Telegram
              </a>
            </div>
            <p className="text-sm">
              © {new Date().getFullYear()} TradeSmartDz — {t('landing_footer_rights')}
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
