'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, Users, BookOpen, X, GraduationCap } from 'lucide-react';
import { classApi } from '@/lib/api';
import type { Class } from '@/types';

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', subject: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await classApi.list();
      setClasses(res.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name) { toast.error('Class name is required'); return; }
    setSaving(true);
    try {
      await classApi.create(form);
      toast.success('Class created!');
      setShowModal(false);
      setForm({ name: '', description: '', subject: '' });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create');
    } finally { setSaving(false); }
  };

  const subjectColors: Record<string, string> = {
    'Computer Science': 'from-brand-500 to-brand-400',
    'Mathematics': 'from-accent-emerald to-accent-cyan',
    'Physics': 'from-accent-purple to-brand-500',
    'Data Structures': 'from-accent-cyan to-brand-400',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title">Classes</h1>
          <p className="text-white/40 text-sm mt-1">{classes.length} classes</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Class
        </button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="glass-card h-40 skeleton" />)}
        </div>
      ) : classes.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <GraduationCap className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-white mb-2">No classes yet</h3>
          <p className="text-white/40 text-sm mb-6">Create classes to organize your students</p>
          <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create First Class
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls, i) => {
            const gradient = subjectColors[cls.subject || ''] || 'from-brand-500/50 to-accent-cyan/50';
            return (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass-card overflow-hidden hover:border-white/15 transition-all group"
              >
                {/* Color bar */}
                <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-semibold text-white group-hover:text-brand-300 transition-colors">
                        {cls.name}
                      </h3>
                      {cls.subject && (
                        <span className="text-xs text-white/40">{cls.subject}</span>
                      )}
                    </div>
                    <div className={`px-2 py-0.5 rounded-lg text-xs ${cls.is_active ? 'bg-accent-emerald/10 text-accent-emerald' : 'bg-white/5 text-white/30'}`}>
                      {cls.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  {cls.description && (
                    <p className="text-sm text-white/40 mb-4 line-clamp-2">{cls.description}</p>
                  )}
                  <div className="flex items-center gap-4 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-white/40">
                      <Users className="w-3.5 h-3.5" />
                      <span>{cls.student_count} students</span>
                    </div>
                    <div className="text-xs text-white/20">
                      {new Date(cls.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl font-bold text-white">Create Class</h2>
                <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Class Name *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. B.Tech CSE 2024 Batch A" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Subject</label>
                  <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Data Structures & Algorithms" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Description</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Optional description" className="input-field resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Plus className="w-4 h-4" />
                  }
                  Create Class
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
