'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Brain, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter email and password'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      setTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      toast.success(`Welcome back, ${data.user.full_name.split(' ')[0]}!`);
      router.push('/admin/dashboard');
    } catch (err: any) {
      toast.error(err.name === 'TimeoutError' ? 'Request timed out. Try again.' : err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid-bg" style={{ background: "#0D0F1A" }} flex items-center justify-center p-4">
      </div>
      <div className="fixed top-1/3 -left-40 w-80 h-80 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/3 -right-40 w-80 h-80 bg-accent-cyan/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center shadow-[0_0_30px_rgba(91,106,245,0.4)]">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="font-display text-2xl font-bold text-white">INTERVEX AI</span>
          </Link>
          <p className="text-white/40 mt-3 text-sm">Admin Portal — Sign in to your workspace</p>
        </div>

        <div className="glass-card p-8">
          <h1 className="font-display text-2xl font-bold text-white mb-6">Welcome back</h1>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm text-white/60 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="admin@company.com" className="input-field pl-10" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input value={password} onChange={e => setPassword(e.target.value)} type={showPass ? 'text' : 'password'} placeholder="Your password" className="input-field pl-10 pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center text-sm text-white/40">
            Don't have an account?{' '}
            <Link href="/auth/register" className="text-brand-400 hover:text-brand-300 transition-colors">Create Admin Account</Link>
          </div>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          Are you a student?{' '}
          <Link href="/join" className="text-white/40 hover:text-white/60 underline">Join via link</Link>
        </p>
      </motion.div>
    </div>
  );
}
