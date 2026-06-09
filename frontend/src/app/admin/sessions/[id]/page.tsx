'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Copy, Eye, BarChart3, Zap, Clock,
  BookOpen, Shield, Users, Link as LinkIcon, Trash2, Timer
} from 'lucide-react';
import { sessionApi } from '@/lib/api';
import type { Session } from '@/types';

function useSessionTimer(session: Session | null) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!session || session.status !== 'active') {
      setTimeLeft(null);
      return;
    }

    // Server se aya time_remaining_seconds use karo as base
    if (session.time_remaining_seconds !== undefined && session.time_remaining_seconds !== null) {
      setTimeLeft(session.time_remaining_seconds);
    } else if (session.activated_at) {
      const total = session.duration_minutes * 60;
      const elapsed = Math.floor((Date.now() - new Date(session.activated_at).getTime()) / 1000);
      setTimeLeft(Math.max(0, total - elapsed));
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [session?.id, session?.status, session?.time_remaining_seconds]);

  return timeLeft;
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  return `${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const timeLeft = useSessionTimer(session);

  useEffect(() => {
    sessionApi.get(sessionId).then(r => setSession(r.data)).catch(() => router.push('/admin/sessions')).finally(() => setLoading(false));
  }, [sessionId]);

  // Auto-refresh when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && session?.status === 'active') {
      setTimeout(() => {
        sessionApi.get(sessionId).then(r => setSession(r.data));
      }, 2000);
    }
  }, [timeLeft]);

  const copyLink = () => {
    if (!session) return;
    const url = `${window.location.origin}/join/${session.join_link}`;
    navigator.clipboard.writeText(url);
    toast.success('Join link copied to clipboard!');
  };

  const handleDelete = async () => {
    if (!session) return;
    if (!confirm(`Delete "${session.title}"? This cannot be undone.`)) return;
    try {
      await sessionApi.delete(session.id);
      toast.success('Session deleted');
      router.push('/admin/sessions');
    } catch { toast.error('Delete failed'); }
  };

  const updateStatus = async (status: string) => {
    if (!session) return;
    setActivating(true);
    try {
      await sessionApi.updateStatus(session.id, status);
      toast.success(`Session ${status}`);
      const res = await sessionApi.get(session.id);
      setSession(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Update failed');
    } finally { setActivating(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!session) return null;

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${session.join_link}` : '';

  const statusColors: Record<string, string> = {
    draft: 'bg-white/5 text-white/40 border-white/10',
    active: 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30',
    ended: 'bg-accent-rose/15 text-accent-rose border-accent-rose/30',
    archived: 'bg-white/5 text-white/20 border-white/5',
  };

  const isLowTime = timeLeft !== null && timeLeft < 300 && timeLeft > 0;
  const isExpired = timeLeft === 0 && session.status === 'active';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/sessions" className="text-white/40 hover:text-white p-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="section-title">{session.title}</h1>
              <span className={`badge border ${statusColors[session.status]}`}>{session.status}</span>
            </div>
            <p className="text-white/40 text-sm mt-0.5">Session Details & Controls</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session.status === 'active' && (
            <Link href={`/admin/sessions/${session.id}/monitor`} className="btn-secondary flex items-center gap-2">
              <Eye className="w-4 h-4" /> Live Monitor
            </Link>
          )}
          {session.status === 'ended' && (
            <Link href={`/admin/sessions/${session.id}/results`} className="btn-secondary flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> View Results
            </Link>
          )}
          {session.status === 'draft' && (
            <button onClick={() => updateStatus('active')} disabled={activating} className="btn-primary flex items-center gap-2">
              {activating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
              Activate Session
            </button>
          )}
          {session.status === 'active' && (
            <button onClick={() => updateStatus('ended')} disabled={activating} className="btn-danger flex items-center gap-2">
              {activating ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
              End Session
            </button>
          )}
          <button onClick={handleDelete} className="btn-danger flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {/* Live Timer Banner — active session ke liye */}
      {session.status === 'active' && timeLeft !== null && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-5 rounded-xl border p-4 flex items-center justify-between ${
            isExpired
              ? 'bg-red-500/10 border-red-500/30'
              : isLowTime
              ? 'bg-orange-500/10 border-orange-500/30 animate-pulse'
              : 'bg-brand-500/10 border-brand-500/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <Timer className={`w-5 h-5 ${isExpired ? 'text-red-400' : isLowTime ? 'text-orange-400' : 'text-brand-400'}`} />
            <div>
              <p className={`text-sm font-medium ${isExpired ? 'text-red-400' : isLowTime ? 'text-orange-400' : 'text-brand-400'}`}>
                {isExpired ? 'Session Time Expired — ending shortly...' : isLowTime ? 'Session ending soon!' : 'Session Time Remaining'}
              </p>
              <p className="text-white/40 text-xs mt-0.5">
                Students joining now will get the remaining time only
              </p>
            </div>
          </div>
          <div className={`font-mono text-2xl font-bold tabular-nums ${isExpired ? 'text-red-400' : isLowTime ? 'text-orange-400' : 'text-white'}`}>
            {isExpired ? '00m 00s' : formatTime(timeLeft)}
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-5">
          {session.status !== 'archived' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
              <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-brand-400" /> Student Join Link
              </h2>
              <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-white/8 mb-4">
                <span className="text-sm text-white/60 flex-1 truncate font-mono">{joinUrl || `[domain]/join/${session.join_link}`}</span>
                <button onClick={copyLink} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-white/40">
                  <span className="text-white/20">Join Code:</span>
                  <span className="font-mono font-bold text-white/70 tracking-widest">{session.join_code}</span>
                </div>
                {session.status === 'active' && (
                  <span className="flex items-center gap-1.5 text-accent-emerald text-xs">
                    <span className="w-1.5 h-1.5 bg-accent-emerald rounded-full animate-pulse" />
                    Active — Students can join now
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {(session.description || session.instructions) && (
            <div className="glass-card p-6">
              {session.description && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-white/40 mb-2">Description</h3>
                  <p className="text-sm text-white/60">{session.description}</p>
                </div>
              )}
              {session.instructions && (
                <div>
                  <h3 className="text-sm font-medium text-white/40 mb-2">Student Instructions</h3>
                  <p className="text-sm text-white/60 whitespace-pre-wrap">{session.instructions}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-display font-semibold text-white">Session Config</h2>
            {[
              { icon: Clock, label: 'Duration', value: `${session.duration_minutes} minutes` },
              { icon: BookOpen, label: 'Questions', value: `${session.question_count} questions` },
              { icon: BarChart3, label: 'Total Marks', value: session.total_marks },
              { icon: BarChart3, label: 'Passing Marks', value: session.passing_marks || 'Not set' },
              { icon: Shield, label: 'Max Warnings', value: session.max_warnings },
              { icon: Users, label: 'Shuffle Questions', value: session.shuffle_questions ? 'Yes' : 'No' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-white/40">
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </div>
                <span className="text-white/70 font-medium">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="glass-card p-5">
            <h2 className="font-display font-semibold text-white mb-3">Quick Links</h2>
            <div className="space-y-2">
              {session.status === 'active' && (
                <Link href={`/admin/sessions/${session.id}/monitor`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-glass text-sm text-white/60 hover:text-white transition-all">
                  <Eye className="w-4 h-4 text-accent-emerald" /> Live Monitor
                </Link>
              )}
              <Link href={`/admin/sessions/${session.id}/results`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-glass text-sm text-white/60 hover:text-white transition-all">
                <BarChart3 className="w-4 h-4 text-brand-400" /> View Results
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
