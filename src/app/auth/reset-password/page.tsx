"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // We may receive error from Supabase via URL hash fragment after redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error")) {
      try {
        const params = new URLSearchParams(hash.replace("#", "?"));
        const errorDescription = params.get("error_description");
        if (errorDescription) {
          setError(decodeURIComponent(errorDescription));
        }
      } catch {
        // ignore URL parse errors
      }
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setIsLoading(false);

    if (updateError) {
      const msg = updateError.message.toLowerCase();
      if (msg.includes("same as old")) {
        setError("New password must be different from your current password.");
      } else if (msg.includes("too weak") || msg.includes("too short")) {
        setError("Password is too weak. Use at least 8 characters with a mix of letters and numbers.");
      } else {
        setError(updateError.message);
      }
      return;
    }

    setSuccess(true);
  };

  if (success) {
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
              Password Updated!
            </h1>
            <p className="mt-2 text-sm text-slate-400 max-w-sm">
              Your password has been changed successfully. You can now log in with your new password.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-brand-border bg-brand-card/50 p-6 md:p-8 backdrop-blur-xl glow-indigo">
            <div className="rounded-lg border border-brand-emerald/20 bg-brand-emerald/10 p-4 text-xs text-brand-mint font-medium text-center">
              Your password was reset successfully. Redirecting to login...
            </div>
            <div className="mt-6">
              <button
                onClick={() => router.push("/login")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint py-3 text-sm font-semibold text-brand-bg shadow-lg shadow-emerald-500/10 hover:opacity-90 active:scale-98"
              >
                Go to Login
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            Set New Password
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Enter your new password below.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-brand-border bg-brand-card/50 p-6 md:p-8 backdrop-blur-xl glow-indigo">
          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-brand-rose/20 bg-brand-rose/10 p-3 text-xs text-brand-rose font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* New Password */}
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                New Password
              </label>
              <div className="relative mt-2">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  disabled={isLoading}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="block w-full rounded-xl border border-brand-border bg-slate-900/60 pl-11 pr-11 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald/30 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirm-new-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Confirm New Password
              </label>
              <div className="relative mt-2">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirm-new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  disabled={isLoading}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="block w-full rounded-xl border border-brand-border bg-slate-900/60 pl-11 pr-11 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald/30 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Update Password Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint py-3 text-sm font-semibold text-brand-bg shadow-lg shadow-emerald-500/10 hover:opacity-90 active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-bg/30 border-t-brand-bg"></span>
                  Updating...
                </span>
              ) : (
                <>
                  Update Password
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
