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
  spotify_id?: string;
  display_name: string;
  email: string;
  avatar_url?: string;
  product: 'premium' | 'free' | 'open';
  country?: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: UserProfile;
  is_premium: boolean;
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
