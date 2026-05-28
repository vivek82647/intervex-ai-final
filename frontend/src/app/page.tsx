'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Brain, Shield, Zap, BarChart3, Code2, Users, CheckCircle, Star } from 'lucide-react';

const features = [
  { icon: Brain, title: 'AI Question Generation', desc: 'Generate MCQ, descriptive, and coding questions instantly using local Ollama or cloud AI models.', color: 'from-brand-500 to-brand-400' },
  { icon: Shield, title: 'Advanced Anti-Cheat', desc: 'Real-time tab monitoring, fullscreen enforcement, copy-paste prevention, and auto-termination.', color: 'from-accent-rose to-accent-amber' },
  { icon: Zap, title: 'Live Monitoring', desc: 'Watch every student in real-time. See progress, warnings, and status from your admin dashboard.', color: 'from-accent-cyan to-brand-400' },
  { icon: Code2, title: 'Code Execution', desc: 'Sandboxed code runner supporting Python, JS, Java, C++. Automated test case evaluation.', color: 'from-accent-emerald to-accent-cyan' },
  { icon: BarChart3, title: 'AI Evaluation', desc: 'Descriptive answers evaluated by AI with rubric scoring. Instant, consistent feedback.', color: 'from-accent-purple to-brand-500' },
  { icon: Users, title: 'Multi-tenant SaaS', desc: 'Fully isolated admin workspaces. Each instructor manages their own classes and students.', color: 'from-accent-amber to-accent-rose' },
];

const stats = [
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '< 2s', label: 'AI Response Time' },
  { value: '10+', label: 'Languages Supported' },
  { value: '∞', label: 'Students per Session' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface overflow-hidden">
      {/* Grid background */}
      <div className="fixed inset-0 grid-bg opacity-50 pointer-events-none" />

      {/* Glow orbs */}
      <div className="fixed top-1/4 -left-32 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 -right-32 w-96 h-96 bg-accent-cyan/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/2 w-96 h-96 bg-accent-purple/10 rounded-full blur-3xl pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-lg font-bold text-white">INTERVEX AI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm text-white/60 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/auth/register" className="btn-primary text-sm">
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 pt-24 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-8">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Assessment Platform
          </div>

          <h1 className="font-display text-6xl md:text-7xl font-bold text-white leading-tight mb-6">
            The Future of
            <br />
            <span className="gradient-text">Mock Interviews</span>
            <br />
            is Here
          </h1>

          <p className="text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Create AI-powered assessments, monitor students in real-time, and get instant AI evaluation.
            Built for educators who demand the best.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/auth/register" className="btn-primary flex items-center gap-2 text-base px-8 py-3">
              Start for Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/auth/login" className="btn-secondary text-base px-8 py-3">
              Admin Login
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="glass-card p-5 text-center">
              <div className="font-display text-3xl font-bold gradient-text mb-1">{stat.value}</div>
              <div className="text-sm text-white/40">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Everything You Need to <span className="gradient-text-purple">Assess Better</span>
          </h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            A complete platform for creating, running, and evaluating technical assessments at scale.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6 hover:border-white/15 transition-all duration-300 group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} p-0.5 mb-5`}>
                <div className="w-full h-full rounded-xl bg-surface-2 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <h3 className="font-display text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            How <span className="gradient-text">INTERVEX AI</span> Works
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Admin flow */}
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-brand-400" />
              </div>
              <span className="font-display font-bold text-white">For Admins / Educators</span>
            </div>
            <div className="space-y-4">
              {[
                'Create a class & add students',
                'Build question bank (manual, CSV, or AI)',
                'Configure session: duration, rules, anti-cheat',
                'Generate secure join link',
                'Monitor live from dashboard',
                'Download reports & analytics',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <span className="text-sm text-white/60">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Student flow */}
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-accent-emerald/20 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-accent-emerald" />
              </div>
              <span className="font-display font-bold text-white">For Students</span>
            </div>
            <div className="space-y-4">
              {[
                'Receive join link from educator',
                'Enter name, email, roll number',
                'Read instructions & rules',
                'Start test in fullscreen mode',
                'Solve MCQ, descriptive & coding',
                'Submit and get instant AI feedback',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent-emerald/20 text-accent-emerald text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <span className="text-sm text-white/60">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-8 py-20 text-center">
        <div className="gradient-border">
          <div className="p-12">
            <Star className="w-10 h-10 text-accent-amber mx-auto mb-5" />
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Ready to Transform Your Assessments?
            </h2>
            <p className="text-white/40 mb-8 text-lg">
              Join educators who use INTERVEX AI to run fair, efficient, AI-evaluated interviews.
            </p>
            <Link href="/auth/register" className="btn-primary text-base px-10 py-4 inline-flex items-center gap-2">
              Create Your Account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-8 py-6 text-center text-white/30 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Brain className="w-4 h-4 text-brand-400" />
          <span className="font-display font-semibold text-white/50">INTERVEX AI</span>
        </div>
        <p>AI-Powered Mock Interview & Assessment Platform — Production Ready</p>
      </footer>
    </div>
  );
}
