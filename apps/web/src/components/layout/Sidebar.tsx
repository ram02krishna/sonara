"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Library,
  BarChart2,
  Heart,
  PlusSquare,
  Sparkles,
  Zap,
  Moon,
  ChevronLeft,
  ChevronRight,
  Music,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore, MoodMode } from "@/store/useAppStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { MOCK_PLAYLISTS } from "@/data/mockCatalog";

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mood, setMood, user, isAuthenticated } = useAppStore();
  const { setCurrentTrack } = usePlayerStore();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Search", href: "/search", icon: Search },
    { label: "Your Library", href: "/library", icon: Library },
    { label: "Stats & Insights", href: "/stats", icon: BarChart2 },
  ];

  const moods: { id: MoodMode; label: string; icon: any; colorClass: string }[] = [
    { id: "default", label: "All Vibe", icon: Sparkles, colorClass: "text-violet-400 border-violet-500/30" },
    { id: "focus", label: "Focus", icon: Sparkles, colorClass: "text-emerald-400 border-emerald-500/30" },
    { id: "workout", label: "Workout", icon: Zap, colorClass: "text-orange-400 border-orange-500/30" },
    { id: "latenight", label: "Late Night", icon: Moon, colorClass: "text-indigo-400 border-indigo-500/30" },
  ];

  return (
    <aside
      className={cn(
        "relative flex flex-col h-full glass-panel border-r border-white/5 transition-all duration-300 z-30 select-none",
        sidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-500 to-cyan-400 p-[2px] shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-black/80 rounded-[14px] flex items-center justify-center">
              <Music className="w-5 h-5 text-cyan-300 animate-pulseGlow" />
            </div>
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-white/90 to-cyan-200 bg-clip-text text-transparent">
                Sonara
              </span>
              <span className="text-[10px] text-muted-foreground tracking-widest uppercase font-medium">
                Lossless Audio
              </span>
            </div>
          )}
        </Link>

        <button
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
          className="p-1.5 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Nav */}
      <div className="px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                isActive
                  ? "bg-white/10 text-white shadow-inner font-semibold"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform group-hover:scale-110",
                  isActive ? "text-cyan-400" : "text-muted-foreground group-hover:text-white"
                )}
              />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {isActive && !sidebarCollapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Mood Modes Selector */}
      <div className="px-4 py-3">
        {!sidebarCollapsed && (
          <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2">
            Mood Switcher
          </p>
        )}
        <div className={cn("grid gap-1.5", sidebarCollapsed ? "grid-cols-1" : "grid-cols-2")}>
          {moods.map((m) => {
            const isCurrentMood = mood === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setMood(m.id)}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all text-left",
                  isCurrentMood
                    ? "bg-white/15 border-white/30 text-white shadow-sm"
                    : "border-transparent bg-white/[0.03] text-muted-foreground hover:bg-white/10 hover:text-white"
                )}
                title={m.label}
              >
                <Icon className={cn("w-3.5 h-3.5 shrink-0", m.colorClass)} />
                {!sidebarCollapsed && <span className="truncate">{m.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[1px] bg-white/5 mx-4 my-2" />

      {/* Playlists Quick Access */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        <Link
          href="/library?tab=liked"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-all group"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0">
            <Heart className="w-3.5 h-3.5 text-white fill-white" />
          </div>
          {!sidebarCollapsed && <span className="font-medium text-white/90">Liked Songs</span>}
        </Link>

        {!sidebarCollapsed && (
          <div className="pt-3 pb-1">
            <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase px-2 mb-1">
              Curated Playlists
            </p>
            {MOCK_PLAYLISTS.map((pl) => (
              <Link
                key={pl.id}
                href={`/playlist/${pl.id}`}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors group"
              >
                <span className="truncate">{pl.name}</span>
                <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  {pl.tracks_total} tracks
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* User / Auth footer */}
      <div className="p-3 border-t border-white/5">
        {isAuthenticated && user ? (
          <Link
            href="/settings"
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-500 to-cyan-400 p-[1.5px] shrink-0">
              <img
                src={user.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
                alt={user.display_name}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white truncate">{user.display_name}</span>
                <span className="text-xs text-cyan-400 capitalize flex items-center gap-1 font-medium">
                  {user.product === "premium" ? "✦ Premium" : "Free Tier"}
                </span>
              </div>
            )}
          </Link>
        ) : (
          <Link
            href="/login"
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white text-xs font-semibold py-2.5 transition-all shadow-md shadow-violet-900/30",
              sidebarCollapsed ? "px-2" : "px-4"
            )}
          >
            <Music className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Connect Spotify</span>}
          </Link>
        )}
      </div>
    </aside>
  );
}
