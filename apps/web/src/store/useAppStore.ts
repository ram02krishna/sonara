import { create } from "zustand";
import { UserProfile } from "@/types/api";

export type MoodMode = "default" | "focus" | "workout" | "latenight";
export type ThemeMode = "dark" | "light";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: "default" | "success" | "error" | "info";
  duration?: number;
}

interface AppState {
  theme: ThemeMode;
  mood: MoodMode;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  toasts: ToastMessage[];
  audioQuality: "lossless" | "high" | "normal";
  normalizeAudio: boolean;
  crossfadeSeconds: number;

  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  syncThemeFromDom: () => void;
  setMood: (mood: MoodMode) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setUser: (user: UserProfile | null) => void;
  setIsLoadingAuth: (loading: boolean) => void;
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
  setAudioQuality: (quality: "lossless" | "high" | "normal") => void;
  setNormalizeAudio: (normalize: boolean) => void;
  setCrossfadeSeconds: (seconds: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: "dark",
  mood: "default",
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  user: null,
  isAuthenticated: false,
  isLoadingAuth: true,
  toasts: [],
  audioQuality: (typeof window !== "undefined" && (localStorage.getItem("sonara-audio-quality") as any)) || "lossless",
  normalizeAudio: typeof window !== "undefined" ? localStorage.getItem("sonara-normalize-audio") !== "false" : true,
  crossfadeSeconds: (typeof window !== "undefined" && Number(localStorage.getItem("sonara-crossfade"))) || 0,

  setAudioQuality: (quality) => {
    set({ audioQuality: quality });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sonara-audio-quality", quality);
      } catch {
        // ignore
      }
    }
  },

  setNormalizeAudio: (normalize) => {
    set({ normalizeAudio: normalize });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sonara-normalize-audio", String(normalize));
      } catch {
        // ignore
      }
    }
  },

  setCrossfadeSeconds: (seconds) => {
    set({ crossfadeSeconds: seconds });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sonara-crossfade", String(seconds));
      } catch {
        // ignore
      }
    }
  },

  setTheme: (theme) => {
    set({ theme });
    if (typeof document !== "undefined") {
      try {
        localStorage.setItem("sonara-theme", theme);
      } catch {
        // storage unavailable (private mode): theme still applies for this session
      }
      document.documentElement.setAttribute("data-theme", theme);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  },

  // The inline script in layout.tsx already applied the saved/system theme; mirror it into state.
  syncThemeFromDom: () => {
    if (typeof document === "undefined") return;
    const t = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    set({ theme: t });
  },

  toggleTheme: () => {
    const nextTheme = get().theme === "dark" ? "light" : "dark";
    get().setTheme(nextTheme);
  },

  setMood: (mood) => {
    set({ mood });
    if (typeof document !== "undefined") {
      let accentColor = "#3b82f6"; // default
      if (mood === "focus") accentColor = "#3b82f6"; // royal blue
      if (mood === "workout") accentColor = "#f97316"; // vibrant orange
      if (mood === "latenight") accentColor = "#6366f1"; // deep indigo

      document.documentElement.style.setProperty("--dynamic-accent", accentColor);
      document.documentElement.style.setProperty("--dynamic-accent-soft", `${accentColor}33`);
    }
  },

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoadingAuth: false }),
  setIsLoadingAuth: (isLoadingAuth) => set({ isLoadingAuth }),

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    setTimeout(() => {
      get().removeToast(id);
    }, toast.duration || 4000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
