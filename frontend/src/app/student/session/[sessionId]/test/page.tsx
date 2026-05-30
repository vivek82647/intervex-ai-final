'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import {
  Clock, ChevronLeft, ChevronRight, Send, AlertTriangle,
  CheckCircle, XCircle, Code2, Mic, MicOff, Volume2, VolumeX
} from 'lucide-react';
import { sessionApi, attemptApi } from '@/lib/api';
import { useStudentStore } from '@/store/auth.store';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
const LANGUAGES = ['python', 'javascript', 'java', 'cpp', 'c'];

// ─── Voice Hooks ──────────────────────────────────────────────────────────────

function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error('Voice not supported in this browser'); return; }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      onResult(text);
      setListening(false);
    };
    rec.onerror = () => { setListening(false); toast.error('Voice recognition error'); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, start, stop };
}

function useVoiceOutput() {
  const [speaking, setSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const speak = useCallback((text: string) => {
    if (!enabled) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, [enabled]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speaking, enabled, setEnabled, speak, stop };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();
  const { studentId, studentName, attemptId: storedAttemptId, setSession } = useStudentStore();

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [attemptId, setAttemptId] = useState<string | null>(storedAttemptId);
  const [timeLeft, setTimeLeft] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [warningMsg, setWarningMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeOutput, setCodeOutput] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [language, setLanguage] = useState('python');
  const [submitted, setSubmitted] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [maxWarnings, setMaxWarnings] = useState(3);
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const hasLoaded = useRef(false);
  const prevQuestionIdx = useRef(-1);

  // Voice
  const voiceOut = useVoiceOutput();
  const voiceIn = useVoiceInput((text) => {
    const q = questions[currentIdx];
    if (!q) return;
    if (q.type === 'descriptive') {
      const prev = answers[q.id]?.text_answer || '';
      saveAnswer(q.id, { text_answer: prev ? prev + ' ' + text : text });
      toast.success('Voice added to answer ✓');
    } else if (q.type === 'coding') {
      // Append as comment
      const prev = answers[q.id]?.code_answer || '';
      saveAnswer(q.id, { code_answer: prev + '\n# ' + text, language: answers[q.id]?.language || language });
    } else {
      toast('For MCQ, please click an option', { icon: 'ℹ️' });
    }
  });

  // Read question aloud when it changes
  useEffect(() => {
    if (questions.length === 0) return;
    if (currentIdx === prevQuestionIdx.current) return;
    prevQuestionIdx.current = currentIdx;
    const q = questions[currentIdx];
    if (q && voiceOut.enabled) {
      voiceOut.speak(`Question ${currentIdx + 1}. ${q.content}`);
    }
  }, [currentIdx, questions]);

  // Load session + start attempt
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    const init = async () => {
      try {
        const startRes = await attemptApi.start({ session_id: sessionId });
        
        // Block terminated/submitted students
        if (startRes.data.status === 'terminated') {
          router.replace('/student/terminated');
          return;
        }
        if (startRes.data.status === 'submitted') {
          router.replace(`/student/result/${startRes.data.attempt_id}`);
          return;
        }

        const qRes = await sessionApi.getQuestions(sessionId);
        setQuestions(qRes.data);
        setAttemptId(startRes.data.attempt_id);
        setSession({ attemptId: startRes.data.attempt_id });
        const dur = startRes.data.duration_minutes || 60;
        setSessionDuration(dur);
        setTimeLeft(dur * 60);
        if (startRes.data.max_warnings) setMaxWarnings(startRes.data.max_warnings);
      } catch (err: any) {
        const detail = err?.response?.data?.detail || '';
        if (detail.includes('terminated')) {
          router.replace('/student/terminated');
          return;
        }
        if (detail.includes('already submitted')) {
          router.replace(`/student/result/${storedAttemptId}`);
          return;
        }
        toast.error(detail || 'Failed to start test');
      }
    };
    init();
  }, [sessionId]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || submitted) return;
    timerRef.current = setTimeout(() => {
      setTimeLeft(t => { if (t <= 1) { handleAutoSubmit(); return 0; } return t - 1; });
    }, 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, submitted]);

  // WebSocket + anti-cheat
  useEffect(() => {
    if (!attemptId || !studentId) return;
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000', {
      auth: { token: Cookies.get('access_token') },
      transports: ['websocket'],
    });
    socket.on('connect', () => {
      socket.emit('student_join', { session_id: sessionId, student_id: studentId, student_name: studentName, attempt_id: attemptId });
    });
    socket.on('warning_issued', ({ count, message }: any) => {
      setWarningCount(count); setWarningMsg(message);
      toast.error(message, { duration: 4000 });
      setTimeout(() => setWarningMsg(''), 5000);
    });
    socket.on('session_terminated', ({ reason }: any) => {
      toast.error(`Session terminated: ${reason}`, { duration: 0 });
      router.push(`/student/result?terminated=true&reason=${encodeURIComponent(reason)}`);
    });
    socketRef.current = socket;

    const reportViolation = async (type: string, details: any = {}) => {
      if (!attemptId) return;
      try {
        const res = await attemptApi.recordWarning(attemptId, { type, details });
        const newCount = res.data.warning_count;
        setWarningCount(newCount);
        socket.emit('anti_cheat_warning', { type, details, session_id: sessionId, student_id: studentId, max_warnings: maxWarnings });
        // Frontend-side termination if backend/socket doesn't respond
        if (newCount >= maxWarnings) {
          toast.error('Too many violations! Test terminated.', { duration: 0 });
          setTimeout(() => router.push(`/student/result?terminated=true&reason=Too many warnings`), 2000);
        }
      } catch { }
    };

    // Tab switch - works on mobile too (pagehide for iOS Safari)
    const onVisibilityChange = () => { if (document.hidden) reportViolation('tab_switch', { timestamp: new Date().toISOString() }); };
    const onPageHide = () => reportViolation('tab_switch', { timestamp: new Date().toISOString() });
    const onCopy = (e: Event) => { e.preventDefault(); reportViolation('copy_paste', { action: 'copy' }); };
    const onPaste = (e: Event) => { e.preventDefault(); reportViolation('copy_paste', { action: 'paste' }); };
    const onContextMenu = (e: Event) => { e.preventDefault(); reportViolation('right_click'); };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key))) { e.preventDefault(); reportViolation('dev_tools'); }
    };
    const onFullscreenChange = () => { if (!document.fullscreenElement) reportViolation('fullscreen_exit'); };

    // Mobile: track touch outside (app switch on phone)
    let lastTouchTime = Date.now();
    const onFocus = () => {
      const gap = Date.now() - lastTouchTime;
      if (gap > 3000) reportViolation('tab_switch', { gap_ms: gap });
      lastTouchTime = Date.now();
    };
    const onBlur = () => { lastTouchTime = Date.now(); };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide); // iOS Safari
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    // Only request fullscreen on desktop (mobile fullscreen API unreliable)
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (!isMobile) document.documentElement.requestFullscreen().catch(() => {});

    return () => {
      socket.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [attemptId, studentId, sessionId]);

  useEffect(() => {
    if (!socketRef.current || questions.length === 0) return;
    const progress = Math.round((Object.keys(answers).length / questions.length) * 100);
    socketRef.current.emit('student_progress', { progress, time_remaining: timeLeft, status: 'in_progress' });
  }, [answers, timeLeft]);

  const saveAnswer = useCallback(async (questionId: string, answerData: any) => {
    if (!attemptId) return;
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], ...answerData } }));
    try { await attemptApi.saveAnswer(attemptId, { question_id: questionId, ...answerData }); } catch { }
  }, [attemptId]);

  const handleSubmit = async () => {
    if (!attemptId || submitting) return;
    if (!confirm('Submit your test? You cannot change answers after submission.')) return;
    submitAttempt();
  };

  const handleAutoSubmit = async () => { if (submitted) return; toast('⏰ Time is up! Submitting...'); submitAttempt(); };

  const submitAttempt = async () => {
    if (!attemptId || submitting || submitted) return;
    setSubmitting(true);
    voiceOut.stop();
    try {
      document.exitFullscreen().catch(() => {});
      socketRef.current?.emit('student_submitted', { score: null });
      await attemptApi.submit(attemptId);
      setSubmitted(true);
      voiceOut.speak('Test submitted successfully. Good luck!');
      router.push(`/student/result/${attemptId}`);
    } catch { toast.error('Submission failed. Retrying...'); setSubmitting(false); }
  };

  const runCode = async () => {
    const q = questions[currentIdx];
    const answer = answers[q.id];
    if (!answer?.code_answer) { toast.error('Write some code first'); return; }
    setRunning(true);
    try {
      const res = await attemptApi.runCode(attemptId!, { question_id: q.id, code: answer.code_answer, language: answer.language || language });
      setCodeOutput(res.data);
    } catch { toast.error('Execution failed'); } finally { setRunning(false); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const currentQ = questions[currentIdx];
  const progress = questions.length > 0 ? (Object.keys(answers).length / questions.length) * 100 : 0;
  const isLowTime = timeLeft < 300;

  if (!currentQ) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col select-none">
      <AnimatePresence>
        {warningMsg && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="fixed top-0 inset-x-0 z-50 p-4">
            <div className="max-w-2xl mx-auto p-4 bg-accent-amber/20 border border-accent-amber/50 rounded-2xl text-accent-amber text-sm text-center font-medium">
              {warningMsg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-surface-1 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-accent-cyan flex items-center justify-center">
            <span className="text-white text-xs font-bold">IX</span>
          </div>
          <div>
            <p className="text-xs text-white/40">Question {currentIdx + 1} of {questions.length}</p>
            <div className="w-32 h-1 bg-white/10 rounded-full mt-1">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${isLowTime ? 'bg-accent-rose/15 border-accent-rose/30 text-accent-rose' : 'bg-surface-2 border-white/10 text-white'}`}>
          <Clock className={`w-4 h-4 ${isLowTime ? 'animate-pulse' : ''}`} />
          <span className="font-mono text-sm font-bold">{formatTime(timeLeft)}</span>
        </div>

        {/* Voice controls + warnings + submit */}
        <div className="flex items-center gap-3">
          {/* TTS toggle */}
          <button
            onClick={() => { voiceOut.setEnabled(e => !e); if (voiceOut.speaking) voiceOut.stop(); }}
            title={voiceOut.enabled ? 'Mute voice reading' : 'Enable voice reading'}
            className={`p-2 rounded-xl border transition-all ${voiceOut.enabled ? 'bg-accent-cyan/15 border-accent-cyan/40 text-accent-cyan' : 'bg-surface-2 border-white/10 text-white/40'}`}
          >
            {voiceOut.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {warningCount > 0 && (
            <div className="flex items-center gap-1.5 text-accent-amber text-xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{warningCount} warning{warningCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm flex items-center gap-2 py-2">
            {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Submit
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Question nav sidebar */}
        <aside className="w-16 bg-surface-1 border-r border-white/5 flex flex-col items-center py-4 gap-2 overflow-y-auto">
          {questions.map((q, i) => {
            const answered = !!answers[q.id];
            return (
              <button key={q.id} onClick={() => setCurrentIdx(i)}
                className={`w-9 h-9 rounded-xl text-xs font-medium transition-all ${
                  i === currentIdx ? 'bg-brand-500 text-white shadow-[0_0_15px_rgba(91,106,245,0.5)]' :
                  answered ? 'bg-accent-emerald/20 text-accent-emerald border border-accent-emerald/30' :
                  'bg-surface-2 text-white/40 hover:text-white/70'
                }`}
              >{i + 1}</button>
            );
          })}
        </aside>

        {/* Main question area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6">
            {/* Question card */}
            <div className="glass-card p-5 mb-5">
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-lg border ${
                  currentQ.type === 'mcq' ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' :
                  currentQ.type === 'coding' ? 'bg-accent-cyan/10 border-accent-cyan/30 text-accent-cyan' :
                  'bg-accent-emerald/10 border-accent-emerald/30 text-accent-emerald'
                }`}>
                  {currentQ.type === 'mcq' ? 'Multiple Choice' : currentQ.type === 'coding' ? 'Coding' : 'Descriptive'}
                </span>
                <span className="text-xs text-white/30 capitalize">{currentQ.difficulty}</span>
                <span className="text-xs text-white/30">{currentQ.topic}</span>
                <span className="ml-auto text-xs text-white/50">{currentQ.marks} mark{currentQ.marks !== 1 ? 's' : ''}</span>
                {/* Read aloud button */}
                <button onClick={() => voiceOut.speak(`Question ${currentIdx + 1}. ${currentQ.content}`)}
                  title="Read question aloud"
                  className={`p-1.5 rounded-lg transition-all ${voiceOut.speaking ? 'text-accent-cyan bg-accent-cyan/15' : 'text-white/30 hover:text-white/60'}`}>
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-white leading-relaxed whitespace-pre-wrap">{currentQ.content}</p>
            </div>

            {/* MCQ */}
            {currentQ.type === 'mcq' && (
              <div className="space-y-3">
                {(currentQ.options || []).map((opt: any) => {
                  const selected = answers[currentQ.id]?.selected_option === opt.id;
                  return (
                    <button key={opt.id} onClick={() => saveAnswer(currentQ.id, { selected_option: opt.id })}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selected ? 'border-brand-500/60 bg-brand-500/15 text-white' : 'border-white/8 bg-surface-glass hover:border-white/20 text-white/70'
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-brand-500 bg-brand-500' : 'border-white/20'}`}>
                          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm">{opt.text}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Descriptive with Voice Input */}
            {currentQ.type === 'descriptive' && (
              <div className="glass-card p-1">
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <span className="text-xs text-white/30">Type or use voice</span>
                  <button
                    onClick={voiceIn.listening ? voiceIn.stop : voiceIn.start}
                    title={voiceIn.listening ? 'Stop recording' : 'Speak your answer'}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      voiceIn.listening
                        ? 'bg-accent-rose/20 border border-accent-rose/50 text-accent-rose animate-pulse'
                        : 'bg-brand-500/15 border border-brand-500/40 text-brand-400 hover:bg-brand-500/25'
                    }`}
                  >
                    {voiceIn.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {voiceIn.listening ? 'Stop' : 'Speak'}
                  </button>
                </div>
                <textarea
                  value={answers[currentQ.id]?.text_answer || ''}
                  onChange={e => saveAnswer(currentQ.id, { text_answer: e.target.value })}
                  placeholder="Write your detailed answer here, or click 'Speak' to use voice..."
                  rows={12}
                  className="w-full bg-transparent p-4 text-white text-sm leading-relaxed placeholder:text-white/20 focus:outline-none resize-none"
                />
                <div className="px-4 pb-3 text-xs text-white/20 text-right">
                  {(answers[currentQ.id]?.text_answer || '').length} characters
                </div>
              </div>
            )}

            {/* Coding */}
            {currentQ.type === 'coding' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <select value={answers[currentQ.id]?.language || language}
                    onChange={e => { setLanguage(e.target.value); saveAnswer(currentQ.id, { language: e.target.value }); }}
                    className="input-field w-36 text-sm">
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <button onClick={runCode} disabled={running} className="btn-secondary text-sm flex items-center gap-2 py-2">
                    {running ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Code2 className="w-3.5 h-3.5" />}
                    Run Code
                  </button>
                </div>
                <div className="rounded-xl overflow-hidden border border-white/8">
                  <MonacoEditor
                    height="350px"
                    language={answers[currentQ.id]?.language || language}
                    value={answers[currentQ.id]?.code_answer || (currentQ.starter_code?.[answers[currentQ.id]?.language || language] || '')}
                    onChange={val => saveAnswer(currentQ.id, { code_answer: val || '', language: answers[currentQ.id]?.language || language })}
                    theme="vs-dark"
                    options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 12 } }}
                  />
                </div>
                {codeOutput && (
                  <div className="glass-card p-4">
                    <p className="text-xs text-white/40 mb-2 font-mono">Output</p>
                    <pre className="text-sm text-white/80 font-mono whitespace-pre-wrap">{codeOutput.stdout || codeOutput.stderr || 'No output'}</pre>
                    {codeOutput.results && (
                      <div className="mt-3 space-y-2">
                        {codeOutput.results.map((r: any, i: number) => (
                          <div key={i} className={`text-xs flex items-center gap-2 ${r.passed ? 'text-accent-emerald' : 'text-accent-rose'}`}>
                            {r.passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            Test case {i + 1}: {r.passed ? 'Passed' : 'Failed'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
                className="btn-secondary flex items-center gap-2 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              {currentIdx < questions.length - 1 ? (
                <button onClick={() => setCurrentIdx(currentIdx + 1)} className="btn-primary flex items-center gap-2">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2">
                  <Send className="w-4 h-4" /> Submit Test
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
