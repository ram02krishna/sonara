"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Loader2, ListMusic, Mic2, Music, Sparkles } from "lucide-react";
import { friendlyError, useGuestLogin, useLogin, useSignup } from "@/hooks/useSonara";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const field =
  "w-full px-4 py-3 rounded-xl bg-foreground/5 border border-foreground/10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

const FEATURES = [
  { icon: Sparkles, title: "Made around your taste", text: "Pick the languages and genres you love. Your home is built from them." },
  { icon: ListMusic, title: "Playlists, likes and follows", text: "Save songs, build playlists and follow your favourite artists." },
  { icon: Mic2, title: "Synced lyrics", text: "Sing along with lyrics that follow the song line by line." },
  { icon: Headphones, title: "Your listening insights", text: "See your top songs, artists and listening streaks." },
];

export default function LoginPage() {
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const login = useLogin();
  const signup = useSignup();
  const guest = useGuestLogin();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const busy = login.isPending || signup.isPending || guest.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanName = name.trim();

    if (!cleanEmail) {
      addToast({ title: "Email required", description: "Please enter your email address.", type: "error" });
      return;
    }

    try {
      if (mode === "login") {
        await login.mutateAsync({ email: cleanEmail, password });
        router.push("/");
      } else {
        await signup.mutateAsync({ email: cleanEmail, password, display_name: cleanName });
        router.push("/onboarding");
      }
    } catch (err) {
      addToast({
        title: mode === "login" ? "Couldn't sign you in" : "Couldn't create your account",
        description: friendlyError(err).detail,
        type: "error",
      });
    }
  };

  const asGuest = async () => {
    try {
      await guest.mutateAsync({ display_name: name.trim() || undefined });
      router.push("/onboarding");
    } catch (err) {
      addToast({ title: "Couldn't start a guest session", description: friendlyError(err).detail, type: "error" });
    }
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full bg-brand opacity-20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center shadow-brand"><Music className="w-6 h-6" /></span>
          <span className="text-2xl font-extrabold tracking-tight">Sonara</span>
        </div>
        <div className="relative max-w-lg space-y-8">
          <h1 className="text-5xl font-extrabold tracking-tight leading-[1.05]">
            Music for <span className="text-gradient-brand">every taste</span>, in every language.
          </h1>
          <ul className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-primary" /></span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Sonara is an independent project. Music metadata and previews come from public catalogues.</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center"><Music className="w-5 h-5" /></span>
            <span className="text-xl font-extrabold">Sonara</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="text-sm text-muted-foreground mt-1">{mode === "login" ? "Sign in to pick up where you left off." : "It takes a few seconds."}</p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && <input className={field} placeholder="Your name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
            <input className={field} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input className={field} type="password" required minLength={mode === "signup" ? 8 : 1} placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-brand font-semibold text-sm shadow-brand hover:opacity-95 disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {(login.isPending || signup.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            {mode === "login" ? "New to Sonara? " : "Already have an account? "}
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="font-semibold text-foreground hover:underline">
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex-1 h-px bg-foreground/10" />or<span className="flex-1 h-px bg-foreground/10" /></div>

          <button onClick={asGuest} disabled={busy} className={cn("w-full py-3 rounded-xl glass-pill text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50")}>
            {guest.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Continue as guest
          </button>
          <p className="text-xs text-muted-foreground text-center">Guest profiles keep their own playlists and taste on this device. You can add an email later in Settings to keep them.</p>
        </div>
      </section>
    </main>
  );
}
