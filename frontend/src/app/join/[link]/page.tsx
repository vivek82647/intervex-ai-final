"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Cookies from "js-cookie";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function StudentJoinPage() {
  const router = useRouter();
  const params = useParams();
  const sessionLink = params.link as string;

  const [form, setForm] = useState({ full_name: "", email: "", roll_number: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email) { setError("Name and email are required"); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/auth/student/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          join_link: sessionLink,
          full_name: form.full_name,
          email: form.email,
          roll_number: form.roll_number || undefined,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to join session");

      Cookies.set("access_token", data.access_token, { expires: 1 });
      sessionStorage.setItem("student_info", JSON.stringify({
        student_id: data.student_id,
        student_name: data.student_name,
        session_id: data.session_id,
        session_title: data.session_title,
        token: data.access_token,
      }));

      router.push(`/student/session/${data.session_id}/instructions`);
    } catch (err: any) {
      setError(err.name === "TimeoutError" ? "Request timed out. Please try again." : err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">
            INTERVEX <span className="text-indigo-400">AI</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Join Test</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Enter Your Details</h2>
          <p className="text-gray-500 text-sm mb-6">Fill in your details to start the test</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input type="text" required value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input type="email" required value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number <span className="text-gray-400">(Optional)</span></label>
              <input type="text" value={form.roll_number}
                onChange={e => setForm({ ...form, roll_number: e.target.value })}
                placeholder="e.g. 2021CS001"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md mt-2">
              {loading ? "Please wait..." : "Start Test →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}