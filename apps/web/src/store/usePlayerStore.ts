import { create } from "zustand";
import { Track, Device, Lyrics } from "@/types/api";
import { extractDominantColor, ExtractedColors } from "@/lib/color-extractor";

export type RightPanelTab = "queue" | "lyrics" | "artist" | null;

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  volume: number;
  isMuted: boolean;
  previousVolume: number;
  shuffle: boolean;
  repeatMode: "off" | "track" | "context";
  queue: Track[];
  history: Track[];
  
  // UI & Panels
  isExpanded: boolean;
  rightPanelTab: RightPanelTab;
  extractedColors: ExtractedColors;
  lyrics: Lyrics | null;
  isLoadingLyrics: boolean;
  
  // Devices & SDK
  activeDevice: Device | null;
  devices: Device[];
  deviceId: string | null;
  isPremiumRequired: boolean;
  
  // Actions
  setCurrentTrack: (track: Track | null) => Promise<void>;
  setIsPlaying: (playing: boolean) => void;
  setProgressMs: (progress: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setQueue: (tracks: Track[]) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  setIsExpanded: (expanded: boolean) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleRightPanelTab: (tab: RightPanelTab) => void;
  setLyrics: (lyrics: Lyrics | null) => void;
  setLoadingLyrics: (loading: boolean) => void;
  setActiveDevice: (device: Device | null) => void;
  setDevices: (devices: Device[]) => void;
  setDeviceId: (id: string | null) => void;
  setIsPremiumRequired: (required: boolean) => void;
}

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
  history: [],
  
  isExpanded: false,
  rightPanelTab: null,
  extractedColors: {
    primary: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.4)",
    secondary: "#06b6d4",
  },
  lyrics: null,
  isLoadingLyrics: false,
  
  activeDevice: null,
  devices: [],
  deviceId: null,
  isPremiumRequired: false,

  setCurrentTrack: async (track) => {
    if (!track) {
      set({ currentTrack: null, durationMs: 0, progressMs: 0 });
      return;
    }

    set({
      currentTrack: track,
      durationMs: track.duration_ms || 210000,
      progressMs: 0,
      isPlaying: true,
    });

    const albumImage = track.album?.images?.[0]?.url;
    if (albumImage) {
      const colors = await extractDominantColor(albumImage);
      set({ extractedColors: colors });
      // Apply CSS variable to root for theme glow
      if (typeof document !== "undefined") {
        document.documentElement.style.setProperty("--dynamic-accent", colors.primary);
        document.documentElement.style.setProperty("--dynamic-accent-soft", colors.glow);
      }
    }
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setProgressMs: (progressMs) => set({ progressMs }),
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),

  toggleMute: () => {
    const { isMuted, volume, previousVolume } = get();
    if (isMuted) {
      set({ isMuted: false, volume: previousVolume || 75 });
    } else {
      set({ isMuted: true, previousVolume: volume, volume: 0 });
    }
  },

  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

  cycleRepeatMode: () => {
    const modes: ("off" | "context" | "track")[] = ["off", "context", "track"];
    const current = get().repeatMode;
    const nextIndex = (modes.indexOf(current) + 1) % modes.length;
    set({ repeatMode: modes[nextIndex] });
  },

  setQueue: (tracks) => set({ queue: tracks }),
  addToQueue: (track) => set((state) => ({ queue: [...state.queue, track] })),
  removeFromQueue: (index) =>
    set((state) => ({
      queue: state.queue.filter((_, i) => i !== index),
    })),

  playNext: () => {
    const { queue, currentTrack, history } = get();
    if (queue.length === 0) return;
    const nextTrack = queue[0];
    const newQueue = queue.slice(1);
    if (currentTrack) {
      set({ history: [currentTrack, ...history] });
    }
    get().setCurrentTrack(nextTrack);
    set({ queue: newQueue });
  },

  playPrevious: () => {
    const { history, currentTrack, queue, progressMs } = get();
    // If more than 3 seconds in, restart track
    if (progressMs > 3000 || history.length === 0) {
      set({ progressMs: 0 });
      return;
    }
    const prevTrack = history[0];
    const newHistory = history.slice(1);
    if (currentTrack) {
      set({ queue: [currentTrack, ...queue] });
    }
    get().setCurrentTrack(prevTrack);
    set({ history: newHistory });
  },

  setIsExpanded: (isExpanded) => set({ isExpanded }),
  
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  
  toggleRightPanelTab: (tab) => {
    const current = get().rightPanelTab;
    set({ rightPanelTab: current === tab ? null : tab });
  },

  setLyrics: (lyrics) => set({ lyrics }),
  setLoadingLyrics: (isLoadingLyrics) => set({ isLoadingLyrics }),
  setActiveDevice: (activeDevice) => set({ activeDevice }),
  setDevices: (devices) => set({ devices }),
  setDeviceId: (deviceId) => set({ deviceId }),
  setIsPremiumRequired: (isPremiumRequired) => set({ isPremiumRequired }),
}));
