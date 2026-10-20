"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Play, Lock } from "lucide-react";
import { friendlyError, usePlaylist } from "@/hooks/useSonara";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { Cover, EmptyState, ErrorState, TrackRow } from "@/components/ui/media";

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = usePlaylist(id);
  const play = usePlayTrack();

  if (error) {
    const e = friendlyError(error);
    return <div className="p-8"><ErrorState title={e.title} detail={e.detail} onRetry={() => refetch()} /></div>;
  }
  if (isLoading || !data) return <div className="p-8"><div className="h-64 rounded-[2rem] skeleton" /></div>;

  const { playlist, tracks } = data;
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
        <Cover src={playlist.images?.[0]?.url} alt={playlist.name} className="w-44 h-44 md:w-52 md:h-52 shrink-0 shadow-2xl" />
        <div className="text-center md:text-left space-y-2 min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Playlist</p>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">{playlist.name}</h1>
          <p className="text-sm text-muted-foreground">
            {playlist.owner_name ? `By ${playlist.owner_name} · ` : ""}
            {playlist.tracks_total ?? tracks.length} tracks
          </p>
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

      {tracks.length ? (
        <div className="space-y-0.5">
          {tracks.map((t, i) => <TrackRow key={`${t.id}-${i}`} track={t} index={i} context={tracks} />)}
        </div>
      ) : (
        <EmptyState
          title="Tracks aren't available for this playlist"
          detail="Only playlists you own or collaborate on can display private track contents."
          action={<Lock className="w-4 h-4 mx-auto text-muted-foreground" />}
        />
      )}
    </div>
  );
}
