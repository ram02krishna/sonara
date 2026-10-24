"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { Play, Shuffle } from "lucide-react";
import { friendlyError, useArtist, useCollectionToggle } from "@/hooks/useSonara";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { AlbumCard, Cover, EmptyState, ErrorState, PageHero, RowSkeleton, SectionHeader, TrackRow, useVisible } from "@/components/ui/media";
import { cn } from "@/lib/utils";

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useArtist(id);
  const follow = useCollectionToggle("artist");
  const addToast = useAppStore((s) => s.addToast);
  const playList = usePlayerStore((s) => s.playList);
  const [showAll, setShowAll] = useState(false);
  const tracks = useVisible(data?.tracks);

  if (error) {
    const e = friendlyError(error);
    return <div className="p-8"><ErrorState title={e.title} detail={e.detail} onRetry={() => refetch()} /></div>;
  }
  if (isLoading || !data) return <div className="p-8 space-y-6"><div className="h-64 rounded-[2rem] skeleton" /><RowSkeleton /></div>;

  const { artist, albums, following } = data;
  const shown = showAll ? tracks : tracks.slice(0, 5);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-10">
      <PageHero
        round
        image={artist.images?.[0]?.url}
        cover={<Cover round src={artist.images?.[0]?.url} alt={artist.name} className="w-40 h-40 md:w-52 md:h-52 shadow-2xl" />}
        eyebrow="Artist"
        title={artist.name}
        meta={artist.genres?.length ? <span className="capitalize">{artist.genres.slice(0, 4).join(" · ")}</span> : undefined}
      >
        {tracks.length > 0 && (
          <>
            <button onClick={() => playList(tracks, 0)} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand font-semibold text-sm shadow-brand hover:scale-105 transition-transform"><Play className="w-4 h-4 fill-current ml-0.5" />Play</button>
            <button onClick={() => playList([...tracks].sort(() => Math.random() - 0.5), 0)} className="inline-flex items-center gap-2 px-5 py-3 rounded-full glass-pill text-sm font-semibold"><Shuffle className="w-4 h-4" />Shuffle</button>
          </>
        )}
        <button
          aria-pressed={following}
          onClick={() =>
            follow.mutate(
              { item: { id: artist.id, name: artist.name, images: artist.images, genres: artist.genres, uri: artist.uri } as never, on: !following },
              { onSuccess: () => addToast({ title: following ? `Unfollowed ${artist.name}` : `Following ${artist.name}`, type: "success", duration: 2000 }) }
            )
          }
          className={cn("px-6 py-3 rounded-full text-sm font-semibold border transition-colors", following ? "border-foreground/30 hover:border-foreground" : "glass-pill")}
        >
          {following ? "Following" : "Follow"}
        </button>
      </PageHero>

      <section>
        <SectionHeader title="Popular" subtitle="Songs from the catalogue" />
        {shown.length ? (
          <>
            <div className="space-y-0.5">{shown.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks} />)}</div>
            {tracks.length > 5 && (
              <button onClick={() => setShowAll((s) => !s)} className="mt-3 px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">{showAll ? "Show less" : `Show ${tracks.length - 5} more`}</button>
            )}
          </>
        ) : (
          <EmptyState title="No songs found" detail="The catalogue didn't return songs for this artist." />
        )}
      </section>

      {albums.length > 0 && (
        <section>
          <SectionHeader title="Albums & singles" />
          <div className="shelf shelf-fade">{albums.map((al) => <AlbumCard key={al.id} album={al} />)}</div>
        </section>
      )}
    </div>
  );
}
