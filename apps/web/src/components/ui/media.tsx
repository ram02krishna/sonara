"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Heart, ListMusic, MoreHorizontal, Music2, Pause, Play, RefreshCw } from "lucide-react";
import { AlbumSummary, Artist, Track, UserPlaylist } from "@/types/api";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { useUiStore } from "@/store/useUiStore";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { useTrackLiked } from "@/hooks/useSonara";
import { cn, formatDuration } from "@/lib/utils";

/* ------------------------------- primitives ------------------------------- */

export function Cover({ src, alt, className, round }: { src?: string; alt: string; className?: string; round?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br from-primary/25 to-accent/20 flex items-center justify-center", round ? "rounded-full" : "rounded-2xl", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <Music2 className="w-1/3 h-1/3 text-foreground/40" />
      )}
    </div>
  );
}

/** Playlist artwork: a 2x2 mosaic of its first covers. */
export function PlaylistCover({ covers, className }: { covers?: string[]; className?: string }) {
  const list = covers ?? [];
  if (list.length >= 4) {
    return (
      <div className={cn("grid grid-cols-2 overflow-hidden bg-muted", className)}>
        {list.slice(0, 4).map((c, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={c} alt="" loading="lazy" className="w-full h-full object-cover" />
        ))}
      </div>
    );
  }
  if (list.length > 0) return <Cover src={list[0]} alt="" className={cn("rounded-none", className)} />;
  return (
    <div className={cn("flex items-center justify-center bg-gradient-to-br from-primary/30 to-accent/20", className)}>
      <ListMusic className="w-1/3 h-1/3 text-foreground/50" />
    </div>
  );
}

export function EqBars({ playing }: { playing: boolean }) {
  return (
    <span className={cn("inline-flex items-end gap-[2px] h-3.5", !playing && "eq-paused")} aria-hidden>
      <span className="eq-bar" />
      <span className="eq-bar" />
      <span className="eq-bar" />
    </span>
  );
}

export function SectionHeader({ title, subtitle, action, href }: { title: string; subtitle?: string; action?: React.ReactNode; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground truncate">
          {href ? <Link href={href} className="hover:underline">{title}</Link> : title}
        </h2>
        {subtitle && <p className="text-xs md:text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Hides explicit songs when the listener asked for it in Settings. */
export function useVisible(tracks: Track[] | undefined): Track[] {
  const hide = useAppStore((s) => s.settings.hideExplicit);
  return useMemo(() => (tracks ?? []).filter((t) => !(hide && t.explicit)), [tracks, hide]);
}

function useIsActive(trackId: string) {
  const active = usePlayerStore((s) => s.currentTrack?.id === trackId);
  const playing = usePlayerStore((s) => s.isPlaying);
  return { active, playing: active && playing };
}

export function LikeButton({ track, className }: { track: Track; className?: string }) {
  const { liked, toggle } = useTrackLiked(track);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle.mutate(!liked);
      }}
      aria-label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
      aria-pressed={liked}
      className={cn("p-1.5 rounded-full transition-colors", liked ? "text-primary" : "text-muted-foreground hover:text-foreground", className)}
    >
      <Heart className={cn("w-4 h-4", liked && "fill-current")} />
    </button>
  );
}

function MenuButton({ track, className, onRemove }: { track: Track; className?: string; onRemove?: { label: string; run: () => void } }) {
  const openMenu = useUiStore((s) => s.openMenu);
  return (
    <button
      aria-label={`More options for ${track.name}`}
      aria-haspopup="menu"
      onClick={(e) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        openMenu({ clientX: r.left, clientY: r.bottom + 4 }, track, onRemove);
      }}
      className={cn("p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10", className)}
    >
      <MoreHorizontal className="w-4 h-4" />
    </button>
  );
}

const artistLinks = (t: Track) =>
  (t.artists ?? []).map((a, i) => (
    <React.Fragment key={`${a.id}-${i}`}>
      {i > 0 && ", "}
      {a.id ? (
        <Link href={`/artist/${a.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline hover:text-foreground">
          {a.name}
        </Link>
      ) : (
        a.name
      )}
    </React.Fragment>
  ));

/* --------------------------------- cards ---------------------------------- */

/** Compact home tile (Spotify style): small cover + title, plays on click. */
export function QuickPlayCard({ title, image, onPlay, href, active }: { title: string; image?: string; onPlay?: () => void; href?: string; active?: boolean }) {
  const inner = (
    <>
      <Cover src={image} alt="" className="w-14 h-14 shrink-0 rounded-none" />
      <span className={cn("flex-1 text-sm font-semibold truncate px-3 text-left", active ? "text-primary" : "text-foreground")}>{title}</span>
      {onPlay && (
        <span className="mr-3 w-9 h-9 rounded-full bg-brand flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-4 h-4 fill-current ml-0.5" />
        </span>
      )}
    </>
  );
  const cls = "group flex items-center overflow-hidden rounded-xl bg-foreground/[0.06] hover:bg-foreground/[0.12] transition-colors min-w-0";
  return href ? (
    <Link href={href} className={cls}>{inner}</Link>
  ) : (
    <button onClick={onPlay} className={cls}>{inner}</button>
  );
}

export function TrackCard({ track, context }: { track: Track; context?: Track[] }) {
  const play = usePlayTrack();
  const { active, playing } = useIsActive(track.id);
  const openMenu = useUiStore((s) => s.openMenu);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => play(track, context)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), play(track, context))}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(e, track);
      }}
      aria-label={`Play ${track.name} by ${track.artists?.[0]?.name ?? ""}`}
      className="group relative w-40 md:w-44 text-left p-3 rounded-3xl glass-card card-lift cursor-pointer"
    >
      <div className="relative">
        <Cover src={track.album?.images?.[0]?.url} alt={track.name} className="aspect-square w-full shadow-lg" />
        <span className={cn("absolute right-2 bottom-2 w-10 h-10 rounded-full bg-brand flex items-center justify-center shadow-xl transition-all", active ? "opacity-100" : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0")}>
          {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </span>
        <MenuButton track={track} className="absolute left-1.5 top-1.5 bg-black/40 text-white opacity-0 group-hover:opacity-100 backdrop-blur" />
      </div>
      <p className={cn("mt-3 text-sm font-semibold truncate", active ? "text-primary" : "text-foreground")}>{track.name}</p>
      <p className="text-xs text-muted-foreground truncate">{artistLinks(track)}</p>
    </div>
  );
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link href={`/artist/${artist.id}`} className="group w-36 md:w-40 text-center p-3 rounded-3xl glass-card card-lift block">
      <Cover src={artist.images?.[0]?.url} alt={artist.name} round className="aspect-square w-full shadow-lg" />
      <p className="mt-3 text-sm font-semibold text-foreground truncate">{artist.name}</p>
      <p className="text-xs text-muted-foreground truncate capitalize">{artist.genres?.[0] || "Artist"}</p>
    </Link>
  );
}

export function AlbumCard({ album, artistName }: { album: AlbumSummary; artistName?: string }) {
  return (
    <Link href={`/album/${album.id}`} className="group w-40 md:w-44 text-left p-3 rounded-3xl glass-card card-lift block">
      <Cover src={album.images?.[0]?.url} alt={album.name} className="aspect-square w-full shadow-lg" />
      <p className="mt-3 text-sm font-semibold text-foreground truncate">{album.name}</p>
      <p className="text-xs text-muted-foreground truncate">{[album.release_date?.slice(0, 4), artistName].filter(Boolean).join(" · ") || "Album"}</p>
    </Link>
  );
}

export function PlaylistCard({ playlist }: { playlist: UserPlaylist }) {
  return (
    <Link href={`/playlist/${playlist.id}`} className="group w-40 md:w-44 text-left p-3 rounded-3xl glass-card card-lift block">
      <PlaylistCover covers={playlist.covers} className="aspect-square w-full rounded-2xl shadow-lg" />
      <p className="mt-3 text-sm font-semibold text-foreground truncate">{playlist.name}</p>
      <p className="text-xs text-muted-foreground truncate">{playlist.track_count} songs</p>
    </Link>
  );
}

/* ---------------------------------- rows ---------------------------------- */

export function TrackRow({
  track,
  index,
  context,
  showAlbum = true,
  onRemove,
}: {
  track: Track;
  index?: number;
  context?: Track[];
  showAlbum?: boolean;
  onRemove?: { label: string; run: () => void };
}) {
  const play = usePlayTrack();
  const { active, playing } = useIsActive(track.id);
  const openMenu = useUiStore((s) => s.openMenu);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => play(track, context)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), play(track, context))}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(e, track, onRemove);
      }}
      style={{ paddingTop: "var(--row-py)", paddingBottom: "var(--row-py)" }}
      className={cn(
        "group grid items-center gap-3 px-2.5 rounded-2xl cursor-pointer transition-colors",
        showAlbum ? "grid-cols-[2rem_minmax(0,1fr)_2rem_3rem_2rem] md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,0.7fr)_2rem_3rem_2rem]" : "grid-cols-[2rem_minmax(0,1fr)_2rem_3rem_2rem]",
        active ? "bg-foreground/10" : "hover:bg-foreground/[0.06]"
      )}
    >
      <span className="w-8 flex items-center justify-center text-xs text-muted-foreground tabular-nums">
        {active ? (
          <EqBars playing={playing} />
        ) : (
          <>
            <span className={cn(index === undefined && "hidden", "group-hover:hidden")}>{(index ?? 0) + 1}</span>
            <Play className={cn("w-4 h-4 fill-current text-foreground", index !== undefined && "hidden group-hover:block")} />
          </>
        )}
      </span>

      <div className="flex items-center gap-3 min-w-0">
        <Cover src={track.album?.images?.[0]?.url} alt={track.name} className="w-11 h-11 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className={cn("text-sm font-medium truncate", active ? "text-primary" : "text-foreground")}>{track.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {track.explicit && <span className="inline-block mr-1.5 px-1 rounded bg-foreground/15 text-[9px] font-bold align-middle">E</span>}
            {artistLinks(track)}
          </p>
        </div>
      </div>

      {showAlbum && (
        <span className="hidden md:block text-xs text-muted-foreground truncate">
          {track.album?.id ? (
            <Link href={`/album/${track.album.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline hover:text-foreground">
              {track.album.name}
            </Link>
          ) : (
            track.album?.name
          )}
        </span>
      )}

      <LikeButton track={track} className="opacity-0 group-hover:opacity-100 focus:opacity-100 [&[aria-pressed=true]]:opacity-100" />
      <span className="text-xs text-muted-foreground tabular-nums text-right">{track.duration_ms ? formatDuration(track.duration_ms) : ""}</span>
      <MenuButton track={track} onRemove={onRemove} className="opacity-0 group-hover:opacity-100 focus:opacity-100" />
    </div>
  );
}

/* -------------------------------- feedback -------------------------------- */

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

export function RowSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2.5">
          <div className="w-11 h-11 rounded-xl skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded skeleton" />
            <div className="h-2.5 w-1/5 rounded skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ title, detail, onRetry, action }: { title: string; detail?: string; onRetry?: () => void; action?: React.ReactNode }) {
  return (
    <div role="alert" className="glass-card rounded-3xl p-8 text-center max-w-lg mx-auto space-y-3">
      <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      <div className="flex justify-center gap-2 pt-1">
        {onRetry && (
          <button onClick={onRetry} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-pill text-sm text-foreground">
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        )}
        {action}
      </div>
    </div>
  );
}

export function EmptyState({ title, detail, action, icon: Icon = Music2 }: { title: string; detail?: string; action?: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="rounded-3xl border border-dashed border-foreground/15 p-10 text-center space-y-2">
      <Icon className="w-8 h-8 mx-auto text-muted-foreground" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {detail && <p className="text-sm text-muted-foreground max-w-sm mx-auto">{detail}</p>}
      {action}
    </div>
  );
}

/** Big header used by artist / album / playlist pages: blurred artwork backdrop + cover + actions. */
export function PageHero({
  image,
  cover,
  eyebrow,
  title,
  meta,
  round,
  children,
}: {
  image?: string;
  cover: React.ReactNode;
  eyebrow: string;
  title: string;
  meta?: React.ReactNode;
  round?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden border border-foreground/10 p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end gap-6", "rounded-[2rem]")}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" aria-hidden className={cn("absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-50", round && "opacity-40")} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="relative shrink-0">{cover}</div>
      <div className="relative text-center md:text-left space-y-2 min-w-0 flex-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{eyebrow}</p>
        <h1 className="text-3xl md:text-6xl font-extrabold tracking-tight text-foreground break-words">{title}</h1>
        {meta && <div className="text-sm text-muted-foreground">{meta}</div>}
        {children && <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">{children}</div>}
      </div>
    </div>
  );
}
