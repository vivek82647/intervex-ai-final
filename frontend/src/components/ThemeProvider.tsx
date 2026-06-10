'use client';
import { useEffect } from 'react';
import { useThemeStore } from '@/store/theme.store';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }
  }, [theme]);

  // On first mount — read from localStorage directly to avoid flash
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('intervex-theme') || '{}');
      const t = stored?.state?.theme;
      if (t === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    } catch {}
  }, []);

  return <>{children}</>;
}
