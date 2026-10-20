"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { friendlyError, useSearch } from "@/hooks/useSonara";
import { AlbumCard, ArtistCard, Cover, EmptyState, ErrorState, SectionHeader, TrackRow } from "@/components/ui/media";
import { cn } from "@/lib/utils";

type Filter = "all" | "track" | "artist" | "album" | "playlist";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "track", label: "Songs" },
  { id: "artist", label: "Artists" },
  { id: "album", label: "Albums" },
  { id: "playlist", label: "Playlists" },
];

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [input, setInput] = useState(urlQuery);
  const [filter, setFilter] = useState<Filter>("all");

  // The URL (?q=) is the single source of truth, shared with the header search box.
  useEffect(() => setInput(urlQuery), [urlQuery]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (input.trim() !== urlQuery.trim()) router.replace(input.trim() ? `/search?q=${encodeURIComponent(input.trim())}` : "/search");
    }, 350);
    return () => clearTimeout(t);
  }, [input, urlQuery, router]);

  const { data, isFetching, error, refetch } = useSearch(urlQuery, filter === "all" ? undefined : filter);
  const errInfo = error ? friendlyError(error) : null;
  const tracks = data?.tracks ?? [];
  const artists = data?.artists ?? [];
  const albums = data?.albums ?? [];
  const playlists = data?.playlists ?? [];
  const nothing = !!urlQuery && !isFetching && !error && !tracks.length && !artists.length && !albums.length && !playlists.length;
  const show = (f: Filter) => filter === "all" || filter === f;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div className="relative max-w-2xl">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Songs, artists, albums, playlists, in any language"
          className="w-full pl-12 pr-12 py-4 rounded-2xl glass-pill text-base text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50"
        />
        {isFetching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              filter === f.id ? "bg-foreground text-background" : "glass-pill text-foreground hover:bg-foreground/10"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!urlQuery && <EmptyState title="Search Spotify's catalogue" detail="Find any song, artist or album, in any language." />}
      {errInfo && <ErrorState title={errInfo.title} detail={errInfo.detail} onRetry={() => refetch()} />}
      {nothing && <EmptyState title={`No results for “${urlQuery}”`} detail="Check the spelling or try another search." />}

      {show("track") && tracks.length > 0 && (
        <section>
          <SectionHeader title="Songs" />
          <div className="space-y-0.5">
            {tracks.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} context={tracks} />
            ))}
          </div>
        </section>
      )}
      {show("artist") && artists.length > 0 && (
        <section>
          <SectionHeader title="Artists" />
          <div className="shelf">{artists.map((a) => <ArtistCard key={a.id} artist={a} />)}</div>
        </section>
      )}
      {show("album") && albums.length > 0 && (
        <section>
          <SectionHeader title="Albums" />
          <div className="shelf">{albums.map((a) => <AlbumCard key={a.id} album={a} />)}</div>
        </section>
      )}
      {show("playlist") && playlists.length > 0 && (
        <section>
          <SectionHeader title="Playlists" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {playlists.map((p) => (
              <Link key={p.id} href={`/playlist/${p.id}`} className="flex items-center gap-3 p-3 rounded-2xl glass-card">
                <Cover src={p.images?.[0]?.url} alt={p.name} className="w-14 h-14 shrink-0 rounded-xl" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.owner_name ? `By ${p.owner_name}` : "Playlist"}</p>
                </div>
              </Link>
            ))}
          </div>
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
