'use client';
import { useEffect, useState } from 'react';
import { XCircle, Mail, Send, CheckCircle, Clock } from 'lucide-react';
import { useStudentStore } from '@/store/auth.store';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';

export default function TerminatedPage() {
  const router = useRouter();
  const { studentName, studentId, sessionId, clearSession } = useStudentStore();
  const [reason, setReason] = useState('');
  const [requestStatus, setRequestStatus] = useState<'idle'|'sending'|'sent'|'approved'|'rejected'>('idle');
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Block back button
    window.history.pushState(null, '', window.location.href);
    const block = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', block);

    // Connect socket to listen for admin response
    if (sessionId && studentId) {
      const s = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000', {
        auth: { token: Cookies.get('access_token') },
        transports: ['websocket'],
      });

      s.on('rejoin_approved', () => {
        setRequestStatus('approved');
      });

      s.on('rejoin_rejected', () => {
        setRequestStatus('rejected');
      });

      s.on('rejoin_request_sent', () => {
        setRequestStatus('sent');
      });

      setSocket(s);
      return () => {
        s.disconnect();
        window.removeEventListener('popstate', block);
      };
    }

    return () => window.removeEventListener('popstate', block);
  }, [sessionId, studentId]);

  const handleRequestRejoin = () => {
    if (!socket || !sessionId || !studentId) return;
    setRequestStatus('sending');
    socket.emit('request_rejoin', {
      session_id: sessionId,
      student_id: studentId,
      student_name: studentName,
      reason: reason || 'No reason provided',
    });
  };

  const handleRejoin = () => {
    // Clear terminated state and go back to join
    clearSession();
    router.push('/');
  };

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
          This happened due to repeated policy violations. Your session is expired
          and cannot be resumed without admin approval.
        </p>

        {/* Rejoin Request Section */}
        {requestStatus === 'idle' && sessionId && studentId && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4 text-left">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400" />
              Request Rejoin
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              If you believe this was a mistake, send a request to the administrator.
            </p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why you should be allowed to rejoin..."
              className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-indigo-400 mb-3"
              rows={3}
            />
            <button
              onClick={handleRequestRejoin}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Request
            </button>
          </div>
        )}

        {requestStatus === 'sending' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-white/60 text-sm">Sending request...</p>
          </div>
        )}

        {requestStatus === 'sent' && (
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-6 mb-4">
            <Clock className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
            <p className="text-indigo-300 font-medium mb-1">Request Sent!</p>
            <p className="text-white/50 text-sm">Waiting for administrator approval...</p>
          </div>
        )}

        {requestStatus === 'approved' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-emerald-300 font-medium mb-1">Rejoin Approved!</p>
            <p className="text-white/50 text-sm mb-4">Admin has approved your request.</p>
            <button
              onClick={handleRejoin}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-medium transition-all"
            >
              Rejoin Test →
            </button>
          </div>
        )}

        {requestStatus === 'rejected' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-4">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-300 font-medium mb-1">Request Denied</p>
            <p className="text-white/50 text-sm">Admin has rejected your rejoin request. Contact them directly.</p>
          </div>
        )}

        <p className="text-white/20 text-xs mt-4">
          Back button is disabled on this page.
        </p>
      </div>
    </div>
  );
}