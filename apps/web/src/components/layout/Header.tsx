"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Command,
  Sun,
  Moon,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function Header() {
  const router = useRouter();
  const { theme, toggleTheme, mood, setCommandPaletteOpen } = useAppStore();

  const moodBadges: Record<string, { label: string; icon: any; color: string }> = {
    default: { label: "Standard Vibe", icon: Sparkles, color: "text-violet-400" },
    focus: { label: "Focus Mode", icon: Sparkles, color: "text-emerald-400" },
    workout: { label: "Workout Mode", icon: Zap, color: "text-orange-400" },
    latenight: { label: "Late Night Neon", icon: Moon, color: "text-indigo-400" },
  };

  const currentBadge = moodBadges[mood] || moodBadges.default;
  const MoodIcon = currentBadge.icon;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 glass-panel border-b border-white/5 backdrop-blur-xl">
      {/* Navigation history controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => router.forward()}
          aria-label="Go forward"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Active Mood Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium glass-pill ml-2 border border-white/10">
          <MoodIcon className={cn("w-3 h-3", currentBadge.color)} />
          <span className="text-white/80">{currentBadge.label}</span>
        </div>
      </div>

      {/* Center Search / Command Trigger */}
      <div className="flex-1 max-w-md mx-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all text-xs text-muted-foreground group shadow-inner"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
            <span className="group-hover:text-white/90 transition-colors">Search tracks, artists, moods...</span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-muted-foreground">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
