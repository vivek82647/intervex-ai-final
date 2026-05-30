'use client';
import { AlertTriangle, Mail } from 'lucide-react';
import Link from 'next/link';

export default function TerminatedPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-accent-rose/15 border border-accent-rose/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-accent-rose" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-3">
          Session Terminated
        </h1>
        <p className="text-white/50 mb-2">
          Your test session was terminated due to multiple violations of exam rules.
        </p>
        <p className="text-white/40 text-sm mb-8">
          You cannot re-attempt this session. Please contact your administrator for assistance.
        </p>
        <div className="glass-card p-5 text-left mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-brand-400" />
            <span className="text-sm text-white font-medium">Contact Admin</span>
          </div>
          <p className="text-white/40 text-sm">
            Reach out to your instructor or exam administrator to explain the situation. 
            They can review your case and provide a new session if needed.
          </p>
        </div>
        <Link href="/student/join" className="btn-secondary inline-flex items-center gap-2">
          Back to Join Page
        </Link>
      </div>
    </div>
  );
}
