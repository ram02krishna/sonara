"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Play } from "lucide-react";
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
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="relative rounded-[2rem] overflow-hidden border border-foreground/10 p-6 md:p-10 flex flex-col md:flex-row items-center md:items-end gap-6">
        {artist.images?.[0]?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.images[0].url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <Cover src={artist.images?.[0]?.url} alt={artist.name} round className="relative w-40 h-40 md:w-48 md:h-48 shrink-0 shadow-2xl" />
        <div className="relative text-center md:text-left space-y-2 min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Artist</p>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground">{artist.name}</h1>
          {artist.genres?.length > 0 && <p className="text-sm text-muted-foreground capitalize">{artist.genres.slice(0, 4).join(" · ")}</p>}
          {tracks.length > 0 && (
            <button
              onClick={() => play(tracks[0], tracks)}
              className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold text-sm shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" /> Play
            </button>
          )}
        </div>
      </div>

      <section>
        <SectionHeader title="Songs" subtitle="From Spotify's catalogue" />
        {tracks.length ? (
          <div className="space-y-0.5">
            {tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks} />)}
          </div>
        ) : (
          <EmptyState title="No songs found" />
        )}
      </section>
    </div>
  );
}
