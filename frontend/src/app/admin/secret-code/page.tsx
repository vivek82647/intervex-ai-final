"use client";
import { useEffect, useState } from "react";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { portalAPI } from "@/lib/portalAPI";

interface SecretCode {
  id: number;
  code: string;
  is_active: boolean;
  max_uses: number | null;
  used_count: number;
  created_at: string;
}

export default function SecretCodePage() {
  const [codes, setCodes] = useState<SecretCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const data = await portalAPI.getCodes();
      setCodes(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load codes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const generateRandom = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    setNewCode(
      Array.from({ length: 8 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join("")
    );
  };

  const handleCreate = async () => {
    if (!newCode.trim()) return;
    try {
      setCreating(true);
      await portalAPI.createCode({
        code: newCode.trim(),
        max_uses: maxUses ? parseInt(maxUses) : undefined,
      });
      setNewCode("");
      setMaxUses("");
      fetchCodes();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (code: SecretCode) => {
    try {
      await portalAPI.toggleCode(code.id, !code.is_active);
      fetchCodes();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to toggle");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this code?")) return;
    try {
      await portalAPI.deleteCode(id);
      fetchCodes();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const copyToClipboard = (code: string, id: number) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Key className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Secret Codes</h1>
          <p className="text-sm text-muted-foreground">
            Share codes with students so they can register on the Student Portal
          </p>
        </div>
        <button
          onClick={fetchCodes}
          className="ml-auto p-2 rounded-lg hover:bg-accent transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Create new code */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Create New Code
        </h2>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 flex gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="Enter code or generate"
              className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={generateRandom}
              className="px-3 py-2 rounded-lg border text-sm hover:bg-accent transition-colors whitespace-nowrap"
            >
              Generate
            </button>
          </div>
          <input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Max uses (optional)"
            className="w-44 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newCode.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {creating ? "Creating..." : "Create Code"}
          </button>
        </div>
      </div>

      {/* Codes list */}
      <div className="rounded-xl border bg-card">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Loading codes...
          </div>
        ) : codes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No codes yet. Create your first secret code above.
          </div>
        ) : (
          <div className="divide-y">
            {codes.map((code) => (
              <div
                key={code.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-accent/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg tracking-widest">
                      {code.code}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        code.is_active
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {code.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {code.used_count} used
                    {code.max_uses ? ` / ${code.max_uses} max` : " (unlimited)"}
                    {" · "}
                    Created {new Date(code.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(code.code, code.id)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="Copy code"
                  >
                    {copiedId === code.id ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggle(code)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title={code.is_active ? "Deactivate" : "Activate"}
                  >
                    {code.is_active ? (
                      <ToggleRight className="w-5 h-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(code.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
