"use client";
import { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  MessageSquare,
} from "lucide-react";
import { portalAPI } from "@/lib/portalAPI";

interface Assignment {
  id: number;
  title: string;
  description: string;
  deadline?: string;
  created_at: string;
  submission_count?: number;
}

interface Submission {
  id: number;
  student_name: string;
  student_email: string;
  submitted_at: string;
  feedback?: string;
  file_data?: string;
  file_type?: string;
}

const emptyForm = { title: "", description: "", deadline: "" };

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<Record<number, Submission[]>>({});
  const [loadingSubs, setLoadingSubs] = useState<number | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<number, string>>({});
  const [savingFeedback, setSavingFeedback] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const data = await portalAPI.getAdminAssignments();
      setAssignments(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    try {
      setSubmitting(true);
      await portalAPI.createAssignment({
        title: form.title,
        description: form.description,
        deadline: form.deadline || undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      setError("");
      fetchAssignments();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!submissions[id]) {
      try {
        setLoadingSubs(id);
        const data = await portalAPI.getSubmissions(id);
        setSubmissions((prev) => ({ ...prev, [id]: data }));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load submissions");
      } finally {
        setLoadingSubs(null);
      }
    }
  };

  const handleSaveFeedback = async (submissionId: number) => {
    const feedback = feedbackMap[submissionId];
    if (!feedback?.trim()) return;
    try {
      setSavingFeedback(submissionId);
      await portalAPI.giveFeedback(submissionId, feedback);
      // Refresh submissions for expanded assignment
      if (expandedId) {
        const data = await portalAPI.getSubmissions(expandedId);
        setSubmissions((prev) => ({ ...prev, [expandedId]: data }));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save feedback");
    } finally {
      setSavingFeedback(null);
    }
  };

  const downloadFile = (fileData: string, fileType: string, name: string) => {
    const link = document.createElement("a");
    link.href = `data:${fileType};base64,${fileData}`;
    link.download = name;
    link.click();
  };

  const inputCls =
    "w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Create assignments and review student submissions
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={fetchAssignments}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Assignment
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Assignment</h2>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Assignment title"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Assignment instructions..."
                rows={4}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Deadline (optional)
              </label>
              <input
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
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
              onClick={handleCreate}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Assignment"}
            </button>
          </div>
        </div>
      )}

      {/* Assignments list */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm border rounded-xl bg-card">
            Loading assignments...
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm border rounded-xl bg-card">
            No assignments yet. Create your first one!
          </div>
        ) : (
          assignments.map((a) => (
            <div key={a.id} className="rounded-xl border bg-card overflow-hidden">
              {/* Assignment header */}
              <button
                onClick={() => toggleExpand(a.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-accent/30 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {a.description || "No description"}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      Created {new Date(a.created_at).toLocaleDateString()}
                    </span>
                    {a.deadline && (
                      <span className="text-xs text-amber-500">
                        Due {new Date(a.deadline).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {a.submission_count ?? 0} submissions
                  </span>
                  {expandedId === a.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Submissions */}
              {expandedId === a.id && (
                <div className="border-t">
                  {loadingSubs === a.id ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Loading submissions...
                    </div>
                  ) : (submissions[a.id] ?? []).length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No submissions yet.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {(submissions[a.id] ?? []).map((sub) => (
                        <div key={sub.id} className="p-5 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm">
                                {sub.student_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sub.student_email} ·{" "}
                                {new Date(sub.submitted_at).toLocaleString()}
                              </p>
                            </div>
                            {sub.file_data && (
                              <button
                                onClick={() =>
                                  downloadFile(
                                    sub.file_data!,
                                    sub.file_type || "application/octet-stream",
                                    `${sub.student_name}-submission`
                                  )
                                }
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs hover:bg-accent transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </button>
                            )}
                          </div>

                          {/* Feedback */}
                          <div className="space-y-2">
                            {sub.feedback && (
                              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                <p className="text-xs font-medium text-primary mb-1">
                                  Your Feedback
                                </p>
                                <p className="text-sm">{sub.feedback}</p>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={feedbackMap[sub.id] ?? ""}
                                onChange={(e) =>
                                  setFeedbackMap((prev) => ({
                                    ...prev,
                                    [sub.id]: e.target.value,
                                  }))
                                }
                                placeholder={
                                  sub.feedback
                                    ? "Update feedback..."
                                    : "Write feedback..."
                                }
                                className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <button
                                onClick={() => handleSaveFeedback(sub.id)}
                                disabled={
                                  savingFeedback === sub.id ||
                                  !feedbackMap[sub.id]?.trim()
                                }
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                {savingFeedback === sub.id ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
