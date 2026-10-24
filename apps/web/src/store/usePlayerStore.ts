import { create } from "zustand";
import { Track, Lyrics } from "@/types/api";
import { extractDominantColor, ExtractedColors } from "@/lib/color-extractor";

export type RightPanelTab = "queue" | "lyrics" | "artist" | null;
export type RepeatMode = "off" | "track" | "context";
export type Engine = "idle" | "preview" | "video" | "unavailable";

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  volume: number;
  isMuted: boolean;
  previousVolume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  queue: Track[]; // up next
  context: Track[]; // the list currently being played (for repeat-all)
  history: Track[];
  restartToken: number; // bumped to make the engine restart the current track
  engine: Engine; // what is actually producing sound right now
  setEngine: (e: Engine) => void;

  isExpanded: boolean;
  rightPanelTab: RightPanelTab;
  extractedColors: ExtractedColors;
  lyrics: Lyrics | null;
  isLoadingLyrics: boolean;
  sleepTimerEndsAt: number | null; // epoch ms
  sleepAfterTrack: boolean;

  setCurrentTrack: (track: Track | null) => Promise<void>;
  playList: (tracks: Track[], startIndex?: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setProgressMs: (progress: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setQueue: (tracks: Track[]) => void;
  addToQueue: (track: Track) => void;
  playNextInQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  playNext: () => boolean;
  playPrevious: () => void;
  setIsExpanded: (expanded: boolean) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleRightPanelTab: (tab: RightPanelTab) => void;
  setLyrics: (lyrics: Lyrics | null) => void;
  setLoadingLyrics: (loading: boolean) => void;
  setSleepTimer: (minutes: number | null, afterTrack?: boolean) => void;
}

const shuffled = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  progressMs: 0,
  durationMs: 0,
  volume: 75,
  isMuted: false,
  previousVolume: 75,
  shuffle: false,
  repeatMode: "off",
  queue: [],
  context: [],
  history: [],
  restartToken: 0,
  engine: "idle",
  setEngine: (engine) => set({ engine }),

  isExpanded: false,
  rightPanelTab: null,
  extractedColors: { primary: "#8b5cf6", glow: "rgba(139, 92, 246, 0.4)", secondary: "#06b6d4" },
  lyrics: null,
  isLoadingLyrics: false,
  sleepTimerEndsAt: null,
  sleepAfterTrack: false,

  setCurrentTrack: async (track) => {
    if (!track) {
      set({ currentTrack: null, durationMs: 0, progressMs: 0, isPlaying: false });
      return;
    }
    set({ currentTrack: track, durationMs: track.duration_ms || 30000, progressMs: 0, isPlaying: true, lyrics: null });
    const art = track.album?.images?.[0]?.url;
    if (art) {
      const colors = await extractDominantColor(art);
      if (get().currentTrack?.id !== track.id) return; // a newer track started meanwhile
      set({ extractedColors: colors });
      if (typeof document !== "undefined") {
        document.documentElement.style.setProperty("--dynamic-accent", colors.primary);
        document.documentElement.style.setProperty("--dynamic-accent-soft", colors.glow);
      }
    }
  },

  // Play a list from an index; the rest becomes "up next" (shuffled when shuffle is on).
  playList: (tracks, startIndex = 0) => {
    if (!tracks.length) return;
    const idx = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    const { shuffle, currentTrack, history } = get();
    const rest = tracks.filter((_, i) => i !== idx);
    const after = shuffle ? shuffled(rest) : [...tracks.slice(idx + 1)];
    set({
      context: tracks,
      queue: after,
      history: currentTrack ? [currentTrack, ...history].slice(0, 50) : history,
    });
    void get().setCurrentTrack(tracks[idx]);
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setProgressMs: (progressMs) => set({ progressMs }),
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),

  toggleMute: () => {
    const { isMuted, volume, previousVolume } = get();
    if (isMuted) set({ isMuted: false, volume: previousVolume || 75 });
    else set({ isMuted: true, previousVolume: volume, volume: 0 });
  },

  toggleShuffle: () => {
    const { shuffle, queue } = get();
    set({ shuffle: !shuffle, queue: !shuffle ? shuffled(queue) : queue });
  },

  cycleRepeatMode: () => {
    const modes: RepeatMode[] = ["off", "context", "track"];
    set({ repeatMode: modes[(modes.indexOf(get().repeatMode) + 1) % modes.length] });
  },

  setQueue: (queue) => set({ queue }),
  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),
  playNextInQueue: (track) => set((s) => ({ queue: [track, ...s.queue] })),
  removeFromQueue: (index) => set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
  clearQueue: () => set({ queue: [] }),
  reorderQueue: (from, to) =>
    set((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.queue.length || to >= s.queue.length) return s;
      const q = [...s.queue];
      const [moved] = q.splice(from, 1);
      q.splice(to, 0, moved);
      return { queue: q };
    }),

  // Returns false when there was nothing to play next (the engine may then autoplay similar music).
  playNext: () => {
    const { queue, currentTrack, history, repeatMode, context } = get();
    if (repeatMode === "track" && currentTrack) {
      set((s) => ({ restartToken: s.restartToken + 1, progressMs: 0, isPlaying: true }));
      return true;
    }
    let upcoming = queue;
    if (upcoming.length === 0 && repeatMode === "context" && context.length > 0) {
      upcoming = context.filter((t) => t.id !== currentTrack?.id);
      if (upcoming.length === 0) upcoming = context;
    }
    if (upcoming.length === 0) return false;
    const next = upcoming[0];
    set({
      queue: upcoming.slice(1),
      history: currentTrack ? [currentTrack, ...history].slice(0, 50) : history,
    });
    void get().setCurrentTrack(next);
    return true;
  },

  playPrevious: () => {
    const { history, currentTrack, queue, progressMs } = get();
    if (progressMs > 3000 || history.length === 0) {
      set((s) => ({ progressMs: 0, restartToken: s.restartToken + 1 }));
      return;
    }
    const [prev, ...rest] = history;
    set({ queue: currentTrack ? [currentTrack, ...queue] : queue, history: rest });
    void get().setCurrentTrack(prev);
  },

  setIsExpanded: (isExpanded) => set({ isExpanded }),
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
  toggleRightPanelTab: (tab) => set({ rightPanelTab: get().rightPanelTab === tab ? null : tab }),
  setLyrics: (lyrics) => set({ lyrics }),
  setLoadingLyrics: (isLoadingLyrics) => set({ isLoadingLyrics }),
  setSleepTimer: (minutes, afterTrack = false) =>
    set({ sleepTimerEndsAt: minutes ? Date.now() + minutes * 60_000 : null, sleepAfterTrack: afterTrack }),
}));
