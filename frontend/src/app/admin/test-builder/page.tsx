'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, ArrowLeft, Save, Eye, EyeOff,
  ChevronDown, ChevronUp, GripVertical, CheckCircle,
  AlignLeft, Code2, CircleDot, Clock, Settings
} from 'lucide-react';
import Link from 'next/link';
import { questionApi, sessionApi, classApi } from '@/lib/api';
import { useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Option { id: string; text: string; is_correct: boolean; }
interface ManualQuestion {
  uid: string;
  type: 'mcq' | 'descriptive' | 'coding';
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  title: string;
  content: string;
  marks: number;
  negative_marks: number;
  options: Option[];
  correct_answer: string;
  explanation: string;
  starter_code_python: string;
  starter_code_js: string;
  collapsed: boolean;
}

const defaultMCQOptions = (): Option[] => [
  { id: 'a', text: '', is_correct: false },
  { id: 'b', text: '', is_correct: false },
  { id: 'c', text: '', is_correct: false },
  { id: 'd', text: '', is_correct: false },
];

const newQuestion = (type: ManualQuestion['type'] = 'mcq'): ManualQuestion => ({
  uid: Math.random().toString(36).slice(2),
  type,
  topic: '',
  difficulty: 'medium',
  title: '',
  content: '',
  marks: 1,
  negative_marks: 0,
  options: type === 'mcq' ? defaultMCQOptions() : [],
  correct_answer: '',
  explanation: '',
  starter_code_python: 'def solution():\n    pass',
  starter_code_js: 'function solution() {\n  // code\n}',
  collapsed: false,
});

const TYPE_ICONS = {
  mcq: CircleDot,
  descriptive: AlignLeft,
  coding: Code2,
};

const TYPE_COLORS = {
  mcq: 'text-brand-400 border-brand-500/30 bg-brand-500/10',
  descriptive: 'text-accent-emerald border-accent-emerald/30 bg-accent-emerald/10',
  coding: 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10',
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TestBuilderPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<ManualQuestion[]>([newQuestion('mcq')]);
  const [testTitle, setTestTitle] = useState('');
  const [testDesc, setTestDesc] = useState('');
  const [duration, setDuration] = useState(60);
  const [maxWarnings, setMaxWarnings] = useState(3);
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    classApi.list().then(r => setClasses(r.data)).catch(() => {});
  }, []);

  const addQuestion = (type: ManualQuestion['type']) => {
    setQuestions(prev => [...prev, newQuestion(type)]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
  };

  const removeQuestion = (uid: string) => {
    if (questions.length === 1) { toast.error('At least one question required'); return; }
    setQuestions(prev => prev.filter(q => q.uid !== uid));
  };

  const updateQ = (uid: string, field: keyof ManualQuestion, value: any) => {
    setQuestions(prev => prev.map(q => q.uid === uid ? { ...q, [field]: value } : q));
  };

  const updateOption = (uid: string, optId: string, field: keyof Option, value: any) => {
    setQuestions(prev => prev.map(q => {
      if (q.uid !== uid) return q;
      const opts = q.options.map(o => {
        if (field === 'is_correct' && value === true) {
          return { ...o, is_correct: o.id === optId };
        }
        return o.id === optId ? { ...o, [field]: value } : o;
      });
      const correct = opts.find(o => o.is_correct);
      return { ...q, options: opts, correct_answer: correct?.id || '' };
    }));
  };

  const toggleCollapse = (uid: string) => updateQ(uid, 'collapsed', !questions.find(q => q.uid === uid)?.collapsed);

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);

  const validate = () => {
    if (!testTitle.trim()) { toast.error('Test title required'); return false; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.content.trim()) { toast.error(`Q${i + 1}: Question text required`); return false; }
      if (!q.topic.trim()) { toast.error(`Q${i + 1}: Topic required`); return false; }
      if (q.type === 'mcq') {
        if (q.options.some(o => !o.text.trim())) { toast.error(`Q${i + 1}: Fill all MCQ options`); return false; }
        if (!q.correct_answer) { toast.error(`Q${i + 1}: Select correct answer`); return false; }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Save questions to bank
      const savedIds: string[] = [];
      for (const q of questions) {
        const payload: any = {
          type: q.type,
          topic: q.topic || 'General',
          difficulty: q.difficulty,
          title: q.title || q.content.slice(0, 60),
          content: q.content,
          marks: q.marks,
          negative_marks: q.negative_marks,
          correct_answer: q.correct_answer,
          explanation: q.explanation || '',
          source: 'manual',
        };
        if (q.type === 'mcq') payload.options = q.options;
        if (q.type === 'coding') {
          payload.starter_code = { python: q.starter_code_python, javascript: q.starter_code_js };
        }
        const res = await questionApi.create(payload);
        savedIds.push(res.data.id);
      }

      // Create session
      const sessionRes = await sessionApi.create({
        title: testTitle,
        description: testDesc,
        duration_minutes: duration,
        max_warnings: maxWarnings,
        class_id: classId || undefined,
        total_marks: totalMarks,
        passing_marks: Math.round(totalMarks * 0.4),
        shuffle_questions: false,
        shuffle_options: false,
        show_result_immediately: true,
        allow_review: false,
        fullscreen_required: true,
        question_ids: savedIds,
      });

      toast.success('Test created successfully!');
      router.push(`/admin/sessions/${sessionRes.data.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/sessions" className="text-white/40 hover:text-white p-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="section-title">Manual Test Builder</h1>
            <p className="text-white/40 text-sm">{questions.length} questions · {totalMarks} marks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(s => !s)} className="btn-secondary flex items-center gap-2 text-sm">
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save & Create Session'}
          </button>
        </div>
      </div>

      {/* Test Info */}
      <div className="glass-card p-5 mb-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Test Title *</label>
            <input value={testTitle} onChange={e => setTestTitle(e.target.value)}
              placeholder="e.g. Data Structures Mid-Term Exam"
              className="input-field text-lg font-medium" />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Description</label>
            <input value={testDesc} onChange={e => setTestDesc(e.target.value)}
              placeholder="Optional description" className="input-field" />
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="glass-card p-5 mb-5 overflow-hidden">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-brand-400" /> Session Settings
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-white/40 mb-2"><Clock className="w-3 h-3 inline mr-1" />Duration (min)</label>
                <input type="number" value={duration} onChange={e => setDuration(+e.target.value)} min={5} className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-2">Max Warnings</label>
                <input type="number" value={maxWarnings} onChange={e => setMaxWarnings(+e.target.value)} min={1} max={10} className="input-field" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-white/40 mb-2">Class (optional)</label>
                <select value={classId} onChange={e => setClassId(e.target.value)} className="input-field">
                  <option value="">No class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const Icon = TYPE_ICONS[q.type];
          return (
            <motion.div key={q.uid} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card overflow-hidden">
              {/* Question Header */}
              <div className="flex items-center gap-3 p-4 border-b border-white/5 cursor-pointer"
                onClick={() => toggleCollapse(q.uid)}>
                <GripVertical className="w-4 h-4 text-white/20 flex-shrink-0" />
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${TYPE_COLORS[q.type]}`}>
                  <Icon className="w-3 h-3" />
                  {q.type.toUpperCase()}
                </div>
                <span className="text-white/30 text-sm font-mono">Q{idx + 1}</span>
                <p className="flex-1 text-sm text-white truncate">
                  {q.content || <span className="text-white/30 italic">Empty question...</span>}
                </p>
                <span className="text-xs text-white/30">{q.marks}m</span>
                <button onClick={e => { e.stopPropagation(); removeQuestion(q.uid); }}
                  className="text-white/20 hover:text-accent-rose transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
                {q.collapsed ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronUp className="w-4 h-4 text-white/30" />}
              </div>

              {/* Question Body */}
              {!q.collapsed && (
                <div className="p-5 space-y-4">
                  {/* Type + Difficulty + Topic + Marks row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Type</label>
                      <select value={q.type} onChange={e => {
                        const t = e.target.value as ManualQuestion['type'];
                        setQuestions(prev => prev.map(pq => pq.uid === q.uid ? {
                          ...pq, type: t,
                          options: t === 'mcq' ? defaultMCQOptions() : [],
                          correct_answer: ''
                        } : pq));
                      }} className="input-field text-sm">
                        <option value="mcq">MCQ</option>
                        <option value="descriptive">Descriptive</option>
                        <option value="coding">Coding</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Difficulty</label>
                      <select value={q.difficulty} onChange={e => updateQ(q.uid, 'difficulty', e.target.value)} className="input-field text-sm">
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Topic *</label>
                      <input value={q.topic} onChange={e => updateQ(q.uid, 'topic', e.target.value)}
                        placeholder="e.g. Arrays" className="input-field text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">Marks</label>
                        <input type="number" min="0.5" step="0.5" value={q.marks}
                          onChange={e => updateQ(q.uid, 'marks', +e.target.value)} className="input-field text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">-ve Marks</label>
                        <input type="number" min="0" step="0.25" value={q.negative_marks}
                          onChange={e => updateQ(q.uid, 'negative_marks', +e.target.value)} className="input-field text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Question Text *</label>
                    <textarea value={q.content} onChange={e => updateQ(q.uid, 'content', e.target.value)}
                      placeholder="Write your question here..."
                      rows={3} className="input-field resize-none text-sm leading-relaxed" />
                  </div>

                  {/* MCQ Options */}
                  {q.type === 'mcq' && (
                    <div>
                      <label className="block text-xs text-white/40 mb-2">Options — click circle to mark correct answer</label>
                      <div className="space-y-2">
                        {q.options.map(opt => (
                          <div key={opt.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${opt.is_correct ? 'border-accent-emerald/50 bg-accent-emerald/8' : 'border-white/8 bg-surface-glass'}`}>
                            <button onClick={() => updateOption(q.uid, opt.id, 'is_correct', true)}
                              className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${opt.is_correct ? 'border-accent-emerald bg-accent-emerald' : 'border-white/20 hover:border-white/40'}`}>
                              {opt.is_correct && <div className="w-2 h-2 rounded-full bg-white" />}
                            </button>
                            <span className="text-xs text-white/30 font-mono w-4">{opt.id})</span>
                            <input value={opt.text} onChange={e => updateOption(q.uid, opt.id, 'text', e.target.value)}
                              placeholder={`Option ${opt.id.toUpperCase()}`}
                              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none" />
                            {opt.is_correct && <CheckCircle className="w-4 h-4 text-accent-emerald flex-shrink-0" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Descriptive Answer */}
                  {q.type === 'descriptive' && (
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Model Answer / Key Points</label>
                      <textarea value={q.correct_answer} onChange={e => updateQ(q.uid, 'correct_answer', e.target.value)}
                        placeholder="Write the expected answer or key points for evaluation..."
                        rows={4} className="input-field resize-none text-sm" />
                    </div>
                  )}

                  {/* Coding Starter Code */}
                  {q.type === 'coding' && (
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">Starter Code — Python</label>
                        <textarea value={q.starter_code_python} onChange={e => updateQ(q.uid, 'starter_code_python', e.target.value)}
                          rows={5} className="input-field resize-none text-xs font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">Starter Code — JavaScript</label>
                        <textarea value={q.starter_code_js} onChange={e => updateQ(q.uid, 'starter_code_js', e.target.value)}
                          rows={5} className="input-field resize-none text-xs font-mono" />
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Explanation (optional — shown after test)</label>
                    <input value={q.explanation} onChange={e => updateQ(q.uid, 'explanation', e.target.value)}
                      placeholder="Why is this the correct answer?" className="input-field text-sm" />
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Add Question Buttons */}
      <div className="mt-5 glass-card p-4">
        <p className="text-xs text-white/30 mb-3 text-center">Add Question</p>
        <div className="flex gap-3 justify-center flex-wrap">
          {(['mcq', 'descriptive', 'coding'] as const).map(type => {
            const Icon = TYPE_ICONS[type];
            return (
              <button key={type} onClick={() => addQuestion(type)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all hover:scale-105 ${TYPE_COLORS[type]}`}>
                <Plus className="w-4 h-4" />
                <Icon className="w-4 h-4" />
                {type.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface-1/95 backdrop-blur-xl border-t border-white/5 px-6 py-3 flex items-center justify-between z-40">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-white/40">{questions.length} Questions</span>
          <span className="text-white/40">Total: <span className="text-white font-medium">{totalMarks} marks</span></span>
          <span className="text-white/40">Duration: <span className="text-white font-medium">{duration} min</span></span>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save & Create Session'}
        </button>
      </div>
    </div>
  );
}
