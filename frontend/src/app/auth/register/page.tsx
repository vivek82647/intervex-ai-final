'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Brain, Mail, Lock, User, Building2, ArrowRight, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const [form, setForm] = useState({ full_name: '', email: '', organization: '', password: '', confirm_password: '', secret_code: '' });
  const [loading, setLoading] = useState(false);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.secret_code) { toast.error('Secret code is required'); return; }
    if (form.full_name.length < 2) { toast.error('Name must be at least 2 characters'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirm_password) { toast.error("Passwords don't match"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.full_name, email: form.email, organization: form.organization || undefined, password: form.password, secret_code: form.secret_code }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');
      setTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      toast.success('Account created! Welcome to INTERVEX AI');
      router.push('/admin/dashboard');
    } catch (err: any) {
      toast.error(err.name === 'TimeoutError' ? 'Request timed out. Try again.' : err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid-bg" style={{ background: "#0D0F1A" }} flex items-center justify-center p-4">
      <div className="fixed top-1/4 -right-40 w-80 h-80 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center shadow-[0_0_30px_rgba(91,106,245,0.4)]">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="font-display text-2xl font-bold text-white">INTERVEX AI</span>
          </Link>
          <p className="text-white/40 mt-3 text-sm">Create your admin workspace</p>
        </div>

        <div className="glass-card p-8">
          <h1 className="font-display text-2xl font-bold text-white mb-6">Create Account</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Secret Code <span className="text-accent-rose text-xs">*required</span></label>
              <div className="relative"><KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input value={form.secret_code} onChange={f('secret_code')} type="password" placeholder="Enter admin secret code" className="input-field pl-10" /></div>
              <p className="text-xs text-white/25 mt-1">Contact your platform administrator for the secret code.</p>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Full Name</label>
              <div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input value={form.full_name} onChange={f('full_name')} placeholder="Dr. Jane Smith" className="input-field pl-10" /></div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Email</label>
              <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input value={form.email} onChange={f('email')} type="email" placeholder="admin@university.edu" className="input-field pl-10" /></div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Organization <span className="text-white/30">(optional)</span></label>
              <div className="relative"><Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input value={form.organization} onChange={f('organization')} placeholder="MIT, Google, etc." className="input-field pl-10" /></div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Password</label>
              <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input value={form.password} onChange={f('password')} type="password" placeholder="Min. 8 characters" className="input-field pl-10" /></div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Confirm Password</label>
              <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input value={form.confirm_password} onChange={f('confirm_password')} type="password" placeholder="Repeat password" className="input-field pl-10" /></div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center text-sm text-white/40">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 transition-colors">Sign in</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
