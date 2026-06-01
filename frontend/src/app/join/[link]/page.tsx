"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Brain, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { useStudentStore } from "@/store/auth.store";
import Cookies from "js-cookie";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const sessionLink = params.link as string;
  const { studentId, token, setSession } = useStudentStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  // If already logged in, auto-join
  useEffect(() => {
    const storedToken = token || Cookies.get('access_token');
    if (studentId && storedToken) {
      handleJoin(storedToken);
    } else {
      // Fetch session info to show title
      fetchSessionInfo();
    }
  }, []);

  const fetchSessionInfo = async () => {
    try {
      const res = await fetch(`${API}/sessions/join/${sessionLink}`);
      if (res.ok) {
        const data = await res.json();
        setSessionInfo(data);
      }
    } catch {}
  };

  const handleJoin = async (accessToken: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/student/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ join_link: sessionLink }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to join");

      setSession({ sessionId: data.session_id, sessionTitle: data.session_title });
      router.push(`/student/session/${data.session_id}/instructions`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Not logged in — show login/register options
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg">
            <Brain className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-white mb-2">
          {sessionInfo?.title || 'Join Test'}
        </h1>
        <p className="text-white/40 text-sm mb-8">
          {sessionInfo ? `${sessionInfo.duration_minutes} min • Sign in to continue` : 'Sign in to join this test session'}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-white/60">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            Joining session...
          </div>
        ) : (
          <div className="space-y-3">
            <Link
              href={`/student/login?join=${sessionLink}`}
              className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-semibold transition-all"
            >
              <LogIn className="w-4 h-4" />
              Sign In & Join Test
            </Link>
            <Link
              href={`/student/register`}
              className="flex items-center justify-center gap-2 w-full bg-white/10 hover:bg-white/15 border border-white/10 text-white py-3.5 rounded-xl font-semibold transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Create Account First
            </Link>
          </div>
        )}

        <p className="text-white/20 text-xs mt-6">
          You need an account to take this test
        </p>
      </div>
    </div>
  );
}
