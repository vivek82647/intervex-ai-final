'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Brain, User, Mail, Hash, Phone, Clock, BookOpen, AlertCircle, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useStudentStore } from '@/store/auth.store';
import Cookies from 'js-cookie';

const schema = z.object({
  full_name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  roll_number: z.string().optional(),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function JoinPage() {
  const params = useParams();
  const joinLink = params.link as string;
  const router = useRouter();
  const { setSession } = useStudentStore();

  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    authApi.getSessionByLink(joinLink).then(r => {
      setSessionInfo(r.data);
    }).catch(() => {
      toast.error('Invalid or expired session link');
    }).finally(() => setLoading(false));
  }, [joinLink]);

  const onSubmit = async (data: FormData) => {
    setJoining(true);
    try {
      const res = await authApi.studentJoin({ join_link: joinLink, ...data });
      const { access_token, student_id, student_name, session_id, session_title } = res.data;

      Cookies.set('access_token', access_token, { expires: 1 });
      setSession({ studentId: student_id, studentName: student_name, sessionId: session_id, sessionTitle: session_title, token: access_token });

      router.push(`/student/session/${session_id}/instructions`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to join session');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sessionInfo) {
    return (
      <div className="min-h-screen bg-surface grid-bg flex items-center justify-center p-4">
        <div className="glass-card p-10 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-accent-rose mx-auto mb-4" />
          <h1 className="font-display text-xl font-bold text-white mb-2">Session Not Found</h1>
          <p className="text-white/40 text-sm">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  if (sessionInfo.status !== 'active') {
    return (
      <div className="min-h-screen bg-surface grid-bg flex items-center justify-center p-4">
        <div className="glass-card p-10 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-accent-amber mx-auto mb-4" />
          <h1 className="font-display text-xl font-bold text-white mb-2">Session {sessionInfo.status}</h1>
          <p className="text-white/40 text-sm capitalize">This session is currently {sessionInfo.status} and cannot be joined.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface grid-bg flex items-center justify-center p-4">
      <div className="fixed top-1/3 -left-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(91,106,245,0.4)]">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">{sessionInfo.title}</h1>
          <p className="text-white/40 text-sm mt-1">INTERVEX AI Assessment</p>
        </div>

        {/* Session info */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="glass-card p-3 text-center">
            <Clock className="w-4 h-4 text-accent-amber mx-auto mb-1" />
            <div className="text-sm font-semibold text-white">{sessionInfo.duration_minutes} min</div>
            <div className="text-xs text-white/30">Duration</div>
          </div>
          <div className="glass-card p-3 text-center">
            <BookOpen className="w-4 h-4 text-brand-400 mx-auto mb-1" />
            <div className="text-sm font-semibold text-white">{sessionInfo.total_marks} marks</div>
            <div className="text-xs text-white/30">Total Marks</div>
          </div>
        </div>

        {/* Form */}
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold text-white mb-5">Enter Your Details</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Full Name *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input {...register('full_name')} placeholder="Your full name" className="input-field pl-10" />
              </div>
              {errors.full_name && <p className="text-accent-rose text-xs mt-1">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input {...register('email')} type="email" placeholder="you@college.edu" className="input-field pl-10" />
              </div>
              {errors.email && <p className="text-accent-rose text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Roll Number <span className="text-white/30">(optional)</span></label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input {...register('roll_number')} placeholder="e.g. CS2021042" className="input-field pl-10" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Phone <span className="text-white/30">(optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input {...register('phone')} placeholder="+91 9876543210" className="input-field pl-10" />
              </div>
            </div>

            {sessionInfo.fullscreen_required && (
              <div className="p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/20 text-xs text-accent-amber flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>This test requires fullscreen mode. Your activity will be monitored for anti-cheat compliance.</span>
              </div>
            )}

            <button type="submit" disabled={joining} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {joining
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><span>Join Session</span> <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
