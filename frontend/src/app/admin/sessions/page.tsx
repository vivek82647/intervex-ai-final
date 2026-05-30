'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Plus, Minus, BookOpen, Brain,
  Clock, Shield, Settings, CheckCircle, Search
} from 'lucide-react';
import Link from 'next/link';
import { sessionApi, questionApi, classApi } from '@/lib/api';
import type { Question, Class } from '@/types';

export default function CreateSessionPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);
  const [qSearch, setQSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [qLoading, setQLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      description: '',
      instructions: 'Read all questions carefully before answering. You must maintain fullscreen during the test.',
      class_id: '',
      duration_minutes: 60,
      passing_marks: '',
      shuffle_questions: true,
      shuffle_options: true,
      show_result_immediately: true,
      allow_review: false,
      max_warnings: 3,
      fullscreen_required: true,
      password: '',
    }
  });

  useEffect(() => {
    classApi.list().then(r => setClasses(r.data)).catch(() => {});
    loadQuestions();
  }, []);

  const loadQuestions = async (search = '') => {
    setQLoading(true);
    try {
      const res = await questionApi.list({ search, limit: 50 });
      setQuestions(res.data);
    } catch { } finally { setQLoading(false); }
  };

  const toggleQ = (id: string) => {
    setSelectedQIds(prev => prev.includes(id) ? prev.filter(q => q !== id) : [...prev, id]);
  };

  const onSubmit = async (data: any) => {
    if (selectedQIds.length === 0) {
      toast.error('Select at least one question');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...data,
        duration_minutes: Number(data.duration_minutes),
        passing_marks: data.passing_marks ? Number(data.passing_marks) : null,
        question_ids: selectedQIds,
        class_id: data.class_id || null,
      };
      const res = await sessionApi.create(payload);
      toast.success('Session created!');
      router.push(`/admin/sessions/${res.data.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const diffColor: Record<string, string> = {
    easy: 'text-accent-emerald', medium: 'text-accent-amber',
    moderate: 'text-accent-amber', hard: 'text-accent-rose', high: 'text-accent-rose',
  };

  const typeIcon: Record<string, string> = { mcq: '⊙', descriptive: '✎', coding: '</>' };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/sessions" className="text-white/40 hover:text-white p-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="section-title">Create Session</h1>
            <p className="text-white/40 text-sm mt-0.5">Configure your interview session</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2].map(s => (
            <button key={s} onClick={() => setStep(s)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${step === s ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' : 'text-white/30 hover:text-white/50'}`}>
              <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${step === s ? 'bg-brand-500 text-white' : 'bg-white/10'}`}>{s}</span>
              {s === 1 ? 'Details' : 'Questions'}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {/* Basic Info */}
            <div className="glass-card p-6">
              <h2 className="font-display font-semibold text-white mb-5 flex items-center gap-2">
                <Settings className="w-4 h-4 text-brand-400" /> Basic Information
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-white/60 mb-2">Session Title *</label>
                  <input {...register('title', { required: true })} placeholder="e.g. JavaScript Technical Round 1" className="input-field" />
                  {errors.title && <p className="text-accent-rose text-xs mt-1">Title is required</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-white/60 mb-2">Description</label>
                  <textarea {...register('description')} rows={2} placeholder="Optional description" className="input-field resize-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-white/60 mb-2">Instructions for Students</label>
                  <textarea {...register('instructions')} rows={3} className="input-field resize-none" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Class (optional)</label>
                  <select {...register('class_id')} className="input-field">
                    <option value="">No class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Session Password (optional)</label>
                  <input {...register('password')} placeholder="Leave blank for no password" className="input-field" />
                </div>
              </div>
            </div>

            {/* Timing */}
            <div className="glass-card p-6">
              <h2 className="font-display font-semibold text-white mb-5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent-amber" /> Timing & Scoring
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Duration (minutes) *</label>
                  <input {...register('duration_minutes', { required: true, min: 5, max: 480 })} type="number" min="5" max="480" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Passing Marks (optional)</label>
                  <input {...register('passing_marks')} type="number" min="0" placeholder="e.g. 40" className="input-field" />
                </div>
              </div>
            </div>

            {/* Anti-cheat */}
            <div className="glass-card p-6">
              <h2 className="font-display font-semibold text-white mb-5 flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent-rose" /> Anti-Cheat Settings
              </h2>
              <div className="space-y-3">
                {[
                  { name: 'fullscreen_required', label: 'Require fullscreen mode', desc: 'Students must keep test in fullscreen' },
                  { name: 'shuffle_questions', label: 'Shuffle question order', desc: 'Each student gets unique question order' },
                  { name: 'shuffle_options', label: 'Shuffle MCQ options', desc: 'Randomize option positions' },
                  { name: 'show_result_immediately', label: 'Show result immediately', desc: 'Students see score after submission' },
                  { name: 'allow_review', label: 'Allow answer review', desc: 'Students can revisit previous answers' },
                ].map((setting) => (
                  <label key={setting.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-glass cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-white">{setting.label}</p>
                      <p className="text-xs text-white/30">{setting.desc}</p>
                    </div>
                    <input type="checkbox" {...register(setting.name as any)} className="w-4 h-4 accent-brand-500" />
                  </label>
                ))}
                <div className="pt-1">
                  <label className="block text-sm text-white/60 mb-2">Max Warnings Before Termination</label>
                  <select {...register('max_warnings')} className="input-field w-32">
                    {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={() => setStep(2)} className="btn-primary flex items-center gap-2">
                Next: Select Questions <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-400" />
                  Select Questions ({selectedQIds.length} selected)
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedQIds.length === questions.length) {
                        setSelectedQIds([]);
                      } else {
                        setSelectedQIds(questions.map((q: any) => q.id));
                      }
                    }}
                    className="text-xs text-brand-400 hover:text-brand-300 border border-brand-500/30 px-2 py-1 rounded-lg"
                  >
                    {selectedQIds.length === questions.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <Link href="/admin/questions" target="_blank" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add to Bank
                  </Link>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  value={qSearch}
                  onChange={e => { setQSearch(e.target.value); loadQuestions(e.target.value); }}
                  placeholder="Search questions..."
                  className="input-field pl-9"
                />
              </div>

              {qLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)}
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-10 text-white/30">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No questions in bank.</p>
                  <Link href="/admin/questions" className="text-brand-400 text-sm hover:underline">Add questions first</Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {questions.map((q) => {
                    const selected = selectedQIds.includes(q.id);
                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleQ(q.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selected ? 'border-brand-500/40 bg-brand-500/10' : 'border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                          selected ? 'border-brand-500 bg-brand-500' : 'border-white/20'
                        }`}>
                          {selected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{q.title}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-white/30 font-mono">{typeIcon[q.type]} {q.type}</span>
                            <span className={`text-xs ${diffColor[q.difficulty]}`}>{q.difficulty}</span>
                            <span className="text-xs text-white/30">{q.topic}</span>
                          </div>
                        </div>
                        <span className="text-xs text-white/40 flex-shrink-0">{q.marks}m</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-5">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button type="submit" disabled={loading || selectedQIds.length === 0} className="btn-primary flex items-center gap-2">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Create Session ({selectedQIds.length} Q)
              </button>
            </div>
          </motion.div>
        )}
      </form>
    </div>
  );
}
