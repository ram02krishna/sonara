"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api-client";
import {
  Artist,
  AuthResponse,
  DashboardResponse,
  LoginPayload,
  Lyrics,
  PlaylistSummary,
  Preferences,
  SearchResult,
  SessionResponse,
  SignupPayload,
  StatsReport,
  Track,
} from "@/types/api";

/** Don't retry auth/permission failures; they won't fix themselves. */
const retryUnlessClientError = (count: number, err: unknown) =>
  !(err instanceof ApiError && err.code >= 400 && err.code < 500) && count < 2;

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionResponse>("/auth/session"),
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["session"], { authenticated: true, user: data.user, is_premium: true });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["preferences"] });
    },
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SignupPayload) =>
      apiFetch<AuthResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["session"], { authenticated: true, user: data.user, is_premium: true });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["preferences"] });
    },
  });
}

export function useGuestLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (displayName?: string) =>
      apiFetch<AuthResponse>("/auth/guest", {
        method: "POST",
        body: JSON.stringify({ display_name: displayName || "Sonara Listener" }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["session"], { authenticated: true, user: data.user, is_premium: true });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["preferences"] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(["session"], { authenticated: false, user: null });
      qc.clear();
    },
  });
}

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardResponse>("/dashboard"),
    enabled,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: true, // pick up new listening/Spotify changes when the tab regains focus
    retry: retryUnlessClientError,
  });
}

export function usePreferences(enabled = true) {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: () => apiFetch<Preferences>("/me/preferences"),
    enabled,
    retry: retryUnlessClientError,
  });
}

export function useSavePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: Omit<Preferences, "onboarded">) =>
      apiFetch<Preferences>("/me/preferences", { method: "PUT", body: JSON.stringify(prefs) }),
    onSuccess: (saved) => {
      qc.setQueryData(["preferences"], saved);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/** The single search hook used by the header, command palette and /search page. */
export function useSearch(query: string, type?: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["search", q, type ?? "all"],
    queryFn: () => apiFetch<SearchResult>("/search", { params: { q, type, limit: 10 } }),
    enabled: q.length > 0,
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });
}

export function useTopArtists(timeRange = "medium_term", enabled = true) {
  return useQuery({
    queryKey: ["top-artists", timeRange],
    queryFn: async () => (await apiFetch<{ items: Artist[] }>("/me/top/artists", { params: { time_range: timeRange, limit: 20 } })).items,
    enabled,
    retry: retryUnlessClientError,
  });
}

export function useTopTracks(timeRange = "medium_term", enabled = true) {
  return useQuery({
    queryKey: ["top-tracks", timeRange],
    queryFn: async () => (await apiFetch<{ items: Track[] }>("/me/top/tracks", { params: { time_range: timeRange, limit: 20 } })).items,
    enabled,
    retry: retryUnlessClientError,
  });
}

export function useMyPlaylists(enabled = true) {
  return useQuery({
    queryKey: ["my-playlists"],
    queryFn: async () => (await apiFetch<{ items: PlaylistSummary[] }>("/me/playlists")).items,
    enabled,
    staleTime: 5 * 60_000,
    retry: retryUnlessClientError,
  });
}

export function usePlaylist(id: string) {
  return useQuery({
    queryKey: ["playlist", id],
    queryFn: () => apiFetch<{ playlist: PlaylistSummary; tracks: Track[] }>(`/playlists/${encodeURIComponent(id)}`),
    enabled: !!id,
    retry: retryUnlessClientError,
  });
}

export function useArtist(id?: string) {
  return useQuery({
    queryKey: ["artist", id],
    queryFn: () => apiFetch<{ artist: Artist; tracks: Track[] }>(`/artists/${encodeURIComponent(id!)}`),
    enabled: !!id,
    staleTime: 10 * 60_000,
    retry: retryUnlessClientError,
  });
}

export function useLyrics(track: Track | null) {
  const artist = track?.artists?.[0]?.name;
  return useQuery({
    queryKey: ["lyrics", track?.id],
    queryFn: () =>
      apiFetch<Lyrics>("/lyrics", {
        params: { track_name: track!.name, artist_name: artist!, duration_ms: track!.duration_ms },
      }),
    enabled: !!track && !!artist,
    staleTime: 60 * 60_000,
    retry: false,
  });
}

export function useStats(range: string) {
  return useQuery({
    queryKey: ["stats", range],
    queryFn: () => apiFetch<StatsReport>("/stats", { params: { range } }),
    retry: retryUnlessClientError,
  });
}

/** Human-friendly message for an API failure (never shows raw JSON to people). */
export function friendlyError(err: unknown): { title: string; detail: string; needsLogin: boolean } {
  if (err instanceof ApiError) {
    if (err.code === 401) return { title: "Please log in", detail: "Connect your Spotify account to continue.", needsLogin: true };
    if (err.code === 403) return { title: "Spotify blocked this request", detail: err.message, needsLogin: false };
    if (err.code === 429) return { title: "Spotify is rate limiting us", detail: "Give it a moment and try again.", needsLogin: false };
    return { title: "Something went wrong", detail: err.message, needsLogin: false };
  }
  return { title: "Can't reach Sonara's server", detail: "Check that the API is running and try again.", needsLogin: false };
}

export function useSavedTracks(enabled = true) {
  return useQuery({
    queryKey: ["saved-tracks"],
    queryFn: async () => (await apiFetch<{ items: Track[] }>("/me/tracks", { params: { limit: 50 } })).items,
    enabled,
    retry: retryUnlessClientError,
  });
}

/** Whether a track is in the user's Liked Songs, plus a toggle that really saves it on Spotify. */
export function useTrackLiked(uri?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["track-saved", uri],
    queryFn: async () => (await apiFetch<{ saved: boolean }>("/me/library/contains", { params: { uri } })).saved,
    enabled: !!uri && uri.startsWith("spotify:track:"),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      await apiFetch<void>("/me/library", { method: next ? "PUT" : "DELETE", params: { uri } });
      return next;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["track-saved", uri] });
      const prev = qc.getQueryData<boolean>(["track-saved", uri]);
      qc.setQueryData(["track-saved", uri], next); // optimistic
      return { prev };
    },
    onError: (_e, _n, ctx) => qc.setQueryData(["track-saved", uri], ctx?.prev ?? false),
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved-tracks"] }),
  });
  return { liked: query.data ?? false, toggle };
}
