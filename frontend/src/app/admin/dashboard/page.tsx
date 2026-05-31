'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Users, BookOpen, PlayCircle, BarChart3,
  TrendingUp, Zap, Plus, ArrowRight, Activity, Clock
} from 'lucide-react';
import { adminApi, sessionApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { DashboardStats, Session } from '@/types';

const StatCard = ({ icon: Icon, label, value, color, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card p-6"
  >
    <div className="flex items-start justify-between mb-4">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <TrendingUp className="w-4 h-4 text-accent-emerald" />
    </div>
    <div className="font-display text-3xl font-bold text-white mb-1">{value}</div>
    <div className="text-sm text-white/40">{label}</div>
  </motion.div>
);

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, sessionsRes] = await Promise.all([
          adminApi.getDashboard(),
          sessionApi.list({ limit: 5 }),
        ]);
        setStats(statsRes.data);
        setRecentSessions(sessionsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statCards = [
    { icon: Users, label: 'Total Students', value: stats?.total_students ?? '–', color: 'bg-brand-500/20', delay: 0 },
    { icon: BookOpen, label: 'Total Sessions', value: stats?.total_sessions ?? '–', color: 'bg-accent-cyan/20', delay: 0.05 },
    { icon: Activity, label: 'Active Now', value: stats?.active_sessions ?? '–', color: 'bg-accent-emerald/20', delay: 0.1 },
    { icon: BarChart3, label: 'Avg Score', value: stats ? `${stats.avg_score}%` : '–', color: 'bg-accent-purple/20', delay: 0.15 },
  ];

  const statusColor: Record<string, string> = {
    active: 'badge-active',
    draft: 'badge-draft',
    ended: 'badge-ended',
    archived: 'badge-draft',
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div>
          <h1 className="section-title">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="gradient-text">{user?.full_name?.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-white/40 mt-1 text-sm">Here's what's happening across your workspace</p>
        </div>
        <Link href="/admin/sessions/create" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Session
        </Link>
      </motion.div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-6 h-32 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent sessions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-semibold text-white flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-brand-400" />
              Recent Sessions
            </h2>
            <Link href="/admin/sessions" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <div className="text-center py-10 text-white/30">
              <PlayCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No sessions yet</p>
              <Link href="/admin/sessions/create" className="btn-primary text-xs mt-4 inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Create First Session
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/admin/sessions/${session.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-glass transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-brand-300 transition-colors">
                      {session.title}
                    </p>
                    <p className="text-xs text-white/30 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {session.duration_minutes}m · {session.question_count} questions
                    </p>
                  </div>
                  <span className={statusColor[session.status] || 'badge-draft'}>
                    {session.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-6"
        >
          <h2 className="font-display font-semibold text-white mb-5 flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent-amber" />
            Quick Actions
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/admin/sessions/create', icon: PlayCircle, label: 'New Session', color: 'text-brand-400 bg-brand-500/10 hover:bg-brand-500/20' },
              { href: '/admin/questions', icon: BookOpen, label: 'Question Bank', color: 'text-accent-cyan bg-accent-cyan/10 hover:bg-accent-cyan/20' },
              { href: '/admin/students', icon: Users, label: 'Manage Students', color: 'text-accent-emerald bg-accent-emerald/10 hover:bg-accent-emerald/20' },
              { href: '/admin/results', icon: BarChart3, label: 'View Results', color: 'text-accent-purple bg-accent-purple/10 hover:bg-accent-purple/20' },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`flex flex-col items-center gap-2 p-5 rounded-xl border border-white/5 transition-all duration-200 ${action.color}`}
              >
                <action.icon className="w-6 h-6" />
                <span className="text-xs font-medium text-white">{action.label}</span>
              </Link>
            ))}
          </div>

          {/* Tips */}
          <div className="mt-5 p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
            <p className="text-xs text-brand-300 font-medium mb-1">💡 Pro Tip</p>
            <p className="text-xs text-white/40 leading-relaxed">
              Use AI question generation to create a full question bank in seconds. Just enter a topic, difficulty, and count.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}