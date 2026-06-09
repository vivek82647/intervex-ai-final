'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/theme.store';

interface ThemeToggleProps {
  collapsed?: boolean;
}

export default function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  // Avoid SSR hydration mismatch — render only after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply theme to <html> on every change
  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
    }
  }, [theme, mounted]);

  // Render a neutral placeholder until hydrated (same size, no flicker)
  if (!mounted) {
    return (
      <div className={`nav-item w-full ${collapsed ? 'justify-center px-2' : ''}`}>
        <span className="w-4 h-4 flex-shrink-0" />
        {!collapsed && <span>Theme</span>}
      </div>
    );
  }

  const isLight = theme === 'light';

  return (
    <button
      onClick={toggleTheme}
      title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      aria-label="Toggle theme"
      className={`nav-item w-full ${collapsed ? 'justify-center px-2' : ''} hover:bg-brand-500/10`}
    >
      <span className="relative w-4 h-4 flex-shrink-0">
        <Sun
          className={`absolute inset-0 w-4 h-4 transition-all duration-300 ${
            isLight ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
          }`}
        />
        <Moon
          className={`absolute inset-0 w-4 h-4 transition-all duration-300 ${
            isLight ? 'opacity-0 -rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
          }`}
        />
      </span>
      {!collapsed && (
        <span>{isLight ? 'Light Mode' : 'Dark Mode'}</span>
      )}
    </button>
  );
}
