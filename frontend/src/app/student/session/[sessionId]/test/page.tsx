'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { Clock, ChevronLeft, ChevronRight, Send, AlertTriangle, CheckCircle, XCircle, Code2, Mic, MicOff, Volume2, VolumeX, Bookmark, BookmarkCheck, RotateCcw } from 'lucide-react';
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
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Voice not supported'); return; }
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = false;
    rec.onresult = (e: any) => { onResult(e.results[0][0].transcript); setListening(false); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start(); setListening(true);
  }, [onResult]);
  const stop = useCallback(() => { recognitionRef.current?.stop(); setListening(false); }, []);
  return { listening, start, stop };
}

function useVoiceOutput() {
  const [speaking, setSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(false); // off by default for clean UI
  const speak = useCallback((text: string) => {
    if (!enabled) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => setSpeaking(true); u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [enabled]);
  const stop = useCallback(() => { window.speechSynthesis.cancel(); setSpeaking(false); }, []);
  return { speaking, enabled, setEnabled, speak, stop };
}

// ─── Q Status ─────────────────────────────────────────────────────────────────
type QStatus = 'not-visited' | 'answered' | 'marked' | 'answered-marked' | 'visited';

export default function TestPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();
  const { studentId, studentName, attemptId: storedAttemptId, setSession } = useStudentStore();

  // Block back button
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const block = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', block);
    return () => window.removeEventListener('popstate', block);
  }, []);

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [attemptId, setAttemptId] = useState<string | null>(storedAttemptId);
  const [timeLeft, setTimeLeft] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [language, setLanguage] = useState('python');
  const [codeOutput, setCodeOutput] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [maxWarnings, setMaxWarnings] = useState(3);
  const [sessionTitle, setSessionTitle] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const hasLoaded = useRef(false);

  const voiceOut = useVoiceOutput();
  const voiceIn = useVoiceInput((text) => {
    const q = questions[currentIdx];
    if (!q) return;
    if (q.type === 'descriptive') {
      const prev = answers[q.id]?.text_answer || '';
      saveAnswer(q.id, { text_answer: prev ? prev + ' ' + text : text });
      toast.success('Voice added ✓');
    }
  });

  // Load
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    const init = async () => {
      try {
        const startRes = await attemptApi.start({ session_id: sessionId });
        if (startRes.data.status === 'terminated') { router.replace('/student/terminated'); return; }
        if (startRes.data.status === 'submitted') { router.replace(`/student/result/${startRes.data.attempt_id}`); return; }
        const qRes = await sessionApi.getQuestions(sessionId);
        setQuestions(qRes.data);
        setSessionTitle(startRes.data.session_title || 'Assessment');
        setAttemptId(startRes.data.attempt_id);
        setSession({ attemptId: startRes.data.attempt_id });
        const dur = startRes.data.duration_minutes || 60;
        setTimeLeft(dur * 60);
        if (startRes.data.max_warnings) setMaxWarnings(startRes.data.max_warnings);
      } catch (err: any) {
        const detail = err?.response?.data?.detail || '';
        if (detail.includes('terminated')) { router.replace('/student/terminated'); return; }
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
    socket.on('connect', () => socket.emit('student_join', { session_id: sessionId, student_id: studentId, student_name: studentName, attempt_id: attemptId }));
    socket.on('warning_issued', ({ count, message }: any) => { setWarningCount(count); toast.error(message, { duration: 4000 }); });
    socket.on('session_terminated', ({ reason }: any) => { toast.error(`Terminated: ${reason}`, { duration: 0 }); router.push(`/student/result?terminated=true`); });
    socketRef.current = socket;

    const reportViolation = async (type: string, details: any = {}) => {
      if (!attemptId) return;
      try {
        const res = await attemptApi.recordWarning(attemptId, { type, details });
        const newCount = res.data.warning_count;
        setWarningCount(newCount);
        socket.emit('anti_cheat_warning', { type, details, session_id: sessionId, student_id: studentId, max_warnings: maxWarnings });
        if (newCount >= maxWarnings) { toast.error('Too many violations! Test terminated.', { duration: 0 }); setTimeout(() => router.push('/student/terminated'), 2000); }
      } catch {}
    };

    let lastBlurTime = Date.now();
    const onVis = () => { if (document.hidden) reportViolation('tab_switch', { ts: new Date().toISOString() }); };
    const onPageHide = () => reportViolation('tab_switch', {});
    const onBlur = () => { lastBlurTime = Date.now(); };
    const onFocus = () => { if (Date.now() - lastBlurTime > 3000) reportViolation('tab_switch', { gap: Date.now() - lastBlurTime }); };
    const onCopy = (e: Event) => { e.preventDefault(); reportViolation('copy_paste', { action: 'copy' }); };
    const onPaste = (e: Event) => { e.preventDefault(); reportViolation('copy_paste', { action: 'paste' }); };
    const onCtx = (e: Event) => { e.preventDefault(); reportViolation('right_click'); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key))) { e.preventDefault(); reportViolation('dev_tools'); } };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onCtx);
    document.addEventListener('keydown', onKey);
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (!isMobile) document.documentElement.requestFullscreen().catch(() => {});

    return () => {
      socket.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onCtx);
      document.removeEventListener('keydown', onKey);
    };
  }, [attemptId, studentId]);

  const saveAnswer = useCallback(async (questionId: string, answerData: any) => {
    if (!attemptId) return;
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], ...answerData } }));
    try { await attemptApi.saveAnswer(attemptId, { question_id: questionId, ...answerData }); } catch {}
  }, [attemptId]);

  const submitAttempt = async () => {
    if (!attemptId || submitting || submitted) return;
    setSubmitting(true);
    voiceOut.stop();
    try {
      document.exitFullscreen().catch(() => {});
      socketRef.current?.emit('student_submitted', {});
      await attemptApi.submit(attemptId);
      setSubmitted(true);
      router.push(`/student/result/${attemptId}`);
    } catch { toast.error('Submission failed'); setSubmitting(false); }
  };

  const handleSubmit = () => { if (!confirm('Submit your test? You cannot change answers after this.')) return; submitAttempt(); };
  const handleAutoSubmit = () => { if (submitted) return; toast('⏰ Time is up! Submitting...'); submitAttempt(); };

  const runCode = async () => {
    const q = questions[currentIdx];
    const answer = answers[q.id];
    if (!answer?.code_answer) { toast.error('Write some code first'); return; }
    setRunning(true);
    try { const res = await attemptApi.runCode(attemptId!, { question_id: q.id, code: answer.code_answer, language: answer.language || language }); setCodeOutput(res.data); }
    catch { toast.error('Execution failed'); } finally { setRunning(false); }
  };

  const toggleMark = (qId: string) => setMarked(prev => { const n = new Set(prev); n.has(qId) ? n.delete(qId) : n.add(qId); return n; });
  const clearResponse = (qId: string) => { setAnswers(prev => { const n = {...prev}; delete n[qId]; return n; }); if (attemptId) attemptApi.saveAnswer(attemptId, { question_id: qId, selected_option: null, text_answer: null }).catch(() => {}); };

  const formatTime = (s: number) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const getQStatus = (q: any): QStatus => {
    const ans = answers[q.id];
    const isMarked = marked.has(q.id);
    const hasAns = ans && (ans.selected_option || ans.text_answer || ans.code_answer);
    if (hasAns && isMarked) return 'answered-marked';
    if (hasAns) return 'answered';
    if (isMarked) return 'marked';
    return 'not-visited';
  };

  const statusStyle: Record<QStatus, string> = {
    'answered': 'bg-green-500 text-white border-green-500',
    'marked': 'bg-purple-500 text-white border-purple-500',
    'answered-marked': 'bg-purple-500 text-white border-purple-500',
    'not-visited': 'bg-white text-gray-500 border-gray-300',
    'visited': 'bg-red-100 text-red-500 border-red-300',
  };

  const currentQ = questions[currentIdx];
  const isLowTime = timeLeft < 300 && timeLeft > 0;

  const answered = Object.keys(answers).filter(id => {
    const a = answers[id];
    return a && (a.selected_option || a.text_answer || a.code_answer);
  }).length;
  const markedCount = marked.size;
  const notVisited = questions.length - answered - markedCount;

  if (!currentQ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading test...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">IX</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs text-gray-400 leading-none">Assessment</p>
            <p className="text-sm font-semibold text-gray-800 leading-tight">{sessionTitle || 'Test'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {warningCount > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-orange-600 text-xs font-medium">{warningCount} Warning{warningCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-mono text-sm font-bold ${isLowTime ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
            <span className="text-xs font-normal text-gray-400 ml-1 hidden sm:inline">Time Left</span>
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
            {submitting ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Submit Test
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Question header */}
          <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Question <span className="font-semibold text-gray-800">{currentIdx + 1}</span> of {questions.length}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                currentQ.type === 'mcq' ? 'bg-blue-50 text-blue-600' :
                currentQ.type === 'coding' ? 'bg-cyan-50 text-cyan-600' :
                'bg-green-50 text-green-600'
              }`}>
                {currentQ.type === 'mcq' ? 'Multiple Choice' : currentQ.type === 'coding' ? 'Coding' : 'Descriptive'}
              </span>
              <span className="text-xs text-gray-400 capitalize">{currentQ.difficulty}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{currentQ.marks} mark{currentQ.marks !== 1 ? 's' : ''}</span>
              <button onClick={() => toggleMark(currentQ.id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  marked.has(currentQ.id) ? 'bg-purple-50 border-purple-300 text-purple-600' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-purple-300'
                }`}>
                {marked.has(currentQ.id) ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                {marked.has(currentQ.id) ? 'Marked' : 'Mark for Review'}
              </button>
              {/* Voice controls */}
              <button onClick={() => voiceOut.setEnabled((e: boolean) => !e)} title={voiceOut.enabled ? 'Mute' : 'Read aloud'}
                className={`p-1.5 rounded-lg border text-xs transition-all ${voiceOut.enabled ? 'bg-blue-50 border-blue-200 text-blue-500' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                {voiceOut.enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Question + Answer area */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Question text */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 shadow-sm">
              <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">{currentQ.content}</p>
            </div>

            {/* MCQ */}
            {currentQ.type === 'mcq' && (
              <div className="space-y-3">
                {(currentQ.options || []).map((opt: any, i: number) => {
                  const selected = answers[currentQ.id]?.selected_option === opt.id;
                  const letters = ['A', 'B', 'C', 'D', 'E'];
                  return (
                    <button key={opt.id} onClick={() => saveAnswer(currentQ.id, { selected_option: opt.id })}
                      className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                      }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-all ${
                        selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {letters[i] || opt.id.toUpperCase()}
                      </div>
                      <span className={`text-sm ${selected ? 'text-blue-800 font-medium' : 'text-gray-700'}`}>{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Descriptive */}
            {currentQ.type === 'descriptive' && (
              <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
                  <span className="text-xs text-gray-400">Type your answer below or use voice</span>
                  <button onClick={voiceIn.listening ? voiceIn.stop : voiceIn.start}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      voiceIn.listening ? 'bg-red-50 border-red-300 text-red-500 animate-pulse' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300'
                    }`}>
                    {voiceIn.listening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    {voiceIn.listening ? 'Stop' : 'Speak'}
                  </button>
                </div>
                <textarea
                  value={answers[currentQ.id]?.text_answer || ''}
                  onChange={e => saveAnswer(currentQ.id, { text_answer: e.target.value })}
                  placeholder="Write your detailed answer here..."
                  rows={14}
                  className="w-full p-4 text-gray-800 text-sm leading-relaxed placeholder:text-gray-300 focus:outline-none resize-none"
                />
                <div className="px-4 pb-3 text-xs text-gray-300 text-right">
                  {(answers[currentQ.id]?.text_answer || '').length} characters
                </div>
              </div>
            )}

            {/* Coding */}
            {currentQ.type === 'coding' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <select value={answers[currentQ.id]?.language || language}
                    onChange={e => { setLanguage(e.target.value); saveAnswer(currentQ.id, { language: e.target.value }); }}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:border-blue-400">
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <button onClick={runCode} disabled={running}
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
                    {running ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Code2 className="w-3.5 h-3.5" />}
                    Run Code
                  </button>
                </div>
                <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                  <MonacoEditor
                    height="320px"
                    language={answers[currentQ.id]?.language || language}
                    value={answers[currentQ.id]?.code_answer || (currentQ.starter_code?.[answers[currentQ.id]?.language || language] || '')}
                    onChange={val => saveAnswer(currentQ.id, { code_answer: val || '', language: answers[currentQ.id]?.language || language })}
                    theme="vs"
                    options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 12 } }}
                  />
                </div>
                {codeOutput && (
                  <div className="bg-gray-900 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-2 font-mono">Output</p>
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">{codeOutput.stdout || codeOutput.stderr || 'No output'}</pre>
                    {codeOutput.results && (
                      <div className="mt-3 space-y-1.5 border-t border-gray-700 pt-3">
                        {codeOutput.results.map((r: any, i: number) => (
                          <div key={i} className={`text-xs flex items-center gap-2 ${r.passed ? 'text-green-400' : 'text-red-400'}`}>
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
          </div>

          {/* Bottom nav */}
          <div className="bg-white border-t border-gray-200 px-5 py-3 flex items-center justify-between">
            <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
              className="flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <div className="flex items-center gap-2">
              {currentQ.type === 'mcq' && answers[currentQ.id]?.selected_option && (
                <button onClick={() => clearResponse(currentQ.id)}
                  className="flex items-center gap-1.5 border border-gray-200 hover:border-red-300 text-gray-500 hover:text-red-500 px-3 py-2 rounded-lg text-xs transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> Clear Response
                </button>
              )}
            </div>

            {currentIdx < questions.length - 1 ? (
              <button onClick={() => setCurrentIdx(currentIdx + 1)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Send className="w-4 h-4" /> Submit Test
              </button>
            )}
          </div>
        </main>

        {/* Right Sidebar — Question Palette */}
        <aside className="w-64 bg-white border-l border-gray-200 flex flex-col hidden lg:flex">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Question Palette</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((q, i) => {
                const status = getQStatus(q);
                return (
                  <button key={q.id} onClick={() => setCurrentIdx(i)}
                    className={`w-9 h-9 rounded-lg text-xs font-semibold border-2 transition-all ${statusStyle[status]} ${i === currentIdx ? 'ring-2 ring-blue-400 ring-offset-1 scale-110' : 'hover:scale-105'}`}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Legend</p>
            <div className="space-y-2">
              {[
                { color: 'bg-green-500', label: 'Answered', count: answered },
                { color: 'bg-purple-500', label: 'Marked for Review', count: markedCount },
                { color: 'bg-white border-2 border-gray-300', label: 'Not Visited', count: notVisited },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded ${item.color} flex-shrink-0`} />
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 mt-auto">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{answered}<span className="text-gray-400 text-lg">/{questions.length}</span></p>
              <p className="text-xs text-gray-400 mt-0.5">Questions Answered</p>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }} />
              </div>
            </div>
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> Submit Test
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
