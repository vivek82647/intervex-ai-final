'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { XCircle, Mail, Send, CheckCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000';

function BlockedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'terminated';
  // Read session/student context stored before termination
  const sessionId  = searchParams.get('session_id')  || (typeof window !== 'undefined' ? localStorage.getItem('session_id')  ?? '' : '');
  const studentId  = searchParams.get('student_id')  || (typeof window !== 'undefined' ? localStorage.getItem('student_id')  ?? '' : '');

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [message,  setMessage]  = useState('');
  const [sent,     setSent]     = useState(false);
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState('');

  const socketRef = useRef<Socket | null>(null);

  // Prevent navigation away from this page
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const block = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', block);
    return () => window.removeEventListener('popstate', block);
  }, []);

  // Connect socket so we can emit request_rejoin
  useEffect(() => {
    if (!sessionId) return;
    const socket = io(WS_URL, { transports: ['websocket'], reconnection: false });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) { setError('Name and email required'); return; }
    setError('');
    setSending(true);

    try {
      // 1. REST call (existing behaviour)
      await fetch(`${API}/auth/student/rejoin-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, reason }),
      });
    } catch {
      // ignore REST errors — WS notification still matters
    }

    // 2. WebSocket emit so monitor page gets real-time notification
    if (socketRef.current && sessionId) {
      socketRef.current.emit('request_rejoin', {
        session_id:   sessionId,
        student_id:   studentId  || email,   // fallback to email if id not stored
        student_name: name,
        email,                                // Fix 2 companion: send email along
        reason:       message || reason,
      });
    }

    setSent(true);
    setSending(false);
  };

  const isIP = reason === 'ip';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-red-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Session Expired</h1>
          <p className="text-red-300 text-sm">
            {isIP
              ? 'Access from this device/network has been blocked for this session.'
              : 'Your test session was terminated due to policy violations.'}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 text-sm text-white/50 leading-relaxed">
          {isIP
            ? 'A previous attempt from this IP address was terminated. You cannot rejoin this session from this network.'
            : 'This session is permanently closed for your account. You cannot resume or retake this test.'}
          <br /><br />
          To get access, please contact your administrator and request a new session.
        </div>

        {!sent ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" /> Request Admin Access
            </h3>
            <p className="text-white/40 text-xs mb-4">Send a request to your administrator for a new session.</p>
            <form onSubmit={handleRequest} className="space-y-3">
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Your Full Name" required
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-400"
              />
              <input
                value={email} onChange={e => setEmail(e.target.value)}
                type="email" placeholder="Your Email" required
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-400"
              />
              <textarea
                value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Explain why you need access (optional)..." rows={3}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-400 resize-none"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit" disabled={sending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send Request to Admin'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-emerald-300 font-semibold mb-1">Request Sent!</p>
            <p className="text-white/40 text-sm">Your administrator will review and contact you if a new session is provided.</p>
          </div>
        )}

        <p className="text-white/20 text-xs text-center mt-6">This page cannot be navigated away from.</p>
      </div>
    </div>
  );
}

export default function BlockedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BlockedContent />
    </Suspense>
  );
}