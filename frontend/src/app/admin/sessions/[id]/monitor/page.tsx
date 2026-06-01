'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity, Users, CheckCircle, AlertTriangle, XCircle,
  ArrowLeft, Wifi, WifiOff, Monitor, Globe, UserCheck, UserX
} from 'lucide-react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import type { LiveStudent } from '@/types';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/auth.store';

const STATUS_COLOR: Record<string, string> = {
  joined: 'bg-brand-500/20 text-brand-400',
  in_progress: 'bg-accent-emerald/20 text-accent-emerald',
  submitted: 'bg-accent-cyan/20 text-accent-cyan',
  terminated: 'bg-accent-rose/20 text-accent-rose',
};

function getDuplicateIPs(students: LiveStudent[]): Set<string> {
  const ipCount: Record<string, number> = {};
  students.forEach(s => {
    if (s.ip_address && s.ip_address !== 'Unknown')
      ipCount[s.ip_address] = (ipCount[s.ip_address] || 0) + 1;
  });
  return new Set(Object.entries(ipCount).filter(([, c]) => c > 1).map(([ip]) => ip));
}

interface RejoinRequest {
  student_id: string;
  student_name: string;
  reason: string;
  requested_at: string;
}

export default function MonitorPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { user } = useAuthStore();
  const [students, setStudents] = useState<Record<string, LiveStudent>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [liveStats, setLiveStats] = useState({ total: 0, in_progress: 0, submitted: 0, terminated: 0 });
  const [rejoinRequests, setRejoinRequests] = useState<RejoinRequest[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = Cookies.get('access_token');
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('admin_watch', { session_id: sessionId, admin_id: user?.id || 'admin' });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('session_snapshot', ({ students: snap, pending_rejoins }: any) => {
      const map: Record<string, LiveStudent> = {};
      snap.forEach((s: LiveStudent) => { map[s.student_id] = s; });
      setStudents(map);
      updateStats(map);
      if (pending_rejoins?.length) setRejoinRequests(pending_rejoins);
    });

    const updateStats = (map: Record<string, LiveStudent>) => {
      const v = Object.values(map);
      setLiveStats({
        total: v.length,
        in_progress: v.filter(s => s.status === 'in_progress' || s.status === 'joined').length,
        submitted: v.filter(s => s.status === 'submitted').length,
        terminated: v.filter(s => s.status === 'terminated').length,
      });
    };

    socket.on('student_joined', (data) => {
      setStudents(prev => {
        const updated = { ...prev, [data.student_id]: {
          ...prev[data.student_id], student_id: data.student_id,
          student_name: data.student_name, ip_address: data.ip_address || 'Unknown',
          user_agent: data.user_agent || '', status: 'joined', warning_count: 0,
          progress: 0, connected: true, joined_at: data.timestamp
        }};
        updateStats(updated);
        return updated;
      });
      addAlert({ type: 'join', message: `${data.student_name} joined`, ip: data.ip_address, ts: data.timestamp, level: 'info' });
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
      setStudents(prev => ({ ...prev, [data.student_id]: { ...prev[data.student_id], warning_count: data.count } }));
      addAlert({ type: 'warning', message: `${data.student_name}: ${data.type.replace('_', ' ')} (${data.count}x)`, ip: data.ip_address, ts: data.timestamp, level: 'warning' });
      toast.error(`⚠️ ${data.student_name} — ${data.type.replace('_', ' ')}`);
    });

    socket.on('student_terminated', (data) => {
      setStudents(prev => {
        const updated = { ...prev, [data.student_id]: { ...prev[data.student_id], status: 'terminated' } };
        updateStats(updated);
        return updated;
      });
      addAlert({ type: 'terminate', message: `${data.student_name} terminated`, ts: data.timestamp, level: 'error' });
    });

    socket.on('student_disconnected', (data) => {
      setStudents(prev => ({ ...prev, [data.student_id]: { ...prev[data.student_id], connected: false } }));
    });

    socket.on('student_progress', (data) => {
      setStudents(prev => ({ ...prev, [data.student_id]: { ...prev[data.student_id], ...data } }));
    });

    // ── Duplicate IP blocked attempt ──
    socket.on('duplicate_ip_attempt', (data) => {
      addAlert({
        type: 'ip_block',
        message: `🚫 IP blocked: ${data.blocked_student} tried to join from same IP as another student`,
        ip: data.ip_address,
        ts: data.timestamp,
        level: 'error'
      });
      toast.error(`🚫 Duplicate IP blocked: ${data.blocked_student}`);
    });

    // ── Rejoin request from student ──
    socket.on('rejoin_requested', (data) => {
      setRejoinRequests(prev => {
        const exists = prev.find(r => r.student_id === data.student_id);
        if (exists) return prev;
        return [...prev, { student_id: data.student_id, student_name: data.student_name, reason: data.reason, requested_at: data.timestamp }];
      });
      addAlert({ type: 'rejoin', message: `${data.student_name} requested rejoin`, ts: data.timestamp, level: 'warning' });
      toast(`🔔 ${data.student_name} wants to rejoin!`, { icon: '🙋', duration: 5000 });
    });

    socket.on('rejoin_approved_confirmed', (data) => {
      setRejoinRequests(prev => prev.filter(r => r.student_id !== data.student_id));
      addAlert({ type: 'rejoin_approved', message: `${data.student_name} rejoin approved`, ts: data.timestamp, level: 'success' });
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId, user?.id]);

  const addAlert = (alert: any) => setAlerts(prev => [alert, ...prev].slice(0, 50));

  const terminateStudent = (studentId: string) => {
    socketRef.current?.emit('admin_terminate_student', { session_id: sessionId, student_id: studentId, reason: 'Terminated by admin' });
    toast.success('Student terminated');
  };

  const approveRejoin = (studentId: string) => {
    socketRef.current?.emit('admin_approve_rejoin', { session_id: sessionId, student_id: studentId });
    setRejoinRequests(prev => prev.filter(r => r.student_id !== studentId));
    toast.success('Rejoin approved!');
  };

  const rejectRejoin = (studentId: string) => {
    socketRef.current?.emit('admin_reject_rejoin', { session_id: sessionId, student_id: studentId });
    setRejoinRequests(prev => prev.filter(r => r.student_id !== studentId));
    toast('Rejoin rejected');
  };

  const studentList = Object.values(students);
  const duplicateIPs = getDuplicateIPs(studentList);

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

      {/* Stats */}
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

      {/* Duplicate IP banner */}
      {duplicateIPs.size > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-accent-rose/10 border border-accent-rose/30 flex items-center gap-2 text-accent-rose text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span><strong>Suspicious:</strong> Shared IPs detected — {[...duplicateIPs].join(', ')}</span>
        </div>
      )}

      {/* ── Rejoin Requests Banner ── */}
      <AnimatePresence>
        {rejoinRequests.map(req => (
          <motion.div
            key={req.student_id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-3 p-4 rounded-xl bg-accent-amber/10 border border-accent-amber/40 flex items-center justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-accent-amber font-medium text-sm flex items-center gap-2">
                🙋 <strong>{req.student_name}</strong> wants to rejoin
              </p>
              {req.reason && req.reason !== 'No reason provided' && (
                <p className="text-white/40 text-xs mt-0.5 truncate">"{req.reason}"</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => approveRejoin(req.student_id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-emerald/20 text-accent-emerald text-xs font-medium hover:bg-accent-emerald/30 transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => rejectRejoin(req.student_id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-rose/20 text-accent-rose text-xs font-medium hover:bg-accent-rose/30 transition-all"
              >
                <UserX className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Students */}
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
                {studentList.map((student) => {
                  const isDuplicateIP = student.ip_address && duplicateIPs.has(student.ip_address);
                  return (
                    <motion.div key={student.student_id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className={`glass-card p-4 ${isDuplicateIP ? 'border-accent-rose/50 bg-accent-rose/5' : student.warning_count >= 2 ? 'border-accent-amber/30' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-white flex items-center gap-2">
                            {student.student_name}
                            <span className={`w-1.5 h-1.5 rounded-full ${student.connected ? 'bg-accent-emerald' : 'bg-white/20'}`} />
                            {isDuplicateIP && <AlertTriangle className="w-3.5 h-3.5 text-accent-rose" />}
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

                      <div className={`flex items-center gap-1.5 text-xs mb-2 ${isDuplicateIP ? 'text-accent-rose' : 'text-white/30'}`}>
                        <Globe className="w-3 h-3 flex-shrink-0" />
                        <span className="font-mono truncate">{student.ip_address || 'Unknown'}</span>
                        {isDuplicateIP && <span className="text-accent-rose font-medium ml-1">⚠ Shared IP</span>}
                      </div>

                      {student.user_agent && (
                        <div className="flex items-center gap-1.5 text-xs text-white/20 mb-2 truncate">
                          <Monitor className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{student.user_agent.split(' ').slice(0, 3).join(' ')}</span>
                        </div>
                      )}

                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-white/30 mb-1">
                          <span>Progress</span><span>{student.progress || 0}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-brand-500 to-accent-cyan rounded-full transition-all duration-500" style={{ width: `${student.progress || 0}%` }} />
                        </div>
                      </div>

                      {student.status !== 'terminated' && student.status !== 'submitted' && (
                        <button onClick={() => terminateStudent(student.student_id)}
                          className="w-full text-xs py-1 rounded-lg border border-accent-rose/20 text-accent-rose/60 hover:border-accent-rose/50 hover:text-accent-rose transition-all">
                          Terminate
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Live Feed */}
        <div>
          <h2 className="font-display font-semibold text-white mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-amber" /> Live Feed
          </h2>
          <div className="glass-card p-4 h-96 overflow-y-auto space-y-2">
            {alerts.length === 0 ? (
              <p className="text-center text-white/20 text-sm pt-8">No activity yet</p>
            ) : (
              alerts.map((alert, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  className={`text-xs p-2 rounded-lg border ${
                    alert.level === 'error' ? 'bg-accent-rose/10 border-accent-rose/20 text-accent-rose' :
                    alert.level === 'warning' ? 'bg-accent-amber/10 border-accent-amber/20 text-accent-amber' :
                    alert.level === 'success' ? 'bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald' :
                    'bg-white/5 border-white/10 text-white/50'
                  }`}
                >
                  <div>{alert.message}</div>
                  {alert.ip && (
                    <div className="flex items-center gap-1 mt-0.5 opacity-60">
                      <Globe className="w-2.5 h-2.5" />
                      <span className="font-mono">{alert.ip}</span>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}