'use client';
import { useEffect } from 'react';
import { XCircle, ShieldOff } from 'lucide-react';

export default function TerminatedPage() {

  useEffect(() => {
    // Back button block — permanently
    const blockNav = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockNav);

    // Koi bhi navigation block karo
    const blockBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', blockBeforeUnload);

    return () => {
      window.removeEventListener('popstate', blockNav);
      window.removeEventListener('beforeunload', blockBeforeUnload);
    };
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a0000 50%, #0f0f0f 100%)' }}
    >
      <div className="w-full max-w-md text-center select-none">

        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(220,38,38,0.15)',
              border: '2px solid rgba(220,38,38,0.4)',
              boxShadow: '0 0 40px rgba(220,38,38,0.2)',
            }}
          >
            <ShieldOff className="w-14 h-14 text-red-500" />
          </div>
        </div>

        {/* Title */}
        <h1
          className="text-4xl font-black mb-3 tracking-tight"
          style={{ color: '#ff4444', textShadow: '0 0 20px rgba(255,68,68,0.4)' }}
        >
          ACCESS DENIED
        </h1>

        <div
          className="inline-block px-4 py-1 rounded-full text-xs font-bold tracking-widest mb-6"
          style={{ background: 'rgba(220,38,38,0.2)', color: '#ff6666', border: '1px solid rgba(220,38,38,0.3)' }}
        >
          PERMANENTLY TERMINATED
        </div>

        {/* Message box */}
        <div
          className="rounded-2xl p-6 mb-6 text-left"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <p className="text-white font-semibold text-base mb-3">
            Your test session has been permanently terminated.
          </p>
          <ul className="space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>This device and account are permanently blocked for this test.</span>
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>Rejoining with any email address is not possible from this network.</span>
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>Contacting your administrator is the only option if you believe this is an error.</span>
            </li>
          </ul>
        </div>

        {/* No options — strict */}
        <div
          className="rounded-xl p-4"
          style={{
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.2)',
          }}
        >
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Contact your exam administrator if you believe this termination was an error.
            Attempting to rejoin will be blocked automatically.
          </p>
        </div>

        <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
          Navigation is disabled on this page.
        </p>
      </div>
    </div>
  );
}
