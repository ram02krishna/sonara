"use client";

import { useEffect } from "react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { playback } from "@/lib/playback";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

/** Spotify-style keyboard shortcuts. Ignored while typing and when a modifier (other than Shift) is held. */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useAppStore.getState().toggleCommandPalette();
        return;
      }
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      // Buttons/links keep their own Space/Enter behaviour.
      const interactive = (e.target as HTMLElement | null)?.closest?.("button, a, [role=button], [role=menuitem], input[type=range]");
      const p = usePlayerStore.getState();
      const key = e.key;

      if (key === "?") return useAppStore.getState().setShortcutsOpen(true);
      if (key === "/") {
        e.preventDefault();
        return void window.dispatchEvent(new Event("sonara:focus-search"));
      }
      if (!p.currentTrack) return;

      switch (key) {
        case " ":
          if (interactive) return;
          e.preventDefault();
          p.setIsPlaying(!p.isPlaying);
          break;
        case "ArrowRight":
          if (interactive && (e.target as HTMLElement).tagName === "INPUT") return;
          e.preventDefault();
          e.shiftKey ? p.playNext() : playback.seek(Math.min(p.durationMs, p.progressMs + 10000));
          break;
        case "ArrowLeft":
          if (interactive && (e.target as HTMLElement).tagName === "INPUT") return;
          e.preventDefault();
          e.shiftKey ? p.playPrevious() : playback.seek(Math.max(0, p.progressMs - 10000));
          break;
        case "ArrowUp":
          if (interactive && (e.target as HTMLElement).tagName === "INPUT") return;
          e.preventDefault();
          p.setVolume(Math.min(100, p.volume + 5));
          break;
        case "ArrowDown":
          if (interactive && (e.target as HTMLElement).tagName === "INPUT") return;
          e.preventDefault();
          p.setVolume(Math.max(0, p.volume - 5));
          break;
        case "m":
        case "M":
          p.toggleMute();
          break;
        case "s":
        case "S":
          p.toggleShuffle();
          break;
        case "r":
        case "R":
          p.cycleRepeatMode();
          break;
        case "q":
        case "Q":
          p.toggleRightPanelTab("queue");
          break;
        case "y":
        case "Y":
          p.toggleRightPanelTab("lyrics");
          break;
        case "f":
        case "F":
          p.setIsExpanded(!p.isExpanded);
          break;
        case "l":
        case "L":
          window.dispatchEvent(new Event("sonara:toggle-like"));
          break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
