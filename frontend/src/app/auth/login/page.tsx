"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OTPModal from "@/components/shared/OTPModal";
import { useAuthStore } from "@/store/auth.store";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP state
  const [showOTP, setShowOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

  // Step 1: Validate the password and send an OTP.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");

      // Show the OTP modal after the email has been sent.
      setOtpEmail(form.email);
      setShowOTP(true);
    } catch (err: any) {
      setError(
        err.name === "TimeoutError"
          ? "Login timed out while sending OTP. Please try again."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the OTP and store the JWT tokens.
  const handleOTPVerify = async (otp: string) => {
    const res = await fetch(`${API}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: otpEmail, otp, purpose: "login" }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "The OTP is incorrect");

    // Save the authenticated session.
    setTokens(data.access_token, data.refresh_token);
    setUser(data.user);

    // Redirect to the dashboard.
    router.push("/admin/dashboard");
  };

  // OTP resend
  const handleResend = async () => {
    const res = await fetch(`${API}/auth/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: otpEmail, purpose: "login" }),
    });
    if (!res.ok) throw new Error("Resend failed");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">
            INTERVEX <span className="text-indigo-400">AI</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Admin Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Admin Login</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@intervex.ai"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="********"
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
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            We will send an OTP to your email after you sign in.
          </p>
        </div>
      </div>

      {/* OTP Modal */}
      <OTPModal
        isOpen={showOTP}
        email={otpEmail}
        purpose="login"
        onVerify={handleOTPVerify}
        onResend={handleResend}
        onClose={() => setShowOTP(false)}
      />
    </div>
  );
}
