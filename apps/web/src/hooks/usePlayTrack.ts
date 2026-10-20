"use client";

import { useCallback } from "react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { Track } from "@/types/api";

/**
 * Play a track and queue the rest of the list it came from, like Spotify/Apple Music.
 * Clicking the track that's already playing toggles pause.
 */
export function usePlayTrack() {
  const { currentTrack, isPlaying, setIsPlaying, setCurrentTrack, setQueue } = usePlayerStore();

  return useCallback(
    (track: Track, context?: Track[]) => {
      if (currentTrack?.id === track.id) {
        setIsPlaying(!isPlaying);
        return;
      }
      if (context?.length) {
        const idx = context.findIndex((t) => t.id === track.id);
        setQueue(idx >= 0 ? context.slice(idx + 1) : []);
      }
      void setCurrentTrack(track);
    },
    [currentTrack?.id, isPlaying, setIsPlaying, setCurrentTrack, setQueue]
  );
}
