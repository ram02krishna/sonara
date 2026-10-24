"use client";

import React from "react";
import Link from "next/link";
import { Pause, Play, SlidersHorizontal } from "lucide-react";
import { DashboardSection, Track } from "@/types/api";
import { AlbumCard, ArtistCard, Cover, SectionHeader, TrackCard, TrackRow, useVisible } from "@/components/ui/media";
import { usePlayerStore } from "@/store/usePlayerStore";

/** Renders one server-driven dashboard section by its type/kind: new sections need no frontend change. */
export function SectionRenderer({ section }: { section: DashboardSection }) {
  const tracks = useVisible(section.tracks);
  const artists = section.artists ?? [];
  const albums = section.albums ?? [];

  if (section.type === "grid" && section.kind !== "albums") {
    return (
      <section aria-label={section.title}>
        <SectionHeader title={section.title} subtitle={section.subtitle} />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6">
          {tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks} />)}
        </div>
      </section>
    );
  }

  return (
    <section aria-label={section.title}>
      <SectionHeader title={section.title} subtitle={section.subtitle} />
      <div className="shelf shelf-fade">
        {section.kind === "tracks" && tracks.map((t) => <TrackCard key={t.id} track={t} context={tracks} />)}
        {section.kind === "artists" && artists.map((a) => <ArtistCard key={a.id} artist={a} />)}
        {section.kind === "albums" && albums.map((a) => <AlbumCard key={a.id} album={a} />)}
      </div>
    </section>
  );
}

/** Hero banner: the listener's top artist (or a lead track), with one-tap play of their mix. */
export function Hero({ section, genres, playable }: { section?: DashboardSection; genres: string[]; playable: Track[] }) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentId = usePlayerStore((s) => s.currentTrack?.id);
  const playList = usePlayerStore((s) => s.playList);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);

  const artist = section?.artists?.[0];
  const lead = section?.tracks?.[0];
  const image = artist?.images?.[0]?.url ?? lead?.album?.images?.[0]?.url;
  const title = artist?.name ?? lead?.name;
  const playing = !!playable.length && currentId === playable[0].id && isPlaying;
  if (!title) return null;

  return (
    <div className="relative rounded-[2rem] overflow-hidden border border-foreground/10 min-h-[240px] md:min-h-[290px] flex items-end">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
      <div className="relative z-10 p-6 md:p-10 flex flex-col sm:flex-row sm:items-end gap-6 w-full">
        <Cover src={image} alt={title} round={!!artist} className="w-32 h-32 md:w-44 md:h-44 shrink-0 shadow-2xl ring-1 ring-foreground/10" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{section?.title ?? (artist ? "Featured Artist" : "Featured Track")}</p>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground truncate">{title}</h2>
          {genres.length > 0 && <p className="text-sm text-muted-foreground capitalize truncate">Your sound: {genres.slice(0, 4).join(" · ")}</p>}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {playable.length > 0 && (
              <button
                onClick={() => (currentId === playable[0].id ? setIsPlaying(!isPlaying) : playList(playable, 0))}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand font-semibold text-sm shadow-brand hover:scale-105 active:scale-95 transition-transform"
              >
                {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                {playing ? "Pause" : "Play your mix"}
              </button>
            )}
            <Link href="/onboarding" className="inline-flex items-center gap-2 px-4 py-3 rounded-full glass-pill text-sm font-medium text-foreground">
              <SlidersHorizontal className="w-4 h-4" /> Tune your taste
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
