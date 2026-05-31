"use client";

import { useState, useRef, useEffect } from "react";

interface OTPModalProps {
  isOpen: boolean;
  email: string;
  purpose: "login" | "register" | "test";
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<void>;
  onClose?: () => void;
}

export default function OTPModal({
  isOpen,
  email,
  purpose,
  onVerify,
  onResend,
  onClose,
}: OTPModalProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer for resend
  useEffect(() => {
    if (!isOpen) return;
    setResendTimer(60);
    setCanResend(false);
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Auto-focus first input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      setOtp(["", "", "", "", "", ""]);
      setError("");
    }
  }, [isOpen]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // sirf numbers
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (value && index === 5) {
      const complete = [...newOtp.slice(0, 5), value.slice(-1)];
      if (complete.every((d) => d !== "")) {
        handleSubmit(complete.join(""));
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split("");
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      handleSubmit(pasted);
    }
    e.preventDefault();
  };

  const handleSubmit = async (otpValue?: string) => {
    const finalOtp = otpValue || otp.join("");
    if (finalOtp.length !== 6) {
      setError("6-digit OTP enter karo");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onVerify(finalOtp);
    } catch (err: any) {
      setError(err.message || "OTP galat hai. Dobara try karo.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendTimer(60);
    setOtp(["", "", "", "", "", ""]);
    setError("");
    try {
      await onResend();
      // Timer restart
      const interval = setInterval(() => {
        setResendTimer((t) => {
          if (t <= 1) {
            setCanResend(true);
            clearInterval(interval);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } catch {
      setError("OTP resend nahi ho saka. Dobara try karo.");
    }
  };

  const purposeText = {
    login: "Admin Login",
    register: "Account Verify",
    test: "Test Shuru",
  }[purpose];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">OTP Verify Karo</h2>
          <p className="text-gray-500 mt-2 text-sm">
            {purposeText} ke liye 6-digit OTP bheja gaya hai
          </p>
          <p className="text-indigo-600 font-semibold mt-1 text-sm">{email}</p>
        </div>

        {/* OTP Inputs */}
        <div
          className="flex gap-3 justify-center mb-6"
          onPaste={handlePaste}
        >
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none transition-all
                ${digit ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-300 bg-gray-50"}
                ${error ? "border-red-400 bg-red-50" : ""}
                focus:border-indigo-500 focus:bg-white focus:shadow-md`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm text-center mb-4 bg-red-50 py-2 px-4 rounded-lg">
            ❌ {error}
          </p>
        )}

        {/* Submit Button */}
        <button
          onClick={() => handleSubmit()}
          disabled={loading || otp.join("").length !== 6}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-base
            hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
            transition-all shadow-md hover:shadow-lg"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Verify ho raha hai...
            </span>
          ) : (
            "OTP Verify Karo ✓"
          )}
        </button>

        {/* Resend */}
        <div className="text-center mt-4">
          {canResend ? (
            <button
              onClick={handleResend}
              className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm underline"
            >
              OTP Dobara Bhejo
            </button>
          ) : (
            <p className="text-gray-400 text-sm">
              Resend available in{" "}
              <span className="font-semibold text-gray-600">{resendTimer}s</span>
            </p>
          )}
        </div>

        <p className="text-center text-gray-400 text-xs mt-3">
          ⏰ OTP 10 minutes mein expire ho jaata hai
        </p>
      </div>
    </div>
  );
}
