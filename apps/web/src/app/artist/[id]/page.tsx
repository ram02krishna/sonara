"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Play, Shuffle, Music2 } from "lucide-react";
import { friendlyError, useArtist } from "@/hooks/useSonara";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { Cover, EmptyState, ErrorState, SectionHeader, TrackRow } from "@/components/ui/media";

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useArtist(id);
  const play = usePlayTrack();

  if (error) {
    const e = friendlyError(error);
    return <div className="p-8"><ErrorState title={e.title} detail={e.detail} onRetry={() => refetch()} /></div>;
  }
  if (isLoading || !data) return <div className="p-8"><div className="h-64 rounded-[2rem] skeleton" /></div>;

  const { artist, tracks } = data;

  const handleShuffle = () => {
    if (!tracks.length) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    play(shuffled[0], shuffled);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto pb-24">
      <div className="relative rounded-[2rem] overflow-hidden border border-foreground/10 p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end gap-6 shadow-xl">
        {artist.images?.[0]?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.images[0].url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <Cover src={artist.images?.[0]?.url} alt={artist.name} round className="relative w-40 h-40 md:w-48 md:h-48 shrink-0 shadow-2xl border-2 border-foreground/10" />
        <div className="relative text-center md:text-left space-y-3 min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-blue-500 font-bold">Verified Artist</p>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">{artist.name}</h1>
          {artist.genres?.length > 0 && (
            <div className="flex flex-wrap justify-center md:justify-start gap-1.5 pt-1">
              {artist.genres.slice(0, 4).map((g) => (
                <span key={g} className="px-3 py-1 rounded-full text-xs font-medium glass-pill text-muted-foreground capitalize">
                  {g}
                </span>
              ))}
            </div>
          )}
          {tracks.length > 0 && (
            <div className="pt-2 flex items-center justify-center md:justify-start gap-3">
              <button
                onClick={() => play(tracks[0], tracks)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 hover:scale-105 active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" /> Play
              </button>
              <button
                onClick={handleShuffle}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full glass-card hover:bg-foreground/10 text-foreground font-semibold text-sm transition-all hover:scale-105 active:scale-95 border border-foreground/10"
              >
                <Shuffle className="w-4 h-4 text-blue-500" /> Shuffle
              </button>
            </div>
          )}
        </div>
      </div>

      <section>
        <SectionHeader
          title="Popular Tracks"
          subtitle={`${tracks.length} popular tracks available in studio master`}
        />
        {tracks.length ? (
          <div className="space-y-0.5">
            {tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks} />)}
          </div>
        ) : (
          <EmptyState title="No songs found" detail="We couldn't locate songs for this artist right now." />
        )}
      </section>
    </div>
  );
}
