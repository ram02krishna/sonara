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
  Share2,
  Heart,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { cn, formatDuration } from "@/lib/utils";
import { useTrackLiked, friendlyError } from "@/hooks/useSonara";

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

  const { addToast, audioQuality, theme } = useAppStore();
  const isLight = theme === "light";
  const [showLyricsMode, setShowLyricsMode] = useState(false);
  const { liked: isLiked, toggle: toggleLike } = useTrackLiked(currentTrack);

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
        className={cn(
          "fixed inset-0 z-50 overflow-hidden flex flex-col justify-between p-6 md:p-10 select-none",
          isLight ? "text-slate-900 bg-[#f8fafc]" : "text-white bg-[#06070a]"
        )}
        style={{
          background: isLight
            ? `radial-gradient(circle at 50% 18%, ${extractedColors.glow.replace(/[\d.]+\)$/, "0.22)")} 0%, rgba(248, 250, 252, 0.96) 55%, #f1f5f9 100%)`
            : `radial-gradient(circle at 50% 15%, ${extractedColors.glow} 0%, rgba(6, 7, 10, 0.98) 55%, #050608 100%)`,
        }}
      >
        {/* Solid opaque background layer to guarantee 0% bleedthrough */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none -z-10",
            isLight ? "bg-[#f8fafc]" : "bg-[#06070a]"
          )}
        />

        {/* Top Bar */}
        <div className="flex items-center justify-between w-full max-w-5xl mx-auto z-10">
          <button
            onClick={() => setIsExpanded(false)}
            aria-label="Minimize player"
            className={cn(
              "p-2.5 rounded-full backdrop-blur-md transition-colors",
              isLight
                ? "bg-black/5 hover:bg-black/10 text-slate-800 border border-black/5"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
            )}
          >
            <ChevronDown className="w-6 h-6" />
          </button>

          <div className="flex flex-col items-center">
            <span
              className={cn(
                "text-[11px] uppercase tracking-widest font-semibold",
                isLight ? "text-slate-500" : "text-white/60"
              )}
            >
              Playing from Album
            </span>
            <span
              className={cn(
                "text-sm font-bold truncate max-w-xs md:max-w-md",
                isLight ? "text-slate-900" : "text-white/90"
              )}
            >
              {currentTrack.album?.name || "Single"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={cn(
                "hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border shadow-md backdrop-blur-md",
                isLight
                  ? "bg-white/90 border-slate-200 text-blue-600 shadow-slate-200/50"
                  : "bg-white/10 border-white/10 text-cyan-400"
              )}
            >
              <div className="flex items-end gap-0.5 h-3">
                <span
                  className={cn(
                    "w-0.5 rounded-full transition-all",
                    isLight ? "bg-blue-600" : "bg-cyan-400",
                    isPlaying ? "h-3 animate-pulse" : "h-1.5"
                  )}
                />
                <span
                  className={cn(
                    "w-0.5 rounded-full transition-all",
                    isLight ? "bg-blue-600" : "bg-cyan-400",
                    isPlaying ? "h-2 animate-pulse delay-75" : "h-1"
                  )}
                />
                <span
                  className={cn(
                    "w-0.5 rounded-full transition-all",
                    isLight ? "bg-blue-600" : "bg-cyan-400",
                    isPlaying ? "h-2.5 animate-pulse delay-150" : "h-2"
                  )}
                />
              </div>
              <span>
                {audioQuality === "lossless"
                  ? "Hi-Res Lossless 24-bit • Studio Master"
                  : audioQuality === "high"
                  ? "High Fidelity • 320 kbps"
                  : "Standard AAC • 160 kbps"}
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                addToast({ title: "Track link copied to clipboard", type: "success" });
              }}
              className={cn(
                "p-2.5 rounded-full transition-colors",
                isLight
                  ? "bg-black/5 hover:bg-black/10 text-slate-800 border border-black/5"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
              )}
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Main Stage (Art vs Lyrics) */}
        <div className="flex-1 max-w-5xl w-full mx-auto my-6 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-14 overflow-hidden z-10">
          {/* Artwork - Clean, full resolution, no ugly capsule dots */}
          <div
            className={cn(
              "relative group max-w-md w-full aspect-square rounded-3xl overflow-hidden",
              isLight
                ? "shadow-[0_24px_60px_rgba(0,0,0,0.18)] border border-black/10 bg-slate-200"
                : "shadow-[0_24px_60px_rgba(0,0,0,0.9)] border border-white/10 bg-black/40"
            )}
          >
            <img
              src={currentTrack.album?.images?.[0]?.url || ""}
              alt={currentTrack.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>

          {/* Right: Lyrics / Track Metadata */}
          <div className="flex-1 w-full max-w-md flex flex-col justify-center h-full max-h-[460px]">
            {/* Clean Segmented Tab Switcher */}
            <div
              className={cn(
                "flex items-center p-1 rounded-2xl border w-fit mb-4 backdrop-blur-md",
                isLight ? "bg-black/5 border-black/10" : "bg-white/10 border-white/10"
              )}
            >
              <button
                onClick={() => setShowLyricsMode(false)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  !showLyricsMode
                    ? isLight
                      ? "bg-white text-slate-900 shadow-sm font-bold"
                      : "bg-white text-black shadow-md font-bold"
                    : isLight
                    ? "text-slate-500 hover:text-slate-900"
                    : "text-white/60 hover:text-white"
                )}
              >
                About Track
              </button>
              <button
                onClick={() => setShowLyricsMode(true)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  showLyricsMode
                    ? isLight
                      ? "bg-white text-slate-900 shadow-sm font-bold"
                      : "bg-white text-black shadow-md font-bold"
                    : isLight
                    ? "text-slate-500 hover:text-slate-900"
                    : "text-white/60 hover:text-white"
                )}
              >
                <Mic2 className="w-3.5 h-3.5" />
                <span>Lyrics</span>
              </button>
            </div>

            {showLyricsMode ? (
              <div className="overflow-y-auto space-y-4 max-h-[360px] pr-2 scrollbar-none">
                {lyrics?.lines && lyrics.lines.length > 0 ? (
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
                            ? isLight
                              ? "text-slate-950 text-2xl font-extrabold scale-[1.03]"
                              : "text-white text-2xl font-bold scale-[1.03]"
                            : isLight
                            ? "text-slate-400 text-lg hover:text-slate-700"
                            : "text-white/30 text-lg hover:text-white/60"
                        )}
                      >
                        {l.words}
                      </p>
                    );
                  })
                ) : (
                  <p
                    className={cn(
                      "italic py-10",
                      isLight ? "text-slate-500" : "text-white/40"
                    )}
                  >
                    Synced lyrics will stream automatically when available.
                  </p>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "p-6 md:p-8 rounded-3xl space-y-4 backdrop-blur-xl border shadow-xl transition-all",
                  isLight
                    ? "bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-200/60"
                    : "bg-white/[0.07] border-white/10 text-white shadow-2xl"
                )}
              >
                <div>
                  <h1
                    className={cn(
                      "text-3xl font-extrabold tracking-tight mb-1",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    {currentTrack.name}
                  </h1>
                  <p
                    className={cn(
                      "text-lg font-medium",
                      isLight ? "text-blue-600" : "text-cyan-300"
                    )}
                  >
                    {currentTrack.artists?.map((a) => a.name).join(", ") || "Unknown Artist"}
                  </p>
                </div>

                <div
                  className={cn(
                    "grid grid-cols-2 gap-3 text-xs pt-3 border-t",
                    isLight ? "border-slate-200" : "border-white/10"
                  )}
                >
                  <div>
                    <span className={cn("block", isLight ? "text-slate-500" : "text-white/50")}>
                      Released
                    </span>
                    <span className={cn("font-semibold", isLight ? "text-slate-900" : "text-white/90")}>
                      {currentTrack.album?.release_date || "2026"}
                    </span>
                  </div>
                  <div>
                    <span className={cn("block", isLight ? "text-slate-500" : "text-white/50")}>
                      Popularity
                    </span>
                    <span className={cn("font-semibold", isLight ? "text-slate-900" : "text-white/90")}>
                      {currentTrack.popularity || 88} / 100
                    </span>
                  </div>
                  <div>
                    <span className={cn("block", isLight ? "text-slate-500" : "text-white/50")}>
                      Audio Engine
                    </span>
                    <span className={cn("font-semibold", isLight ? "text-blue-600" : "text-cyan-400")}>
                      {audioQuality === "lossless"
                        ? "FLAC / 24-bit Lossless"
                        : audioQuality === "high"
                        ? "High-Fi 320k"
                        : "AAC 160k"}
                    </span>
                  </div>
                  <div>
                    <span className={cn("block", isLight ? "text-slate-500" : "text-white/50")}>
                      Provider
                    </span>
                    <span className={cn("font-semibold", isLight ? "text-slate-900" : "text-white/90")}>
                      Sonara Studio Engine
                    </span>
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
              className={cn(
                "relative w-full h-2 hover:h-3 rounded-full cursor-pointer transition-all group",
                isLight ? "bg-slate-200" : "bg-white/20"
              )}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                setProgressMs(Math.round(ratio * durationMs));
              }}
            >
              <div
                className={cn(
                  "h-full rounded-full relative transition-all",
                  isLight
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                    : "bg-gradient-to-r from-violet-400 to-cyan-400"
                )}
                style={{ width: `${progressPercent}%` }}
              >
                <div
                  className={cn(
                    "absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-md",
                    isLight ? "bg-blue-600 ring-2 ring-white" : "bg-white shadow-lg"
                  )}
                />
              </div>
            </div>
            <div
              className={cn(
                "flex justify-between text-xs font-mono",
                isLight ? "text-slate-500" : "text-white/60"
              )}
            >
              <span>{formatDuration(progressMs)}</span>
              <span>{formatDuration(durationMs)}</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                const next = !isLiked;
                toggleLike.mutate(next, {
                  onSuccess: () =>
                    addToast({
                      title: next ? "Added to Liked Songs" : "Removed from Liked Songs",
                      type: "success",
                    }),
                  onError: (err) =>
                    addToast({
                      title: "Couldn't update Liked Songs",
                      description: friendlyError(err).detail,
                      type: "error",
                    }),
                });
              }}
              className={cn(
                "p-3 rounded-full transition-colors",
                isLight
                  ? "bg-black/5 hover:bg-black/10 border border-black/5 text-slate-700"
                  : "bg-white/10 hover:bg-white/20 border border-white/10 text-white"
              )}
            >
              <Heart
                className={cn(
                  "w-5 h-5 transition-transform",
                  isLiked
                    ? "text-fuchsia-600 fill-fuchsia-600 scale-110"
                    : isLight
                    ? "text-slate-700"
                    : "text-white"
                )}
              />
            </button>

            {/* Main playback row */}
            <div className="flex items-center gap-6">
              <button
                onClick={toggleShuffle}
                className={cn(
                  "p-2 transition-colors",
                  shuffle
                    ? isLight
                      ? "text-blue-600"
                      : "text-cyan-400"
                    : isLight
                    ? "text-slate-400 hover:text-slate-800"
                    : "text-white/50 hover:text-white"
                )}
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <button
                onClick={playPrevious}
                className={cn(
                  "p-2 transition-colors",
                  isLight ? "text-slate-700 hover:text-slate-900" : "text-white/80 hover:text-white"
                )}
              >
                <SkipBack className="w-7 h-7" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all",
                  isLight
                    ? "bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-500"
                    : "bg-white text-black shadow-white/10"
                )}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-1" />
                )}
              </button>
              <button
                onClick={playNext}
                className={cn(
                  "p-2 transition-colors",
                  isLight ? "text-slate-700 hover:text-slate-900" : "text-white/80 hover:text-white"
                )}
              >
                <SkipForward className="w-7 h-7" />
              </button>
              <button
                onClick={cycleRepeatMode}
                className={cn(
                  "p-2 transition-colors",
                  repeatMode !== "off"
                    ? isLight
                      ? "text-blue-600"
                      : "text-cyan-400"
                    : isLight
                    ? "text-slate-400 hover:text-slate-800"
                    : "text-white/50 hover:text-white"
                )}
              >
                {repeatMode === "track" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className={cn(
                  "transition-colors",
                  isLight ? "text-slate-500 hover:text-slate-800" : "text-white/60 hover:text-white"
                )}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className={cn(
                  "w-24 h-1.5 rounded-lg cursor-pointer",
                  isLight ? "bg-slate-200 accent-blue-600" : "bg-white/20 accent-cyan-400"
                )}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
