"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import OTPModal from "@/components/shared/OTPModal";

export default function StudentJoinPage() {
  const router = useRouter();
  const params = useParams();
  const sessionLink = params.link as string;

  const [form, setForm] = useState({
    name: "",
    email: "",
    roll_number: "",
  });
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP state
  const [showOTP, setShowOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

  // Step 1: Validate the session and send an OTP.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Pehle session validate karo (link se session ID lo)
      const sessionRes = await fetch(`${API}/sessions/by-link/${sessionLink}`);
      if (!sessionRes.ok) {
        throw new Error("Invalid test link. Admin se contact karo.");
      }
      const sessionData = await sessionRes.json();
      setSessionId(sessionData.id);

      // Request an OTP.
      const otpRes = await fetch(`${API}/students/request-test-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          roll_number: form.roll_number,
          session_id: sessionData.id,
        }),
      });

      const otpData = await otpRes.json();
      if (!otpRes.ok) throw new Error(otpData.detail || "Unable to send the OTP");

      setOtpEmail(form.email);
      setShowOTP(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the OTP and continue to the instructions page.
  const handleOTPVerify = async (otp: string) => {
    const res = await fetch(`${API}/students/verify-test-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        otp,
        session_id: sessionId,
        name: form.name,
        roll_number: form.roll_number,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "The OTP is incorrect");

    // Save student details for the test session.
    sessionStorage.setItem(
      "student_info",
      JSON.stringify(data.student_info)
    );

    // Continue to the instructions page.
    router.push(`/student/session/${sessionId}/instructions`);
  };

  // OTP resend
  const handleResend = async () => {
    const res = await fetch(`${API}/students/request-test-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        roll_number: form.roll_number,
        session_id: sessionId,
      }),
    });
    if (!res.ok) throw new Error("Resend failed");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">
            INTERVEX <span className="text-indigo-400">AI</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Join Test</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Apni Details Bharo
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Email verify hone ke baad test shuru hoga
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poora Naam *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Apna naam likhein"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="aapka@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              />
              <p className="text-xs text-gray-400 mt-1">
                We will send the OTP to this email address.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roll Number (Optional)
              </label>
              <input
                type="text"
                value={form.roll_number}
                onChange={(e) =>
                  setForm({ ...form, roll_number: e.target.value })
                }
                placeholder="Jaise: 2021CS001"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold
                hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                transition-all shadow-md hover:shadow-lg mt-2"
            >
              {loading ? "Sending OTP..." : "Send OTP and Continue"}
            </button>
          </form>

          <div className="mt-4 bg-indigo-50 rounded-xl p-3">
            <p className="text-xs text-indigo-700 text-center">
              We will send a 6-digit OTP to your email. Verify it before starting the test.
            </p>
          </div>
        </div>
      </div>

      {/* OTP Modal */}
      <OTPModal
        isOpen={showOTP}
        email={otpEmail}
        purpose="test"
        onVerify={handleOTPVerify}
        onResend={handleResend}
        onClose={() => setShowOTP(false)}
      />
    </div>
  );
}
