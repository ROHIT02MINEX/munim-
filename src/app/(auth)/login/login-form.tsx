"use client";

import React, { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const authErrorMessages: Record<string, string> = {
  config_missing:
    "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
  session_not_found: "Session expired or not found. Please log in again.",
  profile_create_failed:
    "Login succeeded but profile creation failed. Run supabase/schema.sql in your Supabase project.",
  password_reset_sent: "Password reset link sent! Check your email inbox.",
};

export default function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirectTo") || "/";
  const authError = searchParams.get("error");
  const authSuccess = searchParams.get("success");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate email
    if (!email || !email.includes("@") || !email.includes(".")) {
      setError("Enter a valid email address.");
      return;
    }

    // Validate password
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (signInError) {
      // Map Supabase error messages to user-friendly ones
      const msg = signInError.message.toLowerCase();
      if (msg.includes("invalid login credentials") || msg.includes("invalid email or password")) {
        setError("Invalid email or password. Please try again.");
      } else if (msg.includes("email not confirmed")) {
        setError("Please confirm your email before logging in. Check your inbox for the confirmation link.");
      } else if (msg.includes("too many requests")) {
        setError("Too many login attempts. Please wait a moment and try again.");
      } else {
        setError(signInError.message);
      }
      return;
    }

    router.push(redirectTo);
    router.refresh();
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
            Munim by Rohit
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            India&apos;s first AI-powered, offline-first digital ledger that works everywhere.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-brand-border bg-brand-card/50 p-6 md:p-8 backdrop-blur-xl glow-indigo">
          {/* Auth error from URL params */}
          {authError && !error && (
            <div className="mb-4 rounded-lg border border-brand-rose/20 bg-brand-rose/10 p-3 text-xs text-brand-rose font-medium">
              {authErrorMessages[authError] ?? "Login failed. Try again."}
            </div>
          )}

          {/* Success message from URL params (e.g. password reset sent) */}
          {authSuccess && !error && (
            <div className="mb-4 rounded-lg border border-brand-emerald/20 bg-brand-emerald/10 p-3 text-xs text-brand-mint font-medium">
              {authErrorMessages[authSuccess] ?? "Success!"}
            </div>
          )}

          {/* Form-level error */}
          {error && (
            <div className="mb-4 rounded-lg border border-brand-rose/20 bg-brand-rose/10 p-3 text-xs text-brand-rose font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Email Address
              </label>
              <div className="relative mt-2">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  id="email"
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

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <div className="relative mt-2">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  required
                  minLength={8}
                  autoComplete="current-password"
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

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-brand-emerald hover:text-brand-mint font-medium"
              >
                Forgot password?
              </Link>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint py-3 text-sm font-semibold text-brand-bg shadow-lg shadow-emerald-500/10 hover:opacity-90 active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-bg/30 border-t-brand-bg"></span>
                  Logging in...
                </span>
              ) : (
                <>
                  Log In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <span className="text-xs text-slate-500">Don&apos;t have an account? </span>
            <Link
              href="/signup"
              className="text-xs text-brand-emerald hover:text-brand-mint font-semibold"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
