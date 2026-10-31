/**
 * Sonara API Types - Generated / Aligned with OpenAPI 3.1 Spec
 */

export interface Image {
  url: string;
  height?: number | null;
  width?: number | null;
}

export interface ArtistSummary {
  id: string;
  name: string;
  uri?: string;
}

export interface AlbumSummary {
  id: string;
  name: string;
  uri?: string;
  release_date?: string;
  images: Image[];
}

export interface Track {
  id: string;
  name: string;
  uri: string;
  preview_url?: string | null;
  duration_ms: number;
  explicit?: boolean;
  popularity?: number;
  artists: ArtistSummary[];
  album: AlbumSummary;
  is_liked?: boolean;
}

export interface Artist {
  id: string;
  name: string;
  uri: string;
  genres: string[];
  images: Image[];
  followers?: number;
  popularity?: number;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  description?: string;
  images: Image[];
  owner_name?: string;
  tracks_total?: number;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent?: number;
}

export interface PlaybackState {
  device?: Device;
  is_playing: boolean;
  item?: Track;
  progress_ms: number;
  shuffle_state?: boolean;
  repeat_state?: 'off' | 'track' | 'context';
}

export interface PlayHistoryItem {
  track: Track;
  played_at: string;
}

export interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  product?: string; // legacy field, unused
  country?: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: UserProfile | null;
  guest?: boolean;
}

export interface AuthResponse {
  authenticated: boolean;
  guest?: boolean;
  user: UserProfile;
}

export interface LoginPayload {
  email: string;
  password?: string;
}

export interface SignupPayload {
  email: string;
  password?: string;
  display_name: string;
}

export interface SearchResult {
  tracks?: Track[];
  artists?: Artist[];
  albums?: AlbumSummary[];
  playlists?: PlaylistSummary[];
}

export interface LyricsLine {
  time_seconds: number;
  words: string;
}

export interface Lyrics {
  id?: number;
  track_name: string;
  artist_name: string;
  synced: boolean;
  plain_lyrics?: string;
  lines?: LyricsLine[];
}

export interface GenreStat {
  genre: string;
  percentage: number;
}

export interface DailyListeningStat {
  date: string;
  hours: number;
}

export interface StatsReport {
  play_count: number;
  unique_tracks: number;
  unique_artists: number;
  total_minutes: number;
  streak_days: number;
  top_genres: GenreStat[];
  daily_listening: DailyListeningStat[];
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: number;
}

/** Server-driven dashboard (GET /dashboard) */
export type SectionType = "hero" | "carousel" | "grid";
export type SectionKind = "tracks" | "artists" | "albums";

export interface DashboardSection {
  id: string;
  type: SectionType;
  kind: SectionKind;
  title: string;
  subtitle?: string;
  tracks?: Track[];
  artists?: Artist[];
  albums?: AlbumSummary[];
}

export interface DashboardResponse {
  sections: DashboardSection[];
  top_genres: string[];
  needs_onboarding: boolean;
  market: string;
  generated_at: string;
}

export interface Preferences {
  languages: string[];
  genres: string[];
  artists: ArtistSummary[];
  country?: string;
  onboarded: boolean;
  audio_quality?: "lossless" | "high" | "normal";
  normalize_audio?: boolean;
}

/** A playlist created by a Sonara user. */
export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  track_count: number;
  covers: string[];
  tracks?: Track[];
  created_at: string;
  updated_at: string;
}

export interface AlbumDetail {
  album: AlbumSummary;
  artists: ArtistSummary[];
  label?: string;
  total_tracks: number;
  tracks: Track[];
}

export interface BrowseCategory {
  slug: string;
  title: string;
  group: "language" | "genre" | "mood";
  color: string;
}

export interface AppConfig {
  catalog_configured: boolean;
  video_enabled: boolean;
}

export interface Video {
  video_id: string;
  title: string;
  channel: string;
}
