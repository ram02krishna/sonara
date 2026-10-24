"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, Loader2, Play, Search as SearchIcon, X } from "lucide-react";
import { friendlyError, useBrowseCategories, useSearch } from "@/hooks/useSonara";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { AlbumCard, ArtistCard, Cover, EmptyState, ErrorState, RowSkeleton, SectionHeader, TrackRow, useVisible } from "@/components/ui/media";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Filter = "all" | "track" | "artist" | "album";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "track", label: "Songs" },
  { id: "artist", label: "Artists" },
  { id: "album", label: "Albums" },
];
const RECENT_KEY = "sonara-recent-searches";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  const [filter, setFilter] = useState<Filter>("all");
  const [recent, setRecent] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const play = usePlayTrack();
  const { data: categories } = useBrowseCategories();

  useEffect(() => setRecent(readRecent()), []);
  useEffect(() => setPage(0), [urlQuery, filter]);

  const { data, isFetching, error, refetch } = useSearch(urlQuery, filter === "all" ? undefined : filter, page * 10);
  const tracks = useVisible(data?.tracks);
  const artists = data?.artists ?? [];
  const albums = data?.albums ?? [];

  // Remember searches that actually returned something.
  useEffect(() => {
    const q = urlQuery.trim();
    if (!q || !data || (!tracks.length && !artists.length && !albums.length)) return;
    const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setRecent(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const clearRecent = () => {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignore */
    }
    setRecent([]);
  };

  const errInfo = error ? friendlyError(error) : null;
  const nothing = !!urlQuery && !isFetching && !error && !tracks.length && !artists.length && !albums.length;
  const show = (f: Filter) => filter === "all" || filter === f;

  // "Top result": an artist whose name matches the query, otherwise the first song.
  const exact = artists.find((a) => a.name.toLowerCase() === urlQuery.trim().toLowerCase());
  const top = page === 0 && filter === "all" ? (exact ? ({ kind: "artist", artist: exact } as const) : tracks[0] ? ({ kind: "track", track: tracks[0] } as const) : null) : null;

  if (!urlQuery) {
    return (
      <div className="p-4 md:p-8 space-y-10 max-w-6xl mx-auto">
        <header><h1 className="text-3xl font-extrabold tracking-tight">Search</h1><p className="text-sm text-muted-foreground mt-1">Songs, artists and albums, in any language. Press <kbd className="px-1.5 rounded bg-foreground/10 text-xs font-mono">/</kbd> to search from anywhere.</p></header>
        {recent.length > 0 && (
          <section>
            <SectionHeader title="Recent searches" action={<button onClick={clearRecent} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>} />
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button key={r} onClick={() => router.push(`/search?q=${encodeURIComponent(r)}`)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-pill text-sm"><Clock className="w-3.5 h-3.5 text-muted-foreground" />{r}</button>
              ))}
            </div>
          </section>
        )}
        {(categories?.length ?? 0) > 0 && (
          <section>
            <SectionHeader title="Browse all" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {categories!.map((c) => (
                <Link key={c.slug} href={`/explore/${c.slug}`} style={{ backgroundImage: `linear-gradient(135deg, ${c.color}, ${c.color}99)` }} className="relative h-24 rounded-2xl p-4 overflow-hidden text-white font-bold text-lg hover:scale-[1.02] transition-transform">
                  {c.title}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={cn("px-4 py-1.5 rounded-full text-sm font-medium transition-colors", filter === f.id ? "bg-foreground text-background" : "glass-pill text-foreground")}>
            {f.label}
          </button>
        ))}
        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-2" />}
      </div>

      {errInfo && <ErrorState title={errInfo.title} detail={errInfo.detail} onRetry={() => refetch()} />}
      {isFetching && !data && <RowSkeleton />}
      {nothing && <EmptyState icon={SearchIcon} title={`No results for “${urlQuery}”`} detail="Check the spelling or try fewer or different words." />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {top && (
          <section>
            <SectionHeader title="Top result" />
            {top.kind === "artist" ? (
              <Link href={`/artist/${top.artist.id}`} className="group relative block p-6 rounded-3xl glass-card card-lift">
                <Cover round src={top.artist.images?.[0]?.url} alt={top.artist.name} className="w-28 h-28 shadow-xl" />
                <p className="mt-4 text-3xl font-extrabold tracking-tight truncate">{top.artist.name}</p>
                <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-foreground/10 text-xs font-semibold">Artist</span>
              </Link>
            ) : (
              <div role="button" tabIndex={0} onClick={() => play(top.track, tracks)} onKeyDown={(e) => e.key === "Enter" && play(top.track, tracks)} className="group relative p-6 rounded-3xl glass-card card-lift cursor-pointer">
                <Cover src={top.track.album?.images?.[0]?.url} alt={top.track.name} className="w-28 h-28 shadow-xl" />
                <p className="mt-4 text-2xl font-extrabold tracking-tight line-clamp-2">{top.track.name}</p>
                <p className="text-sm text-muted-foreground truncate">{top.track.artists?.map((a) => a.name).join(", ")}</p>
                <span className="absolute right-5 bottom-5 w-12 h-12 rounded-full bg-brand flex items-center justify-center shadow-brand opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-5 h-5 fill-current ml-0.5" /></span>
              </div>
            )}
          </section>
        )}

        {show("track") && tracks.length > 0 && (
          <section className={cn(!top && "lg:col-span-2")}>
            <SectionHeader title="Songs" />
            <div className="space-y-0.5">{tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks} />)}</div>
          </section>
        )}
      </div>

      {show("artist") && artists.length > 0 && (
        <section><SectionHeader title="Artists" /><div className="shelf shelf-fade">{artists.map((a) => <ArtistCard key={a.id} artist={a} />)}</div></section>
      )}
      {show("album") && albums.length > 0 && (
        <section><SectionHeader title="Albums" /><div className="shelf shelf-fade">{albums.map((a) => <AlbumCard key={a.id} album={a} />)}</div></section>
      )}

      {filter !== "all" && !!data && (tracks.length >= 10 || artists.length >= 10 || albums.length >= 10 || page > 0) && (
        <div className="flex justify-center gap-3">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-5 py-2 rounded-full glass-pill text-sm disabled:opacity-40">Previous</button>
          <button onClick={() => setPage((p) => p + 1)} className="px-5 py-2 rounded-full glass-pill text-sm">Show more</button>
        </div>
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
