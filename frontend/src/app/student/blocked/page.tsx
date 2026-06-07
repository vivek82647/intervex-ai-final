'use client';
import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldOff, XCircle } from 'lucide-react';

function BlockedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'terminated';

  useEffect(() => {
    // Back button permanently block
    const blockNav = () => window.history.pushState(null, '', window.location.href);
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockNav);
    return () => window.removeEventListener('popstate', blockNav);
  }, []);

  const isIpBlock = reason === 'ip';

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a0000 50%, #0f0f0f 100%)' }}
    >
      <div className="w-full max-w-md text-center select-none">

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

        <h1
          className="text-4xl font-black mb-3 tracking-tight"
          style={{ color: '#ff4444', textShadow: '0 0 20px rgba(255,68,68,0.4)' }}
        >
          {isIpBlock ? 'NETWORK BLOCKED' : 'ACCESS DENIED'}
        </h1>

        <div
          className="inline-block px-4 py-1 rounded-full text-xs font-bold tracking-widest mb-6"
          style={{ background: 'rgba(220,38,38,0.2)', color: '#ff6666', border: '1px solid rgba(220,38,38,0.3)' }}
        >
          PERMANENTLY BLOCKED
        </div>

        <div
          className="rounded-2xl p-6 mb-6 text-left"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-white font-semibold text-base mb-3">
            {isIpBlock
              ? 'This network/IP address has been permanently blocked.'
              : 'Your test session has been permanently terminated.'}
          </p>
          <ul className="space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>Joining with any email address from this device is not allowed.</span>
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>Switching accounts or browsers will not bypass this block.</span>
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span>This block is permanent and cannot be bypassed.</span>
            </li>
          </ul>
        </div>

        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Contact your exam administrator if you believe this was an error.
          </p>
        </div>

        <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
          Navigation is disabled on this page.
        </p>
      </div>
    </div>
  );
}

export default function BlockedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <BlockedContent />
    </Suspense>
  );
}
