"use client";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Plus,
  X,
  Trophy,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { portalAPI } from "@/lib/portalAPI";

interface Student {
  id: number;
  name: string;
  email: string;
}

interface Result {
  id: number;
  student_name: string;
  student_email: string;
  score: number;
  rank?: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  eligible_next_round: boolean;
  next_round_session_link?: string;
  published_at: string;
}

const emptyForm = {
  student_id: "",
  score: "",
  rank: "",
  total_questions: "",
  correct_answers: "",
  wrong_answers: "",
  eligible_next_round: false,
  next_round_session_link: "",
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
      setLoading(true);
      const [r, s] = await Promise.all([
        portalAPI.getAdminResults(),
        portalAPI.getStudents(),
      ]);
      setResults(r);
      setStudents(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSubmit = async () => {
    if (!form.student_id || !form.score) {
      setError("Student and score are required");
      return;
    }
    try {
      setSubmitting(true);
      await portalAPI.publishResult({
        student_id: parseInt(form.student_id),
        score: parseFloat(form.score),
        rank: form.rank ? parseInt(form.rank) : undefined,
        total_questions: form.total_questions
          ? parseInt(form.total_questions)
          : undefined,
        correct_answers: form.correct_answers
          ? parseInt(form.correct_answers)
          : undefined,
        wrong_answers: form.wrong_answers
          ? parseInt(form.wrong_answers)
          : undefined,
        eligible_next_round: form.eligible_next_round,
        next_round_session_link: form.next_round_session_link || undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      setError("");
      fetchAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setSubmitting(false);
    }
  };

  const Field = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );

  const inputCls =
    "w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Publish Results</h1>
          <p className="text-sm text-muted-foreground">
            Publish scores and round eligibility for students
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={fetchAll}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Publish Result
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Publish form */}
      {showForm && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Result</h2>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
                setError("");
              }}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Student *">
              <select
                value={form.student_id}
                onChange={(e) =>
                  setForm({ ...form, student_id: e.target.value })
                }
                className={inputCls}
              >
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Score (%) *">
              <input
                type="number"
                min="0"
                max="100"
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                placeholder="e.g. 85.5"
                className={inputCls}
              />
            </Field>

            <Field label="Rank">
              <input
                type="number"
                value={form.rank}
                onChange={(e) => setForm({ ...form, rank: e.target.value })}
                placeholder="e.g. 3"
                className={inputCls}
              />
            </Field>

            <Field label="Total Questions">
              <input
                type="number"
                value={form.total_questions}
                onChange={(e) =>
                  setForm({ ...form, total_questions: e.target.value })
                }
                placeholder="e.g. 30"
                className={inputCls}
              />
            </Field>

            <Field label="Correct Answers">
              <input
                type="number"
                value={form.correct_answers}
                onChange={(e) =>
                  setForm({ ...form, correct_answers: e.target.value })
                }
                placeholder="e.g. 24"
                className={inputCls}
              />
            </Field>

            <Field label="Wrong Answers">
              <input
                type="number"
                value={form.wrong_answers}
                onChange={(e) =>
                  setForm({ ...form, wrong_answers: e.target.value })
                }
                placeholder="e.g. 6"
                className={inputCls}
              />
            </Field>

            <Field label="Next Round Session Link">
              <input
                type="text"
                value={form.next_round_session_link}
                onChange={(e) =>
                  setForm({
                    ...form,
                    next_round_session_link: e.target.value,
                  })
                }
                placeholder="https://..."
                className={inputCls}
              />
            </Field>

            <Field label="Eligible for Next Round?">
              <div className="flex items-center gap-3 pt-1.5">
                <button
                  onClick={() =>
                    setForm({
                      ...form,
                      eligible_next_round: !form.eligible_next_round,
                    })
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.eligible_next_round
                      ? "bg-green-500/10 text-green-600"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {form.eligible_next_round ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> Eligible
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" /> Not Eligible
                    </>
                  )}
                </button>
                <span className="text-xs text-muted-foreground">
                  Click to toggle
                </span>
              </div>
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              className="px-4 py-2 rounded-lg border text-sm hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Publishing..." : "Publish Result"}
            </button>
          </div>
        </div>
      )}

      {/* Results list */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Loading results...
          </div>
        ) : results.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No results published yet.
          </div>
        ) : (
          <div className="divide-y">
            {results.map((r) => (
              <div key={r.id} className="px-5 py-4 hover:bg-accent/30 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{r.student_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.student_email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-lg">{r.score}%</p>
                      <p className="text-xs text-muted-foreground">Score</p>
                    </div>
                    {r.rank && (
                      <div className="text-center">
                        <p className="font-bold text-lg">#{r.rank}</p>
                        <p className="text-xs text-muted-foreground">Rank</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="font-bold text-lg text-green-500">
                        {r.correct_answers ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">Correct</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg text-destructive">
                        {r.wrong_answers ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">Wrong</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        r.eligible_next_round
                          ? "bg-green-500/10 text-green-600"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {r.eligible_next_round ? "Eligible ✓" : "Not Eligible"}
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
