import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono, Syne } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import KeepAlive from '@/components/KeepAlive';
import ThemeProvider from '@/components/ThemeProvider';

const displayFont = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
});

const bodyFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'INTERVEX AI — AI-Powered Mock Interview Platform',
  description: 'Enterprise-grade AI assessment platform for educators and students',
  keywords: ['mock interview', 'assessment', 'AI evaluation', 'online exam'],
  appleWebApp: { capable: true, statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Anti-flash: apply theme before paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = JSON.parse(localStorage.getItem('intervex-theme') || '{}');
            if (t && t.state && t.state.theme === 'light') {
              document.documentElement.setAttribute('data-theme', 'light');
            }
          } catch(e) {}
        `}} />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} font-body antialiased`}>
        <ThemeProvider>
          {children}
          <KeepAlive />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
              },
              success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
              error: { iconTheme: { primary: '#F43F5E', secondary: '#fff' } },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
