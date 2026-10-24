import { create } from "zustand";
import { Track, UserPlaylist } from "@/types/api";

export interface MenuState {
  x: number;
  y: number;
  track: Track;
  onRemove?: { label: string; run: () => void }; // e.g. "Remove from this playlist"
}

export interface ConfirmState {
  title: string;
  detail?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface UiState {
  menu: MenuState | null;
  openMenu: (e: { clientX: number; clientY: number }, track: Track, onRemove?: MenuState["onRemove"]) => void;
  closeMenu: () => void;

  addToPlaylist: Track[] | null; // tracks waiting to be added
  openAddToPlaylist: (tracks: Track[]) => void;
  closeAddToPlaylist: () => void;

  createPlaylist: { tracks: Track[] } | null;
  openCreatePlaylist: (tracks?: Track[]) => void;
  closeCreatePlaylist: () => void;

  editPlaylist: UserPlaylist | null;
  openEditPlaylist: (p: UserPlaylist | null) => void;

  confirm: ConfirmState | null;
  openConfirm: (c: ConfirmState) => void;
  closeConfirm: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  menu: null,
  openMenu: (e, track, onRemove) => set({ menu: { x: e.clientX, y: e.clientY, track, onRemove } }),
  closeMenu: () => set({ menu: null }),

  addToPlaylist: null,
  openAddToPlaylist: (tracks) => set({ addToPlaylist: tracks, menu: null }),
  closeAddToPlaylist: () => set({ addToPlaylist: null }),

  createPlaylist: null,
  openCreatePlaylist: (tracks = []) => set({ createPlaylist: { tracks }, addToPlaylist: null, menu: null }),
  closeCreatePlaylist: () => set({ createPlaylist: null }),

  editPlaylist: null,
  openEditPlaylist: (editPlaylist) => set({ editPlaylist }),

  confirm: null,
  openConfirm: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),
}));
