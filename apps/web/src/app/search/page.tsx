"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Pause, Disc3, Music2, Radio, Headphones, Mic2, Flame, Heart, Moon, Dumbbell } from "lucide-react";
import { friendlyError, useSearch } from "@/hooks/useSonara";
import {
  AlbumCard,
  ArtistCard,
  Cover,
  EmptyState,
  ErrorState,
  PlaylistCard,
  SectionHeader,
  TrackRow,
} from "@/components/ui/media";
import { cn } from "@/lib/utils";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { usePlayerStore } from "@/store/usePlayerStore";
import type { Track, Artist } from "@/types/api";

type Filter = "all" | "track" | "artist" | "album" | "playlist";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "track", label: "Songs" },
  { id: "artist", label: "Artists" },
  { id: "album", label: "Albums" },
  { id: "playlist", label: "Playlists" },
];

interface BrowseCategory {
  title: string;
  query: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BROWSE_CATEGORIES: BrowseCategory[] = [
  { title: "Pop", query: "pop", color: "from-pink-600 to-rose-700", icon: Music2 },
  { title: "Hip-Hop", query: "hip-hop", color: "from-orange-600 to-amber-700", icon: Flame },
  { title: "Rock", query: "rock", color: "from-red-600 to-rose-800", icon: Disc3 },
  { title: "Dance & EDM", query: "dance edm", color: "from-teal-500 to-cyan-700", icon: Headphones },
  { title: "Indie & Alt", query: "indie", color: "from-blue-600 to-indigo-800", icon: Radio },
  { title: "R&B", query: "r&b", color: "from-purple-600 to-indigo-800", icon: Mic2 },
  { title: "K-Pop", query: "k-pop", color: "from-sky-500 to-blue-700", icon: Music2 },
  { title: "Bollywood", query: "bollywood", color: "from-amber-500 to-orange-700", icon: Disc3 },
  { title: "Workout", query: "workout", color: "from-orange-500 to-red-600", icon: Dumbbell },
  { title: "Chill & Lo-Fi", query: "chill lofi", color: "from-indigo-600 to-violet-800", icon: Headphones },
  { title: "Romance", query: "romance", color: "from-rose-500 to-pink-700", icon: Heart },
  { title: "Sleep & Calm", query: "sleep calm", color: "from-slate-700 to-zinc-900", icon: Moon },
];

function TopResultCard({ track, artist }: { track?: Track; artist?: Artist }) {
  const play = usePlayTrack();
  const { currentTrack, isPlaying } = usePlayerStore();
  const router = useRouter();

  if (artist && (!track || artist.name.toLowerCase() === track.artists?.[0]?.name?.toLowerCase())) {
    return (
      <div
        onClick={() => router.push(`/artist/${artist.id}`)}
        className="group relative p-5 rounded-2xl glass-card hover:bg-foreground/10 transition-all cursor-pointer flex flex-col justify-between h-full"
      >
        <div className="space-y-4">
          <div className="w-24 h-24 rounded-full overflow-hidden shadow-lg bg-foreground/5">
            <Cover src={artist.images?.[0]?.url} alt={artist.name} round className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground group-hover:underline underline-offset-4 line-clamp-1">
              {artist.name}
            </h3>
            <span className="inline-block mt-2 px-3 py-1 rounded-full bg-foreground/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Artist
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (track) {
    const active = currentTrack?.id === track.id;
    return (
      <div
        onClick={() => play(track)}
        className="group relative p-5 rounded-2xl glass-card hover:bg-foreground/10 transition-all cursor-pointer flex flex-col justify-between h-full"
      >
        <div className="space-y-4">
          <div className="w-24 h-24 rounded-xl overflow-hidden shadow-lg bg-foreground/5">
            <Cover src={track.album?.images?.[0]?.url} alt={track.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground group-hover:underline underline-offset-4 line-clamp-1">
              {track.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              <span className="text-foreground font-medium">{track.artists?.map((a) => a.name).join(", ")}</span>
              <span className="mx-2">•</span>
              <span className="px-2.5 py-0.5 rounded-full bg-foreground/10 text-xs uppercase tracking-wider">Song</span>
            </p>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            play(track);
          }}
          aria-label={active && isPlaying ? "Pause" : "Play"}
          className={cn(
            "absolute right-5 bottom-5 w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-2xl transition-all duration-200",
            active && isPlaying
              ? "opacity-100 scale-100"
              : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105 active:scale-95"
          )}
        >
          {active && isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>
      </div>
    );
  }

  return null;
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [filter, setFilter] = useState<Filter>("all");

  // Focus the navbar search input on mount if no query
  useEffect(() => {
    if (!urlQuery) {
      document.getElementById("sonara-navbar-search")?.focus();
    }
  }, [urlQuery]);

  const { data, isFetching, error, refetch } = useSearch(urlQuery, filter === "all" ? undefined : filter);
  const errInfo = error ? friendlyError(error) : null;
  const tracks = data?.tracks ?? [];
  const artists = data?.artists ?? [];
  const albums = data?.albums ?? [];
  const playlists = data?.playlists ?? [];
  const nothing = !!urlQuery && !isFetching && !error && !tracks.length && !artists.length && !albums.length && !playlists.length;
  const show = (f: Filter) => filter === "all" || filter === f;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Category Filter Chips (Shown when a query is active) */}
      {urlQuery && (
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all",
                filter === f.id
                  ? "bg-foreground text-background shadow-md scale-105"
                  : "glass-pill text-foreground hover:bg-foreground/10"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Error State */}
      {errInfo && <ErrorState title={errInfo.title} detail={errInfo.detail} onRetry={() => refetch()} />}

      {/* Empty State when no results found */}
      {nothing && (
        <EmptyState
          title={`No results found for "${urlQuery}"`}
          detail="Please make sure your words are spelled correctly, or try different keywords or genres."
        />
      )}

      {/* Default Browse All (Spotify Style) when no search query */}
      {!urlQuery && (
        <section className="space-y-5">
          <SectionHeader title="Browse all" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {BROWSE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.title}
                  onClick={() => router.push(`/search?q=${encodeURIComponent(cat.query)}`)}
                  className={cn(
                    "group relative aspect-square p-4 rounded-2xl bg-gradient-to-br text-left text-white overflow-hidden shadow-md cursor-pointer",
                    cat.color
                  )}
                >
                  <span className="font-extrabold text-base md:text-lg tracking-tight block max-w-[80%] leading-tight">
                    {cat.title}
                  </span>
                  <div className="absolute -right-2 -bottom-2 w-16 h-16 rounded-full bg-white/10 flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
                    <Icon className="w-8 h-8 text-white/90" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* All Filter: Top Result + Songs Side by Side */}
      {filter === "all" && (tracks.length > 0 || artists.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5 flex flex-col">
            <h2 className="text-xl font-bold text-foreground mb-3">Top result</h2>
            <div className="flex-1">
              <TopResultCard track={tracks[0]} artist={artists[0]} />
            </div>
          </div>
          {tracks.length > 0 && (
            <div className="lg:col-span-7 flex flex-col">
              <h2 className="text-xl font-bold text-foreground mb-3">Songs</h2>
              <div className="space-y-1">
                {tracks.slice(0, 4).map((t, i) => (
                  <TrackRow key={t.id} track={t} index={i} context={tracks} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Songs Section (when filter is track or full list) */}
      {filter === "track" && tracks.length > 0 && (
        <section className="space-y-2">
          <SectionHeader title="Songs" />
          <div className="space-y-0.5">
            {tracks.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} context={tracks} />
            ))}
          </div>
        </section>
      )}

      {/* Artists Section */}
      {show("artist") && artists.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Artists" />
          {filter === "artist" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {artists.map((a) => (
                <ArtistCard key={a.id} artist={a} />
              ))}
            </div>
          ) : (
            <div className="shelf">
              {artists.map((a) => (
                <ArtistCard key={a.id} artist={a} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Albums Section */}
      {show("album") && albums.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Albums" />
          {filter === "album" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {albums.map((a) => (
                <AlbumCard key={a.id} album={a} />
              ))}
            </div>
          ) : (
            <div className="shelf">
              {albums.map((a) => (
                <AlbumCard key={a.id} album={a} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Playlists Section */}
      {show("playlist") && playlists.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Playlists" />
          {filter === "playlist" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {playlists.map((p) => (
                <PlaylistCard key={p.id} playlist={p} />
              ))}
            </div>
          ) : (
            <div className="shelf">
              {playlists.map((p) => (
                <PlaylistCard key={p.id} playlist={p} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchInner />
    </Suspense>
  );
}
