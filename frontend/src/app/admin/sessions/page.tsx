'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, PlayCircle, Clock, Users, BookOpen, Copy,
  ExternalLink, MoreVertical, Eye, BarChart3, Zap, Trash2
} from 'lucide-react';
import { sessionApi } from '@/lib/api';
import type { Session } from '@/types';

const STATUS_CONFIG: Record<string, { label: string; class: string; dot: string }> = {
  draft: { label: 'Draft', class: 'bg-white/5 text-white/40 border-white/10', dot: 'bg-white/30' },
  active: { label: 'Live', class: 'bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30', dot: 'bg-accent-emerald animate-pulse' },
  ended: { label: 'Ended', class: 'bg-accent-rose/15 text-accent-rose border-accent-rose/30', dot: 'bg-accent-rose' },
  archived: { label: 'Archived', class: 'bg-white/5 text-white/30 border-white/5', dot: 'bg-white/20' },
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await sessionApi.list();
      setSessions(res.data);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const copyLink = (link: string) => {
    const url = `${window.location.origin}/join/${link}`;
    navigator.clipboard.writeText(url);
    toast.success('Join link copied!');
  };

  const activate = async (id: string, current: string) => {
    const next = current === 'draft' ? 'active' : current === 'active' ? 'ended' : null;
    if (!next) return;
    setActivating(id);
    try {
      await sessionApi.updateStatus(id, next);
      toast.success(`Session ${next === 'active' ? 'activated' : 'ended'}`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Update failed');
    } finally { setActivating(null); }
  };

  const deleteSession = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await sessionApi.delete(id);
      toast.success('Session deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title">Sessions</h1>
          <p className="text-white/40 text-sm mt-1">Manage your interview sessions</p>
        </div>
        <Link href="/admin/sessions/create" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Session
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="glass-card h-24 skeleton" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <PlayCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-white mb-2">No sessions yet</h3>
          <p className="text-white/40 text-sm mb-6">Create your first session to start interviewing students</p>
          <Link href="/admin/sessions/create" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create First Session
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => {
            const cfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.draft;
            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-5 hover:border-white/15 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <Link href={`/admin/sessions/${session.id}`} className="font-display font-semibold text-white hover:text-brand-300 transition-colors truncate">
                        {session.title}
                      </Link>
                      <span className={`badge border ${cfg.class} flex items-center gap-1.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-5 text-xs text-white/40">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{session.duration_minutes}m</span>
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{session.question_count} questions</span>
                      <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />{session.total_marks} marks</span>
                      <span className="font-mono text-white/20">{session.join_code}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => deleteSession(session.id, session.title)}
                      className="p-1.5 text-white/20 hover:text-accent-rose transition-colors rounded-lg hover:bg-accent-rose/10"
                      title="Delete session">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {session.status !== 'ended' && session.status !== 'archived' && (
                      <button onClick={() => copyLink(session.join_link)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                        <Copy className="w-3 h-3" /> Copy Link
                      </button>
                    )}
                    {session.status === 'active' && (
                      <Link href={`/admin/sessions/${session.id}/monitor`} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                        <Eye className="w-3 h-3" /> Monitor
                      </Link>
                    )}
                    {(session.status === 'draft' || session.status === 'active') && (
                      <button
                        onClick={() => activate(session.id, session.status)}
                        disabled={activating === session.id}
                        className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                          session.status === 'draft'
                            ? 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30 hover:bg-accent-emerald hover:text-white'
                            : 'bg-accent-rose/10 text-accent-rose border border-accent-rose/30 hover:bg-accent-rose hover:text-white'
                        }`}
                      >
                        {activating === session.id
                          ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          : <Zap className="w-3 h-3" />
                        }
                        {session.status === 'draft' ? 'Activate' : 'End Session'}
                      </button>
                    )}
                    <Link href={`/admin/sessions/${session.id}/results`} className="text-white/30 hover:text-white p-1.5">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
