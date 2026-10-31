import { create } from "zustand";
import { UserProfile } from "@/types/api";

export type MoodMode = "default" | "focus" | "workout" | "latenight";
export type ThemeMode = "dark" | "light";
export type ThemePref = "system" | "dark" | "light";
export type Accent = "blue" | "violet" | "rose" | "emerald" | "amber";
export type Density = "comfortable" | "compact";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: "default" | "success" | "error" | "info";
  duration?: number;
}

/** Settings that live on this device (localStorage). */
export interface Settings {
  themePref: ThemePref;
  accent: Accent;
  density: Density;
  reduceMotion: boolean;
  autoplay: boolean; // keep playing similar music when the queue ends
  hideExplicit: boolean;
  fullSongs: boolean; // always play complete full songs
  showVideoWindow: boolean; // toggle floating video window on/off (songs keep playing in full either way)
  fullSongVideo: boolean; // backward-compat alias
  playbackSpeed: number; // applies to 30-second previews
  showLyricsInPlayer: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  themePref: "system",
  accent: "blue",
  density: "comfortable",
  reduceMotion: false,
  autoplay: true,
  hideExplicit: false,
  fullSongs: true,
  showVideoWindow: false,
  fullSongVideo: true,
  playbackSpeed: 1,
  showLyricsInPlayer: true,
};

const SETTINGS_KEY = "sonara-settings";
export const ACCENTS: Record<Accent, { label: string; swatch: string }> = {
  blue: { label: "Ocean", swatch: "#3b82f6" },
  violet: { label: "Violet", swatch: "#8b5cf6" },
  rose: { label: "Rose", swatch: "#f43f5e" },
  emerald: { label: "Emerald", swatch: "#10b981" },
  amber: { label: "Amber", swatch: "#f59e0b" },
};

function readSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      fullSongs: parsed.fullSongs !== undefined ? parsed.fullSongs : true,
      showVideoWindow: parsed.showVideoWindow !== undefined ? parsed.showVideoWindow : false,
      fullSongVideo: parsed.fullSongs !== undefined ? parsed.fullSongs : true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function systemTheme(): ThemeMode {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Applies settings to <html> (theme, accent, density, motion). */
export function applySettingsToDom(s: Settings) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const theme: ThemeMode = s.themePref === "system" ? systemTheme() : s.themePref;
  el.setAttribute("data-theme", theme);
  el.classList.toggle("dark", theme === "dark");
  el.setAttribute("data-accent", s.accent);
  el.setAttribute("data-density", s.density);
  el.setAttribute("data-motion", s.reduceMotion ? "reduce" : "full");
}

interface AppState {
  settings: Settings;
  theme: ThemeMode;
  mood: MoodMode;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  shortcutsOpen: boolean;
  user: UserProfile | null;
  isGuest: boolean;
  toasts: ToastMessage[];

  hydrateSettings: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  toggleTheme: () => void;
  setMood: (mood: MoodMode) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setUser: (user: UserProfile | null, guest?: boolean) => void;
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  theme: "dark",
  mood: "default",
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  shortcutsOpen: false,
  user: null,
  isGuest: false,
  toasts: [],

  // Called once on the client so server and first client render match (no hydration warnings).
  hydrateSettings: () => {
    const settings = readSettings();
    applySettingsToDom(settings);
    let collapsed = false;
    try {
      collapsed = localStorage.getItem("sonara-sidebar") === "collapsed";
    } catch {
      /* ignore */
    }
    set({ settings, theme: settings.themePref === "system" ? systemTheme() : settings.themePref, sidebarCollapsed: collapsed });
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      // The inline theme script in layout.tsx reads these to avoid a flash on load.
      if (settings.themePref === "system") localStorage.removeItem("sonara-theme");
      else localStorage.setItem("sonara-theme", settings.themePref);
      localStorage.setItem("sonara-accent", settings.accent);
    } catch {
      /* storage unavailable: settings still apply this session */
    }
    applySettingsToDom(settings);
    set({ settings, theme: settings.themePref === "system" ? systemTheme() : settings.themePref });
  },

  resetSettings: () => get().updateSettings(DEFAULT_SETTINGS),

  toggleTheme: () => get().updateSettings({ themePref: get().theme === "dark" ? "light" : "dark" }),

  setMood: (mood) => {
    set({ mood });
    if (typeof document === "undefined") return;
    const colors: Record<MoodMode, string | null> = { default: null, focus: "#3b82f6", workout: "#f97316", latenight: "#6366f1" };
    const c = colors[mood];
    if (c) {
      document.documentElement.style.setProperty("--dynamic-accent", c);
      document.documentElement.style.setProperty("--dynamic-accent-soft", `${c}33`);
    } else {
      // Back to the default accent; otherwise the last mood's colour stayed applied.
      document.documentElement.style.removeProperty("--dynamic-accent");
      document.documentElement.style.removeProperty("--dynamic-accent-soft");
    }
  },

  setSidebarCollapsed: (sidebarCollapsed) => {
    try {
      localStorage.setItem("sonara-sidebar", sidebarCollapsed ? "collapsed" : "open");
    } catch {
      /* ignore */
    }
    set({ sidebarCollapsed });
  },
  toggleSidebar: () => get().setSidebarCollapsed(!get().sidebarCollapsed),

  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

  setUser: (user, guest = false) => set({ user, isGuest: guest }),

  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2, 9);
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
    setTimeout(() => get().removeToast(id), toast.duration || 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
