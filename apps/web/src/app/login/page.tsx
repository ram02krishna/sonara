"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Disc3, ArrowRight, User, KeyRound, Mail, Play } from "lucide-react";
import { useLogin, useSignup, useGuestLogin } from "@/hooks/useSonara";
import { useAppStore } from "@/store/useAppStore";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useAppStore();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "signup" || requestedTab === "signin") {
      setTab(requestedTab);
    }
  }, [searchParams]);

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
      addToast({ title: "Welcome back", type: "success" });
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
      addToast({ title: "Listening as Guest", type: "success" });
      router.replace("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start guest session";
      addToast({ title: "Guest entry failed", description: msg, type: "error" });
    }
  };

  const isSubmitting = loginMutation.isPending || signupMutation.isPending || guestMutation.isPending;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
            <Disc3 className="w-6 h-6 animate-[spin_8s_linear_infinite]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {tab === "signin" ? "Log in to Sonara" : "Create your account"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {tab === "signin" ? "Welcome back! Enter your details to continue." : "Start listening with lossless audio and live lyrics."}
          </p>
        </div>

        {/* Auth Card */}
        <div className="p-6 rounded-2xl glass-card border border-foreground/10 space-y-5 shadow-xl">
          {/* Simple Tab Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-foreground/5 border border-foreground/5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTab("signin")}
              className={`py-2 rounded-lg transition-all ${
                tab === "signin"
                  ? "bg-foreground/15 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`py-2 rounded-lg transition-all ${
                tab === "signup"
                  ? "bg-foreground/15 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          {tab === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Email</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Password</label>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-3 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                <span>{isSubmitting ? "Logging in..." : "Log In"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Name</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Email</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Password</label>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-3 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-foreground/5 border border-foreground/10 text-foreground text-sm focus:outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                <span>{isSubmitting ? "Creating..." : "Create Account"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="relative py-1 flex items-center justify-center">
            <div className="w-full border-t border-foreground/10" />
            <span className="absolute bg-card px-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              or
            </span>
          </div>

          <button
            type="button"
            onClick={handleGuest}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground text-xs font-semibold transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current text-primary" />
            <span>Continue as Guest</span>
          </button>
        </div>

        <p className="text-[11px] text-center text-muted-foreground">
          Sonara Music Streaming • Privacy First
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
