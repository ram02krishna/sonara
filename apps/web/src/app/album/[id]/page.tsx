"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Heart, Play, Shuffle } from "lucide-react";
import { friendlyError, useAlbum, useCollectionToggle } from "@/hooks/useSonara";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { Cover, ErrorState, PageHero, RowSkeleton, TrackRow, useVisible } from "@/components/ui/media";
import { formatDuration } from "@/lib/utils";

export default function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useAlbum(id);
  const toggle = useCollectionToggle("album");
  const addToast = useAppStore((s) => s.addToast);
  const playList = usePlayerStore((s) => s.playList);
  const tracks = useVisible(data?.album.tracks);

  if (error) {
    const e = friendlyError(error);
    return <div className="p-8"><ErrorState title={e.title} detail={e.detail} onRetry={() => refetch()} /></div>;
  }
  if (isLoading || !data) return <div className="p-8 space-y-6"><div className="h-60 rounded-[2rem] skeleton" /><RowSkeleton /></div>;

  const { album, saved } = data;
  const a = album.album;
  const total = album.tracks.reduce((s, t) => s + (t.duration_ms || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <PageHero
        image={a.images?.[0]?.url}
        cover={<Cover src={a.images?.[0]?.url} alt={a.name} className="w-44 h-44 md:w-56 md:h-56 shadow-2xl" />}
        eyebrow="Album"
        title={a.name}
        meta={
          <p>
            {album.artists.map((ar, i) => <React.Fragment key={ar.id}>{i > 0 && ", "}<Link href={`/artist/${ar.id}`} className="font-semibold text-foreground hover:underline">{ar.name}</Link></React.Fragment>)}
            {a.release_date ? ` · ${a.release_date.slice(0, 4)}` : ""} · {album.total_tracks || album.tracks.length} songs{total ? `, ${formatDuration(total)}` : ""}
          </p>
        }
      >
        {tracks.length > 0 && (
          <>
            <button onClick={() => playList(tracks, 0)} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand font-semibold text-sm shadow-brand hover:scale-105 transition-transform"><Play className="w-4 h-4 fill-current ml-0.5" />Play</button>
            <button onClick={() => playList([...tracks].sort(() => Math.random() - 0.5), 0)} className="inline-flex items-center gap-2 px-5 py-3 rounded-full glass-pill text-sm font-semibold"><Shuffle className="w-4 h-4" />Shuffle</button>
          </>
        )}
        <button
          aria-pressed={saved}
          aria-label={saved ? "Remove album from your library" : "Save album to your library"}
          onClick={() =>
            toggle.mutate(
              { item: { id: a.id, name: a.name, images: a.images, release_date: a.release_date, uri: a.uri } as never, on: !saved },
              { onSuccess: () => addToast({ title: saved ? "Removed from library" : "Saved to your library", description: a.name, type: "success", duration: 2000 }) }
            )
          }
          className={`p-3 rounded-full glass-pill ${saved ? "text-primary" : ""}`}
        >
          <Heart className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />
        </button>
      </PageHero>

      <div className="space-y-0.5">
        {tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks} showAlbum={false} />)}
      </div>
      {album.label && <p className="text-xs text-muted-foreground">© {album.label}</p>}
    </div>
  );
}
