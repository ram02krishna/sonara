"use client";

import React, { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, ListMusic } from "lucide-react";
import { friendlyError, useMyPlaylists, useSavedTracks, useTopArtists, useTopTracks } from "@/hooks/useSonara";
import { ArtistCard, Cover, EmptyState, ErrorState, ShelfSkeleton, TrackRow } from "@/components/ui/media";
import { cn } from "@/lib/utils";

type Tab = "liked" | "playlists" | "artists" | "tracks";
const TABS: { id: Tab; label: string }[] = [
  { id: "liked", label: "Liked Songs" },
  { id: "playlists", label: "Playlists" },
  { id: "artists", label: "Top Artists" },
  { id: "tracks", label: "Top Tracks" },
];

function LibraryInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "liked") as Tab;

  const liked = useSavedTracks(tab === "liked");
  const playlists = useMyPlaylists(tab === "playlists");
  const artists = useTopArtists("medium_term", tab === "artists");
  const tracks = useTopTracks("medium_term", tab === "tracks");

  const active = useMemo(() => ({ liked, playlists, artists, tracks })[tab], [tab, liked, playlists, artists, tracks]);
  const err = active.error ? friendlyError(active.error) : null;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg">
          <Heart className="w-7 h-7 text-foreground fill-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Your Library</h1>
          <p className="text-sm text-muted-foreground">Your personal collection, liked tracks, and favorite artists</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => router.replace(`/library?tab=${t.id}`)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              tab === t.id ? "bg-foreground text-background" : "glass-pill text-foreground hover:bg-foreground/10"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <ErrorState title={err.title} detail={err.detail} onRetry={() => active.refetch()} />}
      {active.isLoading && <ShelfSkeleton />}

      {!err && !active.isLoading && tab === "liked" && (
        (liked.data ?? []).length ? (
          <div className="space-y-0.5">
            {liked.data!.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={liked.data} />)}
          </div>
        ) : (
          <EmptyState title="No liked songs yet" detail="Tap the heart in the player to save songs here." />
        )
      )}

      {!err && !active.isLoading && tab === "tracks" && (
        <div className="space-y-0.5">
          {(tracks.data ?? []).map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks.data} />)}
          {!tracks.data?.length && <EmptyState title="No top tracks yet" detail="Listen on Spotify for a while and they'll show up here." />}
        </div>
      )}

      {!err && !active.isLoading && tab === "artists" && (
        (artists.data ?? []).length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {artists.data!.map((a) => <ArtistCard key={a.id} artist={a} />)}
          </div>
        ) : (
          <EmptyState title="No top artists yet" detail="Spotify builds this from your listening history." />
        )
      )}

      {!err && !active.isLoading && tab === "playlists" && (
        (playlists.data ?? []).length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {playlists.data!.map((p) => (
              <Link key={p.id} href={`/playlist/${p.id}`} className="flex items-center gap-3 p-3 rounded-2xl glass-card">
                <Cover src={p.images?.[0]?.url} alt={p.name} className="w-16 h-16 shrink-0 rounded-xl" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><ListMusic className="w-3 h-3" />{p.tracks_total ?? 0} tracks</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No playlists yet" detail="Create a playlist in Spotify and it will appear here." />
        )
      )}
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
