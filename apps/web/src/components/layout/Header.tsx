"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = pathname === "/search" ? searchParams.get("q") ?? "" : "";
  const [value, setValue] = useState(urlQuery);
  useEffect(() => setValue(urlQuery), [urlQuery]);
  // Typing here drives the same /search?q= page everyone uses: one search, one source of truth.
  useEffect(() => {
    const q = value.trim();
    if (!q || q === urlQuery.trim()) return;
    const t = setTimeout(() => router.push(`/search?q=${encodeURIComponent(q)}`), 400);
    return () => clearTimeout(t);
  }, [value, urlQuery, router]);
  const { theme, toggleTheme, mood, setCommandPaletteOpen } = useAppStore();

  const moodBadges: Record<string, { label: string; icon: any; color: string }> = {
    default: { label: "Standard Vibe", icon: Sparkles, color: "text-violet-600 dark:text-violet-400" },
    focus: { label: "Focus Mode", icon: Sparkles, color: "text-emerald-600 dark:text-emerald-400" },
    workout: { label: "Workout Mode", icon: Zap, color: "text-orange-600 dark:text-orange-400" },
    latenight: { label: "Late Night Neon", icon: Moon, color: "text-indigo-600 dark:text-indigo-400" },
  };

  const currentBadge = moodBadges[mood] || moodBadges.default;
  const MoodIcon = currentBadge.icon;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 glass-panel border-b border-foreground/5 backdrop-blur-xl">
      {/* Navigation history controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => router.forward()}
          aria-label="Go forward"
          className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Active Mood Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium glass-pill ml-2 border border-foreground/10">
          <MoodIcon className={cn("w-3 h-3", currentBadge.color)} />
          <span className="text-foreground/80">{currentBadge.label}</span>
        </div>
      </div>

      {/* Center Search */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`);
            }}
            placeholder="Search songs, artists, albums…"
            aria-label="Search"
            className="w-full pl-10 pr-16 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 focus:bg-foreground/10 border border-foreground/5 focus:border-foreground/20 outline-none text-sm text-foreground placeholder:text-muted-foreground transition-all"
          />
          <button
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Open command palette"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-foreground/10 text-[10px] font-mono text-muted-foreground hover:text-foreground"
          >
            <Command className="w-3 h-3" />
            <span>K</span>
          </button>
        </div>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
