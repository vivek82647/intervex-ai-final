'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, Search, Users, Mail, Hash, Phone,
  Trash2, Upload, X, CheckCircle, UserPlus
} from 'lucide-react';
import { studentApi, classApi } from '@/lib/api';
import type { Student, Class } from '@/types';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', roll_number: '', phone: '', class_id: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([studentApi.list(), classApi.list()]);
      setStudents(sRes.data);
      setClasses(cRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!form.full_name || !form.email) { toast.error('Name and email are required'); return; }
    setSaving(true);
    try {
      const res = await studentApi.create({
        full_name: form.full_name,
        email: form.email,
        roll_number: form.roll_number || undefined,
        phone: form.phone || undefined,
        class_ids: form.class_id ? [form.class_id] : [],
      });
      if (form.class_id) {
        await classApi.enrollStudent(form.class_id, res.data.id);
      }
      toast.success('Student added!');
      setShowModal(false);
      setForm({ full_name: '', email: '', roll_number: '', phone: '', class_id: '' });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add student');
    } finally { setSaving(false); }
  };

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarColor = (name: string) => {
    const colors = ['bg-brand-500', 'bg-accent-cyan/80', 'bg-accent-emerald/80', 'bg-accent-purple/80', 'bg-accent-amber/80'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title">Students</h1>
          <p className="text-white/40 text-sm mt-1">{students.length} registered students</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" /> Bulk Import
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add Student
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or roll number..."
          className="input-field pl-9"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="glass-card p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-brand-400" />
          <div>
            <div className="font-display text-xl font-bold text-white">{students.length}</div>
            <div className="text-xs text-white/30">Total Students</div>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-accent-emerald" />
          <div>
            <div className="font-display text-xl font-bold text-white">{students.filter(s => s.is_active).length}</div>
            <div className="text-xs text-white/30">Active</div>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <Hash className="w-5 h-5 text-accent-amber" />
          <div>
            <div className="font-display text-xl font-bold text-white">{classes.length}</div>
            <div className="text-xs text-white/30">Classes</div>
          </div>
        </div>
      </div>

      {/* Student table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="glass-card h-16 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-white mb-2">
            {search ? 'No students found' : 'No students yet'}
          </h3>
          <p className="text-white/40 text-sm mb-6">
            {search ? 'Try a different search term' : 'Add students to your workspace'}
          </p>
          {!search && (
            <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add First Student
            </button>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-xs text-white/30">
                <th className="text-left px-5 py-3">Student</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Roll No.</th>
                <th className="text-left px-5 py-3">Phone</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, i) => (
                <motion.tr
                  key={student.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-white/5 hover:bg-surface-glass transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl ${avatarColor(student.full_name)} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
                        {initials(student.full_name)}
                      </div>
                      <span className="text-sm font-medium text-white">{student.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-white/50 flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> {student.email}
                  </td>
                  <td className="px-5 py-3 text-sm text-white/40 font-mono">{student.roll_number || '–'}</td>
                  <td className="px-5 py-3 text-sm text-white/40">{student.phone || '–'}</td>
                  <td className="px-5 py-3">
                    <span className={student.is_active ? 'badge-active' : 'badge-ended'}>
                      {student.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/30">
                    {new Date(student.created_at).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Student Modal */}
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
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl font-bold text-white">Add Student</h2>
                <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Full Name *</label>
                  <input
                    value={form.full_name}
                    onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="Student's full name"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Email *</label>
                  <input
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    type="email"
                    placeholder="student@college.edu"
                    className="input-field"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Roll Number</label>
                    <input
                      value={form.roll_number}
                      onChange={e => setForm(p => ({ ...p, roll_number: e.target.value }))}
                      placeholder="CS2021042"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Phone</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+91 9876543210"
                      className="input-field"
                    />
                  </div>
                </div>
                {classes.length > 0 && (
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Enroll in Class</label>
                    <select
                      value={form.class_id}
                      onChange={e => setForm(p => ({ ...p, class_id: e.target.value }))}
                      className="input-field"
                    >
                      <option value="">No class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleAdd} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <UserPlus className="w-4 h-4" />
                  }
                  Add Student
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
