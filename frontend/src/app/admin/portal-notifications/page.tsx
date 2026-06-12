"use client";
import { useEffect, useState } from "react";
import { Bell, Send, Users, User, RefreshCw } from "lucide-react";
import { portalAPI } from "@/lib/portalAPI";

interface Student {
  id: number;
  name: string;
  email: string;
}

type Target = "all" | "specific";

export default function PortalNotificationsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Target>("all");
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await portalAPI.getStudents();
        setStudents(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load students");
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      setError("Title and message are required");
      return;
    }
    if (target === "specific" && !studentId) {
      setError("Please select a student");
      return;
    }
    try {
      setSending(true);
      setError("");
      setSuccess("");
      await portalAPI.sendNotification({
        title: title.trim(),
        message: message.trim(),
        student_id: target === "specific" ? studentId : undefined,
      });
      setSuccess(
        target === "all"
          ? `Notification sent to all ${students.length} students!`
          : `Notification sent to ${
              students.find((s) => s.id === parseInt(studentId))?.name
            }!`
      );
      setTitle("");
      setMessage("");
      setStudentId("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Send Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Notify all students or a specific student
          </p>
        </div>
        {loading && (
          <RefreshCw className="ml-auto w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium">
          ✓ {success}
        </div>
      )}

      {/* Compose */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        {/* Target selector */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Send To
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTarget("all");
                setStudentId("");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                target === "all"
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-accent"
              }`}
            >
              <Users className="w-4 h-4" />
              All Students ({students.length})
            </button>
            <button
              onClick={() => setTarget("specific")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                target === "specific"
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-accent"
              }`}
            >
              <User className="w-4 h-4" />
              Specific Student
            </button>
          </div>
        </div>

        {/* Student picker */}
        {target === "specific" && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Select Student
            </label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={inputCls}
            >
              <option value="">Choose a student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Notification Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Round 2 Results Announced"
            className={inputCls}
          />
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Message *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your notification message here..."
            rows={5}
            className={`${inputCls} resize-none`}
          />
          <p className="text-xs text-muted-foreground text-right">
            {message.length} characters
          </p>
        </div>

        {/* Preview */}
        {(title || message) && (
          <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">
              Preview
            </p>
            <p className="font-semibold text-sm">{title || "—"}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {message || "—"}
            </p>
          </div>
        )}

        {/* Send button */}
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending
              ? "Sending..."
              : target === "all"
              ? `Send to All (${students.length})`
              : "Send to Student"}
          </button>
        </div>
      </div>

      {/* Quick tips */}
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Tips
        </p>
        <ul className="space-y-1">
          {[
            "Use 'All Students' for announcements like results, schedule changes",
            "Use 'Specific Student' for individual feedback or selections",
            "Keep titles short and clear — students see them first",
          ].map((tip) => (
            <li key={tip} className="text-xs text-muted-foreground flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
