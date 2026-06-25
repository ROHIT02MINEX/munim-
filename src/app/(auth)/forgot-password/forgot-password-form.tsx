"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !validateEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setIsLoading(false);

    if (resetError) {
      const msg = resetError.message.toLowerCase();
      if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("Too many requests. Please wait a moment and try again.");
      } else {
        setError(resetError.message);
      }
      return;
    }

    setSuccess(true);
  };

  return (
    <div className="relative flex min-screen flex-1 flex-col items-center justify-center bg-brand-bg px-4 py-12 md:py-24 overflow-hidden min-h-screen">
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-brand-emerald/10 blur-[100px] animate-pulse-slow"></div>
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-72 w-72 rounded-full bg-brand-indigo/10 blur-[100px] animate-pulse-slow"></div>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-brand-emerald to-brand-mint p-[3px] shadow-[0_0_20px_rgba(52,211,153,0.25)] mb-6 animate-float">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#090d16]">
              <span className="font-display text-3xl font-extrabold text-brand-mint">M</span>
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Forgot Password
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            {success
              ? "Check your email for the password reset link."
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-brand-border bg-brand-card/50 p-6 md:p-8 backdrop-blur-xl glow-indigo">
          {/* Success state */}
          {success ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-brand-emerald/20 bg-brand-emerald/10 p-4 text-xs text-brand-mint font-medium">
                Password reset link sent to <span className="font-bold">{email}</span>.
                Please check your inbox and follow the link.
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint py-3 text-sm font-semibold text-brand-bg shadow-lg shadow-emerald-500/10 hover:opacity-90 active:scale-98"
                >
                  Back to Login
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              {/* Error */}
              {error && (
                <div className="mb-4 rounded-lg border border-brand-rose/20 bg-brand-rose/10 p-3 text-xs text-brand-rose font-medium">
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="reset-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Email Address
                </label>
                <div className="relative mt-2">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    id="reset-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@business.com"
                    disabled={isLoading}
                    required
                    autoComplete="email"
                    className="block w-full rounded-xl border border-brand-border bg-slate-900/60 pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald/30 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Send Reset Link Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint py-3 text-sm font-semibold text-brand-bg shadow-lg shadow-emerald-500/10 hover:opacity-90 active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-bg/30 border-t-brand-bg"></span>
                    Sending...
                  </span>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Back to Login */}
              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-mint font-medium"
                >
                  <ArrowLeft size={12} />
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
