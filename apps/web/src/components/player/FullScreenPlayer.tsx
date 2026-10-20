"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Mic2,
  ListMusic,
  Share2,
  Heart,
  Sparkles,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { cn, formatDuration } from "@/lib/utils";

export function FullScreenPlayer() {
  const {
    isExpanded,
    setIsExpanded,
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
    extractedColors,
    lyrics,
  } = usePlayerStore();

  const { addToast } = useAppStore();
  const [showLyricsMode, setShowLyricsMode] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  if (!isExpanded || !currentTrack) return null;

  const currentSeconds = progressMs / 1000;
  const progressPercent = durationMs > 0 ? (progressMs / durationMs) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        className="fixed inset-0 z-50 overflow-hidden flex flex-col justify-between p-6 md:p-12 text-white select-none"
        style={{
          background: `radial-gradient(circle at 50% 20%, ${extractedColors.glow} 0%, rgba(10, 10, 15, 0.95) 70%, #050508 100%)`,
        }}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between w-full max-w-5xl mx-auto z-10">
          <button
            onClick={() => setIsExpanded(false)}
            aria-label="Minimize player"
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-colors"
          >
            <ChevronDown className="w-6 h-6" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-[11px] uppercase tracking-widest text-white/60 font-semibold">
              Playing from Album
            </span>
            <span className="text-sm font-bold text-white/90 truncate max-w-xs md:max-w-md">
              {currentTrack.album?.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold border border-white/10 text-cyan-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Lossless 24-bit / 96 kHz</span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                addToast({ title: "Track link copied to clipboard", type: "success" });
              }}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Main Stage (Art vs Lyrics) */}
        <div className="flex-1 max-w-5xl w-full mx-auto my-6 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-14 overflow-hidden z-10">
          {/* Artwork */}
          <div className="relative group max-w-md w-full aspect-square rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10">
            <img
              src={currentTrack.album?.images?.[0]?.url || ""}
              alt={currentTrack.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Visualizer bars overlay at bottom */}
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-center gap-1 h-8 bg-black/40 backdrop-blur-md rounded-2xl p-2 border border-white/10">
              {[40, 70, 30, 90, 50, 80, 60, 100, 45, 85, 65, 35].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-cyan-400 rounded-full transition-all duration-150"
                  style={{
                    height: isPlaying ? `${Math.max(15, (h * (progressMs % 1000)) / 1000)}%` : "20%",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right: Lyrics / Track Metadata */}
          <div className="flex-1 w-full max-w-md flex flex-col justify-center h-full max-h-[460px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs uppercase font-bold tracking-widest text-white/50">
                {showLyricsMode ? "Realtime Lyrics" : "About Track"}
              </h2>
              <button
                onClick={() => setShowLyricsMode(!showLyricsMode)}
                className="text-xs text-cyan-300 hover:text-white font-medium flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 transition-colors"
              >
                <Mic2 className="w-3.5 h-3.5" />
                <span>{showLyricsMode ? "Show Details" : "Show Lyrics"}</span>
              </button>
            </div>

            {showLyricsMode ? (
              <div className="overflow-y-auto space-y-4 max-h-[360px] pr-2">
                {lyrics?.lines ? (
                  lyrics.lines.map((l, i) => {
                    const next = lyrics.lines![i + 1];
                    const active =
                      currentSeconds >= l.time_seconds && (!next || currentSeconds < next.time_seconds);
                    return (
                      <p
                        key={i}
                        className={cn(
                          "transition-all duration-300 font-semibold cursor-pointer",
                          active
                            ? "text-white text-2xl font-bold scale-[1.03]"
                            : "text-white/30 text-lg hover:text-white/60"
                        )}
                      >
                        {l.words}
                      </p>
                    );
                  })
                ) : (
                  <p className="text-white/40 italic py-10">No lyrics available for this track.</p>
                )}
              </div>
            ) : (
              <div className="glass-card p-6 rounded-3xl space-y-4 border border-white/10 backdrop-blur-xl">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
                    {currentTrack.name}
                  </h1>
                  <p className="text-lg text-cyan-300 font-medium">
                    {currentTrack.artists?.map((a) => a.name).join(", ")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-white/10">
                  <div>
                    <span className="text-white/50 block">Released</span>
                    <span className="font-semibold text-white/90">
                      {currentTrack.album?.release_date || "2024"}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/50 block">Popularity</span>
                    <span className="font-semibold text-white/90">
                      {currentTrack.popularity || 85} / 100
                    </span>
                  </div>
                  <div>
                    <span className="text-white/50 block">Audio Engine</span>
                    <span className="font-semibold text-cyan-400">FLAC / Hi-Res</span>
                  </div>
                  <div>
                    <span className="text-white/50 block">Provider</span>
                    <span className="font-semibold text-white/90">Spotify Premium</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Full Controls */}
        <div className="w-full max-w-4xl mx-auto space-y-4 z-10">
          {/* Scrubber */}
          <div className="space-y-1.5">
            <div
              className="relative w-full h-2 bg-white/20 hover:h-3 rounded-full cursor-pointer transition-all group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                setProgressMs(Math.round(ratio * durationMs));
              }}
            >
              <div
                className="h-full bg-gradient-to-r from-violet-400 to-cyan-400 rounded-full group-hover:from-violet-300 group-hover:to-cyan-200 relative transition-all"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg" />
              </div>
            </div>
            <div className="flex justify-between text-xs font-mono text-white/60">
              <span>{formatDuration(progressMs)}</span>
              <span>{formatDuration(durationMs)}</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setIsLiked(!isLiked);
                addToast({ title: !isLiked ? "Saved to Liked Songs" : "Removed from Liked Songs", type: "success" });
              }}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Heart className={cn("w-5 h-5", isLiked ? "text-fuchsia-400 fill-fuchsia-400" : "text-white")} />
            </button>

            {/* Main playback row */}
            <div className="flex items-center gap-6">
              <button
                onClick={toggleShuffle}
                className={cn("p-2 transition-colors", shuffle ? "text-cyan-400" : "text-white/50 hover:text-white")}
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <button onClick={playPrevious} className="p-2 text-white/80 hover:text-white transition-colors">
                <SkipBack className="w-7 h-7" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
              </button>
              <button onClick={playNext} className="p-2 text-white/80 hover:text-white transition-colors">
                <SkipForward className="w-7 h-7" />
              </button>
              <button
                onClick={cycleRepeatMode}
                className={cn("p-2 transition-colors", repeatMode !== "off" ? "text-cyan-400" : "text-white/50 hover:text-white")}
              >
                {repeatMode === "track" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 h-1.5 bg-white/20 rounded-lg accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
