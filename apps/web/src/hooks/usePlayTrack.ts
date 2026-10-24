"use client";

import { useCallback } from "react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { Track } from "@/types/api";

/**
 * Play a track within the list it came from (the rest becomes "up next").
 * Clicking the track that's already playing toggles pause.
 */
export function usePlayTrack() {
  return useCallback((track: Track, context?: Track[]) => {
    const s = usePlayerStore.getState();
    if (s.currentTrack?.id === track.id) {
      s.setIsPlaying(!s.isPlaying);
      return;
    }
    if (context?.length) {
      const idx = context.findIndex((t) => t.id === track.id);
      s.playList(context, idx >= 0 ? idx : 0);
    } else {
      void s.setCurrentTrack(track);
    }
  }, []);
}
