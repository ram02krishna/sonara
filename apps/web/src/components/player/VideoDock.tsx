"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { playback } from "@/lib/playback";
import { cn } from "@/lib/utils";

// Embedded YouTube video player host
export function VideoDock() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const track = usePlayerStore((s) => s.currentTrack);
  const engine = usePlayerStore((s) => s.engine);

  const isFullSongPlaying = (engine === "video" || engine === "idle") && !!track;
  const isVisible = isFullSongPlaying && settings.showVideoWindow;

  useEffect(() => () => playback.destroyVideo(), []);

  return (
    <div
      className={cn(
        "fixed transition-all duration-300 ease-out",
        isVisible
          ? "right-4 bottom-28 md:bottom-28 max-md:bottom-40 max-md:left-4 md:w-[380px] rounded-2xl overflow-hidden border border-foreground/10 bg-black shadow-2xl opacity-100 pointer-events-auto scale-100 translate-y-0 z-40"
          : "right-0 bottom-0 w-[2px] h-[2px] opacity-[0.01] pointer-events-none overflow-hidden z-[-10]"
      )}
    >
      <div className={cn("flex items-center justify-between px-3 py-1.5 bg-popover/95 text-xs", !isVisible && "hidden")}>
        <span className="truncate text-muted-foreground font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Full song · Video
        </span>
        <button
          aria-label="Hide video (audio keeps playing in background)"
          title="Hide video (audio keeps playing in background)"
          onClick={() => updateSettings({ showVideoWindow: false })}
          className="p-1 rounded-full hover:bg-foreground/10 text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div id="sonara-yt-host" className={cn("w-full aspect-video min-h-[200px] bg-black", !isVisible && "min-h-0 h-[2px]")} />
    </div>
  );
}
