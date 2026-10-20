"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sliders,
  Sun,
  Moon,
  Music2,
  CheckCircle2,
  LogOut,
  Palette,
  ShieldCheck,
  Radio,
  Layers,
  Trash2,
  Cpu,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useLogout } from "@/hooks/useSonara";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

type SettingsTab = "audio" | "appearance" | "account";

export default function SettingsPage() {
  const router = useRouter();
  const {
    theme,
    toggleTheme,
    user,
    isAuthenticated,
    addToast,
    audioQuality,
    setAudioQuality,
    normalizeAudio,
    setNormalizeAudio,
    crossfadeSeconds,
    setCrossfadeSeconds,
  } = useAppStore();
  const logoutMutation = useLogout();
  const [activeTab, setActiveTab] = useState<SettingsTab>("audio");
  const [isSaving, setIsSaving] = useState(false);

  const handleQualityChange = async (quality: "lossless" | "high" | "normal") => {
    setAudioQuality(quality);
    if (isAuthenticated) {
      setIsSaving(true);
      try {
        await apiFetch("/me/preferences", {
          method: "PUT",
          body: JSON.stringify({ audio_quality: quality }),
        });
        addToast({
          title: "Audio Quality Updated",
          description:
            quality === "lossless"
              ? "Lossless Studio (24-bit / 96 kHz Master FLAC) activated."
              : quality === "high"
              ? "High Fidelity (320 kbps) activated."
              : "Standard AAC (160 kbps) bandwidth-efficient mode active.",
          type: "success",
        });
      } catch {
        addToast({
          title: "Saved Locally",
          description: "Quality preference updated in current session.",
          type: "info",
        });
      } finally {
        setIsSaving(false);
      }
    } else {
      addToast({
        title: "Quality Preference Updated",
        description: `Set to ${quality === "lossless" ? "Lossless Master" : quality === "high" ? "High-Fi 320k" : "Standard AAC"}.`,
        type: "success",
      });
    }
  };

  const handleNormalizeToggle = async () => {
    const next = !normalizeAudio;
    setNormalizeAudio(next);
    if (isAuthenticated) {
      try {
        await apiFetch("/me/preferences", {
          method: "PUT",
          body: JSON.stringify({ normalize_audio: next }),
        });
      } catch {
        // ignore
      }
    }
    addToast({
      title: next ? "Audio Normalization Enabled" : "Audio Normalization Disabled",
      description: next
        ? "Volumes balanced dynamically across all studio masters."
        : "Raw track dynamic range preserved without adjustment.",
      type: "info",
    });
  };

  const handleClearCache = () => {
    if (typeof window !== "undefined") {
      try {
        // Clear cached search or album items while keeping tokens
        const keys = Object.keys(localStorage).filter(
          (k) => k.startsWith("sonara-cache") || k.startsWith("react-query")
        );
        keys.forEach((k) => localStorage.removeItem(k));
      } catch {
        // ignore
      }
    }
    addToast({
      title: "Audio & Artwork Cache Cleared",
      description: "Freed local storage cache. All assets will reload cleanly.",
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
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
            <span>Preferences & Settings</span>
            {isSaving && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 font-normal">
                Syncing...
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure lossless streaming quality, user taste profiles, and aesthetic visual preferences.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-panel self-start sm:self-auto">
          {[
            { id: "audio", label: "Audio & Streaming", icon: Sliders },
            { id: "appearance", label: "Appearance", icon: Palette },
            { id: "account", label: "Account & Cloud", icon: ShieldCheck },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as SettingsTab)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all",
                  active
                    ? "bg-foreground text-background shadow-md font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Audio & Streaming */}
      {activeTab === "audio" && (
        <div className="space-y-6">
          {/* Quality Selector */}
          <div className="glass-card rounded-3xl p-6 md:p-8 space-y-5 border border-foreground/5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Radio className="w-5 h-5 text-cyan-500" />
                  <span>Streaming Audio Quality</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select your desired audio bitrate. Sonara dynamically configures playback resolution in real time.
                </p>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Engine Active</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: "lossless",
                  title: "Lossless Studio",
                  badge: "24-bit / 96 kHz",
                  desc: "Studio master fidelity with pristine acoustic separation and FLAC uncompressed depth.",
                  tone: "border-cyan-400/50 bg-cyan-500/10 shadow-cyan-500/10",
                },
                {
                  id: "high",
                  title: "High Fidelity",
                  badge: "320 kbps",
                  desc: "High bit-rate streaming with rich harmonics, ideal for audiophile headphones.",
                  tone: "border-blue-400/50 bg-blue-500/10 shadow-blue-500/10",
                },
                {
                  id: "normal",
                  title: "Standard Audio",
                  badge: "160 kbps",
                  desc: "Efficient AAC compression designed for lower cellular bandwidth consumption.",
                  tone: "border-slate-400/50 bg-slate-500/10 shadow-slate-500/10",
                },
              ].map((q) => {
                const isSelected = audioQuality === q.id;
                return (
                  <div
                    key={q.id}
                    onClick={() => handleQualityChange(q.id as any)}
                    className={cn(
                      "relative p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between group",
                      isSelected
                        ? cn("shadow-xl", q.tone)
                        : "bg-foreground/[0.03] border-foreground/5 hover:bg-foreground/[0.06] hover:border-foreground/20"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-foreground/10 text-foreground">
                          {q.badge}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <h3 className="text-base font-bold text-foreground">{q.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{q.desc}</p>
                    </div>

                    <div className="pt-4 mt-2 border-t border-foreground/5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>{isSelected ? "Currently Active" : "Click to Activate"}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 group-hover:bg-cyan-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audio Processing Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Volume Normalization */}
            <div className="glass-card rounded-3xl p-6 space-y-3 border border-foreground/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Audio Normalization</h3>
                  </div>
                  <button
                    onClick={handleNormalizeToggle}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative p-0.5",
                      normalizeAudio ? "bg-cyan-500" : "bg-foreground/20"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full bg-white shadow-md transition-transform",
                        normalizeAudio ? "translate-x-6" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Automatically balances loudness between different studio masters and tracks to prevent sudden volume spikes.
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground font-semibold">
                Status: {normalizeAudio ? "Enabled" : "Bypassed"}
              </span>
            </div>

            {/* Seamless DJ Crossfade */}
            <div className="glass-card rounded-3xl p-6 space-y-3 border border-foreground/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-500" />
                    <h3 className="text-sm font-bold text-foreground">Song Crossfade</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    {crossfadeSeconds === 0 ? "Off" : `${crossfadeSeconds}s`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Smoothly blends the ending of a song into the next track for non-stop, gapless audio playback.
                </p>
              </div>

              <div className="pt-2">
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="2"
                  value={crossfadeSeconds}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setCrossfadeSeconds(val);
                  }}
                  className="w-full h-1.5 bg-foreground/20 rounded-lg accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                  <span>Off</span>
                  <span>4s</span>
                  <span>8s</span>
                  <span>12s</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Appearance */}
      {activeTab === "appearance" && (
        <div className="glass-card rounded-3xl p-6 md:p-8 space-y-6 border border-foreground/5 shadow-xl">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <span>Interface & Visual Experience</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customize the look, colors, and reactive glass panels of Sonara Studio.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dark Theme Card */}
            <div
              onClick={() => theme !== "dark" && toggleTheme()}
              className={cn(
                "p-5 rounded-2xl border cursor-pointer transition-all space-y-3",
                theme === "dark"
                  ? "bg-foreground/15 border-cyan-400 shadow-lg"
                  : "bg-foreground/[0.03] border-foreground/5 hover:bg-foreground/[0.06]"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-sm text-foreground">Dark Glassmorphism</span>
                </div>
                {theme === "dark" && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-xs text-muted-foreground">
                Deep black OLED background with vibrant album neon glows and backdrop-blur cards.
              </p>
            </div>

            {/* Light Theme Card */}
            <div
              onClick={() => theme !== "light" && toggleTheme()}
              className={cn(
                "p-5 rounded-2xl border cursor-pointer transition-all space-y-3",
                theme === "light"
                  ? "bg-foreground/15 border-cyan-400 shadow-lg"
                  : "bg-foreground/[0.03] border-foreground/5 hover:bg-foreground/[0.06]"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-sm text-foreground">Clean Light Studio</span>
                </div>
                {theme === "light" && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-xs text-muted-foreground">
                Ultra-crisp light canvas with refined contrast and frosted acrylic glass panels.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Account & Cloud */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {/* Account Profile Card */}
          <div className="glass-card rounded-3xl p-6 md:p-8 border border-foreground/5 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 via-blue-600 to-cyan-500 p-0.5 shrink-0 flex items-center justify-center overflow-hidden shadow-lg">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name}
                      className="w-full h-full rounded-[14px] object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-[14px] bg-background flex items-center justify-center font-extrabold text-lg text-foreground">
                      {user?.display_name ? user.display_name.charAt(0).toUpperCase() : "S"}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-foreground text-lg">{user?.display_name || "Sonara Listener"}</p>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 text-[10px] font-bold">
                      PRO MASTER
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{user?.email || "listener@sonara.app"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all shadow-sm"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-foreground/5">
              <Link
                href="/onboarding"
                className="flex items-center justify-between p-4 rounded-2xl bg-foreground/[0.03] hover:bg-foreground/[0.08] border border-foreground/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Taste Profile</p>
                    <p className="text-[11px] text-muted-foreground">Adjust your favorite languages & genres</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground">Edit →</span>
              </Link>

              <div
                onClick={handleClearCache}
                className="flex items-center justify-between p-4 rounded-2xl bg-foreground/[0.03] hover:bg-foreground/[0.08] border border-foreground/5 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Clear Media Cache</p>
                    <p className="text-[11px] text-muted-foreground">Reset audio stream cache and stored metadata</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground">Clear</span>
              </div>
            </div>
          </div>

          {/* Connected Cloud Architecture (No Spotify Mention) */}
          <div className="glass-card rounded-3xl p-6 border border-foreground/5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-cyan-500" />
              <h3 className="text-sm font-bold text-foreground">Cloud Streaming Architecture</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-foreground/[0.03] border border-foreground/5 space-y-1">
                <span className="text-muted-foreground block text-[11px]">Primary Catalog</span>
                <span className="font-semibold text-foreground">Sonara Global Cloud</span>
              </div>
              <div className="p-3.5 rounded-xl bg-foreground/[0.03] border border-foreground/5 space-y-1">
                <span className="text-muted-foreground block text-[11px]">Lyrics Stream</span>
                <span className="font-semibold text-foreground">LRCLIB Realtime Sync</span>
              </div>
              <div className="p-3.5 rounded-xl bg-foreground/[0.03] border border-foreground/5 space-y-1">
                <span className="text-muted-foreground block text-[11px]">Audio Engine</span>
                <span className="font-semibold text-cyan-400">Sonara Studio Master</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
