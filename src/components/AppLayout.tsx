import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LayoutDashboard, BarChart3, Link2, Settings, LogOut, Menu, X, TrendingUp, User, Calendar, BookOpen, Bot } from 'lucide-react';
import { useState, useMemo } from 'react';

export default function AppLayout() {
  const { user, signOut, userStatus, trialDaysRemaining, showTrialWelcome, setShowTrialWelcome } = useAuth();
  const { t, language } = useLanguage();

  const navItems = useMemo(() => [
    { label: t('dashboard'),      icon: LayoutDashboard, path: '/dashboard' },
    { label: t('myTrades'),       icon: TrendingUp,      path: '/trades'    },
    { label: t('analytics'),      icon: BarChart3,       path: '/analytics' },
    { label: t('connectAccount'), icon: Link2,           path: '/connect'   },
    { label: language === 'ar' ? 'التقويم الاقتصادي' : language === 'fr' ? 'Calendrier' : 'Calendar', icon: Calendar, path: '/calendar' },
    { label: t('dailyJournal'),   icon: BookOpen,        path: '/journal'   },
    { label: language === 'ar' ? 'المدرب الذكي' : language === 'fr' ? 'Coach IA' : 'AI Coach', icon: Bot, path: '/ai-coach' },
    { label: t('settings'),       icon: Settings,        path: '/settings'  },
  ], [t, language]);

  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-background">

      {/* Overlay — full screen, both click and touch */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          style={{ touchAction: 'manipulation' }}
          onClick={() => setSidebarOpen(false)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setSidebarOpen(false);
          }}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col border-e border-border bg-card transition-transform duration-300 ease-in-out lg:static lg:h-auto lg:w-64 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <Logo size="sm" />
          {/* X button — 44px tap target, both click and touchEnd */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSidebarOpen(false);
            }}
            style={{ touchAction: 'manipulation' }}
            className="lg:hidden p-3 rounded-xl hover:bg-muted transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center cursor-pointer select-none"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          <Button
            variant="ghost"
            className="min-h-[44px] w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="truncate">{t('logout')}</span>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Mobile-only header — 3-column: hamburger | logo | icons */}
        <header className="h-14 px-3 flex items-center border-b border-border bg-background lg:hidden sticky top-0 z-30 shrink-0">
          <div className="flex flex-1 items-center">
            <button
              type="button"
              onPointerDown={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-muted touch-manipulation"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <Logo size="sm" />
          <div className="flex flex-1 items-center justify-end gap-1">
            <LanguageSwitcher variant="compact" />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-[200px]">
                <DropdownMenuItem className="truncate text-xs text-muted-foreground">{user?.email}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="me-2 h-4 w-4" /> {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Desktop-only header — icons on right */}
        <header className="h-14 px-4 hidden lg:flex items-center justify-end border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="compact" />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-[200px]">
                <DropdownMenuItem className="truncate text-xs text-muted-foreground">{user?.email}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="me-2 h-4 w-4" /> {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Trial countdown banner */}
        {userStatus === 'trial' && trialDaysRemaining !== null && (
          <div className={`flex items-center justify-between px-4 py-2.5 text-sm font-medium ${
            trialDaysRemaining <= 1
              ? 'bg-red-500/10 border-b border-red-500/20 text-red-500'
              : trialDaysRemaining <= 2
              ? 'bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-600'
              : 'bg-teal-500/10 border-b border-teal-500/20 text-teal-600'
          }`}>
            <div className="flex items-center gap-2">
              <span>⚡</span>
              <span>
                {trialDaysRemaining <= 0
                  ? t('trial_banner_expired')
                  : trialDaysRemaining === 1
                  ? t('trial_banner_one_day')
                  : t('trial_banner_days_remaining').replace('{days}', String(trialDaysRemaining))
                }
              </span>
            </div>
            <button
              onClick={() => navigate('/settings?tab=subscription')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                trialDaysRemaining <= 1
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-teal-500 text-black hover:bg-teal-600'
              }`}
            >
              {t('trial_upgrade_btn')}
            </button>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Welcome trial modal */}
      <Dialog open={showTrialWelcome} onOpenChange={setShowTrialWelcome}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:rounded-t-2xl max-sm:rounded-b-none md:rounded-2xl">
          <DialogTitle className="sr-only">مرحباً بك</DialogTitle>
          <DialogDescription className="sr-only">تجربة مجانية</DialogDescription>

          {/* Gradient header */}
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-8 text-center">
            <div className="text-6xl mb-3">🎉</div>
            <h2 className="text-2xl font-black text-white mb-1">
              {t('trial_welcome_title')}
            </h2>
            <p className="text-teal-100 text-sm">
              {t('trial_welcome_subtitle')}
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Trial badge */}
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 mb-5 text-center">
              <p className="text-3xl font-black text-teal-500 mb-1">{t('trial_badge_days')}</p>
              <p className="text-sm text-muted-foreground">{t('trial_badge_subtitle')}</p>
            </div>

            {/* Features list */}
            <div className="space-y-2.5 mb-6">
              {([
                t('trial_feature_1'),
                t('trial_feature_2'),
                t('trial_feature_3'),
                t('trial_feature_4'),
                t('trial_feature_5'),
                t('trial_feature_6'),
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

            <p className="text-xs text-muted-foreground text-center mt-3">
              {t('trial_no_card')}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
