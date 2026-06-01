'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Brain, Mail, Lock, User, Phone, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useStudentStore } from '@/store/auth.store';
import Cookies from 'js-cookie';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
type Step = 'form' | 'otp';

export default function StudentRegisterPage() {
  const router = useRouter();
  const { setSession } = useStudentStore();
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm_password: '', roll_number: '', phone: '' });
  const [otp, setOtp] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.full_name.length < 2) { toast.error('Enter your full name'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirm_password) { toast.error("Passwords don't match"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/student/register/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.full_name, email: form.email, password: form.password, roll_number: form.roll_number || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      toast.success('OTP sent to your email!');
      setStep('otp');
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error('Enter 6-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/student/register/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp_data: { email: form.email, otp },
          reg_data: { full_name: form.full_name, email: form.email, password: form.password, roll_number: form.roll_number || undefined }
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'OTP verification failed');
      Cookies.set('access_token', data.access_token, { expires: 1 });
      setSession({ studentId: data.student.id, studentName: data.student.full_name, token: data.access_token });
      toast.success('Account created! You can now join tests.');
      router.push('/student/login');
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center px-4">
      <div className="fixed top-1/3 -left-40 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">

        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="font-display text-2xl font-bold text-white">INTERVEX AI</span>
          </Link>
          <p className="text-white/40 mt-3 text-sm">Student Portal — Create your account</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <AnimatePresence mode="wait">

            {step === 'form' && (
              <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <h1 className="text-2xl font-bold text-white mb-6">Create Account</h1>
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Full Name *</label>
                    <div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input value={form.full_name} onChange={f('full_name')} placeholder="Your full name" required
                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400" /></div>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Email *</label>
                    <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input value={form.email} onChange={f('email')} type="email" placeholder="your@email.com" required
                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400" /></div>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Roll Number <span className="text-white/30">(optional)</span></label>
                    <input value={form.roll_number} onChange={f('roll_number')} placeholder="e.g. 2021CS001"
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Password *</label>
                    <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input value={form.password} onChange={f('password')} type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters" required
                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400" />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button></div>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Confirm Password *</label>
                    <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input value={form.confirm_password} onChange={f('confirm_password')} type="password" placeholder="Repeat password" required
                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-white/30 focus:outline-none focus:border-indigo-400" /></div>
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 mt-2">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Verify Email</h1>
                    <p className="text-xs text-white/40 mt-0.5">OTP sent to <span className="text-white/70">{form.email}</span></p>
                  </div>
                </div>
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Enter 6-digit OTP</label>
                    <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000" maxLength={6} autoFocus
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-4 text-white text-center text-2xl font-mono tracking-[0.4em] placeholder-white/20 focus:outline-none focus:border-indigo-400" />
                    <p className="text-xs text-white/30 mt-2 text-center">Valid for 10 minutes</p>
                  </div>
                  <button type="submit" disabled={loading || otp.length !== 6}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Verify & Create Account <ShieldCheck className="w-4 h-4" /></>}
                  </button>
                  <button type="button" onClick={() => { setStep('form'); setOtp(''); }} className="w-full text-sm text-white/30 hover:text-white/60 transition-colors">
                    ← Go back
                  </button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>

          <div className="mt-6 pt-5 border-t border-white/5 text-center text-sm text-white/40">
            Already have an account?{' '}
            <Link href="/student/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">Sign in</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
