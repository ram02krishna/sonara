"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Maximize2,
  Mic2,
  ListMusic,
  Laptop,
  Heart,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { cn, formatDuration } from "@/lib/utils";

export function Player() {
  const {
    currentTrack,
    isPlaying,
    setIsPlaying,
    progressMs,
    setProgressMs,
    durationMs,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    shuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    playNext,
    playPrevious,
    setIsExpanded,
    rightPanelTab,
    toggleRightPanelTab,
    isPremiumRequired,
  } = usePlayerStore();

  const { addToast } = useAppStore();
  const [isLiked, setIsLiked] = useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Sync like state
  useEffect(() => {
    setIsLiked(Boolean(currentTrack?.is_liked));
  }, [currentTrack]);

  // Handle audio source change and play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack?.preview_url) {
      if (audio.src !== currentTrack.preview_url) {
        audio.src = currentTrack.preview_url;
        audio.load();
      }
      if (isPlaying) {
        audio.play().catch((err) => {
          console.warn("Audio autoplay blocked by browser policy:", err);
        });
      } else {
        audio.pause();
      }
    }
  }, [currentTrack, isPlaying]);

  // Sync volume and mute directly with audio element
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume / 100));
  }, [volume, isMuted]);

  // Fallback ticker if no preview_url exists
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && durationMs > 0 && !currentTrack?.preview_url) {
      interval = setInterval(() => {
        setProgressMs(Math.min(durationMs, progressMs + 1000));
        if (progressMs >= durationMs) {
          playNext();
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, progressMs, durationMs, playNext, setProgressMs, currentTrack]);

  if (!currentTrack) {
    return null;
  }

  const handleToggleLike = () => {
    const next = !isLiked;
    setIsLiked(next);
    addToast({
      title: next ? "Added to Liked Songs" : "Removed from Liked Songs",
      type: "success",
    });
  };

  const progressPercent = durationMs > 0 ? (progressMs / durationMs) * 100 : 0;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-3 pt-1 pointer-events-none">
      <div className="max-w-7xl mx-auto pointer-events-auto">
        <div className="glass-panel border border-white/10 rounded-2xl md:rounded-3xl p-3 md:px-5 md:py-3 shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-4">
          
          {/* Left: Track Information & Artwork */}
          <div className="flex items-center gap-3.5 min-w-0 max-w-[240px] md:max-w-[300px]">
            <div
              className="relative w-12 h-12 md:w-14 md:h-14 rounded-xl overflow-hidden shrink-0 shadow-lg cursor-pointer group"
              onClick={() => setIsExpanded(true)}
            >
              <img
                src={currentTrack.album?.images?.[0]?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100"}
                alt={currentTrack.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p
                onClick={() => setIsExpanded(true)}
                className="text-sm font-semibold text-white truncate cursor-pointer hover:underline"
              >
                {currentTrack.name}
              </p>
              <p className="text-xs text-muted-foreground truncate hover:text-white cursor-pointer transition-colors">
                {currentTrack.artists?.map((a) => a.name).join(", ")}
              </p>
            </div>

            <button
              onClick={handleToggleLike}
              aria-label="Like track"
              className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition-colors shrink-0"
            >
              <Heart
                className={cn(
                  "w-4 h-4 transition-all",
                  isLiked ? "text-fuchsia-400 fill-fuchsia-400 scale-110" : "text-muted-foreground"
                )}
              />
            </button>
          </div>

          {/* Center: Controls & Scrubber */}
          <div className="flex-1 max-w-2xl flex flex-col items-center gap-1.5">
            {/* Buttons */}
            <div className="flex items-center gap-4 md:gap-6">
              <button
                onClick={toggleShuffle}
                aria-label="Shuffle"
                className={cn(
                  "hidden sm:block p-1.5 rounded-lg transition-colors",
                  shuffle ? "text-cyan-400" : "text-muted-foreground hover:text-white"
                )}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                onClick={playPrevious}
                aria-label="Previous track"
                className="p-1.5 text-muted-foreground hover:text-white transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <button
                onClick={playNext}
                aria-label="Next track"
                className="p-1.5 text-muted-foreground hover:text-white transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              <button
                onClick={cycleRepeatMode}
                aria-label="Repeat mode"
                className={cn(
                  "hidden sm:block p-1.5 rounded-lg transition-colors",
                  repeatMode !== "off" ? "text-cyan-400" : "text-muted-foreground hover:text-white"
                )}
              >
                {repeatMode === "track" ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>
            </div>

            {/* Scrubber bar */}
            <div className="w-full flex items-center gap-3">
              <span className="text-[11px] font-mono text-muted-foreground w-9 text-right shrink-0">
                {formatDuration(progressMs)}
              </span>

              <div
                className="relative flex-1 h-1.5 bg-white/10 hover:h-2 rounded-full cursor-pointer transition-all group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  const newTimeMs = Math.round(ratio * durationMs);
                  setProgressMs(newTimeMs);
                  if (audioRef.current) {
                    audioRef.current.currentTime = newTimeMs / 1000;
                  }
                }}
              >
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full group-hover:from-violet-400 group-hover:to-cyan-300 relative transition-all"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              <span className="text-[11px] font-mono text-muted-foreground w-9 text-left shrink-0">
                {formatDuration(durationMs)}
              </span>
            </div>
          </div>

          {/* Right: Actions, Panels, Volume */}
          <div className="hidden lg:flex items-center gap-3 justify-end min-w-[220px]">
            <button
              onClick={() => toggleRightPanelTab("lyrics")}
              aria-label="Lyrics"
              className={cn(
                "p-2 rounded-xl transition-colors",
                rightPanelTab === "lyrics" ? "bg-white/15 text-cyan-400" : "text-muted-foreground hover:text-white"
              )}
            >
              <Mic2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => toggleRightPanelTab("queue")}
              aria-label="Queue"
              className={cn(
                "p-2 rounded-xl transition-colors",
                rightPanelTab === "queue" ? "bg-white/15 text-cyan-400" : "text-muted-foreground hover:text-white"
              )}
            >
              <ListMusic className="w-4 h-4" />
            </button>

            <button
              onClick={() => addToast({ title: "Connected to Sonara Web Player (Lossless)", type: "info" })}
              aria-label="Devices"
              className="p-2 rounded-xl text-muted-foreground hover:text-white transition-colors"
            >
              <Laptop className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                aria-label="Mute / Unmute"
                className="p-1 text-muted-foreground hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-20 h-1 bg-white/20 rounded-lg accent-cyan-400 cursor-pointer"
              />
            </div>

            <button
              onClick={() => setIsExpanded(true)}
              aria-label="Expand player"
              className="p-2 rounded-xl text-muted-foreground hover:text-white transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* HTML5 Audio Streaming Engine */}
      <audio
        ref={audioRef}
        src={currentTrack?.preview_url || undefined}
        preload="auto"
        onTimeUpdate={() => {
          if (audioRef.current && isFinite(audioRef.current.currentTime)) {
            setProgressMs(Math.round(audioRef.current.currentTime * 1000));
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
            usePlayerStore.setState({ durationMs: Math.round(audioRef.current.duration * 1000) });
          }
        }}
        onEnded={() => {
          playNext();
        }}
      />
    </footer>
  );
}
