'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  BarChart3, Download, Trophy, Users, Target,
  TrendingUp, AlertTriangle, Clock, ArrowLeft,
  CheckCircle, XCircle
} from 'lucide-react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const PIE_COLORS = ['#5B6AF5', '#10B981', '#F59E0B', '#F43F5E', '#00E5FF'];

export default function SessionResultsPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.sessionResults(sessionId),
      adminApi.analytics(sessionId),
    ]).then(([rRes, aRes]) => {
      setData(rRes.data);
      setAnalytics(aRes.data);
    }).catch(() => toast.error('Failed to load results'))
    .finally(() => setLoading(false));
  }, [sessionId]);

  const exportCsv = async () => {
    try {
      const res = await adminApi.exportCsv(sessionId);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `results-${sessionId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch { toast.error('Export failed'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const results = data?.results || [];
  const scoreRanges = [
    { range: '0-25%', count: results.filter((r: any) => r.percentage < 25).length },
    { range: '25-50%', count: results.filter((r: any) => r.percentage >= 25 && r.percentage < 50).length },
    { range: '50-75%', count: results.filter((r: any) => r.percentage >= 50 && r.percentage < 75).length },
    { range: '75-90%', count: results.filter((r: any) => r.percentage >= 75 && r.percentage < 90).length },
    { range: '90-100%', count: results.filter((r: any) => r.percentage >= 90).length },
  ];

  const STATUS_COLOR: Record<string, string> = {
    submitted: 'badge-active',
    terminated: 'badge-ended',
    in_progress: 'badge-draft',
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/sessions" className="text-white/40 hover:text-white p-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="section-title">Session Results</h1>
            <p className="text-white/40 text-sm mt-0.5">{data?.total_attempts || 0} total attempts</p>
          </div>
        </div>
        <button onClick={exportCsv} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Users, label: 'Total', value: data?.total_attempts || 0, color: 'text-white' },
          { icon: CheckCircle, label: 'Submitted', value: data?.submitted || 0, color: 'text-accent-emerald' },
          { icon: Target, label: 'Avg Score', value: `${data?.avg_score || 0}%`, color: 'text-brand-400' },
          { icon: Trophy, label: 'Top Score', value: results.length ? `${Math.max(...results.map((r: any) => r.percentage || 0)).toFixed(1)}%` : '–', color: 'text-accent-amber' },
        ].map(card => (
          <div key={card.label} className="glass-card p-4">
            <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
            <div className={`font-display text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-white/40">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        {/* Score distribution */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5">
          <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-400" /> Score Distribution
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreRanges}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="range" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1A1F35', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff' }}
              />
              <Bar dataKey="count" fill="#5B6AF5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Topic performance */}
        {analytics?.topic_performance?.length > 0 && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5">
            <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent-emerald" /> Topic Performance
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.topic_performance.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis dataKey="topic" type="category" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} width={80} />
                <Tooltip
                  contentStyle={{ background: '#1A1F35', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#fff' }}
                />
                <Bar dataKey="avg_score" fill="#10B981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Leaderboard table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h2 className="font-display font-semibold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent-amber" /> Leaderboard
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-xs text-white/30">
                <th className="text-left px-5 py-3">#</th>
                <th className="text-left px-5 py-3">Student</th>
                <th className="text-left px-5 py-3">Roll No.</th>
                <th className="text-left px-5 py-3">Score</th>
                <th className="text-left px-5 py-3">%</th>
                <th className="text-left px-5 py-3">Time</th>
                <th className="text-left px-5 py-3">Warnings</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">AI Level</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r: any, i: number) => (
                <tr key={r.attempt_id} className={`border-b border-white/5 hover:bg-surface-glass transition-colors ${i < 3 ? 'text-white' : 'text-white/60'}`}>
                  <td className="px-5 py-3 text-sm">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium">{r.student_name}</td>
                  <td className="px-5 py-3 text-sm text-white/40">{r.roll_number || '–'}</td>
                  <td className="px-5 py-3 text-sm font-mono">{r.score?.toFixed(1)}/{r.max_score}</td>
                  <td className="px-5 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.percentage >= 70 ? 'bg-accent-emerald' : r.percentage >= 40 ? 'bg-accent-amber' : 'bg-accent-rose'}`}
                          style={{ width: `${r.percentage || 0}%` }}
                        />
                      </div>
                      <span>{r.percentage?.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-white/40">
                    {r.time_taken_seconds ? `${Math.floor(r.time_taken_seconds / 60)}m` : '–'}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {r.warning_count > 0
                      ? <span className="text-accent-amber flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{r.warning_count}</span>
                      : <span className="text-white/20">0</span>
                    }
                  </td>
                  <td className="px-5 py-3">
                    <span className={STATUS_COLOR[r.status] || 'badge-draft'}>{r.status}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/40">{r.performance_level || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length === 0 && (
            <div className="text-center py-12 text-white/20">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No submissions yet</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
