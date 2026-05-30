'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, Brain, Upload, Search, Trash2, BookOpen,
  Sparkles, Code2, AlignLeft, CircleDot, CheckSquare, Square, XCircle
} from 'lucide-react';
import { questionApi, api } from '@/lib/api';
import type { Question } from '@/types';

const DIFFICULTIES = ['easy', 'medium', 'moderate', 'hard', 'high'];
const TYPES = ['mcq', 'descriptive', 'coding'];

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  mcq: { icon: CircleDot, label: 'MCQ', color: 'text-brand-400' },
  descriptive: { icon: AlignLeft, label: 'Descriptive', color: 'text-accent-emerald' },
  coding: { icon: Code2, label: 'Coding', color: 'text-accent-cyan' },
};

const DIFF_COLOR: Record<string, string> = {
  easy: 'text-accent-emerald', medium: 'text-accent-amber',
  moderate: 'text-accent-amber', hard: 'text-accent-rose', high: 'text-accent-rose',
};

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiForm, setAIForm] = useState({ topic: '', difficulty: 'medium', count: 5, type: 'mcq', marks: 1, context: '' });
  const [aiLoading, setAILoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractForm, setExtractForm] = useState({ type: 'mcq', difficulty: 'medium', count: 10, marks: 1 });
  const [extractFile, setExtractFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const extractFileRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [qRes, sRes] = await Promise.all([
        questionApi.list({ search, type: typeFilter, difficulty: diffFilter }),
        questionApi.stats()
      ]);
      setQuestions(qRes.data);
      setStats(sRes.data);
      setSelected(new Set()); // clear selection on reload
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, typeFilter, diffFilter]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === questions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(questions.map(q => q.id)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    try {
      await questionApi.delete(id);
      toast.success('Deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected question${selected.size > 1 ? 's' : ''}?`)) return;
    setDeleting(true);
    try {
      await Promise.all([...selected].map(id => questionApi.delete(id)));
      toast.success(`Deleted ${selected.size} questions`);
      load();
    } catch { toast.error('Some deletions failed'); }
    finally { setDeleting(false); }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Delete ALL ${questions.length} questions? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all(questions.map(q => questionApi.delete(q.id)));
      toast.success('All questions deleted');
      load();
    } catch { toast.error('Some deletions failed'); }
    finally { setDeleting(false); }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await questionApi.csvUpload(file);
      toast.success(`Imported ${res.data.saved} questions`);
      if (res.data.errors?.length) toast.error(`${res.data.errors.length} rows had errors`);
      load();
    } catch { toast.error('Upload failed'); }
    e.target.value = '';
  };

  const handleAIGenerate = async () => {
    setAILoading(true);
    try {
      const res = await questionApi.aiGenerate({
        topic: aiForm.topic,
        difficulty: aiForm.difficulty,
        count: Number(aiForm.count),
        type: aiForm.type,
        marks: Number(aiForm.marks),
        context: aiForm.context,
      });
      toast.success(`Generated ${res.data.generated_count} questions!`);
      setShowAIModal(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'AI generation failed');
    } finally { setAILoading(false); }
  };

  const handleExtractUpload = async () => {
    if (!extractFile) return;
    setExtracting(true);
    try {
      const form = new FormData();
      form.append('file', extractFile);
      form.append('q_type', extractForm.type);
      form.append('difficulty', extractForm.difficulty);
      form.append('count', String(extractForm.count));
      form.append('marks', String(extractForm.marks));
      const res = await api.post('/questions/extract-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      toast.success(`Generated ${res.data.generated_count} questions from file!`);
      setShowExtractModal(false);
      setExtractFile(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Extraction failed');
    } finally { setExtracting(false); }
  };

  const allSelected = questions.length > 0 && selected.size === questions.length;

  return (
    <div>
      <div className="page-header flex-wrap gap-3">
        <div>
          <h1 className="section-title">Question Bank</h1>
          <p className="text-white/40 text-sm mt-1">{stats.total || 0} total questions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" /> CSV Import
          </button>
          <button onClick={() => setShowExtractModal(true)} className="btn-secondary flex items-center gap-2 text-sm border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10">
            <Brain className="w-4 h-4" /> PDF/Image/Doc
          </button>
          <button onClick={() => setShowAIModal(true)} className="btn-secondary flex items-center gap-2 text-sm border-brand-500/30 text-brand-400 hover:bg-brand-500/10">
            <Sparkles className="w-4 h-4" /> AI Generate
          </button>
          <button className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Question
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {TYPES.map(type => {
          const cfg = TYPE_CONFIG[type];
          return (
            <button key={type} onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
              className={`glass-card p-3 text-center transition-all ${typeFilter === type ? 'border-brand-500/40 bg-brand-500/10' : 'hover:border-white/15'}`}>
              <cfg.icon className={`w-5 h-5 mx-auto mb-1 ${cfg.color}`} />
              <div className="text-lg font-bold text-white">{stats.by_type?.[type] || 0}</div>
              <div className="text-xs text-white/40">{cfg.label}</div>
            </button>
          );
        })}
        {DIFFICULTIES.slice(0, 3).map(d => (
          <button key={d} onClick={() => setDiffFilter(diffFilter === d ? '' : d)}
            className={`glass-card p-3 text-center transition-all ${diffFilter === d ? 'border-brand-500/40 bg-brand-500/10' : 'hover:border-white/15'}`}>
            <div className={`text-lg font-bold ${DIFF_COLOR[d]}`}>{stats.by_difficulty?.[d] || 0}</div>
            <div className="text-xs text-white/40 capitalize">{d}</div>
          </button>
        ))}
      </div>

      {/* Search + filters + bulk actions */}
      <div className="flex gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions..." className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-field w-36">
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <select value={diffFilter} onChange={e => setDiffFilter(e.target.value)} className="input-field w-36">
          <option value="">All Levels</option>
          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Selection toolbar */}
      {questions.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-1">
          <button onClick={selectAll} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
            {allSelected
              ? <CheckSquare className="w-4 h-4 text-brand-400" />
              : <Square className="w-4 h-4" />}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>

          {selected.size > 0 && (
            <>
              <span className="text-xs text-white/30">{selected.size} selected</span>
              <button onClick={handleBulkDelete} disabled={deleting}
                className="flex items-center gap-1.5 text-sm text-accent-rose hover:text-white bg-accent-rose/10 hover:bg-accent-rose border border-accent-rose/30 hover:border-accent-rose px-3 py-1.5 rounded-lg transition-all">
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Deleting...' : `Delete Selected (${selected.size})`}
              </button>
              <button onClick={() => setSelected(new Set())}
                className="text-white/30 hover:text-white transition-colors">
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}

          {selected.size === 0 && questions.length > 0 && (
            <button onClick={handleDeleteAll} disabled={deleting}
              className="ml-auto flex items-center gap-1.5 text-xs text-white/30 hover:text-accent-rose transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Delete All
            </button>
          )}
        </div>
      )}

      {/* Questions list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="glass-card h-16 skeleton" />)}
        </div>
      ) : questions.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-white mb-2">No questions found</h3>
          <p className="text-white/40 text-sm mb-6">Add questions manually, import CSV, or generate with AI</p>
          <button onClick={() => setShowAIModal(true)} className="btn-primary inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Generate with AI
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => {
            const cfg = TYPE_CONFIG[q.type];
            const isSelected = selected.has(q.id);
            return (
              <motion.div key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className={`glass-card p-4 flex items-center gap-4 hover:border-white/15 transition-all group cursor-pointer ${isSelected ? 'border-brand-500/40 bg-brand-500/5' : ''}`}
                onClick={() => toggleSelect(q.id)}
              >
                {/* Checkbox */}
                <div className="flex-shrink-0">
                  {isSelected
                    ? <CheckSquare className="w-4 h-4 text-brand-400" />
                    : <Square className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />}
                </div>

                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{q.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-xs capitalize ${DIFF_COLOR[q.difficulty]}`}>{q.difficulty}</span>
                    <span className="text-xs text-white/30">{q.topic}</span>
                    {q.is_ai_generated && <span className="text-xs text-brand-400 flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> AI</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <span>{q.marks}m</span>
                  {q.negative_marks > 0 && <span className="text-accent-rose">-{q.negative_marks}</span>}
                </div>
                <button onClick={e => { e.stopPropagation(); handleDelete(q.id); }}
                  className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-accent-rose transition-all p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Extract from File Modal */}
      <AnimatePresence>
        {showExtractModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="glass-card w-full max-w-md p-6">
              <h2 className="font-display text-xl font-bold text-white mb-1 flex items-center gap-2">
                <Brain className="w-5 h-5 text-accent-cyan" /> Extract from File
              </h2>
              <p className="text-white/40 text-xs mb-5">Upload PDF, image (JPG/PNG), DOCX, or TXT — AI will generate questions from it</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">File *</label>
                  <input ref={extractFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.txt" className="hidden"
                    onChange={e => setExtractFile(e.target.files?.[0] || null)} />
                  <button onClick={() => extractFileRef.current?.click()}
                    className={`w-full p-4 rounded-xl border-2 border-dashed text-sm transition-all ${extractFile ? 'border-accent-cyan/50 bg-accent-cyan/5 text-accent-cyan' : 'border-white/10 text-white/30 hover:border-white/20'}`}>
                    {extractFile ? `✓ ${extractFile.name}` : 'Click to upload PDF / Image / DOCX / TXT'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Question Type</label>
                    <select value={extractForm.type} onChange={e => setExtractForm(p => ({...p, type: e.target.value}))} className="input-field">
                      <option value="mcq">MCQ</option>
                      <option value="descriptive">Descriptive</option>
                      <option value="coding">Coding</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Difficulty</label>
                    <select value={extractForm.difficulty} onChange={e => setExtractForm(p => ({...p, difficulty: e.target.value}))} className="input-field">
                      {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Count</label>
                    <input value={extractForm.count} onChange={e => setExtractForm(p => ({...p, count: +e.target.value}))} type="number" min="1" max="20" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Marks each</label>
                    <input value={extractForm.marks} onChange={e => setExtractForm(p => ({...p, marks: +e.target.value}))} type="number" min="0.5" className="input-field" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowExtractModal(false); setExtractFile(null); }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleExtractUpload} disabled={extracting || !extractFile} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {extracting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Brain className="w-4 h-4" />}
                  {extracting ? 'Extracting...' : 'Extract & Generate'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Generate Modal */}
      <AnimatePresence>
        {showAIModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="glass-card w-full max-w-md p-6">
              <h2 className="font-display text-xl font-bold text-white mb-5 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-400" /> AI Question Generator
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Topic *</label>
                  <input value={aiForm.topic} onChange={e => setAIForm(p => ({...p, topic: e.target.value}))} placeholder="e.g. React Hooks, Binary Trees, System Design" className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Type</label>
                    <select value={aiForm.type} onChange={e => setAIForm(p => ({...p, type: e.target.value}))} className="input-field">
                      <option value="mcq">MCQ</option>
                      <option value="descriptive">Descriptive</option>
                      <option value="coding">Coding</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Difficulty</label>
                    <select value={aiForm.difficulty} onChange={e => setAIForm(p => ({...p, difficulty: e.target.value}))} className="input-field">
                      {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Count</label>
                    <input value={aiForm.count} onChange={e => setAIForm(p => ({...p, count: +e.target.value}))} type="number" min="1" max="20" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Marks each</label>
                    <input value={aiForm.marks} onChange={e => setAIForm(p => ({...p, marks: +e.target.value}))} type="number" min="0.5" className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Additional Context (optional)</label>
                  <textarea value={aiForm.context} onChange={e => setAIForm(p => ({...p, context: e.target.value}))} rows={2} placeholder="Specific subtopics, constraints, examples..." className="input-field resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAIModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleAIGenerate} disabled={aiLoading || !aiForm.topic} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {aiLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiLoading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
