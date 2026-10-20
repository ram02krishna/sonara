"use client";

import React from "react";
import Link from "next/link";
import { Play, Pause, Music2, AlertCircle, RefreshCw } from "lucide-react";
import { AlbumSummary, Artist, PlaylistSummary, Track } from "@/types/api";
import { usePlayerStore } from "@/store/usePlayerStore";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { apiFetch } from "@/lib/api-client";
import { cn, formatDuration } from "@/lib/utils";

/** Cover art with clean fallback and subtle border */
export function Cover({
  src,
  alt,
  className,
  round,
}: {
  src?: string;
  alt: string;
  className?: string;
  round?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-foreground/5 flex items-center justify-center shrink-0",
        round ? "rounded-full" : "rounded-xl",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <Music2 className="w-1/3 h-1/3 text-muted-foreground/40" />
      )}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Spotify-style Quick Access Tile (the iconic 6-grid at the top of the dashboard) */
export function QuickPlayCard({
  track,
  context,
}: {
  track: Track;
  context?: Track[];
}) {
  const play = usePlayTrack();
  const { currentTrack, isPlaying } = usePlayerStore();
  const active = currentTrack?.id === track.id;

  return (
    <div
      onClick={() => play(track, context)}
      className={cn(
        "group relative flex items-center gap-3.5 pr-4 rounded-xl overflow-hidden cursor-pointer transition-all",
        active
          ? "bg-foreground/15 border border-primary/30"
          : "bg-foreground/5 hover:bg-foreground/10 border border-foreground/5"
      )}
    >
      <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 relative bg-foreground/10">
        {track.album?.images?.[0]?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.album.images[0].url} alt={track.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 py-2">
        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{track.name}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artists?.map((a) => a.name).join(", ")}</p>
      </div>

      <button
        aria-label={`Play ${track.name}`}
        className={cn(
          "w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-lg transition-all shrink-0",
          active && isPlaying
            ? "opacity-100 scale-100"
            : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 active:scale-95"
        )}
      >
        {active && isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>
    </div>
  );
}

/** Spotify-style Standard Music Card */
export function TrackCard({ track, context }: { track: Track; context?: Track[] }) {
  const play = usePlayTrack();
  const { currentTrack, isPlaying } = usePlayerStore();
  const active = currentTrack?.id === track.id;

  return (
    <div
      onClick={() => play(track, context)}
      className="group w-40 md:w-48 text-left p-3.5 rounded-2xl glass-card cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`Play ${track.name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          play(track, context);
        }
      }}
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-md bg-foreground/5">
        <Cover
          src={track.album?.images?.[0]?.url}
          alt={track.name}
          className="w-full h-full rounded-xl"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            play(track, context);
          }}
          aria-label={active && isPlaying ? "Pause" : "Play"}
          className={cn(
            "absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-xl transition-all duration-200",
            active && isPlaying
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 active:scale-95"
          )}
        >
          {active && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>
      </div>

      <p className={cn("mt-3 text-sm font-semibold truncate transition-colors group-hover:text-primary", active ? "text-primary font-bold" : "text-foreground")}>
        {track.name}
      </p>
      <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artists?.map((a) => a.name).join(", ")}</p>
    </div>
  );
}

/** Apple Music style Artist Circle Card */
export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link href={`/artist/${artist.id}`} className="group w-36 md:w-44 text-center p-3.5 rounded-2xl glass-card block">
      <div className="aspect-square w-full rounded-full overflow-hidden shadow-lg mx-auto bg-foreground/5 relative">
        <Cover
          src={artist.images?.[0]?.url}
          alt={artist.name}
          round
          className="w-full h-full"
        />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
        {artist.name}
      </p>
      <p className="text-xs text-muted-foreground truncate capitalize mt-0.5">{artist.genres?.[0] || "Artist"}</p>
    </Link>
  );
}

/** Album Card with direct one-click playback */
export function AlbumCard({ album }: { album: AlbumSummary }) {
  const play = usePlayTrack();
  const [loading, setLoading] = React.useState(false);

  const handlePlay = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ tracks?: Track[] }>("/search", {
        params: { q: album.name, type: "track", limit: 10 },
      });
      if (res.tracks && res.tracks.length > 0) {
        play(res.tracks[0], res.tracks);
      }
    } catch (err) {
      console.error("Failed to play album tracks:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link
      href={`/search?q=${encodeURIComponent(album.name)}`}
      className="group w-40 md:w-48 text-left p-3.5 rounded-2xl glass-card block"
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-md bg-foreground/5">
        <Cover
          src={album.images?.[0]?.url}
          alt={album.name}
          className="w-full h-full rounded-xl"
        />
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`Play ${album.name}`}
          className="absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 active:scale-95 transition-all duration-200 z-10"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
        {album.name}
      </p>
      <p className="text-xs text-muted-foreground truncate mt-0.5">{album.release_date?.slice(0, 4) || "Album"}</p>
    </Link>
  );
}

/** Playlist Card with direct one-click playback */
export function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  const play = usePlayTrack();
  const [loading, setLoading] = React.useState(false);

  const handlePlay = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ tracks?: { items?: Array<{ track: Track }> }; items?: Array<{ track: Track }> }>(
        `/playlists/${playlist.id}`
      );
      const rawTracks = res.tracks?.items || res.items || [];
      const tracks = rawTracks.map((it) => it.track).filter(Boolean);
      if (tracks.length > 0) {
        play(tracks[0], tracks);
      }
    } catch (err) {
      console.error("Failed to play playlist tracks:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className="group w-40 md:w-48 text-left p-3.5 rounded-2xl glass-card block"
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-md bg-foreground/5">
        <Cover
          src={playlist.images?.[0]?.url}
          alt={playlist.name}
          className="w-full h-full rounded-xl"
        />
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`Play ${playlist.name}`}
          className="absolute right-2.5 bottom-2.5 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 active:scale-95 transition-all duration-200 z-10"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
        {playlist.name}
      </p>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {playlist.owner_name ? `By ${playlist.owner_name}` : playlist.tracks_total ? `${playlist.tracks_total} songs` : "Playlist"}
      </p>
    </Link>
  );
}

/** Spotify-style Track Table Row */
export function TrackRow({
  track,
  index,
  context,
}: {
  track: Track;
  index?: number;
  context?: Track[];
}) {
  const play = usePlayTrack();
  const { currentTrack, isPlaying } = usePlayerStore();
  const active = currentTrack?.id === track.id;

  return (
    <div
      onClick={() => play(track, context)}
      className={cn(
        "flex items-center gap-3.5 p-2.5 rounded-xl cursor-pointer transition-colors group",
        active ? "bg-foreground/15 text-primary" : "hover:bg-foreground/5"
      )}
    >
      {index !== undefined && (
        <span className="w-6 text-center text-xs text-muted-foreground tabular-nums shrink-0">
          {active && isPlaying ? (
            <div className="flex items-end justify-center gap-0.5 h-3.5 w-3.5 mx-auto">
              <span className="w-0.5 bg-primary h-full animate-pulse" />
              <span className="w-0.5 bg-primary h-2/3 animate-pulse delay-75" />
              <span className="w-0.5 bg-primary h-4/5 animate-pulse delay-150" />
            </div>
          ) : (
            <span className="group-hover:hidden">{index + 1}</span>
          )}
          {(!active || !isPlaying) && (
            <Play className="w-3.5 h-3.5 mx-auto text-foreground hidden group-hover:block fill-current" />
          )}
        </span>
      )}

      <Cover src={track.album?.images?.[0]?.url} alt={track.name || "Track"} className="w-10 h-10 md:w-11 md:h-11 shrink-0 rounded-lg shadow-sm" />

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium truncate transition-colors group-hover:text-primary", active ? "text-primary font-bold" : "text-foreground")}>
          {track.name || "Liked Song"}
        </p>
        <p className="text-xs text-muted-foreground truncate">{track.artists?.map((a) => a.name).filter(Boolean).join(", ") || "Unknown Artist"}</p>
      </div>

      <span className="hidden md:block text-xs text-muted-foreground truncate max-w-[14rem] flex-1">
        {track.album?.name || "Single"}
      </span>

      <span className="text-xs text-muted-foreground tabular-nums w-12 text-right shrink-0">
        {track.duration_ms ? formatDuration(track.duration_ms) : "--:--"}
      </span>
    </div>
  );
}

export function ShelfSkeleton({ rounded }: { rounded?: boolean }) {
  return (
    <div className="shelf">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="w-40 md:w-48 p-3.5 rounded-2xl glass-card">
          <div className={cn("aspect-square w-full skeleton", rounded ? "rounded-full" : "rounded-xl")} />
          <div className="h-3 w-3/4 mt-3 rounded skeleton" />
          <div className="h-2.5 w-1/2 mt-2 rounded skeleton" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
  action,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-8 text-center max-w-md mx-auto space-y-3">
      <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {detail && <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>}
      <div className="flex justify-center gap-2 pt-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-pill text-xs font-semibold text-foreground hover:bg-foreground/10"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        )}
        {action}
      </div>
    </div>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-foreground/10 p-10 text-center space-y-2.5">
      <Music2 className="w-8 h-8 mx-auto text-muted-foreground/60" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {detail && <p className="text-xs text-muted-foreground max-w-sm mx-auto">{detail}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
