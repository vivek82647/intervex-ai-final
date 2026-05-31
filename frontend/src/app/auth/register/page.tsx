'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Brain, Mail, Lock, User, Building2, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import OTPModal from '@/components/shared/OTPModal';

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  organization: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { confirm_password, ...payload } = data;
      const res = await authApi.adminRegister(payload);
      setOtpEmail(res.data.email);
      setShowOTP(true);
      toast.success('Verification OTP sent to your email');
    } catch (err: any) {
      const message = err?.code === 'ECONNABORTED'
        ? 'Registration timed out while sending OTP. Please try again.'
        : err?.response?.data?.detail || 'Registration failed. Please check your connection.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerify = async (otp: string) => {
    const { data } = await authApi.verifyRegisterOtp({
      email: otpEmail,
      otp,
      purpose: 'register',
    });
    setTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    toast.success('Account verified! Welcome to INTERVEX AI');
    router.push('/admin/dashboard');
  };

  const handleResend = async () => {
    await authApi.resendOtp({ email: otpEmail, purpose: 'register' });
    toast.success('Verification OTP sent again');
  };

  return (
    <div className="min-h-screen bg-surface grid-bg flex items-center justify-center p-4">
      <div className="fixed top-1/4 -right-40 w-80 h-80 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
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

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input {...register('full_name')} placeholder="Dr. Jane Smith" className="input-field pl-10" />
              </div>
              {errors.full_name && <p className="text-accent-rose text-xs mt-1">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input {...register('email')} type="email" placeholder="admin@university.edu" className="input-field pl-10" />
              </div>
              {errors.email && <p className="text-accent-rose text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Organization <span className="text-white/30">(optional)</span></label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input {...register('organization')} placeholder="MIT, Google, etc." className="input-field pl-10" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input {...register('password')} type="password" placeholder="Min. 8 characters" className="input-field pl-10" />
              </div>
              {errors.password && <p className="text-accent-rose text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input {...register('confirm_password')} type="password" placeholder="Repeat password" className="input-field pl-10" />
              </div>
              {errors.confirm_password && <p className="text-accent-rose text-xs mt-1">{errors.confirm_password.message}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><span>Create Account</span> <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center text-sm text-white/40">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 transition-colors">Sign in</Link>
          </div>
        </div>
      </motion.div>

      <OTPModal
        isOpen={showOTP}
        email={otpEmail}
        purpose="register"
        onVerify={handleOTPVerify}
        onResend={handleResend}
        onClose={() => setShowOTP(false)}
      />
    </div>
  );
}
