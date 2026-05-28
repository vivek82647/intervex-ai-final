'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle, XCircle, Trophy, Target, Brain,
  TrendingUp, AlertTriangle, Clock, BarChart3,
  ChevronDown, ChevronUp, Star
} from 'lucide-react';
import { attemptApi } from '@/lib/api';

const PERF_COLOR: Record<string, string> = {
  Excellent: 'text-accent-emerald',
  Good: 'text-accent-cyan',
  Average: 'text-accent-amber',
  'Below Average': 'text-accent-rose',
  Poor: 'text-accent-rose',
};

export default function ResultPage() {
  const params = useParams();
  const attemptId = params.attemptId as string;
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  useEffect(() => {
    attemptApi.getResult(attemptId).then(r => {
      setResult(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-brand-400 mx-auto mb-4 animate-pulse" />
          <p className="text-white/40">Analyzing your results...</p>
        </div>
      </div>
    );
  }

  if (!result) return (
    <div className="min-h-screen bg-surface flex items-center justify-center text-white/40">
      Result not found
    </div>
  );

  const pct = result.percentage || 0;
  const feedback = result.ai_feedback || {};
  const perfLevel = feedback.performance_level || 'Average';
  const perfColor = PERF_COLOR[perfLevel] || 'text-white';

  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="min-h-screen bg-surface grid-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center mx-auto mb-4">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Test Complete!</h1>
          <p className="text-white/40 mt-1">Here's your detailed performance analysis</p>
        </motion.div>

        {/* Score circle + stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="glass-card p-8 mb-5">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Circle */}
            <div className="relative flex-shrink-0">
              <svg width="130" height="130" viewBox="0 0 130 130">
                <circle cx="65" cy="65" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                <circle
                  cx="65" cy="65" r="54" fill="none"
                  stroke={pct >= 70 ? '#10B981' : pct >= 40 ? '#5B6AF5' : '#F43F5E'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 65 65)"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl font-bold text-white">{pct.toFixed(1)}%</span>
                <span className={`text-xs font-medium ${perfColor}`}>{perfLevel}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { icon: Target, label: 'Score', value: `${result.total_score?.toFixed(1)} / ${result.max_score}`, color: 'text-brand-400' },
                { icon: Clock, label: 'Time Taken', value: result.time_taken_seconds ? `${Math.floor(result.time_taken_seconds / 60)}m ${result.time_taken_seconds % 60}s` : '–', color: 'text-accent-amber' },
                { icon: AlertTriangle, label: 'Warnings', value: result.warning_count, color: result.warning_count > 0 ? 'text-accent-rose' : 'text-accent-emerald' },
                { icon: BarChart3, label: 'Questions', value: result.answers?.length || 0, color: 'text-accent-cyan' },
                { icon: CheckCircle, label: 'Correct', value: result.answers?.filter((a: any) => a.is_correct).length || '–', color: 'text-accent-emerald' },
                { icon: Trophy, label: 'Status', value: result.status === 'submitted' ? 'Submitted' : result.status, color: 'text-accent-emerald' },
              ].map(stat => (
                <div key={stat.label} className="bg-surface-2 rounded-xl p-3">
                  <stat.icon className={`w-4 h-4 ${stat.color} mb-1`} />
                  <div className="text-base font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-white/30">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* AI Feedback */}
        {feedback.overall_feedback && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card p-6 mb-5">
            <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-brand-400" /> AI Feedback
            </h2>
            <p className="text-white/60 text-sm leading-relaxed mb-5">{feedback.overall_feedback}</p>

            <div className="grid md:grid-cols-2 gap-5">
              {feedback.strengths?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-accent-emerald mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Strengths
                  </h3>
                  <ul className="space-y-1.5">
                    {feedback.strengths.map((s: string, i: number) => (
                      <li key={i} className="text-xs text-white/50 flex items-start gap-2">
                        <CheckCircle className="w-3 h-3 text-accent-emerald mt-0.5 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {feedback.weaknesses?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-accent-amber mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Areas to Improve
                  </h3>
                  <ul className="space-y-1.5">
                    {feedback.weaknesses.map((w: string, i: number) => (
                      <li key={i} className="text-xs text-white/50 flex items-start gap-2">
                        <XCircle className="w-3 h-3 text-accent-amber mt-0.5 flex-shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {feedback.recommendations?.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/5">
                <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-accent-amber" /> Recommendations
                </h3>
                <ul className="space-y-1.5">
                  {feedback.recommendations.map((r: string, i: number) => (
                    <li key={i} className="text-xs text-white/50 flex items-start gap-2">
                      <span className="text-brand-400">→</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* Answer breakdown */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h2 className="font-display font-semibold text-white mb-3">Answer Breakdown</h2>
          <div className="space-y-2">
            {result.answers?.map((answer: any, i: number) => (
              <div key={i} className={`glass-card overflow-hidden ${answer.is_correct ? 'border-accent-emerald/20' : answer.marks_awarded > 0 ? 'border-accent-amber/20' : 'border-white/5'}`}>
                <button
                  onClick={() => setExpandedQ(expandedQ === answer.question_id ? null : answer.question_id)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs ${
                      answer.is_correct ? 'bg-accent-emerald/20 text-accent-emerald' :
                      answer.marks_awarded > 0 ? 'bg-accent-amber/20 text-accent-amber' :
                      'bg-accent-rose/20 text-accent-rose'
                    }`}>
                      {i + 1}
                    </div>
                    <p className="text-sm text-white/70 truncate">{answer.question_title}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs font-medium ${answer.marks_awarded > 0 ? 'text-accent-emerald' : 'text-white/30'}`}>
                      {answer.marks_awarded?.toFixed(1) || 0} / {answer.max_marks}
                    </span>
                    {expandedQ === answer.question_id ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                  </div>
                </button>

                {expandedQ === answer.question_id && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                    <p className="text-xs text-white/50 leading-relaxed">{answer.question_content}</p>
                    {answer.text_answer && (
                      <div>
                        <p className="text-xs text-white/30 mb-1">Your Answer:</p>
                        <p className="text-xs text-white/60 bg-surface-2 p-3 rounded-lg">{answer.text_answer}</p>
                      </div>
                    )}
                    {answer.correct_answer && (
                      <div>
                        <p className="text-xs text-white/30 mb-1">Correct Answer:</p>
                        <p className="text-xs text-accent-emerald/80 bg-accent-emerald/5 p-3 rounded-lg">{answer.correct_answer}</p>
                      </div>
                    )}
                    {answer.ai_feedback && (
                      <div>
                        <p className="text-xs text-white/30 mb-1">AI Feedback:</p>
                        <p className="text-xs text-white/50 italic">{answer.ai_feedback}</p>
                      </div>
                    )}
                    {answer.explanation && (
                      <div>
                        <p className="text-xs text-white/30 mb-1">Explanation:</p>
                        <p className="text-xs text-white/50">{answer.explanation}</p>
                      </div>
                    )}
                    {answer.test_cases_passed !== null && answer.test_cases_passed !== undefined && (
                      <p className="text-xs text-white/50">
                        Test Cases: <span className="text-accent-emerald">{answer.test_cases_passed}</span> / {answer.test_cases_total} passed
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
