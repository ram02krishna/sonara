"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GripVertical, ListMusic, Mic2, Play, Trash2, User, X } from "lucide-react";
import { usePlayerStore, RightPanelTab } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { useArtist, useCollectionToggle, useLyrics } from "@/hooks/useSonara";
import { usePlayTrack } from "@/hooks/usePlayTrack";
import { Cover } from "@/components/ui/media";
import { cn, formatDuration } from "@/lib/utils";

const TABS: { id: Exclude<RightPanelTab, null>; label: string; icon: React.ElementType }[] = [
  { id: "queue", label: "Queue", icon: ListMusic },
  { id: "lyrics", label: "Lyrics", icon: Mic2 },
  { id: "artist", label: "About", icon: User },
];

function QueuePanel() {
  const { currentTrack, queue, removeFromQueue, reorderQueue, clearQueue, progressMs } = usePlayerStore();
  const play = usePlayTrack();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      {currentTrack && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Now playing</h3>
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-foreground/10">
            <Cover src={currentTrack.album?.images?.[0]?.url} alt="" className="w-12 h-12 rounded-xl shrink-0 shadow-sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary truncate">{currentTrack.name}</p>
              <p className="text-xs text-muted-foreground truncate">{currentTrack.artists?.map((a) => a.name).join(", ")}</p>
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">{formatDuration(progressMs)}</span>
          </div>
        </section>
      )}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next up · {queue.length}</h3>
          {queue.length > 0 && (
            <button onClick={clearQueue} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Trash2 className="w-3 h-3" />Clear</button>
          )}
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nothing queued. Use “Add to queue” on any song, or let autoplay pick similar music.</p>
        ) : (
          <ul className="space-y-1">
            {queue.map((t, i) => (
              <li
                key={`${t.id}-${i}`}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIndex(i);
                }}
                onDragEnd={() => {
                  if (dragIndex !== null && overIndex !== null) reorderQueue(dragIndex, overIndex);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={cn(
                  "group flex items-center gap-2 p-1.5 rounded-2xl hover:bg-foreground/5 transition-colors",
                  overIndex === i && dragIndex !== null && dragIndex !== i && "ring-2 ring-primary/50",
                  dragIndex === i && "opacity-40"
                )}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => play(t, queue)}
                  className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer text-left"
                >
                  <div className="relative group/play shrink-0">
                    <Cover src={t.album?.images?.[0]?.url} alt={t.name} className="w-10 h-10 rounded-xl shadow-sm" />
                    <span className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors">
                      {t.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.artists?.map((a) => a.name).join(", ")}
                    </p>
                  </div>
                  
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0 pr-1">
                    {t.duration_ms ? formatDuration(t.duration_ms) : ""}
                  </span>
                </div>

                <button
                  onClick={() => removeFromQueue(i)}
                  aria-label={`Remove ${t.name} from queue`}
                  title="Remove from queue"
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LyricsPanel() {
  const track = usePlayerStore((s) => s.currentTrack);
  const progressMs = usePlayerStore((s) => s.progressMs);
  const { data: lyrics, isLoading } = useLyrics(track);
  const activeRef = useRef<HTMLParagraphElement>(null);

  const activeIndex = useMemo(() => {
    if (!lyrics?.synced || !lyrics.lines) return -1;
    const sec = progressMs / 1000;
    let idx = -1;
    lyrics.lines.forEach((l, i) => {
      if (l.time_seconds <= sec) idx = i;
    });
    return idx;
  }, [lyrics, progressMs]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex]);

  if (!track) return <p className="text-sm text-muted-foreground text-center py-10">Play a song to see its lyrics.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-10">Loading lyrics…</p>;
  if (!lyrics) return <p className="text-sm text-muted-foreground text-center py-10">No lyrics found for this song.</p>;
  if (lyrics.synced && lyrics.lines?.length) {
    return (
      <div className="space-y-4 py-6 pr-2">
        {lyrics.lines.map((l, i) => (
          <p
            key={i}
            ref={i === activeIndex ? activeRef : undefined}
            className={cn("text-xl font-bold leading-snug transition-all origin-left", i === activeIndex ? "text-foreground scale-100" : i < activeIndex ? "text-foreground/30" : "text-foreground/50")}
          >
            {l.words || "♪"}
          </p>
        ))}
        <p className="text-[10px] text-muted-foreground pt-4">Synced lyrics from LRCLIB</p>
      </div>
    );
  }
  return <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/80 leading-relaxed py-4">{lyrics.plain_lyrics}</pre>;
}

function AboutPanel() {
  const track = usePlayerStore((s) => s.currentTrack);
  const artistId = track?.artists?.[0]?.id;
  const { data } = useArtist(artistId);
  const follow = useCollectionToggle("artist");
  const addToast = useAppStore((s) => s.addToast);

  if (!track) return <p className="text-sm text-muted-foreground text-center py-10">Play a song to see the artist.</p>;
  if (!artistId || !data) return <p className="text-sm text-muted-foreground text-center py-10">{track.artists?.[0]?.name ?? "Artist"} details aren&apos;t available for this song.</p>;
  const { artist, following } = data;
  return (
    <div className="space-y-4">
      <div className="relative rounded-3xl overflow-hidden aspect-square">
        <Cover src={artist.images?.[0]?.url} alt={artist.name} className="absolute inset-0 rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-2xl font-extrabold text-white truncate">{artist.name}</h3>
          {artist.genres?.length > 0 && <p className="text-xs text-white/70 capitalize truncate">{artist.genres.slice(0, 3).join(" · ")}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() =>
            follow.mutate(
              { item: { id: artist.id, name: artist.name, images: artist.images, genres: artist.genres, uri: artist.uri } as never, on: !following },
              { onSuccess: () => addToast({ title: following ? `Unfollowed ${artist.name}` : `Following ${artist.name}`, type: "success", duration: 2000 }) }
            )
          }
          className={cn("px-5 py-2 rounded-full text-sm font-semibold border transition-colors", following ? "border-foreground/30 hover:border-foreground" : "bg-foreground text-background border-transparent")}
        >
          {following ? "Following" : "Follow"}
        </button>
        <Link href={`/artist/${artist.id}`} className="px-5 py-2 rounded-full text-sm font-semibold border border-foreground/20 hover:border-foreground">View profile</Link>
      </div>
    </div>
  );
}

export function RightPanel() {
  const tab = usePlayerStore((s) => s.rightPanelTab);
  const setTab = usePlayerStore((s) => s.setRightPanelTab);
  const track = usePlayerStore((s) => s.currentTrack);
  if (!tab || !track) return null;

  return (
    <aside aria-label="Now playing panel" className="hidden lg:flex flex-col w-[340px] shrink-0 my-2 mr-2 mb-[104px] glass-panel rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-foreground/10">
        <div role="tablist" className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors", tab === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-foreground/10")}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
        <button onClick={() => setTab(null)} aria-label="Close panel" className="p-1.5 rounded-full hover:bg-foreground/10 text-muted-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "queue" && <QueuePanel />}
        {tab === "lyrics" && <LyricsPanel />}
        {tab === "artist" && <AboutPanel />}
      </div>
    </aside>
  );
}
