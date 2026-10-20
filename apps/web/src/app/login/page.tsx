"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Music,
  Sparkles,
  ShieldCheck,
  Mic2,
  BarChart2,
  ArrowRight,
  User,
  KeyRound,
  Mail,
  Zap,
} from "lucide-react";
import { useLogin, useSignup, useGuestLogin } from "@/hooks/useSonara";
import { useAppStore } from "@/store/useAppStore";

export default function LoginPage() {
  const router = useRouter();
  const { addToast } = useAppStore();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const guestMutation = useGuestLogin();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast({ title: "Please fill in all fields", type: "error" });
      return;
    }
    try {
      await loginMutation.mutateAsync({ email, password });
      addToast({ title: "Welcome back to Sonara", type: "success" });
      router.replace("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in";
      addToast({ title: "Sign in failed", description: msg, type: "error" });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      addToast({ title: "Please fill in all fields", type: "error" });
      return;
    }
    try {
      await signupMutation.mutateAsync({ email, password, display_name: displayName });
      addToast({ title: "Welcome to Sonara", description: "Account created successfully", type: "success" });
      router.replace("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account";
      addToast({ title: "Registration failed", description: msg, type: "error" });
    }
  };

  const handleGuest = async () => {
    try {
      await guestMutation.mutateAsync("Sonara Listener");
      addToast({ title: "Listening as Guest", description: "Enjoy Studio Master sound", type: "success" });
      router.replace("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start guest session";
      addToast({ title: "Guest entry failed", description: msg, type: "error" });
    }
  };

  const isSubmitting = loginMutation.isPending || signupMutation.isPending || guestMutation.isPending;

  return (
    <div className="min-h-full py-12 px-6 max-w-5xl mx-auto flex flex-col justify-center items-center text-center space-y-12">
      {/* Brand Hero */}
      <div className="space-y-4 max-w-2xl">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 via-purple-500 to-cyan-400 p-[2px] shadow-2xl shadow-violet-500/30 mx-auto flex items-center justify-center">
          <div className="w-full h-full bg-black/80 rounded-[22px] flex items-center justify-center">
            <Music className="w-8 h-8 text-cyan-400 animate-pulseGlow" />
          </div>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
          Sound as Pure as{" "}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            the Studio Master.
          </span>
        </h1>

        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
          Sonara blends limitless musical catalog with Apple Music’s breathtaking aesthetics, dynamic album-reactive ambient glassmorphism, and instant time-synced lyrics.
        </p>
      </div>

      {/* Native Auth Card */}
      <div className="glass-card p-8 rounded-3xl border border-foreground/10 max-w-md w-full space-y-6 shadow-2xl backdrop-blur-2xl text-left">
        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-foreground/5 border border-foreground/5 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setTab("signin")}
            className={`py-2 rounded-xl transition-all ${
              tab === "signin"
                ? "bg-foreground/15 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab("signup")}
            className={`py-2 rounded-xl transition-all ${
              tab === "signup"
                ? "bg-foreground/15 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Account
          </button>
        </div>

        {tab === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Email</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Password</label>
              <div className="relative flex items-center">
                <KeyRound className="absolute left-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-violet-900/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
            >
              <span>{isSubmitting ? "Signing in..." : "Enter Sonara"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Display Name</label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Email</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Password</label>
              <div className="relative flex items-center">
                <KeyRound className="absolute left-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold text-sm shadow-xl shadow-emerald-900/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
            >
              <span>{isSubmitting ? "Creating account..." : "Join Sonara"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="relative py-1 flex items-center justify-center">
          <div className="w-full border-t border-foreground/10" />
          <span className="absolute bg-background/90 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            or instant access
          </span>
        </div>

        <button
          type="button"
          onClick={handleGuest}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground text-sm font-semibold hover:border-foreground/20 transition-all"
        >
          <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>Continue as Guest (Instant Listening)</span>
        </button>

        <div className="pt-2 border-t border-foreground/5 flex items-center justify-center gap-2 text-xs text-cyan-600 dark:text-cyan-400">
          <ShieldCheck className="w-4 h-4" />
          <span>Independent Sonara Profile & Personalized Taste</span>
        </div>
      </div>

      {/* Feature Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left pt-6">
        <div className="glass-card p-6 rounded-3xl border border-foreground/5 space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-foreground text-base">Dynamic Album Glow</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Realtime client-side color extraction tints your player, backdrop, and controls to match the album artwork.
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-foreground/5 space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Mic2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-foreground text-base">Time-Synced Lyrics</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            LRCLIB-powered millisecond accurate lyrics scroll automatically alongside every track with vocal line tracking.
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-foreground/5 space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-600 dark:text-fuchsia-400">
            <BarChart2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-foreground text-base">Personal Taste & Analytics</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Local Postgres telemetry tracks listening streaks, genre affinity curves, and personalized recommendations.
          </p>
        </div>
      </div>
    </div>
  );
}
