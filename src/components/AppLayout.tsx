import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LayoutDashboard, BarChart3, Link2, Settings, LogOut, Menu, X, TrendingUp, User, Calendar, BookOpen, Bot } from 'lucide-react';
import { useState, useMemo } from 'react';

export default function AppLayout() {
  const { user, signOut } = useAuth();
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
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
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
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSidebarOpen(false);
            }}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
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

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
