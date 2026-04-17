import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Logo, LogoIcon } from '@/components/Logo';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Bell, X, Globe, LogOut, LayoutDashboard, TrendingUp,
  BarChart2, BookOpen, Calendar, Bot, Link2, Settings,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: { ar: 'الرئيسية',   fr: 'Tableau de bord', en: 'Dashboard' }, path: '/dashboard' },
  { icon: TrendingUp,      label: { ar: 'صفقاتي',     fr: 'Mes Trades',      en: 'My Trades'  }, path: '/trades'    },
  { icon: BarChart2,       label: { ar: 'التحليلات',   fr: 'Analytiques',     en: 'Analytics'  }, path: '/analytics' },
  { icon: BookOpen,        label: { ar: 'المذكرة',     fr: 'Journal',         en: 'Journal'    }, path: '/journal'   },
  { icon: Calendar,        label: { ar: 'التقويم',     fr: 'Calendrier',      en: 'Calendar'   }, path: '/calendar'  },
  { icon: Bot,             label: { ar: 'مدرب AI',     fr: 'Coach IA',        en: 'AI Coach'   }, path: '/ai-coach'  },
  { icon: Link2,           label: { ar: 'ربط حساب',   fr: 'Connecter',       en: 'Connect'    }, path: '/connect'   },
  { icon: Settings,        label: { ar: 'الإعدادات',   fr: 'Paramètres',      en: 'Settings'   }, path: '/settings'  },
];

export default function AppLayout() {
  const { user, signOut, userPlan, userStatus, trialDaysRemaining, showTrialWelcome, setShowTrialWelcome } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = useMemo(() => {
    const items: {
      id: string;
      type: 'trial' | 'streak' | 'goal' | 'info';
      title: string;
      message: string;
      time: string;
      read: boolean;
    }[] = [];

    if (userStatus === 'trial' && trialDaysRemaining !== null && trialDaysRemaining <= 3) {
      items.push({
        id: 'trial-warning',
        type: 'trial',
        title: language === 'ar' ? '⚡ تجربتك تنتهي قريباً' :
               language === 'fr' ? '⚡ Essai bientôt terminé' :
               '⚡ Trial ending soon',
        message: language === 'ar'
          ? `متبقي ${trialDaysRemaining} أيام فقط — اشترك الآن`
          : language === 'fr'
          ? `${trialDaysRemaining} jours restants — Abonnez-vous`
          : `${trialDaysRemaining} days left — Subscribe now`,
        time: '',
        read: false,
      });
    }

    if (userStatus === 'expired') {
      items.push({
        id: 'trial-expired',
        type: 'trial',
        title: language === 'ar' ? '❌ انتهت فترة التجربة' :
               language === 'fr' ? '❌ Essai terminé' :
               '❌ Trial expired',
        message: language === 'ar'
          ? 'اشترك في Pro للوصول لجميع المميزات'
          : language === 'fr'
          ? 'Abonnez-vous à Pro pour accéder à toutes les fonctionnalités'
          : 'Subscribe to Pro to access all features',
        time: '',
        read: false,
      });
    }

    items.push({
      id: 'welcome',
      type: 'info',
      title: language === 'ar' ? '👋 مرحباً بك في TradeSmartDz' :
             language === 'fr' ? '👋 Bienvenue sur TradeSmartDz' :
             '👋 Welcome to TradeSmartDz',
      message: language === 'ar'
        ? 'سجّل صفقاتك يومياً لتحسين أدائك'
        : language === 'fr'
        ? 'Enregistrez vos trades quotidiennement'
        : 'Log your trades daily to improve performance',
      time: '',
      read: true,
    });

    return items;
  }, [userStatus, trialDaysRemaining, language]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const lang = language as 'ar' | 'fr' | 'en';
  const isRtl = language === 'ar';
  const isPro = userPlan === 'pro' || userStatus === 'trial';
  const userName = (user?.user_metadata?.full_name as string)?.trim()
    || user?.email?.split('@')[0] || 'Trader';
  const showTrialBanner = userStatus === 'trial' && trialDaysRemaining !== null;
  const daysLeft = trialDaysRemaining ?? 0;

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  useEffect(() => {
    const handlePop = () => setMobileMenuOpen(false);
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const cycleLang = () => {
    const langs: Array<'ar' | 'fr' | 'en'> = ['ar', 'fr', 'en'];
    setLanguage(langs[(langs.indexOf(lang) + 1) % langs.length]);
  };

  return (
    <div className="min-h-screen bg-background">

      {/* ══════════════════════════════════════════════════════
          MOBILE HEADER (fixed, below md)
      ══════════════════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-40 md:hidden">

        {/* Trial banner — above main bar */}
        {showTrialBanner && (
          <div className={`w-full text-center text-xs font-bold py-1.5 px-4 ${
            daysLeft <= 2
              ? 'bg-red-500 text-white'
              : daysLeft <= 4
              ? 'bg-amber-400 text-amber-900'
              : 'bg-teal-500 text-white'
          }`}>
            {language === 'ar'
              ? `⚡ متبقي ${trialDaysRemaining} أيام من التجربة المجانية`
              : language === 'fr'
              ? `⚡ ${trialDaysRemaining} jours d'essai restants`
              : `⚡ ${trialDaysRemaining} days of free trial left`}
          </div>
        )}

        {/* Main header bar */}
        <div className="bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm px-4 py-3">
          <div className={`flex items-center justify-between w-full relative ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>

            {/* Hamburger */}
            <button
              onPointerDown={() => setMobileMenuOpen(true)}
              className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center active:bg-gray-100 transition-colors"
            >
              <div className="flex flex-col gap-1.5 items-center justify-center">
                <span className="block h-0.5 w-5 bg-gray-700 rounded-full" />
                <span className="block h-0.5 w-4 bg-gray-700 rounded-full" />
                <span className="block h-0.5 w-5 bg-gray-700 rounded-full" />
              </div>
            </button>

            {/* Centered logo */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <Logo size="sm" />
            </div>

            {/* Right: bell + avatar */}
            <div className="flex items-center gap-2">
              <button
                onPointerDown={() => { setShowNotifications(!showNotifications); setMobileMenuOpen(false); }}
                className="relative w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center active:bg-gray-100 transition-colors"
              >
                <Bell className="w-4 h-4 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              <button
                onPointerDown={() => setMobileMenuOpen(true)}
                className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shadow-sm shadow-teal-200 active:bg-teal-600 transition-colors"
              >
                <span className="text-white font-black text-sm">
                  {(userName || 'T').charAt(0).toUpperCase()}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Notification panel (mobile) ── */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onPointerDown={() => setShowNotifications(false)}
        >
          <div
            className="absolute top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-lg animate-in slide-in-from-top duration-200"
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="font-bold text-gray-900 text-sm">
                {language === 'ar' ? 'الإشعارات' : language === 'fr' ? 'Notifications' : 'Notifications'}
              </p>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 flex items-start gap-3 ${!notif.read ? 'bg-teal-50/50' : 'bg-white'}`}
                  onPointerDown={() => {
                    if (notif.type === 'trial') {
                      setShowNotifications(false);
                      navigate('/settings?tab=subscription');
                    }
                  }}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notif.read ? 'bg-teal-500' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 leading-snug">{notif.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{notif.message}</p>
                  </div>
                  {notif.type === 'trial' && (
                    <span className="text-xs text-teal-500 font-bold flex-shrink-0">
                      {language === 'ar' ? 'ترقية ←' : 'Upgrade →'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MOBILE FULLSCREEN MENU
      ══════════════════════════════════════════════════════ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col">

          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onPointerDown={() => setMobileMenuOpen(false)}
          />

          {/* Menu panel slides from top */}
          <div
            className="relative bg-white rounded-b-3xl shadow-2xl shadow-gray-300/50 overflow-hidden animate-in slide-in-from-top duration-300"
            style={{ direction: isRtl ? 'rtl' : 'ltr' }}
          >

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <Logo size="sm" />
              <button
                onPointerDown={() => setMobileMenuOpen(false)}
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* User card */}
            <div className="mx-4 mt-4 mb-2 bg-gradient-to-br from-teal-50 to-white border border-teal-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center shadow-sm shadow-teal-200 flex-shrink-0">
                <span className="text-white font-black text-lg">
                  {(userName || 'T').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">
                  {userName || user?.email?.split('@')[0] || 'Trader'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isPro ? (
                    <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      ⭐ {userStatus === 'trial'
                        ? (language === 'ar' ? 'تجربة مجانية' : language === 'fr' ? 'Essai' : 'Free Trial')
                        : 'Pro'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
                      {language === 'ar' ? 'مجاني' : language === 'fr' ? 'Gratuit' : 'Free'}
                    </span>
                  )}
                  {userStatus === 'trial' && daysLeft > 0 && (
                    <span className={`text-xs font-semibold ${daysLeft <= 2 ? 'text-red-500' : 'text-amber-500'}`}>
                      {language === 'ar'
                        ? `· ${trialDaysRemaining} أيام`
                        : language === 'fr'
                        ? `· ${trialDaysRemaining}j restants`
                        : `· ${trialDaysRemaining}d left`}
                    </span>
                  )}
                </div>
              </div>
              {!isPro && (
                <button
                  onPointerDown={() => { setMobileMenuOpen(false); navigate('/settings?tab=subscription'); }}
                  className="bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0 active:bg-teal-600 transition-colors"
                >
                  {language === 'ar' ? 'ترقية' : 'Upgrade'}
                </button>
              )}
            </div>

            {/* Nav grid — 2 columns */}
            <div className="px-4 py-3 grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onPointerDown={() => { navigate(item.path); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                      active
                        ? 'bg-teal-500 text-white shadow-sm shadow-teal-200'
                        : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-gray-500'}`} />
                    <span className={`text-sm font-semibold truncate ${active ? 'text-white' : 'text-gray-700'}`}>
                      {item.label[lang]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom row: language + logout */}
            <div className="px-4 pb-2 flex items-center gap-2">
              <button
                onPointerDown={cycleLang}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl py-3 active:bg-gray-100 transition-colors"
              >
                <Globe className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-600">
                  {language === 'ar' ? '🇸🇦 عربي' : language === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                </span>
              </button>
              <button
                onPointerDown={async () => { setMobileMenuOpen(false); await handleLogout(); }}
                className="flex items-center justify-center gap-2 bg-red-50 border border-red-100 rounded-2xl py-3 px-4 active:bg-red-100 transition-colors"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold text-red-500">
                  {language === 'ar' ? 'خروج' : language === 'fr' ? 'Déconnexion' : 'Logout'}
                </span>
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 pb-5 pt-2 text-center">
              <p className="text-xs text-gray-300 font-medium">TradeSmartDz v1.0 · neuroport.xyz</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          DESKTOP SIDEBAR (icon-only, expands on hover)
      ══════════════════════════════════════════════════════ */}
      <aside
        className={`hidden md:flex flex-col fixed top-0 h-full z-30 bg-white shadow-sm transition-all duration-300 ease-in-out overflow-hidden ${
          isRtl ? 'right-0 border-l border-gray-100' : 'left-0 border-r border-gray-100'
        }`}
        style={{ width: sidebarExpanded ? '220px' : '64px' }}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >

        {/* Logo area */}
        <div className="flex items-center h-16 px-4 border-b border-gray-50 overflow-hidden flex-shrink-0">
          {sidebarExpanded ? (
            <Logo size="sm" />
          ) : (
            <div className="w-8 h-8 flex items-center justify-center mx-auto">
              <LogoIcon className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-hidden">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={!sidebarExpanded ? item.label[lang] : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full group relative ${
                  active
                    ? 'bg-teal-500 text-white shadow-sm shadow-teal-100'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {/* Active indicator pill */}
                {active && !sidebarExpanded && (
                  <span className={`absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-600 ${
                    isRtl ? 'left-0 rounded-r-full' : 'right-0 rounded-l-full'
                  }`} />
                )}
                <item.icon className={`w-5 h-5 flex-shrink-0 ${
                  active ? 'text-white' : 'text-gray-400 group-hover:text-gray-700'
                }`} />
                <span className={`text-sm font-semibold whitespace-nowrap transition-all duration-200 overflow-hidden ${
                  sidebarExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
                } ${active ? 'text-white' : 'text-gray-700'}`}>
                  {item.label[lang]}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom: user info + logout */}
        <div className="border-t border-gray-50 p-2 flex-shrink-0">
          <div
            className="flex items-center gap-2 px-1 py-2 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => navigate('/settings')}
          >
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-teal-100">
              <span className="text-white font-black text-xs">
                {(userName || 'T').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className={`overflow-hidden transition-all duration-200 ${
              sidebarExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
            }`}>
              <p className="text-xs font-bold text-gray-800 truncate leading-tight">{userName || 'Trader'}</p>
              <span className={`text-xs font-semibold ${isPro ? 'text-teal-600' : 'text-gray-400'}`}>
                {isPro
                  ? (userStatus === 'trial' ? '⚡ Trial' : '⭐ Pro')
                  : (language === 'ar' ? 'مجاني' : language === 'fr' ? 'Gratuit' : 'Free')}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowNotifications(!showNotifications)}
            title={!sidebarExpanded ? 'Notifications' : undefined}
            className="relative flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-all duration-200 mt-1"
          >
            <Bell className="w-4 h-4 flex-shrink-0" />
            {unreadCount > 0 && (
              <span className="absolute top-2 left-6 w-2 h-2 bg-red-500 rounded-full" />
            )}
            <span className={`text-sm font-semibold whitespace-nowrap transition-all duration-200 overflow-hidden ${
              sidebarExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
            }`}>
              {language === 'ar' ? 'الإشعارات' : language === 'fr' ? 'Notifications' : 'Notifications'}
              {unreadCount > 0 && (
                <span className="ms-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </span>
          </button>

          <button
            onClick={handleLogout}
            title={!sidebarExpanded ? 'Logout' : undefined}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200 mt-1"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className={`text-sm font-semibold whitespace-nowrap transition-all duration-200 overflow-hidden ${
              sidebarExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
            }`}>
              {language === 'ar' ? 'تسجيل الخروج' : language === 'fr' ? 'Déconnexion' : 'Logout'}
            </span>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ══════════════════════════════════════════════════════ */}
      <div className={`flex flex-col min-h-screen ${isRtl ? 'md:mr-16 md:ml-0' : 'md:ml-16'}`}>

        {/* Spacer matching fixed mobile header height */}
        <div className={`md:hidden flex-shrink-0 ${showTrialBanner ? 'h-[88px]' : 'h-16'}`} />

        {/* Desktop trial banner */}
        {showTrialBanner && (
          <div className={`hidden md:flex items-center justify-between px-4 py-2.5 text-sm font-medium flex-shrink-0 ${
            daysLeft <= 1
              ? 'bg-red-500/10 border-b border-red-500/20 text-red-500'
              : daysLeft <= 2
              ? 'bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-600'
              : 'bg-teal-500/10 border-b border-teal-500/20 text-teal-600'
          }`}>
            <div className="flex items-center gap-2">
              <span>⚡</span>
              <span>
                {daysLeft <= 0
                  ? (language === 'ar' ? 'انتهت تجربتك المجانية' : language === 'fr' ? 'Essai expiré' : 'Trial expired')
                  : language === 'ar'
                  ? `متبقي ${trialDaysRemaining} أيام من التجربة المجانية`
                  : language === 'fr'
                  ? `${trialDaysRemaining} jours d'essai restants`
                  : `${trialDaysRemaining} days of free trial left`}
              </span>
            </div>
            <button
              onClick={() => navigate('/settings?tab=subscription')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                daysLeft <= 1
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-teal-500 text-black hover:bg-teal-600'
              }`}
            >
              {language === 'ar' ? 'ترقية الآن' : language === 'fr' ? 'Passer Pro' : 'Upgrade Now'}
            </button>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════
          TRIAL WELCOME MODAL
      ══════════════════════════════════════════════════════ */}
      <Dialog open={showTrialWelcome} onOpenChange={setShowTrialWelcome}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:rounded-t-2xl max-sm:rounded-b-none md:rounded-2xl">
          <DialogTitle className="sr-only">مرحباً بك</DialogTitle>
          <DialogDescription className="sr-only">تجربة مجانية</DialogDescription>

          <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-8 text-center">
            <div className="text-6xl mb-3">🎉</div>
            <h2 className="text-2xl font-black text-white mb-1">{t('trial_welcome_title')}</h2>
            <p className="text-teal-100 text-sm">{t('trial_welcome_subtitle')}</p>
          </div>

          <div className="p-6">
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 mb-5 text-center">
              <p className="text-3xl font-black text-teal-500 mb-1">{t('trial_badge_days')}</p>
              <p className="text-sm text-muted-foreground">{t('trial_badge_subtitle')}</p>
            </div>

            <div className="space-y-2.5 mb-6">
              {([
                t('trial_feature_1'), t('trial_feature_2'), t('trial_feature_3'),
                t('trial_feature_4'), t('trial_feature_5'), t('trial_feature_6'),
              ] as string[]).map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-500 text-xs">✓</span>
                  </div>
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => setShowTrialWelcome(false)}
              className="w-full bg-teal-500 hover:bg-teal-600 text-black font-black py-3 text-base"
            >
              {t('trial_cta')}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-3">{t('trial_no_card')}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
