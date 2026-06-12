"use client";
import { useEffect, useState } from "react";
import { Users, Search, ShieldOff, ShieldCheck, RefreshCw, Mail, Calendar } from "lucide-react";
import { portalAPI } from "@/lib/portalAPI";

interface Student {
  id: string; full_name: string; email: string;
  batch?: string; college?: string; is_active: boolean; created_at: string;
}

export default function PortalStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      setLoading(true); setError("");
      const data = await portalAPI.getStudents();
      setStudents(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load students");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleToggleBlock = async (student: Student) => {
    try {
      setTogglingId(student.id);
      await portalAPI.toggleBlock(student.id, !student.is_active);
      fetchStudents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally { setTogglingId(null); }
  };

  const filtered = students.filter(
    (s) => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Portal Students</h1>
          <p className="text-sm text-muted-foreground">Students registered via your secret codes</p>
        </div>
        <button onClick={fetchStudents} className="ml-auto p-2 rounded-lg hover:bg-accent transition-colors"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: students.length, color: "text-primary" },
          { label: "Active", value: students.filter(s => s.is_active).length, color: "text-green-500" },
          { label: "Blocked", value: students.filter(s => !s.is_active).length, color: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading students...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">{search ? "No students match." : "No students registered yet."}</div>
        ) : (
          <div className="divide-y">
            {filtered.map((student) => (
              <div key={student.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-accent/30 transition-colors ${!student.is_active ? "opacity-60" : ""}`}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{student.full_name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{student.full_name}</p>
                    {!student.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Blocked</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{student.email}</span>
                    {student.batch && <span className="text-xs text-muted-foreground">{student.batch}</span>}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="w-3 h-3" />{new Date(student.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleBlock(student)} disabled={togglingId === student.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${!student.is_active ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}
                >
                  {!student.is_active ? <><ShieldCheck className="w-3.5 h-3.5" />Unblock</> : <><ShieldOff className="w-3.5 h-3.5" />Block</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
