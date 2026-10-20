"use client";

import React, { useState } from "react";
import {
  Settings,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  Moon,
  Laptop,
  Music,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, toggleTheme, mood, setMood, user, addToast } = useAppStore();
  const [audioQuality, setAudioQuality] = useState<"lossless" | "high" | "normal">("lossless");

  const handleSavePreferences = () => {
    addToast({
      title: "Settings Saved",
      description: "Audio quality and interface preferences updated.",
      type: "success",
    });
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Preferences & Settings</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Customize audio resolution, Spotify account link, and visual aesthetic
        </p>
      </div>

      {/* Account Status Card */}
      <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 p-0.5">
              <img
                src={user?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                alt=""
                className="w-full h-full rounded-[14px] object-cover"
              />
            </div>
            <div>
              <p className="font-bold text-white text-base">{user?.display_name || "Audiophile"}</p>
              <p className="text-xs text-muted-foreground">{user?.email || "audiophile@sonara.app"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Spotify Premium Active</span>
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-white/5">
          OAuth 2.0 PKCE token refresh is managed securely via Sonara backend BFF. The browser never accesses Spotify API client secrets directly.
        </p>
      </div>

      {/* Streaming Quality */}
      <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white">Streaming Audio Quality</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: "lossless", title: "Lossless FLAC", desc: "24-bit / 96 kHz • Audiophile grade" },
            { id: "high", title: "Very High", desc: "320 kbps AAC • Crystal clear" },
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
                  ? "bg-white/15 border-cyan-400 shadow-md"
                  : "bg-white/[0.03] border-white/5 hover:bg-white/10"
              )}
            >
              <p className="text-sm font-bold text-white">{q.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{q.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Appearance & Themes */}
      <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-bold text-white">Visual Experience</h2>
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
          <div>
            <p className="text-sm font-semibold text-white">Interface Theme</p>
            <p className="text-xs text-muted-foreground">Toggle between dark glassmorphism and refined light mode</p>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
