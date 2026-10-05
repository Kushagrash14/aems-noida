'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  KeyRound,
  ShieldCheck,
  Mail,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Asset Entry Management System — Sign In';
  }, []);

  // Focus OTP input when transitioning to OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);
    }
  }, [step]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Send OTP to Corporate Email
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid corporate email address.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch verification code');
      }

      setStep('otp');
      setResendCooldown(30);
      setStatusMessage({
        type: 'success',
        text: `Verification code sent to ${cleanEmail}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending verification code';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent, codeOverride?: string) => {
    e?.preventDefault();
    if (loading) return;
    const cleanOtp = (codeOverride ?? otp).trim();

    if (cleanOtp.length < 6) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: cleanOtp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid or expired verification code');
      }

      setStatusMessage({
        type: 'success',
        text: 'Login successful! Redirecting to AEMS...',
      });

      setTimeout(() => {
        window.location.href = '/';
      }, 350);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setStatusMessage({ type: 'error', text: msg });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f8] flex flex-col justify-center items-center px-4 py-8 antialiased font-sans">
      <div className="w-full max-w-[410px]">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.06)] border border-slate-200/90 p-6 sm:p-7">
          {/* PG Electroplast Logo */}
          <div className="flex justify-center mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/pg-logo.png"
              alt="PG Electroplast"
              className="h-16 w-auto object-contain"
            />
          </div>

          <div className="text-center mb-6">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-wide leading-snug">
              A.E.M.S
            </h1>
          </div>

          {/* Status Alerts */}
          {statusMessage && (
            <div
              className={`mb-5 p-3 rounded-xl text-xs flex items-start gap-2.5 font-medium ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-snug">{statusMessage.text}</div>
            </div>
          )}

          {/* STEP 1: Enter Corporate Email */}
          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter corporate email"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>SENDING CODE...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-white" />
                    <span>SEND VERIFICATION CODE</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: Enter 6-Digit OTP */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="truncate mr-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Code sent to
                  </span>
                  <span className="text-xs font-semibold text-slate-900 font-mono truncate block">
                    {email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setStatusMessage(null);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Change</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 text-center">
                  Enter 6-Digit OTP
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setOtp(val);
                      if (val.length === 6 && !loading) {
                        handleVerifyOtp(undefined, val);
                      }
                    }}
                    placeholder="••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-center tracking-[0.5em] font-mono text-xl font-bold focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>VERIFYING CODE...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>VERIFY &amp; SIGN IN</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setStatusMessage(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={() => handleSendOtp()}
                  className="text-xs font-bold text-slate-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
