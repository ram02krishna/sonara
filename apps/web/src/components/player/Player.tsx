"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Maximize2, Mic2, ListMusic, MoonStar, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Tv, Volume1, Volume2, VolumeX } from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { cn, formatDuration } from "@/lib/utils";
import { playback } from "@/lib/playback";
import { Cover, LikeButton } from "@/components/ui/media";

function SleepTimer() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const endsAt = usePlayerStore((s) => s.sleepTimerEndsAt);
  const afterTrack = usePlayerStore((s) => s.sleepAfterTrack);
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const addToast = useAppStore((s) => s.addToast);
  const [, force] = useState(0);
  const active = !!endsAt || afterTrack;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => force((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, [endsAt]);

  const set = (minutes: number | null, end = false) => {
    setSleepTimer(minutes, end);
    setOpen(false);
    addToast({ title: minutes || end ? "Sleep timer set" : "Sleep timer off", description: end ? "Stops after this song" : minutes ? `Stops in ${minutes} minutes` : undefined, type: "info", duration: 2000 });
  };
  const left = endsAt ? Math.max(1, Math.ceil((endsAt - Date.now()) / 60000)) : 0;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Sleep timer" aria-expanded={open} title={active ? (afterTrack ? "Stops after this song" : `Stops in ${left} min`) : "Sleep timer"} className={cn("p-2 rounded-full hover:bg-foreground/10", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
        <MoonStar className="w-[18px] h-[18px]" />
      </button>
      {open && (
        <div role="menu" className="pop-in absolute bottom-12 right-0 w-48 p-1.5 rounded-2xl border border-foreground/10 bg-popover/95 backdrop-blur-xl shadow-2xl">
          <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">Sleep timer</p>
          {[15, 30, 45, 60].map((m) => (
            <button key={m} role="menuitem" onClick={() => set(m)} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-foreground/10">{m} minutes</button>
          ))}
          <button role="menuitem" onClick={() => set(null, true)} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-foreground/10">End of this song</button>
          {active && <button role="menuitem" onClick={() => set(null)} className="w-full text-left px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-foreground/10">Turn off</button>}
        </div>
      )}
    </div>
  );
}

export function Player() {
  const {
    currentTrack, isPlaying, setIsPlaying, progressMs, durationMs, volume, setVolume, isMuted, toggleMute, shuffle, toggleShuffle,
    repeatMode, cycleRepeatMode, playNext, playPrevious, setIsExpanded, rightPanelTab, toggleRightPanelTab, engine,
  } = usePlayerStore();
  const fullSongVideo = useAppStore((s) => s.settings.fullSongVideo);
  const showVideoWindow = useAppStore((s) => s.settings.showVideoWindow);
  const updateSettings = useAppStore((s) => s.updateSettings);

  if (!currentTrack) return null;

  const pct = durationMs > 0 ? Math.min(100, (progressMs / durationMs) * 100) : 0;
  const VolIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const RepeatIcon = repeatMode === "track" ? Repeat1 : Repeat;
  const art = currentTrack.album?.images?.[0]?.url;

  const slider = (value: number, max: number, onChange: (n: number) => void, label: string, className?: string) => (
    <input
      type="range"
      min={0}
      max={max}
      step={max > 1000 ? 250 : 1}
      value={Math.min(value, max)}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      className={cn("sonara-range", className)}
      style={{ ["--pct" as string]: `${max ? (value / max) * 100 : 0}%` }}
    />
  );

  return (
    <>
      {/* Desktop player bar */}
      <div className="hidden md:grid fixed bottom-2 inset-x-2 z-40 h-[88px] grid-cols-[1fr_minmax(0,1.6fr)_1fr] items-center gap-4 px-4 rounded-3xl glass-panel shadow-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setIsExpanded(true)} aria-label="Open full-screen player" className="group relative shrink-0">
            <Cover src={art} alt={currentTrack.name} className="w-14 h-14 rounded-xl shadow-lg" />
            <span className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="w-4 h-4 text-white" /></span>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{currentTrack.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {currentTrack.artists?.map((a, i) => (
                <React.Fragment key={`${a.id}-${i}`}>
                  {i > 0 && ", "}
                  {a.id ? <Link href={`/artist/${a.id}`} className="hover:underline hover:text-foreground">{a.name}</Link> : a.name}
                </React.Fragment>
              ))}
            </p>
          </div>
          <LikeButton track={currentTrack} />
        </div>

        <div className="flex flex-col items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={toggleShuffle} aria-label="Shuffle" aria-pressed={shuffle} className={cn("p-2 rounded-full hover:bg-foreground/10", shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground")}><Shuffle className="w-4 h-4" /></button>
            <button onClick={playPrevious} aria-label="Previous" className="p-2 rounded-full text-foreground hover:bg-foreground/10"><SkipBack className="w-5 h-5 fill-current" /></button>
            <button onClick={() => setIsPlaying(!isPlaying)} aria-label={isPlaying ? "Pause" : "Play"} className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
            <button onClick={() => playNext()} aria-label="Next" className="p-2 rounded-full text-foreground hover:bg-foreground/10"><SkipForward className="w-5 h-5 fill-current" /></button>
            <button onClick={cycleRepeatMode} aria-label={`Repeat: ${repeatMode}`} className={cn("p-2 rounded-full hover:bg-foreground/10", repeatMode !== "off" ? "text-primary" : "text-muted-foreground hover:text-foreground")}><RepeatIcon className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2 w-full max-w-xl">
            <span className="text-[11px] tabular-nums text-muted-foreground w-9 text-right">{formatDuration(progressMs)}</span>
            {slider(progressMs, durationMs || 1, (n) => playback.seek(n), "Seek", "flex-1")}
            <span className="text-[11px] tabular-nums text-muted-foreground w-9">{formatDuration(durationMs)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1">
          {engine === "preview" && !fullSongVideo && (
            <span title="This is a 30-second preview. Full song streaming will auto-fallback." className="hidden xl:inline-block mr-1 px-2 py-0.5 rounded-full bg-foreground/10 text-[10px] font-semibold tracking-wide text-muted-foreground">PREVIEW</span>
          )}
          <button
            onClick={() => updateSettings({ showVideoWindow: !showVideoWindow })}
            aria-label={showVideoWindow ? "Hide video window" : "Show video window"}
            title={
              showVideoWindow
                ? "Video window: ON (Click to hide video; song continues playing in background)"
                : "Video window: OFF (Click to show video; full song playing in background)"
            }
            className={cn(
              "p-2 rounded-full hover:bg-foreground/10 transition-colors",
              showVideoWindow ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Tv className="w-[18px] h-[18px]" />
          </button>
          <button onClick={() => toggleRightPanelTab("lyrics")} aria-label="Lyrics" aria-pressed={rightPanelTab === "lyrics"} className={cn("p-2 rounded-full hover:bg-foreground/10", rightPanelTab === "lyrics" ? "text-primary" : "text-muted-foreground hover:text-foreground")}><Mic2 className="w-[18px] h-[18px]" /></button>
          <button onClick={() => toggleRightPanelTab("queue")} aria-label="Queue" aria-pressed={rightPanelTab === "queue"} className={cn("p-2 rounded-full hover:bg-foreground/10", rightPanelTab === "queue" ? "text-primary" : "text-muted-foreground hover:text-foreground")}><ListMusic className="w-[18px] h-[18px]" /></button>
          <SleepTimer />
          <button onClick={toggleMute} aria-label={isMuted ? "Unmute" : "Mute"} className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10"><VolIcon className="w-[18px] h-[18px]" /></button>
          {slider(volume, 100, setVolume, "Volume", "w-24")}
          <button onClick={() => setIsExpanded(true)} aria-label="Full screen" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10"><Maximize2 className="w-[18px] h-[18px]" /></button>
        </div>
      </div>

      {/* Mobile mini player */}
      <div className="md:hidden fixed bottom-[calc(3.9rem+env(safe-area-inset-bottom))] inset-x-2 z-40 rounded-2xl glass-panel shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 p-2.5">
          <button onClick={() => setIsExpanded(true)} className="flex items-center gap-3 min-w-0 flex-1 text-left" aria-label="Open full-screen player">
            <Cover src={art} alt={currentTrack.name} className="w-11 h-11 rounded-lg shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground truncate">{currentTrack.name}</span>
              <span className="block text-xs text-muted-foreground truncate">{currentTrack.artists?.map((a) => a.name).join(", ")}</span>
            </span>
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)} aria-label={isPlaying ? "Pause" : "Play"} className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center">
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <button onClick={() => playNext()} aria-label="Next" className="p-2 text-foreground"><SkipForward className="w-5 h-5 fill-current" /></button>
        </div>
        <div className="h-0.5 bg-foreground/10"><div className="h-full bg-brand" style={{ width: `${pct}%` }} /></div>
      </div>
    </>
  );
}
