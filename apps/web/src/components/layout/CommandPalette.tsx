"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Music,
  Play,
  SkipForward,
  Headphones,
  Zap,
  Moon,
  Sun,
  X,
  Library,
  BarChart2,
  Heart,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useSearch } from "@/hooks/useSonara";
import { useUiStore } from "@/store/useUiStore";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen, setMood, toggleTheme, theme } = useAppStore();
  const { setCurrentTrack, setIsPlaying, isPlaying, playNext } = usePlayerStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  // Same hook + endpoint as the header and /search page.
  const { data: live } = useSearch(commandPaletteOpen ? debounced : "", "track");

  // Global keyboard shortcut Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  // Search filtered items
  const matchedTracks = (live?.tracks ?? []).slice(0, 6);

  const actions = [
    {
      id: "nav-home",
      title: "Go to Home",
      icon: Music,
      category: "Navigation",
      run: () => router.push("/"),
    },
    {
      id: "nav-library",
      title: "Go to Your Library",
      icon: Library,
      category: "Navigation",
      run: () => router.push("/library"),
    },
    {
      id: "nav-explore",
      title: "Explore by language & mood",
      icon: Music,
      category: "Navigation",
      run: () => router.push("/explore"),
    },
    {
      id: "nav-settings",
      title: "Open Settings",
      icon: Music,
      category: "Navigation",
      run: () => router.push("/settings"),
    },
    {
      id: "action-newplaylist",
      title: "Create a new playlist",
      icon: Library,
      category: "Library",
      run: () => useUiStore.getState().openCreatePlaylist(),
    },
    {
      id: "action-theme",
      title: "Toggle light / dark theme",
      icon: Headphones,
      category: "Appearance",
      run: () => useAppStore.getState().toggleTheme(),
    },
    {
      id: "nav-stats",
      title: "View Listening Stats",
      icon: BarChart2,
      category: "Navigation",
      run: () => router.push("/stats"),
    },
    {
      id: "action-playpause",
      title: isPlaying ? "Pause Playback" : "Resume Playback",
      icon: Play,
      category: "Playback",
      run: () => setIsPlaying(!isPlaying),
    },
    {
      id: "action-next",
      title: "Skip to Next Track",
      icon: SkipForward,
      category: "Playback",
      run: () => playNext(),
    },
    {
      id: "mood-focus",
      title: "Focus colours",
      icon: Headphones,
      category: "Audio Modes",
      run: () => setMood("focus"),
    },
    {
      id: "mood-workout",
      title: "Workout colours",
      icon: Zap,
      category: "Moods",
      run: () => setMood("workout"),
    },
    {
      id: "mood-latenight",
      title: "Late night colours",
      icon: Moon,
      category: "Moods",
      run: () => setMood("latenight"),
    },
    {
      id: "theme-toggle",
      title: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
      icon: theme === "dark" ? Sun : Moon,
      category: "Preferences",
      run: () => toggleTheme(),
    },
  ].filter((a) => a.title.toLowerCase().includes(query.toLowerCase()));

  const handleSelectTrack = (track: any) => {
    setCurrentTrack(track);
    setCommandPaletteOpen(false);
  };

  const handleRunAction = (action: any) => {
    action.run();
    setCommandPaletteOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-xl rounded-3xl border border-foreground/10 shadow-2xl overflow-hidden flex flex-col max-h-[500px]">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-foreground/10 gap-3">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command, track, or mood..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent border-none outline-none text-foreground text-sm placeholder:text-muted-foreground"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Matched tracks */}
          {matchedTracks.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase px-3 py-1">
                Tracks
              </p>
              {matchedTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => handleSelectTrack(track)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-foreground/10 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={track.album?.images?.[0]?.url || ""}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-cyan-300">
                        {track.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {track.artists?.map((a) => a.name).join(", ")}
                      </p>
                    </div>
                  </div>
                  <Play className="w-4 h-4 text-muted-foreground group-hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}

          {/* Quick actions */}
          {actions.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase px-3 py-1">
                Actions & Navigation
              </p>
              {actions.map((act) => {
                const Icon = act.icon;
                return (
                  <div
                    key={act.id}
                    onClick={() => handleRunAction(act)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-foreground/10 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground group-hover:text-cyan-400 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm text-foreground/90 group-hover:text-foreground">
                        {act.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60">{act.category}</span>
                  </div>
                );
              })}
            </div>
          )}

          {matchedTracks.length === 0 && actions.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">
              No matching commands or tracks found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
