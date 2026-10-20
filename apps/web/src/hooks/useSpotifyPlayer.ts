/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { loadSpotifySdk, setSdkPlayer, getSdkPlayer } from "@/lib/spotify-sdk";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { Track } from "@/types/api";

/**
 * Boots the Spotify Web Playback SDK for logged-in users. Full-song playback
 * only works for Spotify Premium accounts; for everyone else the SDK reports an
 * account_error and the player falls back to 30s previews.
 */
export function useSpotifyPlayer(enabled: boolean) {
  useEffect(() => {
    if (!enabled || getSdkPlayer()) return;
    let cancelled = false;

    loadSpotifySdk()
      .then(() => {
        if (cancelled || !window.Spotify) return;
        const player = new window.Spotify.Player({
          name: "Sonara Web Player",
          volume: Math.max(0, Math.min(1, usePlayerStore.getState().volume / 100)),
          getOAuthToken: async (cb: (t: string) => void) => {
            try {
              const r = await apiFetch<{ access_token: string }>("/auth/token");
              cb(r.access_token);
            } catch {
              useAppStore.getState().addToast({ title: "Spotify session expired", description: "Log in again to play full songs.", type: "error" });
            }
          },
        });

        const store = usePlayerStore.getState;
        player.addListener("ready", ({ device_id }: { device_id: string }) => {
          usePlayerStore.getState().setDeviceId(device_id);
          usePlayerStore.getState().setIsPremiumRequired(false);
        });
        player.addListener("not_ready", () => usePlayerStore.getState().setDeviceId(null));
        player.addListener("account_error", () => {
          usePlayerStore.getState().setIsPremiumRequired(true);
          usePlayerStore.getState().setDeviceId(null);
          useAppStore.getState().addToast({
            title: "Spotify Premium required for full songs",
            description: "Playing 30-second previews instead.",
            type: "info",
          });
        });
        player.addListener("authentication_error", () =>
          useAppStore.getState().addToast({ title: "Spotify authentication failed", description: "Please log in again.", type: "error" })
        );
        player.addListener("initialization_error", () =>
          useAppStore.getState().addToast({ title: "This browser can't run the Spotify player", type: "error" })
        );
        player.addListener("player_state_changed", (state: any) => {
          if (!state) return;
          const s = store();
          s.setIsPlaying(!state.paused);
          s.setProgressMs(state.position);
          const cur = state.track_window?.current_track;
          // Track finished (SDK parks at 0:00, paused, with this track listed as previous): play our next queued track.
          if (
            cur &&
            state.paused &&
            state.position === 0 &&
            state.track_window?.previous_tracks?.some((t: any) => t.id === cur.id)
          ) {
            s.playNext();
            return;
          }
          if (cur && s.currentTrack?.id !== cur.id) {
            const mapped: Track = {
              id: cur.id,
              name: cur.name,
              uri: cur.uri,
              duration_ms: cur.duration_ms,
              artists: (cur.artists || []).map((a: any) => ({ id: a.uri?.split(":").pop() || a.name, name: a.name, uri: a.uri })),
              album: { id: cur.album?.uri?.split(":").pop() || "", name: cur.album?.name || "", images: cur.album?.images || [] },
            };
            usePlayerStore.setState({ currentTrack: mapped, durationMs: cur.duration_ms });
          }
        });

        setSdkPlayer(player);
        player.connect();
      })
      .catch(() => {
        // SDK blocked (ad blocker/offline): previews still work.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
