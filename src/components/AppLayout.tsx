import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LayoutDashboard, BarChart3, Link2, Settings, LogOut, Menu, X, TrendingUp, User, Calendar, BookOpen } from 'lucide-react';
import { useState, useMemo } from 'react';

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { t, isRtl, language } = useLanguage();

  const navItems = useMemo(() => [
    { label: t('dashboard'),      icon: LayoutDashboard, path: '/dashboard' },
    { label: t('myTrades'),       icon: TrendingUp,      path: '/trades'    },
    { label: t('analytics'),      icon: BarChart3,       path: '/analytics' },
    { label: t('connectAccount'), icon: Link2,           path: '/connect'   },
    { label: language === 'ar' ? 'التقويم الاقتصادي' : language === 'fr' ? 'Calendrier' : 'Calendar', icon: Calendar, path: '/calendar' },
    { label: t('dailyJournal'),   icon: BookOpen,        path: '/journal'   },
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
    <div className="flex min-h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden transform computed in JS to avoid rtl: variant conflicting with lg:translate-x-0 */}
      <aside className={`fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'}`}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <Logo size="sm" />
          <Button variant="ghost" size="icon" className="h-11 w-11 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1 lg:hidden" />
          <div className="hidden lg:flex flex-1" />
          <div className="flex items-center gap-1 sm:gap-2">
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
