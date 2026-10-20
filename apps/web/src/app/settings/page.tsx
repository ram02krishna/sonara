"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sliders,
  Sparkles,
  Sun,
  Moon,
  Music,
  CheckCircle2,
  LogOut,
  Palette,
  Key,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useLogout } from "@/hooks/useSonara";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme, user, addToast } = useAppStore();
  const logoutMutation = useLogout();
  const [audioQuality, setAudioQuality] = useState<"lossless" | "high" | "normal">("lossless");

  const handleSavePreferences = () => {
    addToast({
      title: "Settings Saved",
      description: "Audio quality and interface preferences updated.",
      type: "success",
    });
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      addToast({ title: "Signed out of Sonara", type: "info" });
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Preferences & Settings</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your Sonara account, taste profile, and high-fidelity audio engine
        </p>
      </div>

      {/* Account Status Card */}
      <div className="glass-card rounded-3xl p-6 border border-foreground/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="w-full h-full rounded-[14px] object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-[14px] bg-background flex items-center justify-center font-bold text-base text-foreground">
                  {user?.display_name ? user.display_name.charAt(0).toUpperCase() : "S"}
                </div>
              )}
            </div>
            <div>
              <p className="font-bold text-foreground text-base">{user?.display_name || "Sonara Listener"}</p>
              <p className="text-xs text-muted-foreground">{user?.email || "listener@sonara.app"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>✦ Studio Master Account</span>
            </span>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-foreground/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-500" />
            <span>Catalogue: Spotify Client Credentials (API Key Mode)</span>
          </div>
          <Link
            href="/onboarding"
            className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline flex items-center gap-1"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Customize Taste Profile (Genres & Languages)</span>
          </Link>
        </div>
      </div>

      {/* Streaming Quality */}
      <div className="glass-card rounded-3xl p-6 border border-foreground/5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-lg font-bold text-foreground">Streaming Audio Quality</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: "lossless", title: "Lossless Studio", desc: "24-bit / 96 kHz • Master quality" },
            { id: "high", title: "Very High", desc: "320 kbps AAC • High fidelity" },
            { id: "normal", title: "Standard", desc: "160 kbps • Bandwidth efficient" },
          ].map((q) => (
            <div
              key={q.id}
              onClick={() => {
                setAudioQuality(q.id as any);
                handleSavePreferences();
              }}
              className={cn(
                "p-4 rounded-2xl border cursor-pointer transition-all",
                audioQuality === q.id
                  ? "bg-foreground/15 border-cyan-400 shadow-md"
                  : "bg-foreground/[0.03] border-foreground/5 hover:bg-foreground/10"
              )}
            >
              <p className="text-sm font-bold text-foreground">{q.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{q.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Appearance & Themes */}
      <div className="glass-card rounded-3xl p-6 border border-foreground/5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h2 className="text-lg font-bold text-foreground">Visual Experience</h2>
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-foreground/[0.03] border border-foreground/5">
          <div>
            <p className="text-sm font-semibold text-foreground">Interface Theme</p>
            <p className="text-xs text-muted-foreground">Toggle between dark glassmorphism and refined light mode</p>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground/10 hover:bg-foreground/20 text-foreground text-xs font-semibold transition-all"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
