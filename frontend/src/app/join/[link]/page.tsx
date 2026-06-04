"use client";
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Cookies from "js-cookie";
import { useStudentStore } from "@/store/auth.store";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
type Step = "details" | "otp";

export default function StudentJoinPage() {
  const router = useRouter();
  const params = useParams();
  const sessionLink = params.link as string;
  const { setSession } = useStudentStore();

  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState({ full_name: "", email: "", roll_number: "" });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Get public IP
  const getIP = async (): Promise<string> => {
    try {
      const r = await fetch("https://api.ipify.org?format=json");
      const d = await r.json();
      return d.ip;
    } catch { return "Unknown"; }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email) { setError("Name and email are required"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/student/join/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ join_link: sessionLink, full_name: form.full_name, email: form.email, roll_number: form.roll_number || undefined }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (res.status === 403 && data.detail === "TERMINATED") { router.replace("/student/blocked?reason=terminated"); return; }
      if (res.status === 403 && data.detail === "IP_BLOCKED") { router.replace("/student/blocked?reason=ip"); return; }
      if (!res.ok) throw new Error(data.detail || "Failed to send OTP");
      setStep("otp");
    } catch (err: any) {
      setError(err.name === "TimeoutError" ? "Request timed out." : err.message);
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { setError("Enter 6-digit OTP"); return; }
    setLoading(true); setError("");
    try {
      const ip = await getIP();
      const res = await fetch(`${API}/auth/student/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ join_link: sessionLink, full_name: form.full_name, email: form.email, roll_number: form.roll_number || undefined, otp, ip_address: ip }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (res.status === 403 && data.detail === "TERMINATED") { router.replace("/student/blocked?reason=terminated"); return; }
      if (res.status === 403 && data.detail === "IP_BLOCKED") { router.replace("/student/blocked?reason=ip"); return; }
      if (!res.ok) throw new Error(data.detail || "Failed to join");
      Cookies.set("access_token", data.access_token, { expires: 1 });
      setSession({ studentId: data.student_id, studentName: data.student_name, sessionId: data.session_id, sessionTitle: data.session_title, token: data.access_token });
      router.push(`/student/session/${data.session_id}/instructions`);
    } catch (err: any) {
      setError(err.name === "TimeoutError" ? "Request timed out." : err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">INTERVEX <span className="text-indigo-400">AI</span></h1>
          <p className="text-slate-400 mt-2 text-sm">Join Test</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {step === "details" && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Enter Your Details</h2>
              <p className="text-gray-500 text-sm mb-6">We'll send a verification code to your email</p>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input type="text" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Enter your full name" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number <span className="text-gray-400">(Optional)</span></label>
                  <input type="text" value={form.roll_number} onChange={e => setForm({ ...form, roll_number: e.target.value })} placeholder="e.g. 2021CS001" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900" />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
                <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all mt-2">
                  {loading ? "Please wait..." : "Verify Email →"}
                </button>
              </form>
            </>
          )}
          {step === "otp" && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-2xl">✉️</span></div>
                <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
                <p className="text-gray-500 text-sm mt-1">OTP sent to <span className="font-medium text-gray-800">{form.email}</span></p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Enter 6-digit OTP</label>
                  <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} autoFocus className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 text-center text-2xl font-mono tracking-[0.4em]" />
                  <p className="text-xs text-gray-400 mt-2 text-center">Valid for 10 minutes</p>
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
                <button type="submit" disabled={loading || otp.length !== 6} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                  {loading ? "Verifying..." : "Start Test →"}
                </button>
                <button type="button" onClick={() => { setStep("details"); setOtp(""); setError(""); }} className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">← Change email</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}