'use client';
import { useEffect } from 'react';
import { XCircle, Mail } from 'lucide-react';
import { useStudentStore } from '@/store/auth.store';

export default function TerminatedPage() {
  const { studentName, clearSession } = useStudentStore();

  useEffect(() => {
    // Mark as terminated in sessionStorage so back button cant load test
    sessionStorage.setItem('session_status', 'terminated');
    // Clear student session store
    clearSession();
    // Block back navigation
    window.history.pushState(null, '', window.location.href);
    const block = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', block);
    return () => window.removeEventListener('popstate', block);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-red-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-white mb-3">Session Terminated</h1>
        <p className="text-red-300 text-lg font-medium mb-2">
          {studentName ? `${studentName}, your` : 'Your'} test session has been terminated.
        </p>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          This happened due to repeated policy violations during the test.
          Your session is now permanently expired and cannot be resumed.
        </p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <p className="text-white/60 text-sm leading-relaxed">
            If you believe this was a mistake or would like to request a new session,
            please contact your exam administrator for assistance.
          </p>
        </div>

        <a
          href="mailto:"
          className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium transition-all"
        >
          <Mail className="w-4 h-4" />
          Contact Administrator
        </a>

        <p className="text-white/20 text-xs mt-8">
          This page cannot be navigated away from via back button.
        </p>
      </div>
    </div>
  );
}