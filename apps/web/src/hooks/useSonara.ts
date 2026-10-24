"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError, json } from "@/lib/api-client";
import {
  AlbumDetail,
  AlbumSummary,
  AppConfig,
  Artist,
  AuthResponse,
  BrowseCategory,
  DashboardResponse,
  LoginPayload,
  Lyrics,
  PlayHistoryItem,
  Preferences,
  SearchResult,
  SessionResponse,
  SignupPayload,
  StatsReport,
  Track,
  UserPlaylist,
  Video,
} from "@/types/api";

/** Don't retry client errors (401/403/404/...): they won't fix themselves. */
const retryUnlessClientError = (count: number, err: unknown) =>
  !(err instanceof ApiError && err.code >= 400 && err.code < 500) && count < 2;

const q = { retry: retryUnlessClientError } as const;

/* ---------------------------------- auth ---------------------------------- */

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionResponse>("/auth/session"),
    staleTime: 60_000,
    retry: 1,
  });
}

function useAuthMutation<T>(fn: (p: T) => Promise<AuthResponse>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data) => {
      qc.clear(); // a different identity must never see the previous one's cached data
      if (data) {
        qc.setQueryData(["session"], data);
      }
      await qc.invalidateQueries({ queryKey: ["session"] });
    },
  });
}

export const useLogin = () =>
  useAuthMutation((p: LoginPayload) => apiFetch<AuthResponse>("/auth/login", { method: "POST", ...json(p) }));
export const useSignup = () =>
  useAuthMutation((p: SignupPayload) => apiFetch<AuthResponse>("/auth/signup", { method: "POST", ...json(p) }));
export const useGuestLogin = () =>
  useAuthMutation((p: { display_name?: string }) => apiFetch<AuthResponse>("/auth/guest", { method: "POST", ...json(p) }));

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(["session"], { authenticated: false });
    },
  });
}

export function useAppConfig() {
  return useQuery({ queryKey: ["config"], queryFn: () => apiFetch<AppConfig>("/config"), staleTime: Infinity, retry: 1 });
}

/* -------------------------------- account --------------------------------- */

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { display_name?: string; country?: string }) =>
      apiFetch<SessionResponse>("/me/profile", { method: "PUT", ...json(p) }),
    onSuccess: (s) => qc.setQueryData(["session"], s),
  });
}

export const useChangePassword = () =>
  useMutation({
    mutationFn: (p: { current_password: string; new_password: string }) =>
      apiFetch<{ ok: boolean }>("/me/password", { method: "PUT", ...json(p) }),
  });

export function useUpgradeGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { email: string; password: string }) =>
      apiFetch<SessionResponse>("/me/upgrade", { method: "POST", ...json(p) }),
    onSuccess: (s) => qc.setQueryData(["session"], s),
  });
}

export const useDeleteAccount = () =>
  useMutation({ mutationFn: () => apiFetch<{ deleted: boolean }>("/me", { method: "DELETE", params: { confirm: "yes" } }) });

export function useClearHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>("/me/history", { method: "DELETE" }),
    onSuccess: () => {
      ["dashboard", "recent", "top-tracks", "top-artists", "stats"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

/* ---------------------------- taste & dashboard --------------------------- */

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardResponse>("/dashboard"),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    ...q,
  });
}

export function usePreferences(enabled = true) {
  return useQuery({ queryKey: ["preferences"], queryFn: () => apiFetch<Preferences>("/me/preferences"), enabled, ...q });
}

export function useSavePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: Partial<Preferences>) => apiFetch<Preferences>("/me/preferences", { method: "PUT", ...json(prefs) }),
    onSuccess: (saved) => {
      qc.setQueryData(["preferences"], saved);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/* --------------------------------- catalogue ------------------------------- */

/** The single search hook used by the header, command palette and /search page. */
export function useSearch(query: string, type?: string, offset = 0) {
  const text = query.trim();
  return useQuery({
    queryKey: ["search", text, type ?? "all", offset],
    queryFn: () => apiFetch<SearchResult>("/search", { params: { q: text, type, offset, limit: 10 } }),
    enabled: text.length > 0,
    staleTime: 60_000,
    ...q,
  });
}

export function useBrowseCategories() {
  return useQuery({
    queryKey: ["browse"],
    queryFn: async () => (await apiFetch<{ categories: BrowseCategory[] }>("/browse")).categories,
    staleTime: Infinity,
    ...q,
  });
}

export function useCategory(slug: string) {
  return useQuery({
    queryKey: ["browse", slug],
    queryFn: () =>
      apiFetch<{ category: BrowseCategory; tracks: Track[]; artists: Artist[]; albums: AlbumSummary[] }>(`/browse/${encodeURIComponent(slug)}`),
    enabled: !!slug,
    staleTime: 10 * 60_000,
    ...q,
  });
}

export function useArtist(id?: string) {
  return useQuery({
    queryKey: ["artist", id],
    queryFn: () => apiFetch<{ artist: Artist; tracks: Track[]; albums: AlbumSummary[]; following: boolean }>(`/artists/${encodeURIComponent(id!)}`),
    enabled: !!id,
    staleTime: 10 * 60_000,
    ...q,
  });
}

export function useAlbum(id?: string) {
  return useQuery({
    queryKey: ["album", id],
    queryFn: () => apiFetch<{ album: AlbumDetail; saved: boolean }>(`/albums/${encodeURIComponent(id!)}`),
    enabled: !!id,
    staleTime: 10 * 60_000,
    ...q,
  });
}

export function useLyrics(track: Track | null) {
  const artist = track?.artists?.[0]?.name;
  return useQuery({
    queryKey: ["lyrics", track?.id],
    queryFn: () => apiFetch<Lyrics>("/lyrics", { params: { track_name: track!.name, artist_name: artist!, duration_ms: track!.duration_ms } }),
    enabled: !!track && !!artist,
    staleTime: 60 * 60_000,
    retry: false,
  });
}

export function useVideo(track: Track | null, enabled: boolean) {
  return useQuery({
    queryKey: ["video", track?.id],
    queryFn: () => apiFetch<Video>("/video", { params: { name: track!.name, artist: track!.artists?.[0]?.name } }),
    enabled: enabled && !!track,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });
}

/* ------------------------- your listening on Sonara ----------------------- */

export function useRecentlyPlayed(enabled = true) {
  return useQuery({
    queryKey: ["recent"],
    queryFn: async () => (await apiFetch<{ items: PlayHistoryItem[] }>("/me/recently-played", { params: { limit: 50 } })).items,
    enabled,
    ...q,
  });
}

export function useTopTracks(range = "alltime", enabled = true) {
  return useQuery({
    queryKey: ["top-tracks", range],
    queryFn: async () => (await apiFetch<{ items: Track[] }>("/me/top/tracks", { params: { range, limit: 20 } })).items,
    enabled,
    ...q,
  });
}

export function useTopArtists(range = "alltime", enabled = true) {
  return useQuery({
    queryKey: ["top-artists", range],
    queryFn: async () => (await apiFetch<{ items: Artist[] }>("/me/top/artists", { params: { range, limit: 20 } })).items,
    enabled,
    ...q,
  });
}

export function useStats(range: string, enabled = true) {
  return useQuery({ queryKey: ["stats", range], queryFn: () => apiFetch<StatsReport>("/stats", { params: { range } }), enabled, ...q });
}

/* --------------------------------- library -------------------------------- */

export function useSavedTracks(enabled = true) {
  return useQuery({
    queryKey: ["saved-tracks"],
    queryFn: async () => (await apiFetch<{ items: Track[] }>("/me/tracks", { params: { limit: 1000 } })).items,
    enabled,
    staleTime: 60_000,
    ...q,
  });
}

/**
 * Liked state for a track plus a toggle. Every row on a page shares ONE saved-tracks
 * request, and toggles update the cache instantly (optimistic) and roll back on error.
 */
export function useTrackLiked(track?: Track | null) {
  const qc = useQueryClient();
  const { data } = useSavedTracks(!!track);
  const uri = track?.uri;
  const liked = !!uri && !!data?.some((t) => t.uri === uri);

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (!track) return next;
      if (next) await apiFetch("/me/library", { method: "PUT", ...json(track) });
      else await apiFetch("/me/library", { method: "DELETE", params: { uri: track.uri } });
      return next;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["saved-tracks"] });
      const prev = qc.getQueryData<Track[]>(["saved-tracks"]);
      if (track) {
        qc.setQueryData<Track[]>(["saved-tracks"], (old = []) =>
          next ? [{ ...track, is_liked: true }, ...old.filter((t) => t.uri !== track.uri)] : old.filter((t) => t.uri !== track.uri)
        );
      }
      return { prev };
    },
    onError: (_e, _n, ctx) => qc.setQueryData(["saved-tracks"], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved-tracks"] }),
  });
  return { liked, toggle };
}

export function useFollowing(enabled = true) {
  return useQuery({
    queryKey: ["following"],
    queryFn: async () => (await apiFetch<{ items: Artist[] }>("/me/following")).items,
    enabled,
    ...q,
  });
}

export function useSavedAlbums(enabled = true) {
  return useQuery({
    queryKey: ["saved-albums"],
    queryFn: async () => (await apiFetch<{ items: AlbumSummary[] }>("/me/albums")).items,
    enabled,
    ...q,
  });
}

/** Follow/unfollow an artist or save/unsave an album. */
export function useCollectionToggle(kind: "artist" | "album") {
  const qc = useQueryClient();
  const base = kind === "artist" ? "/me/following" : "/me/albums";
  return useMutation({
    mutationFn: async ({ item, on }: { item: { id: string }; on: boolean }) => {
      if (on) await apiFetch(`${base}/${encodeURIComponent(item.id)}`, { method: "PUT", ...json(item) });
      else await apiFetch(`${base}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [kind === "artist" ? "following" : "saved-albums"] });
      qc.invalidateQueries({ queryKey: [kind] });
    },
  });
}

/* -------------------------------- playlists -------------------------------- */

export function usePlaylists(enabled = true) {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: async () => (await apiFetch<{ items: UserPlaylist[] }>("/playlists")).items,
    enabled,
    staleTime: 60_000,
    ...q,
  });
}

export function usePlaylist(id?: string) {
  return useQuery({ queryKey: ["playlist", id], queryFn: () => apiFetch<UserPlaylist>(`/playlists/${id}`), enabled: !!id, ...q });
}

export function usePlaylistActions() {
  const qc = useQueryClient();
  const refresh = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["playlists"] });
    if (id) qc.invalidateQueries({ queryKey: ["playlist", id] });
  };
  return {
    create: useMutation({
      mutationFn: (p: { name: string; description?: string; tracks?: Track[] }) =>
        apiFetch<UserPlaylist>("/playlists", { method: "POST", ...json(p) }),
      onSuccess: () => refresh(),
    }),
    update: useMutation({
      mutationFn: (p: { id: string; name: string; description?: string }) =>
        apiFetch("/playlists/" + p.id, { method: "PUT", ...json({ name: p.name, description: p.description }) }),
      onSuccess: (_d, v) => refresh(v.id),
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiFetch("/playlists/" + id, { method: "DELETE" }),
      onSuccess: () => refresh(),
    }),
    addTracks: useMutation({
      mutationFn: (p: { id: string; tracks: Track[] }) =>
        apiFetch<{ added: number }>(`/playlists/${p.id}/tracks`, { method: "POST", ...json({ tracks: p.tracks }) }),
      onSuccess: (_d, v) => refresh(v.id),
    }),
    removeTrack: useMutation({
      mutationFn: (p: { id: string; trackId: string }) =>
        apiFetch(`/playlists/${p.id}/tracks/${encodeURIComponent(p.trackId)}`, { method: "DELETE" }),
      onSuccess: (_d, v) => refresh(v.id),
    }),
    move: useMutation({
      mutationFn: (p: { id: string; from: number; to: number }) =>
        apiFetch(`/playlists/${p.id}/move`, { method: "PUT", ...json({ from: p.from, to: p.to }) }),
      onSuccess: (_d, v) => refresh(v.id),
    }),
  };
}

/* ---------------------------------- errors -------------------------------- */

/** Human-friendly message for an API failure (never raw JSON). */
export function friendlyError(err: unknown): { title: string; detail: string; needsLogin: boolean } {
  if (err instanceof ApiError) {
    if (err.code === 401) return { title: "Please sign in", detail: "Sign in to Sonara to continue.", needsLogin: true };
    if (err.code === 0) return { title: "Can't reach Sonara's server", detail: "Check that the API is running, then try again.", needsLogin: false };
    if (err.code === 429) return { title: "Slow down a little", detail: err.message, needsLogin: false };
    if (err.code === 404) return { title: "Not found", detail: err.message, needsLogin: false };
    if (err.errorCode === "catalog_unavailable" || err.errorCode === "catalog_not_configured")
      return { title: "The music catalogue is unavailable", detail: err.message, needsLogin: false };
    return { title: "Something went wrong", detail: err.message, needsLogin: false };
  }
  return { title: "Something went wrong", detail: "Please try again.", needsLogin: false };
}
