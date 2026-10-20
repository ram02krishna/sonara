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

  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setMood: (mood: MoodMode) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setUser: (user: UserProfile | null) => void;
  setIsLoadingAuth: (loading: boolean) => void;
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
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

  setTheme: (theme) => {
    set({ theme });
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  },

  toggleTheme: () => {
    const nextTheme = get().theme === "dark" ? "light" : "dark";
    get().setTheme(nextTheme);
  },

  setMood: (mood) => {
    set({ mood });
    if (typeof document !== "undefined") {
      let accentColor = "#8b5cf6"; // default
      if (mood === "focus") accentColor = "#10b981"; // emerald
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
