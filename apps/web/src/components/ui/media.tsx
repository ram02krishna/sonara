"use client";

import React from "react";
import Link from "next/link";
import { Play, Pause, Music2, AlertTriangle, RefreshCw } from "lucide-react";
import { AlbumSummary, Artist, Track } from "@/types/api";
import { usePlayerStore } from "@/store/usePlayerStore";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { cn, formatDuration } from "@/lib/utils";

/** Cover art with a graceful gradient placeholder (no external stock photos). */
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
        "relative overflow-hidden bg-gradient-to-br from-violet-500/30 to-cyan-500/30 flex items-center justify-center",
        round ? "rounded-full" : "rounded-2xl",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <Music2 className="w-1/3 h-1/3 text-foreground/40" />
      )}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
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

export function TrackCard({ track, context }: { track: Track; context?: Track[] }) {
  const play = usePlayTrack();
  const { currentTrack, isPlaying } = usePlayerStore();
  const active = currentTrack?.id === track.id;
  return (
    <button
      onClick={() => play(track, context)}
      className="group w-40 md:w-44 text-left p-3 rounded-3xl glass-card"
      aria-label={`Play ${track.name}`}
    >
      <div className="relative">
        <Cover src={track.album?.images?.[0]?.url} alt={track.name} className="aspect-square w-full shadow-lg" />
        <span
          className={cn(
            "absolute right-2 bottom-2 w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white flex items-center justify-center shadow-xl transition-all",
            active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
          )}
        >
          {active && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </span>
      </div>
      <p className={cn("mt-3 text-sm font-semibold truncate", active ? "text-cyan-500" : "text-foreground")}>{track.name}</p>
      <p className="text-xs text-muted-foreground truncate">{track.artists?.map((a) => a.name).join(", ")}</p>
    </button>
  );
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link href={`/artist/${artist.id}`} className="group w-36 md:w-40 text-center p-3 rounded-3xl glass-card block">
      <Cover src={artist.images?.[0]?.url} alt={artist.name} round className="aspect-square w-full shadow-lg" />
      <p className="mt-3 text-sm font-semibold text-foreground truncate">{artist.name}</p>
      <p className="text-xs text-muted-foreground truncate capitalize">{artist.genres?.[0] || "Artist"}</p>
    </Link>
  );
}

export function AlbumCard({ album }: { album: AlbumSummary }) {
  return (
    <a
      href={album.uri ? `https://open.spotify.com/album/${album.id}` : undefined}
      target="_blank"
      rel="noreferrer"
      className="group w-40 md:w-44 text-left p-3 rounded-3xl glass-card block"
    >
      <Cover src={album.images?.[0]?.url} alt={album.name} className="aspect-square w-full shadow-lg" />
      <p className="mt-3 text-sm font-semibold text-foreground truncate">{album.name}</p>
      <p className="text-xs text-muted-foreground truncate">{album.release_date?.slice(0, 4) || "Album"}</p>
    </a>
  );
}

export function TrackRow({ track, index, context }: { track: Track; index?: number; context?: Track[] }) {
  const play = usePlayTrack();
  const { currentTrack, isPlaying } = usePlayerStore();
  const active = currentTrack?.id === track.id;
  return (
    <div
      onClick={() => play(track, context)}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-colors group",
        active ? "bg-foreground/10" : "hover:bg-foreground/5"
      )}
    >
      {index !== undefined && (
        <span className="w-6 text-center text-xs text-muted-foreground tabular-nums">
          {active && isPlaying ? <Pause className="w-3.5 h-3.5 mx-auto text-cyan-500 fill-current" /> : index + 1}
        </span>
      )}
      <Cover src={track.album?.images?.[0]?.url} alt={track.name} className="w-11 h-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium truncate", active ? "text-cyan-500" : "text-foreground")}>{track.name}</p>
        <p className="text-xs text-muted-foreground truncate">{track.artists?.map((a) => a.name).join(", ")}</p>
      </div>
      <span className="hidden md:block text-xs text-muted-foreground truncate max-w-[10rem]">{track.album?.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{track.duration_ms ? formatDuration(track.duration_ms) : ""}</span>
    </div>
  );
}

export function ShelfSkeleton({ rounded }: { rounded?: boolean }) {
  return (
    <div className="shelf">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="w-40 md:w-44 p-3 rounded-3xl glass-card">
          <div className={cn("aspect-square w-full skeleton", rounded ? "rounded-full" : "rounded-2xl")} />
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
    <div className="glass-card rounded-3xl p-8 text-center max-w-lg mx-auto space-y-3">
      <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      <div className="flex justify-center gap-2 pt-1">
        {onRetry && (
          <button onClick={onRetry} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-pill text-sm text-foreground hover:bg-foreground/10">
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        )}
        {action}
      </div>
    </div>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-foreground/15 p-10 text-center space-y-2">
      <Music2 className="w-8 h-8 mx-auto text-muted-foreground" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      {action}
    </div>
  );
}
