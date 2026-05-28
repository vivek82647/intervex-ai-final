'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BarChart3, ExternalLink, Clock, Users, Target } from 'lucide-react';
import { sessionApi } from '@/lib/api';
import type { Session } from '@/types';

export default function ResultsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionApi.list({ status: 'ended' }).then(r => setSessions(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title">Results</h1>
          <p className="text-white/40 text-sm mt-1">View analytics and reports for completed sessions</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="glass-card h-20 skeleton" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <BarChart3 className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-white mb-2">No completed sessions</h3>
          <p className="text-white/40 text-sm">Results will appear here when sessions are ended</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5 flex items-center justify-between hover:border-white/15 transition-all"
            >
              <div>
                <h3 className="font-medium text-white mb-1">{session.title}</h3>
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{session.duration_minutes}m</span>
                  <span className="flex items-center gap-1"><Target className="w-3 h-3" />{session.total_marks} marks</span>
                  <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />{session.question_count} questions</span>
                  <span>{new Date(session.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <Link
                href={`/admin/sessions/${session.id}/results`}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" /> View Results <ExternalLink className="w-3 h-3" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
