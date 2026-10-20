"use client";

import React from "react";
import Link from "next/link";
import { Play, Pause, SlidersHorizontal, Disc3 } from "lucide-react";
import { DashboardSection, Track } from "@/types/api";
import { AlbumCard, ArtistCard, Cover, SectionHeader, TrackCard, TrackRow } from "@/components/ui/media";
import { usePlayerStore } from "@/store/usePlayerStore";
import { usePlayTrack } from "@/hooks/usePlayTrack";

/** Renders one server-driven dashboard section by its type/kind. */
export function SectionRenderer({ section }: { section: DashboardSection }) {
  const tracks = section.tracks ?? [];
  const artists = section.artists ?? [];
  const albums = section.albums ?? [];

  const tuneAction =
    section.id === "new-releases" ? (
      <Link
        href="/onboarding"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-pill text-xs font-semibold text-foreground hover:text-primary hover:bg-foreground/10 transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
        <span>Tune taste</span>
      </Link>
    ) : undefined;

  if (section.type === "grid") {
    return (
      <section className="space-y-3">
        <SectionHeader title={section.title} subtitle={section.subtitle} action={tuneAction} />
        {section.kind === "albums" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-1">
            {tracks.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} context={tracks} />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeader title={section.title} subtitle={section.subtitle} action={tuneAction} />
      <div className="shelf">
        {section.kind === "tracks" && tracks.map((t) => <TrackCard key={t.id} track={t} context={tracks} />)}
        {section.kind === "artists" && artists.map((a) => <ArtistCard key={a.id} artist={a} />)}
        {section.kind === "albums" && albums.map((a) => <AlbumCard key={a.id} album={a} />)}
      </div>
    </section>
  );
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Apple Music style Spotlight Banner */
export function Hero({
  section,
  name,
  genres,
  playable,
}: {
  section?: DashboardSection;
  name?: string;
  genres: string[];
  playable: Track[];
}) {
  const play = usePlayTrack();
  const { currentTrack, isPlaying } = usePlayerStore();
  const artist = section?.artists?.[0];
  const leadTrack = section?.tracks?.[0];
  const image = artist?.images?.[0]?.url ?? leadTrack?.album?.images?.[0]?.url;
  const title = artist?.name ?? leadTrack?.name;
  const first = playable[0];
  const playing = !!first && currentTrack?.id === first.id && isPlaying;

  return (
    <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-foreground/10 bg-gradient-to-r from-card via-card/80 to-transparent min-h-[220px] md:min-h-[260px] flex items-end">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          aria-hidden
          className="absolute right-0 top-0 w-2/3 h-full object-cover blur-3xl opacity-20 dark:opacity-30 pointer-events-none"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />

      <div className="relative z-10 p-5 md:p-8 flex flex-col md:flex-row md:items-end gap-6 w-full">
        {image && (
          <Cover
            src={image}
            alt={title ?? ""}
            round={!!artist}
            className="w-28 h-28 md:w-36 md:h-36 shrink-0 shadow-2xl ring-1 ring-foreground/10"
          />
        )}

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Disc3 className="w-3.5 h-3.5 text-primary" />
            <span>Featured Spotlight</span>
          </div>

          {title ? (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground/80 font-semibold">
                {artist ? "Top Artist in Your Rotation" : section?.title}
              </p>
              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-foreground truncate mt-0.5">
                {title}
              </h1>
            </div>
          ) : (
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-foreground">
              What are we playing today?
            </h1>
          )}

          {genres.length > 0 && (
            <p className="text-xs md:text-sm text-muted-foreground capitalize truncate">
              Your sound: {genres.slice(0, 4).join(" · ")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {first && (
              <button
                onClick={() => play(first, playable)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-transform"
              >
                {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                {playing ? "Pause" : "Play Mix"}
              </button>
            )}
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full glass-pill text-xs font-semibold text-foreground hover:bg-foreground/10 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Tune taste
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
