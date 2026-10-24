"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, Plus } from "lucide-react";
import { friendlyError, useFollowing, usePlaylists, useRecentlyPlayed, useSavedAlbums, useSavedTracks } from "@/hooks/useSonara";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useUiStore } from "@/store/useUiStore";
import { AlbumCard, ArtistCard, EmptyState, ErrorState, PlaylistCard, RowSkeleton, TrackRow, useVisible } from "@/components/ui/media";
import { cn } from "@/lib/utils";

type Tab = "playlists" | "liked" | "artists" | "albums" | "recent";
const TABS: { id: Tab; label: string }[] = [
  { id: "playlists", label: "Playlists" },
  { id: "liked", label: "Liked Songs" },
  { id: "artists", label: "Artists" },
  { id: "albums", label: "Albums" },
  { id: "recent", label: "Recently played" },
];

function LibraryInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "playlists") as Tab;
  const openCreatePlaylist = useUiStore((s) => s.openCreatePlaylist);
  const playList = usePlayerStore((s) => s.playList);

  const playlists = usePlaylists(tab === "playlists");
  const liked = useSavedTracks(tab === "liked");
  const artists = useFollowing(tab === "artists");
  const albums = useSavedAlbums(tab === "albums");
  const recent = useRecentlyPlayed(tab === "recent");
  const likedTracks = useVisible(liked.data);
  const recentTracks = useVisible(recent.data?.map((r) => r.track));

  const active = { playlists, liked, artists, albums, recent }[tab];
  const err = active.error ? friendlyError(active.error) : null;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Your Library</h1>
        <button onClick={() => openCreatePlaylist()} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand text-sm font-semibold shadow-brand"><Plus className="w-4 h-4" />New playlist</button>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => router.replace(`/library?tab=${t.id}`)} className={cn("px-4 py-1.5 rounded-full text-sm font-medium transition-colors", tab === t.id ? "bg-foreground text-background" : "glass-pill text-foreground")}>{t.label}</button>
        ))}
      </div>

      {err && <ErrorState title={err.title} detail={err.detail} onRetry={() => active.refetch()} />}
      {active.isLoading && <RowSkeleton rows={6} />}

      {!err && !active.isLoading && tab === "playlists" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <Link href="/library?tab=liked" className="p-3 rounded-3xl glass-card card-lift block">
            <span className="aspect-square w-full rounded-2xl bg-brand flex items-center justify-center shadow-lg"><Heart className="w-1/3 h-1/3 fill-current" /></span>
            <p className="mt-3 text-sm font-semibold">Liked Songs</p>
            <p className="text-xs text-muted-foreground">Your saved songs</p>
          </Link>
          {(playlists.data ?? []).map((p) => <PlaylistCard key={p.id} playlist={p} />)}
          <button onClick={() => openCreatePlaylist()} className="p-3 rounded-3xl border border-dashed border-foreground/20 hover:border-foreground/40 flex flex-col items-center justify-center gap-2 min-h-[11rem] text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="w-8 h-8" /><span className="text-sm font-semibold">Create playlist</span>
          </button>
        </div>
      )}

      {!err && !active.isLoading && tab === "liked" &&
        (likedTracks.length ? (
          <div>
            <button onClick={() => playList(likedTracks, 0)} className="mb-3 px-5 py-2 rounded-full bg-brand text-sm font-semibold">Play all</button>
            <div className="space-y-0.5">{likedTracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={likedTracks} />)}</div>
          </div>
        ) : (
          <EmptyState icon={Heart} title="No liked songs yet" detail="Tap the heart on any song to save it here." />
        ))}

      {!err && !active.isLoading && tab === "artists" &&
        ((artists.data ?? []).length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">{artists.data!.map((a) => <ArtistCard key={a.id} artist={a} />)}</div>
        ) : (
          <EmptyState title="You aren't following anyone yet" detail="Open an artist and press Follow to keep them here." />
        ))}

      {!err && !active.isLoading && tab === "albums" &&
        ((albums.data ?? []).length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">{albums.data!.map((a) => <AlbumCard key={a.id} album={a} />)}</div>
        ) : (
          <EmptyState title="No saved albums" detail="Open an album and press the heart to save it." />
        ))}

      {!err && !active.isLoading && tab === "recent" &&
        (recentTracks.length ? (
          <div className="space-y-0.5">{recentTracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={recentTracks} />)}</div>
        ) : (
          <EmptyState title="Nothing played yet" detail="Songs you listen to for 15 seconds or more show up here." />
        ))}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryInner />
    </Suspense>
  );
}
