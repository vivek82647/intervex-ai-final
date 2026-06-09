'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, LayoutDashboard, Users, BookOpen, PlayCircle,
  BarChart3, LogOut, ChevronLeft, ChevronRight,
  GraduationCap, Menu, FileEdit, Sun, Moon
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore } from '@/store/theme.store';

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/sessions',  icon: PlayCircle,      label: 'Sessions' },
  { href: '/admin/test-builder', icon: FileEdit,     label: 'Test Builder' },
  { href: '/admin/questions', icon: BookOpen,        label: 'Question Bank' },
  { href: '/admin/students',  icon: GraduationCap,   label: 'Students' },
  { href: '/admin/classes',   icon: Users,           label: 'Classes' },
  { href: '/admin/results',   icon: BarChart3,       label: 'Results' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const router     = useRouter();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydration safe — avoid flash
  useEffect(() => { setMounted(true); }, []);

  const handleLogout = () => { logout(); router.push('/auth/login'); };

  const isLight = theme === 'light';

  // Dynamic classes based on theme
  const sidebarBg    = isLight ? 'bg-white border-r border-[rgba(91,106,245,0.1)]' : 'bg-surface-1 border-r border-white/5';
  const mainBg       = isLight ? 'bg-[#F0F4FF]' : 'bg-surface';
  const topbarBg     = isLight ? 'bg-white border-b border-[rgba(91,106,245,0.1)]' : 'bg-surface-1 border-b border-white/5';
  const collapseBtn  = isLight
    ? 'bg-white border border-[rgba(91,106,245,0.15)] text-slate-400 hover:text-brand-500 shadow-sm'
    : 'bg-surface-3 border border-white/10 text-white/50 hover:text-white';
  const logoText     = isLight ? 'text-slate-800' : 'text-white';
  const userNameText = isLight ? 'text-slate-700' : 'text-white';
  const userEmailText= isLight ? 'text-slate-400' : 'text-white/30';
  const signOutClass = isLight
    ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-red-500 hover:bg-red-50 transition-all duration-200 cursor-pointer'
    : 'nav-item w-full text-accent-rose hover:text-accent-rose hover:bg-accent-rose/10';

  const ThemeToggle = ({ showLabel = false }: { showLabel?: boolean }) => (
    <button
      onClick={toggleTheme}
      title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
        isLight
          ? 'bg-[rgba(91,106,245,0.08)] text-brand-500 hover:bg-[rgba(91,106,245,0.14)]'
          : 'bg-surface-glass text-white/60 hover:text-white hover:bg-surface-3'
      }`}
    >
      {mounted && (
        isLight
          ? <Moon className="w-4 h-4" />
          : <Sun  className="w-4 h-4" />
      )}
      {showLabel && mounted && (
        <span>{isLight ? 'Dark Mode' : 'Light Mode'}</span>
      )}
    </button>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 ${isLight ? 'border-b border-[rgba(91,106,245,0.08)]' : 'border-b border-white/5'} ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(91,106,245,0.4)]">
          <Brain className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className={`font-display text-base font-bold ${logoText}`}>INTERVEX AI</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`${active ? 'nav-item-active' : 'nav-item'} ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + Theme toggle + Logout */}
      <div className={`p-3 ${isLight ? 'border-t border-[rgba(91,106,245,0.08)]' : 'border-t border-white/5'}`}>
        {/* Theme toggle */}
        {!collapsed ? (
          <div className="mb-2">
            <ThemeToggle showLabel />
          </div>
        ) : (
          <div className="mb-2 flex justify-center">
            <ThemeToggle />
          </div>
        )}

        {!collapsed && user && (
          <div className="px-3 py-2 mb-2">
            <p className={`text-sm font-medium truncate ${userNameText}`}>{user.full_name}</p>
            <p className={`text-xs truncate ${userEmailText}`}>{user.email}</p>
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`${signOutClass} ${collapsed ? 'justify-center px-2' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen overflow-hidden ${mainBg}`}>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.25 }}
        className={`hidden md:flex flex-col relative z-20 flex-shrink-0 ${sidebarBg}`}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-colors z-30 ${collapseBtn}`}
        >
          {collapsed
            ? <ChevronRight className="w-3 h-3" />
            : <ChevronLeft  className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-30 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              className={`fixed left-0 top-0 bottom-0 w-60 z-40 md:hidden flex flex-col ${sidebarBg}`}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className={`md:hidden flex items-center justify-between px-4 py-3 ${topbarBg}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} style={{ color: 'var(--text-secondary)' }}>
              <Menu className="w-5 h-5" />
            </button>
            <span className={`font-display font-bold text-sm ${logoText}`}>INTERVEX AI</span>
          </div>
          <ThemeToggle />
        </div>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}