"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { json } from "@/lib/api-client";
import { fetchSimilar } from "@/lib/radio";
import { playback } from "@/lib/playback";
import { useAppConfig, useSession } from "@/hooks/useSonara";
import { useAppStore } from "@/store/useAppStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { Track, Video } from "@/types/api";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytLoader: Promise<void> | null = null;
function loadYouTube(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.YT?.Player) return Promise.resolve();
  if (ytLoader) return ytLoader;
  ytLoader = new Promise<void>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
      ytLoader = null;
      reject(new Error("YouTube player failed to load"));
    };
    document.body.appendChild(tag);
  });
  return ytLoader;
}

/**
 * The one place audio is produced.
 *  - preview: a real 30-second clip in an <audio> element (iTunes preview).
 *  - video:   a full song in YouTube's own VISIBLE embedded player (official Data
 *             API lookup, optional, enabled in Settings); never scraped or hidden.
 * It renders no UI itself.
 */
export function PlaybackEngine() {
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);
  const ytRef = useRef<any>(null);
  const pendingVideo = useRef<string | null>(null);
  const modeRef = useRef<"idle" | "preview" | "video">("idle");
  const recorded = useRef<string | null>(null);
  const warnedNoVideo = useRef(false);

  const { data: config } = useAppConfig();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.authenticated && !session?.guest;
  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;

  const settings = useAppStore((s) => s.settings);
  const addToast = useAppStore((s) => s.addToast);
  // Logged-in users ALWAYS play full songs (never preview).
  // Guests are restricted to 30s previews.
  const shouldPlayFullSong = isLoggedIn;

  const track = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const restartToken = usePlayerStore((s) => s.restartToken);
  const progressMs = usePlayerStore((s) => s.progressMs);
  const engine = usePlayerStore((s) => s.engine);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /* ---------------------------- track finished ---------------------------- */
  const handleEnded = useCallback(async () => {
    const st = usePlayerStore.getState();
    if (st.sleepAfterTrack) {
      st.setIsPlaying(false);
      st.setSleepTimer(null);
      addToast({ title: "Sleep timer", description: "Playback stopped. Good night.", type: "info" });
      return;
    }
    if (st.playNext()) return;
    if (settingsRef.current.autoplay && st.currentTrack) {
      const more = await fetchSimilar(st.currentTrack);
      if (more.length) {
        usePlayerStore.getState().setQueue(more.slice(1));
        void usePlayerStore.getState().setCurrentTrack(more[0]);
        return;
      }
    }
    usePlayerStore.getState().setIsPlaying(false);
  }, [addToast]);
  const endedRef = useRef(handleEnded);
  endedRef.current = handleEnded;

  /* ------------------------------ video engine ----------------------------- */
  const ensureYt = useCallback(async () => {
    await loadYouTube();
    if (ytRef.current) return ytRef.current;
    let host: HTMLElement | null = null;
    for (let i = 0; i < 30 && !host; i++) {
      host = document.getElementById("sonara-yt-host");
      if (!host) await new Promise((r) => setTimeout(r, 100));
    }
    if (!host) throw new Error("video host missing");
    host.innerHTML = "";
    const target = document.createElement("div");
    host.appendChild(target);
    ytRef.current = new window.YT.Player(target, {
      width: "100%",
      height: "100%",
      playerVars: { autoplay: 1, controls: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: (e: any) => {
          const v = usePlayerStore.getState();
          e.target.setVolume(v.isMuted ? 0 : v.volume);
          if (pendingVideo.current) {
            e.target.loadVideoById(pendingVideo.current);
            pendingVideo.current = null;
          }
        },
        onStateChange: (e: any) => {
          if (modeRef.current !== "video") return;
          if (e.data === 0) void endedRef.current();
          else if (e.data === 1) usePlayerStore.getState().setIsPlaying(true);
          else if (e.data === 2) usePlayerStore.getState().setIsPlaying(false);
        },
        onError: async (e: any) => {
          console.warn("YouTube player error:", e?.data);
          const t = usePlayerStore.getState().currentTrack;
          if (!t) return;

          // For logged-in users, NEVER downgrade to 30s preview.
          // Retry with an alternate audio query:
          if (isLoggedInRef.current) {
            try {
              const cleanArtist = (t.artists?.[0]?.name || "").split(/[,&/]/)[0].trim();
              const res = await fetch(`/api/stream?q=${encodeURIComponent(`${t.name} ${cleanArtist} lyrical audio`)}`);
              if (res.ok) {
                const data = await res.json();
                if (data.found && data.videoId && ytRef.current?.loadVideoById) {
                  ytRef.current.loadVideoById(data.videoId);
                  return;
                }
              }
            } catch {
              /* ignore fallback error */
            }
            addToast({ title: "Streaming issue", description: "This video has playback restrictions.", type: "error" });
            return;
          }

          // Guest users fallback to preview
          addToast({ title: "Playing preview", description: "Sign in to play complete full-length songs.", type: "info" });
          void startPreview(t);
        },
      },
    });
    return ytRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const destroyVideo = useCallback(() => {
    try {
      ytRef.current?.destroy?.();
    } catch {
      /* ignore */
    }
    ytRef.current = null;
    pendingVideo.current = null;
  }, []);

  const startVideo = async (videoId: string) => {
    audioRef.current?.pause();
    modeRef.current = "video";
    usePlayerStore.getState().setEngine("video");
    const yt = await ensureYt();
    if (yt.loadVideoById) yt.loadVideoById(videoId);
    else pendingVideo.current = videoId; // player still initialising: onReady will load it
  };

  /* ----------------------------- preview engine ---------------------------- */
  const startPreview = async (t: Track) => {
    try {
      ytRef.current?.pauseVideo?.();
    } catch {
      /* ignore */
    }
    const audio = audioRef.current;
    if (!audio) return;
    modeRef.current = "preview";
    let url = t.preview_url || null;
    if (!url) {
      try {
        const r = await apiFetch<{ preview_url?: string }>("/preview", { params: { name: t.name, artist: t.artists?.[0]?.name } });
        url = r.preview_url || null;
      } catch {
        url = null;
      }
    }
    if (usePlayerStore.getState().currentTrack?.id !== t.id) return; // user already moved on
    if (!url) {
      usePlayerStore.getState().setEngine("unavailable");
      usePlayerStore.getState().setIsPlaying(false);
      addToast({ title: "No audio available for this song", description: "No free preview was found for it.", type: "info" });
      return;
    }
    usePlayerStore.getState().setEngine("preview");
    audio.src = url;
    audio.playbackRate = settingsRef.current.playbackSpeed;
    audio.load();
    if (usePlayerStore.getState().isPlaying) audio.play().catch(() => usePlayerStore.getState().setIsPlaying(false));
  };

  // Pre-warm YouTube iframe API and player immediately on mount so songs start with zero delay
  useEffect(() => {
    if (shouldPlayFullSong) {
      void loadYouTube().then(() => {
        ensureYt().catch(() => {});
      });
    }
  }, [shouldPlayFullSong, ensureYt]);

  // Pre-fetch video ID for the upcoming track in the queue so next track transitions seamlessly
  const queue = usePlayerStore((s) => s.queue);
  useEffect(() => {
    if (!shouldPlayFullSong || !queue || queue.length === 0) return;
    const next = queue[0];
    if (!next?.id) return;
    void qc.prefetchQuery({
      queryKey: ["video", next.id],
      queryFn: () => apiFetch<Video>("/video", { params: { name: next.name, artist: next.artists?.[0]?.name } }),
      staleTime: 24 * 60 * 60_000,
    });
  }, [queue, shouldPlayFullSong, qc]);

  /* ------------------------ react to the current track --------------------- */
  useEffect(() => {
    if (!track) {
      audioRef.current?.pause();
      try {
        ytRef.current?.stopVideo?.();
      } catch {
        /* ignore */
      }
      modeRef.current = "idle";
      usePlayerStore.getState().setEngine("idle");
      return;
    }
    let cancelled = false;
    recorded.current = null;
    usePlayerStore.getState().setEngine("idle");

    (async () => {
      if (shouldPlayFullSong) {
        let videoId: string | null = null;
        if (config?.video_enabled !== false) {
          try {
            const v = await qc.fetchQuery({
              queryKey: ["video", track.id],
              queryFn: () => apiFetch<Video>("/video", { params: { name: track.name, artist: track.artists?.[0]?.name } }),
              staleTime: 24 * 60 * 60_000,
            });
            videoId = v?.video_id || null;
          } catch {
            /* try stream fallback */
          }
        }

        if (!videoId) {
          try {
            const res = await fetch(`/api/stream?name=${encodeURIComponent(track.name)}&artist=${encodeURIComponent(track.artists?.[0]?.name || "")}`);
            if (res.ok) {
              const data = await res.json();
              if (data.found && data.videoId) {
                videoId = data.videoId;
              }
            }
          } catch {
            /* ignore fallback error */
          }
        }

        if (!videoId) {
          try {
            const cleanArtist = (track.artists?.[0]?.name || "").split(/[,&/]/)[0].trim();
            const res = await fetch(`/api/stream?q=${encodeURIComponent(`${track.name} ${cleanArtist} official audio`)}`);
            if (res.ok) {
              const data = await res.json();
              if (data.found && data.videoId) {
                videoId = data.videoId;
              }
            }
          } catch {
            /* ignore */
          }
        }

        if (cancelled) return;
        if (videoId) {
          await startVideo(videoId);
          return;
        }

        addToast({ title: "Streaming issue", description: "Could not find a full stream for this track.", type: "error" });
        return;
      }

      // Guest users: play 30s preview
      if (!cancelled) await startPreview(track);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, shouldPlayFullSong]);

  // Leaving full song mode removes the video player
  useEffect(() => {
    if (!shouldPlayFullSong) destroyVideo();
  }, [shouldPlayFullSong, destroyVideo]);

  /* ---------------------------- play / pause / seek ------------------------ */
  useEffect(() => {
    if (modeRef.current === "video") {
      try {
        isPlaying ? ytRef.current?.playVideo?.() : ytRef.current?.pauseVideo?.();
      } catch {
        /* player not ready yet */
      }
    } else if (modeRef.current === "preview" && audioRef.current?.src) {
      if (isPlaying) audioRef.current.play().catch(() => usePlayerStore.getState().setIsPlaying(false));
      else audioRef.current.pause();
    }
  }, [isPlaying, engine]);

  useEffect(() => {
    const v = isMuted ? 0 : volume;
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, v / 100));
    try {
      ytRef.current?.setVolume?.(v);
    } catch {
      /* ignore */
    }
  }, [volume, isMuted, engine]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = settings.playbackSpeed;
  }, [settings.playbackSpeed, engine]);

  useEffect(() => {
    if (restartToken === 0) return;
    if (modeRef.current === "video") ytRef.current?.seekTo?.(0, true);
    else if (audioRef.current) {
      audioRef.current.currentTime = 0;
      if (usePlayerStore.getState().isPlaying) audioRef.current.play().catch(() => undefined);
    }
  }, [restartToken]);

  useEffect(() => {
    playback.register({
      seek: (ms) => {
        if (modeRef.current === "video") ytRef.current?.seekTo?.(ms / 1000, true);
        else if (audioRef.current) audioRef.current.currentTime = ms / 1000;
        usePlayerStore.getState().setProgressMs(ms);
      },
      destroyVideo,
    });
  }, [destroyVideo]);

  // Video progress: YouTube doesn't emit time updates, so poll while playing.
  useEffect(() => {
    if (engine !== "video") return;
    const id = setInterval(() => {
      try {
        const yt = ytRef.current;
        if (!yt?.getCurrentTime) return;
        usePlayerStore.getState().setProgressMs(Math.round(yt.getCurrentTime() * 1000));
        const d = yt.getDuration?.();
        if (d > 0) usePlayerStore.setState({ durationMs: Math.round(d * 1000) });
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearInterval(id);
  }, [engine]);

  /* ------------------------------ sleep timer ----------------------------- */
  useEffect(() => {
    const id = setInterval(() => {
      const st = usePlayerStore.getState();
      if (st.sleepTimerEndsAt && !st.sleepAfterTrack && Date.now() >= st.sleepTimerEndsAt) {
        st.setIsPlaying(false);
        st.setSleepTimer(null);
        addToast({ title: "Sleep timer", description: "Playback stopped. Good night.", type: "info" });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [addToast]);

  /* ------------------- count a play after 15 seconds of listening --------- */
  useEffect(() => {
    if (!track || !isPlaying || progressMs < 15000 || recorded.current === track.id) return;
    recorded.current = track.id;
    const full = track.duration_ms || 30000;
    apiFetch<void>("/history", {
      method: "POST",
      ...json({ track, listened_ms: engine === "video" ? full : Math.min(full, 30000), source: engine === "video" ? "video" : "preview" }),
    })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["recent"] });
      })
      .catch(() => undefined);
  }, [progressMs, isPlaying, track, engine, qc]);

  /* ----------------------- media keys & lock-screen controls --------------- */
  useEffect(() => {
    if (!track || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.artists?.map((a) => a.name).join(", "),
      album: track.album?.name,
      artwork: (track.album?.images ?? []).slice(0, 1).map((i) => ({ src: i.url, sizes: "512x512" })),
    });
    const st = usePlayerStore.getState;
    navigator.mediaSession.setActionHandler("play", () => st().setIsPlaying(true));
    navigator.mediaSession.setActionHandler("pause", () => st().setIsPlaying(false));
    navigator.mediaSession.setActionHandler("nexttrack", () => void endedRef.current());
    navigator.mediaSession.setActionHandler("previoustrack", () => st().playPrevious());
  }, [track]);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      onTimeUpdate={(e) => {
        if (modeRef.current === "preview") usePlayerStore.getState().setProgressMs(Math.round(e.currentTarget.currentTime * 1000));
      }}
      onLoadedMetadata={(e) => {
        // A preview is a ~30s clip: show ITS length so the progress bar is honest.
        const d = e.currentTarget.duration;
        if (modeRef.current === "preview" && Number.isFinite(d) && d > 0) usePlayerStore.setState({ durationMs: Math.round(d * 1000) });
      }}
      onEnded={() => void endedRef.current()}
      onError={() => {
        if (modeRef.current === "preview" && audioRef.current?.src) {
          addToast({ title: "Couldn't play this preview", type: "error" });
          usePlayerStore.getState().setIsPlaying(false);
        }
      }}
    />
  );
}
