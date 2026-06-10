'use client';
import { useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/theme.store';

interface ThemeToggleProps {
  collapsed?: boolean;
}

export default function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }
  }, [theme]);

  const isLight = theme === 'light';

  return (
    <button
      onClick={toggleTheme}
      title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      aria-label="Toggle theme"
      className={`nav-item w-full mb-1 ${collapsed ? 'justify-center px-2' : ''}`}
      style={{
        background: isLight
          ? 'rgba(245, 158, 11, 0.12)'
          : 'rgba(91,106,245,0.08)',
        border: `1px solid ${isLight ? 'rgba(245,158,11,0.3)' : 'rgba(91,106,245,0.2)'}`,
      }}
    >
      <span className="relative w-4 h-4 flex-shrink-0">
        <Sun
          className={`absolute inset-0 w-4 h-4 transition-all duration-300 text-amber-400 ${
            isLight ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
          }`}
        />
        <Moon
          className={`absolute inset-0 w-4 h-4 transition-all duration-300 text-brand-400 ${
            isLight ? 'opacity-0 -rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
          }`}
        />
      </span>
      {!collapsed && (
        <span className="text-sm" style={{ color: isLight ? 'rgb(245,158,11)' : 'var(--text-secondary)' }}>
          {isLight ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}
