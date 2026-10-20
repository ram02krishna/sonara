"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Heart,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { cn, formatDuration } from "@/lib/utils";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useTrackLiked, friendlyError } from "@/hooks/useSonara";
import { getSdkPlayer } from "@/lib/spotify-sdk";

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

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
    isExpanded,
    setIsExpanded,
    rightPanelTab,
    toggleRightPanelTab,
    isPremiumRequired,
    deviceId,
  } = usePlayerStore();

  const { addToast, audioQuality } = useAppStore();
  const { liked: isLiked, toggle: toggleLike } = useTrackLiked(currentTrack);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const isYtReadyRef = useRef<boolean>(false);
  const pendingVideoIdRef = useRef<string | null>(null);
  const recordedPlayRef = useRef<string | null>(null);
  const activeEngineRef = useRef<"sdk" | "youtube" | "preview">("youtube");
  const [isFullTrackMode, setIsFullTrackMode] = useState<boolean>(true);

  const sdkMode = !!deviceId && !isPremiumRequired;

  // Initialize YouTube Iframe API for full song audio streaming
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initYt = () => {
      if (!window.YT || !window.YT.Player || ytPlayerRef.current) return;
      try {
        ytPlayerRef.current = new window.YT.Player("sonara-yt-player-target", {
          height: "1",
          width: "1",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event: any) => {
              isYtReadyRef.current = true;
              const v = isMuted ? 0 : volume;
              try {
                event.target.setVolume(v);
                const iframe = event.target.getIframe?.();
                if (iframe) {
                  iframe.setAttribute("allow", "autoplay; encrypted-media");
                }
                if (pendingVideoIdRef.current) {
                  const vid = pendingVideoIdRef.current;
                  pendingVideoIdRef.current = null;
                  event.target.loadVideoById({ videoId: vid });
                  event.target.playVideo?.();
                  setIsPlaying(true);
                }
              } catch {
                // ignore
              }
            },
            onStateChange: (event: any) => {
              // 0 = ENDED
              if (event.data === 0) {
                playNext();
              }
              // 1 = PLAYING
              if (event.data === 1) {
                setIsPlaying(true);
              }
              // 2 = PAUSED
              if (event.data === 2) {
                setIsPlaying(false);
              }
            },
            onError: () => {
              // If YouTube blocked this specific video, switch to audio preview
              activeEngineRef.current = "preview";
              setIsFullTrackMode(false);
              if (audioRef.current && currentTrack?.preview_url) {
                audioRef.current.src = currentTrack.preview_url;
                audioRef.current.play().catch(() => undefined);
              }
            },
          },
        });
      } catch {
        // Fallback to HTML5 audio preview
      }
    };

    if (!window.YT) {
      const existingScript = document.getElementById("yt-iframe-api");
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        window.onYouTubeIframeAPIReady = initYt;
        document.body.appendChild(tag);
      }
    } else {
      initYt();
    }
  }, [isMuted, volume, playNext, setIsPlaying, currentTrack?.preview_url]);

  // Load and play track whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;

    // Reset progress and set default track duration
    setProgressMs(0);
    recordedPlayRef.current = null;
    if (currentTrack.duration_ms) {
      usePlayerStore.setState({ durationMs: currentTrack.duration_ms });
    }

    // 1. If Spotify SDK mode is active
    if (sdkMode) {
      activeEngineRef.current = "sdk";
      (async () => {
        try {
          await apiFetch<void>("/me/player/play", {
            method: "PUT",
            params: { device_id: deviceId || undefined },
            body: JSON.stringify({ uris: [currentTrack.uri] }),
          });
        } catch {
          if (cancelled) return;
          activeEngineRef.current = "youtube";
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // 2. Full-Song Open Stream Resolver
    (async () => {
      try {
        const res = await fetch(
          `/api/stream?name=${encodeURIComponent(currentTrack.name)}&artist=${encodeURIComponent(
            currentTrack.artists?.[0]?.name || ""
          )}&quality=${audioQuality}`
        );
        const data = await res.json();

        if (cancelled) return;

        if (data.found && data.videoId) {
          activeEngineRef.current = "youtube";
          setIsFullTrackMode(true);
          audioRef.current?.pause();

          const startYt = (vid: string) => {
            if (ytPlayerRef.current?.loadVideoById && isYtReadyRef.current) {
              try {
                ytPlayerRef.current.loadVideoById({ videoId: vid });
                const v = isMuted ? 0 : volume;
                ytPlayerRef.current.setVolume?.(v);
                const q = audioQuality === "lossless" ? "highres" : audioQuality === "high" ? "hd1080" : "medium";
                ytPlayerRef.current.setPlaybackQuality?.(q);
                ytPlayerRef.current.playVideo?.();
                setIsPlaying(true);
                return true;
              } catch {
                return false;
              }
            }
            return false;
          };

          if (!startYt(data.videoId)) {
            pendingVideoIdRef.current = data.videoId;
            const checkYt = setInterval(() => {
              if (startYt(data.videoId) || cancelled) clearInterval(checkYt);
            }, 80);
            setTimeout(() => clearInterval(checkYt), 4000);
          }
          return;
        }
      } catch {
        // Fallback to preview
      }

      // 3. Fallback to 30s audio preview
      activeEngineRef.current = "preview";
      setIsFullTrackMode(false);
      let previewUrl = currentTrack.preview_url || null;
      if (!previewUrl) {
        try {
          const r = await apiFetch<{ preview_url?: string }>("/preview", {
            params: { name: currentTrack.name, artist: currentTrack.artists?.[0]?.name },
          });
          previewUrl = r.preview_url || null;
        } catch {
          previewUrl = null;
        }
      }

      if (cancelled) return;

      if (previewUrl && audioRef.current) {
        audioRef.current.src = previewUrl;
        audioRef.current.load();
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        setIsPlaying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, sdkMode, deviceId]);

  // Sync YouTube progress head every 300ms
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (activeEngineRef.current === "youtube" && ytPlayerRef.current?.getCurrentTime) {
        try {
          const currSec = ytPlayerRef.current.getCurrentTime();
          const durSec = ytPlayerRef.current.getDuration();
          if (typeof currSec === "number" && isFinite(currSec)) {
            const currentMs = Math.round(currSec * 1000);
            setProgressMs(currentMs);

            // Automatically record genuine listening history to power live analytics
            if (currentMs >= 12000 && currentTrack && recordedPlayRef.current !== currentTrack.id) {
              recordedPlayRef.current = currentTrack.id;
              apiFetch("/history", {
                method: "POST",
                body: JSON.stringify({
                  track: currentTrack,
                  listened_ms: currentMs,
                  source: "stream",
                }),
              }).catch(() => undefined);
            }
          }
          if (typeof durSec === "number" && durSec > 0 && isFinite(durSec)) {
            const durMs = Math.round(durSec * 1000);
            if (Math.abs(durationMs - durMs) > 2000) {
              usePlayerStore.setState({ durationMs: durMs });
            }
          }
        } catch {
          // ignore transient poll error
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [isPlaying, durationMs, setProgressMs]);

  // Play / Pause control
  useEffect(() => {
    if (activeEngineRef.current === "youtube" && ytPlayerRef.current) {
      try {
        if (isPlaying) {
          ytPlayerRef.current.playVideo();
        } else {
          ytPlayerRef.current.pauseVideo();
        }
      } catch {
        // ignore
      }
    } else if (activeEngineRef.current === "preview" && audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, setIsPlaying]);

  // Volume control
  useEffect(() => {
    const v = isMuted ? 0 : Math.max(0, Math.min(100, volume));
    if (ytPlayerRef.current?.setVolume) {
      try {
        ytPlayerRef.current.setVolume(v);
      } catch {
        // ignore
      }
    }
    if (audioRef.current) {
      audioRef.current.volume = v / 100;
    }
    if (sdkMode) {
      getSdkPlayer()?.setVolume(v / 100);
    }
  }, [volume, isMuted, sdkMode]);

  const handleTogglePlay = () => {
    if (!currentTrack) return;

    if (activeEngineRef.current === "youtube" && ytPlayerRef.current) {
      try {
        const state = ytPlayerRef.current.getPlayerState?.();
        // 1 = PLAYING, 3 = BUFFERING
        if (state === 1 || state === 3) {
          ytPlayerRef.current.pauseVideo?.();
          setIsPlaying(false);
          return;
        } else if (state === 2 || state === -1 || state === 0 || state === 5) {
          ytPlayerRef.current.playVideo?.();
          setIsPlaying(true);
          return;
        }
      } catch {
        // fallback
      }
    } else if (activeEngineRef.current === "preview" && audioRef.current) {
      if (!audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
      return;
    }

    setIsPlaying(!isPlaying);
  };

  const handleToggleLike = () => {
    if (!currentTrack) return;
    const next = !isLiked;
    toggleLike.mutate(next, {
      onSuccess: () => addToast({ title: next ? "Added to Liked Songs" : "Removed from Liked Songs", type: "success" }),
      onError: (err) => addToast({ title: "Couldn't update Liked Songs", description: friendlyError(err).detail, type: "error" }),
    });
  };

  const handleSeek = (newTimeMs: number) => {
    setProgressMs(newTimeMs);
    if (activeEngineRef.current === "youtube" && ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(newTimeMs / 1000, true);
    } else if (activeEngineRef.current === "preview" && audioRef.current) {
      audioRef.current.currentTime = newTimeMs / 1000;
    } else if (sdkMode) {
      getSdkPlayer()?.seek(newTimeMs);
    }
  };

  const progressPercent = durationMs > 0 ? (progressMs / durationMs) * 100 : 0;

  return (
    <>
      {/* Invisible YouTube Player container for full audio stream - ALWAYS MOUNTED */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          width: "1px",
          height: "1px",
          opacity: 0.001,
          pointerEvents: "none",
          zIndex: -999,
        }}
        aria-hidden="true"
      >
        <div id="sonara-yt-player-target" />
      </div>

      {/* Fallback HTML5 Audio Element for previews - ALWAYS MOUNTED */}
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={() => {
          if (activeEngineRef.current === "preview" && audioRef.current && isFinite(audioRef.current.currentTime)) {
            setProgressMs(Math.round(audioRef.current.currentTime * 1000));
          }
        }}
        onLoadedMetadata={() => {
          if (activeEngineRef.current === "preview" && audioRef.current?.duration && isFinite(audioRef.current.duration)) {
            usePlayerStore.setState({ durationMs: Math.round(audioRef.current.duration * 1000) });
          }
        }}
        onEnded={() => {
          if (activeEngineRef.current === "preview") {
            playNext();
          }
        }}
      />

      {currentTrack && !isExpanded && (
        <footer className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-3 pt-1 pointer-events-none">
      <div className="max-w-7xl mx-auto pointer-events-auto">
        <div className="glass-panel border border-foreground/10 rounded-2xl md:rounded-3xl p-3 md:px-5 md:py-3 shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-4">
          
          {/* Left: Track Information & Artwork */}
          <div className="flex items-center gap-3.5 min-w-0 max-w-[240px] md:max-w-[300px]">
            <div
              className="relative w-12 h-12 md:w-14 md:h-14 rounded-xl overflow-hidden shrink-0 shadow-lg cursor-pointer group"
              onClick={() => setIsExpanded(true)}
            >
              <img
                src={currentTrack.album?.images?.[0]?.url || ""}
                alt={currentTrack.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Maximize2 className="w-4 h-4 text-foreground" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p
                onClick={() => setIsExpanded(true)}
                className="text-sm font-semibold text-foreground truncate cursor-pointer hover:underline"
              >
                {currentTrack.name}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground truncate hover:text-foreground cursor-pointer transition-colors">
                  {currentTrack.artists?.map((a) => a.name).join(", ")}
                </p>
                {isFullTrackMode && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-md font-semibold border shrink-0",
                    audioQuality === "lossless"
                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                      : audioQuality === "high"
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  )}>
                    {audioQuality === "lossless" ? "Hi-Res Lossless" : audioQuality === "high" ? "High-Fi 320k" : "Standard AAC"}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleToggleLike}
              aria-label="Like track"
              className="p-1.5 rounded-full hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Heart
                className={cn(
                  "w-4 h-4 transition-all",
                  isLiked ? "text-fuchsia-600 dark:text-fuchsia-400 fill-fuchsia-400 scale-110" : "text-muted-foreground"
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
                  shuffle ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                onClick={playPrevious}
                aria-label="Previous track"
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={handleTogglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <button
                onClick={playNext}
                aria-label="Next track"
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>

              <button
                onClick={cycleRepeatMode}
                aria-label="Repeat mode"
                className={cn(
                  "hidden sm:block p-1.5 rounded-lg transition-colors",
                  repeatMode !== "off" ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground hover:text-foreground"
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
                className="relative flex-1 h-1.5 bg-foreground/10 hover:h-2 rounded-full cursor-pointer transition-all group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  handleSeek(Math.round(ratio * durationMs));
                }}
              >
                <div
                  className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-violet-500 via-cyan-400 to-teal-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `calc(${progressPercent}% - 6px)` }}
                />
              </div>

              <span className="text-[11px] font-mono text-muted-foreground w-9 text-left shrink-0">
                {formatDuration(durationMs)}
              </span>
            </div>
          </div>

          {/* Right: Actions & Volume */}
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => toggleRightPanelTab("lyrics")}
              aria-label="Lyrics"
              className={cn(
                "p-2 rounded-xl transition-colors",
                rightPanelTab === "lyrics"
                  ? "bg-foreground/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Mic2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => toggleRightPanelTab("queue")}
              aria-label="Queue"
              className={cn(
                "p-2 rounded-xl transition-colors",
                rightPanelTab === "queue"
                  ? "bg-foreground/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListMusic className="w-4 h-4" />
            </button>

            {/* Volume slider */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={toggleMute}
                aria-label="Mute / Unmute"
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-20 h-1 bg-foreground/20 rounded-lg accent-cyan-400 cursor-pointer"
              />
            </div>

            <button
              onClick={() => setIsExpanded(true)}
              aria-label="Expand player"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  )}
</>
);
}
