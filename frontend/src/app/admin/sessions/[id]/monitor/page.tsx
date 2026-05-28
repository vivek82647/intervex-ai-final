'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity, Users, CheckCircle, AlertTriangle, XCircle,
  Clock, ArrowLeft, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { sessionApi } from '@/lib/api';
import type { LiveStudent } from '@/types';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/auth.store';

const STATUS_COLOR: Record<string, string> = {
  joined: 'bg-brand-500/20 text-brand-400',
  in_progress: 'bg-accent-emerald/20 text-accent-emerald',
  submitted: 'bg-accent-cyan/20 text-accent-cyan',
  terminated: 'bg-accent-rose/20 text-accent-rose',
};

const WARNING_COLOR: Record<string, string> = {
  tab_switch: 'text-accent-amber',
  fullscreen_exit: 'text-accent-amber',
  copy_paste: 'text-accent-rose',
  refresh: 'text-accent-rose',
};

export default function MonitorPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { user } = useAuthStore();
  const [students, setStudents] = useState<Record<string, LiveStudent>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [liveStats, setLiveStats] = useState({ total: 0, in_progress: 0, submitted: 0, terminated: 0 });
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = Cookies.get('access_token');
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('admin_watch', { session_id: sessionId, admin_id: user?.id });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('session_snapshot', ({ students: snap }: { students: LiveStudent[] }) => {
      const map: Record<string, LiveStudent> = {};
      snap.forEach(s => { map[s.student_id] = s; });
      setStudents(map);
      updateStats(map);
    });

    const updateStats = (map: Record<string, LiveStudent>) => {
      const values = Object.values(map);
      setLiveStats({
        total: values.length,
        in_progress: values.filter(s => s.status === 'in_progress' || s.status === 'joined').length,
        submitted: values.filter(s => s.status === 'submitted').length,
        terminated: values.filter(s => s.status === 'terminated').length,
      });
    };

    socket.on('student_joined', (data) => {
      setStudents(prev => {
        const updated = { ...prev, [data.student_id]: { ...prev[data.student_id], student_id: data.student_id, student_name: data.student_name, status: 'joined', warning_count: 0, progress: 0, connected: true, joined_at: data.timestamp } };
        updateStats(updated);
        return updated;
      });
      addAlert({ type: 'join', message: `${data.student_name} joined`, ts: data.timestamp, level: 'info' });
    });

    socket.on('student_submitted', (data) => {
      setStudents(prev => {
        const updated = { ...prev, [data.student_id]: { ...prev[data.student_id], status: 'submitted', progress: 100 } };
        updateStats(updated);
        return updated;
      });
      addAlert({ type: 'submit', message: `${data.student_name} submitted`, ts: data.timestamp, level: 'success' });
    });

    socket.on('anti_cheat_alert', (data) => {
      setStudents(prev => {
        const updated = { ...prev, [data.student_id]: { ...prev[data.student_id], warning_count: data.count } };
        return updated;
      });
      addAlert({ type: 'warning', message: `${data.student_name}: ${data.type.replace('_', ' ')} (${data.count}x)`, ts: data.timestamp, level: 'warning' });
      toast.error(`⚠️ ${data.student_name} — ${data.type.replace('_', ' ')}`);
    });

    socket.on('student_terminated', (data) => {
      setStudents(prev => {
        const updated = { ...prev, [data.student_id]: { ...prev[data.student_id], status: 'terminated' } };
        updateStats(updated);
        return updated;
      });
      addAlert({ type: 'terminate', message: `${data.student_name} terminated: ${data.reason}`, ts: data.timestamp, level: 'error' });
    });

    socket.on('student_disconnected', (data) => {
      setStudents(prev => ({ ...prev, [data.student_id]: { ...prev[data.student_id], connected: false } }));
    });

    socket.on('student_progress', (data) => {
      setStudents(prev => ({ ...prev, [data.student_id]: { ...prev[data.student_id], ...data } }));
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId, user?.id]);

  const addAlert = (alert: any) => {
    setAlerts(prev => [alert, ...prev].slice(0, 50));
  };

  const terminateStudent = (studentId: string) => {
    socketRef.current?.emit('admin_terminate_student', { session_id: sessionId, student_id: studentId, reason: 'Terminated by admin' });
    toast.success('Student terminated');
  };

  const studentList = Object.values(students);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/sessions" className="text-white/40 hover:text-white p-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="section-title flex items-center gap-2">
              Live Monitor
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-emerald animate-pulse' : 'bg-accent-rose'}`} />
            </h1>
            <p className="text-white/40 text-sm mt-0.5 flex items-center gap-1">
              {connected ? <Wifi className="w-3 h-3 text-accent-emerald" /> : <WifiOff className="w-3 h-3 text-accent-rose" />}
              {connected ? 'Real-time connection active' : 'Reconnecting...'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: liveStats.total, icon: Users, color: 'text-white' },
          { label: 'Active', value: liveStats.in_progress, icon: Activity, color: 'text-accent-emerald' },
          { label: 'Submitted', value: liveStats.submitted, icon: CheckCircle, color: 'text-accent-cyan' },
          { label: 'Terminated', value: liveStats.terminated, icon: XCircle, color: 'text-accent-rose' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div>
              <div className={`font-display text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-white/40">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Student grid */}
        <div className="lg:col-span-2">
          <h2 className="font-display font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" /> Students
          </h2>
          {studentList.length === 0 ? (
            <div className="glass-card p-12 text-center text-white/30">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Waiting for students to join...</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <AnimatePresence>
                {studentList.map((student) => (
                  <motion.div
                    key={student.student_id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`glass-card p-4 ${student.warning_count >= 2 ? 'border-accent-rose/30' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium text-white flex items-center gap-2">
                          {student.student_name}
                          <span className={`w-1.5 h-1.5 rounded-full ${student.connected ? 'bg-accent-emerald' : 'bg-white/20'}`} />
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[student.status] || 'text-white/30'}`}>
                          {student.status.replace('_', ' ')}
                        </span>
                      </div>
                      {student.warning_count > 0 && (
                        <div className="flex items-center gap-1 text-accent-amber">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">{student.warning_count}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-white/30 mb-1">
                        <span>Progress</span>
                        <span>{student.progress || 0}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-500 to-accent-cyan rounded-full transition-all duration-500"
                          style={{ width: `${student.progress || 0}%` }}
                        />
                      </div>
                    </div>

                    {student.status !== 'terminated' && student.status !== 'submitted' && (
                      <button
                        onClick={() => terminateStudent(student.student_id)}
                        className="w-full text-xs py-1 rounded-lg border border-accent-rose/20 text-accent-rose/60 hover:border-accent-rose/50 hover:text-accent-rose transition-all"
                      >
                        Terminate
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Live alerts feed */}
        <div>
          <h2 className="font-display font-semibold text-white mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-amber" /> Live Feed
          </h2>
          <div className="glass-card p-4 h-96 overflow-y-auto space-y-2">
            {alerts.length === 0 ? (
              <p className="text-center text-white/20 text-sm pt-8">No activity yet</p>
            ) : (
              alerts.map((alert, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`text-xs p-2 rounded-lg border ${
                    alert.level === 'error' ? 'bg-accent-rose/10 border-accent-rose/20 text-accent-rose' :
                    alert.level === 'warning' ? 'bg-accent-amber/10 border-accent-amber/20 text-accent-amber' :
                    alert.level === 'success' ? 'bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald' :
                    'bg-white/5 border-white/10 text-white/50'
                  }`}
                >
                  {alert.message}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
