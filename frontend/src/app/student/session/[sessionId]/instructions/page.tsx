'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Shield, Clock, AlertTriangle, CheckCircle, Monitor,
  Copy, RefreshCw, Eye, Maximize, ArrowRight, Brain
} from 'lucide-react';
import { sessionApi, attemptApi } from '@/lib/api';
import { useStudentStore } from '@/store/auth.store';

const rules = [
  { icon: Maximize, text: 'You must stay in fullscreen mode throughout the test', level: 'critical' },
  { icon: Eye, text: 'Tab switching is monitored — 3 violations auto-terminates', level: 'critical' },
  { icon: Copy, text: 'Copy-paste is disabled during the test', level: 'warning' },
  { icon: RefreshCw, text: 'Do not refresh the page — your progress is auto-saved', level: 'warning' },
  { icon: Monitor, text: 'Dev tools and right-click are disabled', level: 'warning' },
  { icon: Clock, text: 'Timer starts when you click "Start Test"', level: 'info' },
  { icon: CheckCircle, text: 'Answers are auto-saved as you type', level: 'info' },
  { icon: CheckCircle, text: 'You can navigate between questions freely', level: 'info' },
];

export default function InstructionsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();
  const { studentName } = useStudentStore();
  // Block back button on instructions page too
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const blockBack = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockBack);
    return () => window.removeEventListener('popstate', blockBack);
  }, []);

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const checkAttempt = async () => {
      try {
        // Check if student already has terminated/submitted attempt
        const sessionRes = await sessionApi.get(sessionId);
        setSession(sessionRes.data);
        // Try to get existing attempt status
        const { studentId } = useStudentStore.getState();
        if (studentId) {
          try {
            const attemptRes = await attemptApi.start({ session_id: sessionId });
            if (attemptRes.data.status === 'terminated') {
              router.replace(`/student/terminated`);
              return;
            }
            if (attemptRes.data.status === 'submitted') {
              router.replace(`/student/result/${attemptRes.data.attempt_id}`);
              return;
            }
          } catch (e: any) {
            const detail = e?.response?.data?.detail || '';
            if (detail.includes('terminated')) {
              router.replace(`/student/terminated`);
              return;
            }
            if (detail.includes('already submitted')) {
              router.replace(`/student/session/${sessionId}/submitted`);
              return;
            }
          }
        }
      } catch {} finally { setLoading(false); }
    };
    checkAttempt();
  }, [sessionId]);

  const startTest = async () => {
    setStarting(true);
    try {
      // Request fullscreen first
      await document.documentElement.requestFullscreen().catch(() => {});
      router.push(`/student/session/${sessionId}/test`);
    } catch {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface grid-bg flex items-center justify-center p-4">
      <div className="fixed top-1/3 -left-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center mx-auto mb-4">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Hey {studentName?.split(' ')[0]}, ready to begin?
          </h1>
          <p className="text-white/40 mt-1">{session?.title}</p>
        </div>

        {/* Session info cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="glass-card p-4 text-center">
            <Clock className="w-5 h-5 text-accent-amber mx-auto mb-2" />
            <div className="font-display text-xl font-bold text-white">{session?.duration_minutes}</div>
            <div className="text-xs text-white/30">Minutes</div>
          </div>
          <div className="glass-card p-4 text-center">
            <CheckCircle className="w-5 h-5 text-brand-400 mx-auto mb-2" />
            <div className="font-display text-xl font-bold text-white">{session?.total_marks}</div>
            <div className="text-xs text-white/30">Total Marks</div>
          </div>
          <div className="glass-card p-4 text-center">
            <Shield className="w-5 h-5 text-accent-rose mx-auto mb-2" />
            <div className="font-display text-xl font-bold text-white">{session?.max_warnings || 3}</div>
            <div className="text-xs text-white/30">Max Warnings</div>
          </div>
        </div>

        {/* Instructions from admin */}
        {session?.instructions && (
          <div className="glass-card p-5 mb-5">
            <h2 className="text-sm font-medium text-white/60 mb-3">Instructions from Examiner</h2>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{session.instructions}</p>
          </div>
        )}

        {/* Rules */}
        <div className="glass-card p-5 mb-5">
          <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent-rose" /> Anti-Cheat Rules
          </h2>
          <div className="space-y-3">
            {rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  rule.level === 'critical' ? 'bg-accent-rose/15 text-accent-rose' :
                  rule.level === 'warning' ? 'bg-accent-amber/15 text-accent-amber' :
                  'bg-brand-500/15 text-brand-400'
                }`}>
                  <rule.icon className="w-3.5 h-3.5" />
                </div>
                <p className={`text-sm leading-relaxed ${
                  rule.level === 'critical' ? 'text-white/70' : 'text-white/50'
                }`}>
                  {rule.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Agreement */}
        <label className="flex items-start gap-3 mb-5 cursor-pointer group">
          <div
            onClick={() => setAgreed(!agreed)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
              agreed ? 'border-brand-500 bg-brand-500' : 'border-white/20 group-hover:border-white/40'
            }`}
          >
            {agreed && <CheckCircle className="w-3 h-3 text-white" />}
          </div>
          <span className="text-sm text-white/50">
            I have read all the instructions and agree to the anti-cheat rules. I understand that violations may result in session termination.
          </span>
        </label>

        {/* Start button */}
        <motion.button
          onClick={startTest}
          disabled={!agreed || starting}
          whileHover={agreed ? { scale: 1.02 } : {}}
          whileTap={agreed ? { scale: 0.98 } : {}}
          className={`w-full py-4 rounded-2xl font-display font-bold text-lg flex items-center justify-center gap-3 transition-all ${
            agreed
              ? 'bg-gradient-to-r from-brand-500 to-brand-400 text-white shadow-[0_0_30px_rgba(91,106,245,0.5)] hover:shadow-[0_0_50px_rgba(91,106,245,0.7)]'
              : 'bg-surface-3 text-white/20 cursor-not-allowed'
          }`}
        >
          {starting ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Start Test</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </motion.button>

        <p className="text-center text-xs text-white/20 mt-4">
          Once started, your session timer begins and cannot be paused.
        </p>
      </motion.div>
    </div>
  );
}
