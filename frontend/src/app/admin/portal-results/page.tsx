"use client";
import { useEffect, useState } from "react";
import { BarChart3, Plus, X, Trophy, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { portalAPI } from "@/lib/portalAPI";

interface Student { id: string; full_name: string; email: string; }
interface Result {
  id: string; student_name: string; student_email: string;
  session_title: string; round_name: string; score: number;
  max_score: number; percentage: number; rank?: number;
  status: string; next_round_eligible: boolean; created_at: string;
}

const emptyForm = {
  student_id: "", session_title: "", session_date: "",
  round_name: "Round 1", score: "", max_score: "100",
  rank: "", status: "pending", next_round_eligible: false,
  next_round_link: "", feedback: "",
};

const statusColors: Record<string, string> = {
  selected: "bg-green-500/10 text-green-600",
  rejected: "bg-destructive/10 text-destructive",
  next_round: "bg-blue-500/10 text-blue-500",
  pending: "bg-muted text-muted-foreground",
};

export default function PortalResultsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchAll = async () => {
    try {
      setLoading(true); setError("");
      const [r, s] = await Promise.all([portalAPI.getAdminResults(), portalAPI.getStudents()]);
      setResults(r); setStudents(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSubmit = async () => {
    if (!form.student_id || !form.score || !form.session_title || !form.session_date) {
      setError("Student, session title, date and score are required"); return;
    }
    try {
      setSubmitting(true); setError("");
      await portalAPI.publishResult({
        student_id: form.student_id,
        session_title: form.session_title,
        session_date: form.session_date,
        round_name: form.round_name,
        score: parseFloat(form.score),
        max_score: parseFloat(form.max_score),
        rank: form.rank ? parseInt(form.rank) : undefined,
        status: form.status,
        next_round_eligible: form.next_round_eligible,
        next_round_link: form.next_round_link || undefined,
        feedback: form.feedback || undefined,
      });
      setForm(emptyForm); setShowForm(false);
      fetchAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to publish");
    } finally { setSubmitting(false); }
  };

  const inp = "w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Publish Results</h1>
          <p className="text-sm text-muted-foreground">Publish scores and round eligibility for students</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={fetchAll} className="p-2 rounded-lg hover:bg-accent transition-colors"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Publish Result
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {showForm && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Result</h2>
            <button onClick={() => { setShowForm(false); setForm(emptyForm); setError(""); }} className="p-1.5 rounded-lg hover:bg-accent transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Student *">
              <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} className={inp}>
                <option value="">Select student</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>)}
              </select>
            </F>
            <F label="Session Title *">
              <input type="text" value={form.session_title} onChange={(e) => setForm({ ...form, session_title: e.target.value })} placeholder="e.g. Intervex Round 1" className={inp} />
            </F>
            <F label="Session Date *">
              <input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} className={inp} />
            </F>
            <F label="Round Name">
              <input type="text" value={form.round_name} onChange={(e) => setForm({ ...form, round_name: e.target.value })} placeholder="Round 1" className={inp} />
            </F>
            <F label="Score *">
              <input type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} placeholder="e.g. 85" className={inp} />
            </F>
            <F label="Max Score">
              <input type="number" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} placeholder="100" className={inp} />
            </F>
            <F label="Rank (optional)">
              <input type="number" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} placeholder="e.g. 3" className={inp} />
            </F>
            <F label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inp}>
                <option value="pending">Pending</option>
                <option value="selected">Selected</option>
                <option value="rejected">Rejected</option>
                <option value="next_round">Next Round</option>
              </select>
            </F>
            <F label="Next Round Link (optional)">
              <input type="text" value={form.next_round_link} onChange={(e) => setForm({ ...form, next_round_link: e.target.value })} placeholder="https://..." className={inp} />
            </F>
            <F label="Eligible for Next Round?">
              <div className="flex items-center gap-3 pt-1.5">
                <button onClick={() => setForm({ ...form, next_round_eligible: !form.next_round_eligible })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${form.next_round_eligible ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                  {form.next_round_eligible ? <><CheckCircle className="w-4 h-4" />Eligible</> : <><XCircle className="w-4 h-4" />Not Eligible</>}
                </button>
              </div>
            </F>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Feedback (optional)</label>
              <textarea value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} rows={3} placeholder="Overall feedback for the student..." className={`${inp} resize-none`} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowForm(false); setForm(emptyForm); }} className="px-4 py-2 rounded-lg border text-sm hover:bg-accent transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {submitting ? "Publishing..." : "Publish Result"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading results...</div>
        ) : results.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No results published yet.</div>
        ) : (
          <div className="divide-y">
            {results.map((r) => (
              <div key={r.id} className="px-5 py-4 hover:bg-accent/30 transition-colors">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{r.student_name}</p>
                      <p className="text-xs text-muted-foreground">{r.session_title} · {r.round_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className="text-center">
                      <p className="font-bold text-lg">{r.percentage}%</p>
                      <p className="text-xs text-muted-foreground">Score</p>
                    </div>
                    {r.rank && <div className="text-center"><p className="font-bold text-lg">#{r.rank}</p><p className="text-xs text-muted-foreground">Rank</p></div>}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[r.status] || statusColors.pending}`}>
                      {r.status.replace("_", " ")}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${r.next_round_eligible ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                      {r.next_round_eligible ? "Eligible ✓" : "Not Eligible"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
