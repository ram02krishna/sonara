"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Play, Shuffle } from "lucide-react";
import { friendlyError, useCategory } from "@/hooks/useSonara";
import { usePlayerStore } from "@/store/usePlayerStore";
import { AlbumCard, ArtistCard, EmptyState, ErrorState, RowSkeleton, SectionHeader, ShelfSkeleton, TrackRow, useVisible } from "@/components/ui/media";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error, refetch } = useCategory(slug);
  const tracks = useVisible(data?.tracks);
  const playList = usePlayerStore((s) => s.playList);

  if (error) {
    const e = friendlyError(error);
    return <div className="p-8"><ErrorState title={e.title} detail={e.detail} onRetry={() => refetch()} /></div>;
  }
  const color = data?.category.color ?? "#3b82f6";

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto">
      <div className="relative rounded-[2rem] overflow-hidden p-8 md:p-12 min-h-[200px] flex flex-col justify-end text-white" style={{ backgroundImage: `linear-gradient(135deg, ${color}, ${color}66)` }}>
        <p className="text-xs uppercase tracking-widest font-semibold opacity-80">{data?.category.group ?? "Explore"}</p>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">{data?.category.title ?? "…"}</h1>
        {tracks.length > 0 && (
          <div className="flex gap-3 mt-5">
            <button onClick={() => playList(tracks, 0)} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black text-sm font-semibold hover:scale-105 transition-transform"><Play className="w-4 h-4 fill-current" />Play</button>
            <button onClick={() => { const s = [...tracks].sort(() => Math.random() - 0.5); playList(s, 0); }} className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-black/30 text-sm font-semibold hover:bg-black/40"><Shuffle className="w-4 h-4" />Shuffle</button>
          </div>
        )}
      </div>

      {isLoading ? (
        <><RowSkeleton /><ShelfSkeleton rounded /></>
      ) : (
        <>
          {tracks.length > 0 ? (
            <section>
              <SectionHeader title="Songs" />
              <div className="space-y-0.5">{tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks} />)}</div>
            </section>
          ) : (
            <EmptyState title="Nothing here right now" detail="The catalogue returned no songs for this category. Try another one." />
          )}
          {(data?.artists?.length ?? 0) > 0 && (
            <section><SectionHeader title="Artists" /><div className="shelf shelf-fade">{data!.artists.map((a) => <ArtistCard key={a.id} artist={a} />)}</div></section>
          )}
          {(data?.albums?.length ?? 0) > 0 && (
            <section><SectionHeader title="Albums" /><div className="shelf shelf-fade">{data!.albums.map((a) => <AlbumCard key={a.id} album={a} />)}</div></section>
          )}
        </>
      )}
    </div>
  );
}
