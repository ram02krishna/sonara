"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GripVertical, Pencil, Play, Plus, Search, Shuffle, Trash2 } from "lucide-react";
import { friendlyError, usePlaylist, usePlaylistActions, useSearch } from "@/hooks/useSonara";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useUiStore } from "@/store/useUiStore";
import { useAppStore } from "@/store/useAppStore";
import { Cover, EmptyState, ErrorState, PageHero, PlaylistCover, RowSkeleton, TrackRow, useVisible } from "@/components/ui/media";
import { Track } from "@/types/api";

function AddSongs({ playlistId, existing }: { playlistId: string; existing: Set<string> }) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useSearch(q, "track");
  const { addTracks } = usePlaylistActions();
  const addToast = useAppStore((s) => s.addToast);
  return (
    <section className="mt-10 space-y-3">
      <h2 className="text-xl font-bold">Let&apos;s find something for your playlist</h2>
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for songs to add" aria-label="Search songs to add" className="w-full pl-10 pr-4 py-2.5 rounded-full bg-foreground/[0.07] outline-none text-sm focus:ring-2 focus:ring-primary/30" />
      </div>
      {q && isFetching && <RowSkeleton rows={3} />}
      <div className="space-y-0.5">
        {(data?.tracks ?? []).map((t) => {
          const added = existing.has(t.id);
          return (
            <div key={t.id} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-foreground/[0.06]">
              <Cover src={t.album?.images?.[0]?.url} alt="" className="w-11 h-11 rounded-xl shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground truncate">{t.artists?.map((a) => a.name).join(", ")}</p>
              </div>
              <button
                disabled={added || addTracks.isPending}
                onClick={() => addTracks.mutate({ id: playlistId, tracks: [t] }, { onSuccess: () => addToast({ title: "Added", description: t.name, type: "success", duration: 1500 }) })}
                className="px-4 py-1.5 rounded-full border border-foreground/25 text-xs font-semibold hover:border-foreground disabled:opacity-40"
              >
                {added ? "Added" : "Add"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: playlist, isLoading, error, refetch } = usePlaylist(id);
  const { remove, removeTrack, move } = usePlaylistActions();
  const { openEditPlaylist, openConfirm } = useUiStore();
  const addToast = useAppStore((s) => s.addToast);
  const playList = usePlayerStore((s) => s.playList);
  const visible = useVisible(playlist?.tracks);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  if (error) {
    const e = friendlyError(error);
    return <div className="p-8"><ErrorState title={e.title} detail={e.detail} onRetry={() => refetch()} /></div>;
  }
  if (isLoading || !playlist) return <div className="p-8 space-y-6"><div className="h-60 rounded-[2rem] skeleton" /><RowSkeleton /></div>;

  const tracks: Track[] = playlist.tracks ?? [];
  const canReorder = visible.length === tracks.length; // reordering a filtered view would be ambiguous

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHero
        image={playlist.covers?.[0]}
        cover={<PlaylistCover covers={playlist.covers} className="w-44 h-44 md:w-56 md:h-56 rounded-2xl shadow-2xl overflow-hidden" />}
        eyebrow="Playlist"
        title={playlist.name}
        meta={<>{playlist.description && <p className="max-w-xl mb-1">{playlist.description}</p>}<p>{playlist.track_count} songs</p></>}
      >
        {tracks.length > 0 && (
          <>
            <button onClick={() => playList(tracks, 0)} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand font-semibold text-sm shadow-brand hover:scale-105 transition-transform"><Play className="w-4 h-4 fill-current ml-0.5" />Play</button>
            <button onClick={() => playList([...tracks].sort(() => Math.random() - 0.5), 0)} className="inline-flex items-center gap-2 px-5 py-3 rounded-full glass-pill text-sm font-semibold"><Shuffle className="w-4 h-4" />Shuffle</button>
          </>
        )}
        <button onClick={() => openEditPlaylist(playlist)} aria-label="Edit details" className="p-3 rounded-full glass-pill"><Pencil className="w-4 h-4" /></button>
        <button
          onClick={() => openConfirm({ title: `Delete “${playlist.name}”?`, detail: "This removes the playlist. The songs stay in the catalogue.", confirmLabel: "Delete", danger: true, onConfirm: () => remove.mutateAsync(playlist.id).then(() => { addToast({ title: "Playlist deleted", type: "info" }); router.replace("/library"); }) })}
          aria-label="Delete playlist"
          className="p-3 rounded-full glass-pill text-red-500"
        ><Trash2 className="w-4 h-4" /></button>
      </PageHero>

      <div className="mt-8">
        {tracks.length === 0 ? (
          <EmptyState icon={Plus} title="This playlist is empty" detail="Search below to add your first songs." />
        ) : (
          <ul className="space-y-0.5">
            {visible.map((t, i) => (
              <li
                key={t.id}
                draggable={canReorder}
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => { e.preventDefault(); setOver(i); }}
                onDragEnd={() => {
                  if (drag !== null && over !== null && drag !== over) move.mutate({ id: playlist.id, from: drag, to: over });
                  setDrag(null);
                  setOver(null);
                }}
                className={`group flex items-center gap-1 rounded-2xl ${over === i && drag !== null && drag !== i ? "ring-2 ring-primary/50" : ""} ${drag === i ? "opacity-40" : ""}`}
              >
                {canReorder && <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 shrink-0" aria-hidden />}
                <div className="flex-1 min-w-0">
                  <TrackRow track={t} index={i} context={visible} onRemove={{ label: "Remove from this playlist", run: () => removeTrack.mutate({ id: playlist.id, trackId: t.id }, { onSuccess: () => addToast({ title: "Removed", description: t.name, type: "info", duration: 1500 }) }) }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddSongs playlistId={playlist.id} existing={new Set(tracks.map((t) => t.id))} />
    </div>
  );
}
