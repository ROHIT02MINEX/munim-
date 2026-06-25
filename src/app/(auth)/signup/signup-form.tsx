"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validatePassword = (p: string) => p.length >= 8;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate full name
    if (!fullName || fullName.trim().length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    // Validate email
    if (!email || !validateEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    // Validate password
    if (!password || !validatePassword(password)) {
      setError("Password must be at least 8 characters.");
      return;
    }

    // Validate confirm password
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (signUpError) {
      setIsLoading(false);
      const msg = signUpError.message.toLowerCase();
      if (msg.includes("user already registered") || msg.includes("already registered")) {
        setError("An account with this email already exists. Try logging in instead.");
      } else if (msg.includes("password")) {
        setError("Password is too weak. Use at least 8 characters with a mix of letters and numbers.");
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("Too many signup attempts. Please wait a moment and try again.");
      } else {
        setError(signUpError.message);
      }
      return;
    }

    // If email confirmation is ON (default in Supabase), the user must click
    // the link in the confirmation email before they can log in. If it's OFF
    // (recommended for dev), they have a session immediately and we redirect.
    if (signUpData.session) {
      // Already logged in (email confirmation disabled) → go to dashboard
      router.push("/");
      router.refresh();
      return;
    }

    // Email confirmation required → tell the user to check their inbox
    setIsLoading(false);
    setSuccess("Account created! Please check your email to confirm your account, then log in.");
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
            Create Account
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Get started with Munim — your AI-powered digital ledger.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-brand-border bg-brand-card/50 p-6 md:p-8 backdrop-blur-xl glow-indigo">
          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-brand-rose/20 bg-brand-rose/10 p-3 text-xs text-brand-rose font-medium">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 rounded-lg border border-brand-emerald/20 bg-brand-emerald/10 p-3 text-xs text-brand-mint font-medium">
              {success}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Full Name
              </label>
              <div className="relative mt-2">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Rohit Sharma"
                  disabled={isLoading}
                  required
                  minLength={2}
                  autoComplete="name"
                  className="block w-full rounded-xl border border-brand-border bg-slate-900/60 pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald/30 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Email Address
              </label>
              <div className="relative mt-2">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  id="signup-email"
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
              <label htmlFor="signup-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <div className="relative mt-2">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="signup-password"
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

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Confirm Password
              </label>
              <div className="relative mt-2">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
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

            {/* Signup Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-emerald to-brand-mint py-3 text-sm font-semibold text-brand-bg shadow-lg shadow-emerald-500/10 hover:opacity-90 active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-bg/30 border-t-brand-bg"></span>
                  Creating Account...
                </span>
              ) : (
                <>
                  Create Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <span className="text-xs text-slate-500">Already have an account? </span>
            <Link
              href="/login"
              className="text-xs text-brand-emerald hover:text-brand-mint font-semibold"
            >
              Log In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
