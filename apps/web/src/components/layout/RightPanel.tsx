"use client";

import React, { useEffect, useRef } from "react";
import { X, ListMusic, Mic2, UserCheck, Play, Trash2, Disc3 } from "lucide-react";
import { usePlayerStore, RightPanelTab } from "@/store/usePlayerStore";
import { cn, formatDuration, formatCompactNumber } from "@/lib/utils";
import { useArtist, useLyrics } from "@/hooks/useSonara";

export function RightPanel() {
  const {
    rightPanelTab,
    setRightPanelTab,
    currentTrack,
    queue,
    removeFromQueue,
    setQueue,
    setCurrentTrack,
    progressMs,
    lyrics,
    setLyrics,
  } = usePlayerStore();

  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Real lyrics from LRCLIB (via the Go API). No fabricated fallback lines.
  const { data: lyricsData, isLoading: loadingLyrics } = useLyrics(rightPanelTab === "lyrics" ? currentTrack : null);
  useEffect(() => {
    setLyrics(lyricsData ?? null);
  }, [lyricsData, setLyrics]);

  const { data: artistData } = useArtist(rightPanelTab === "artist" ? currentTrack?.artists?.[0]?.id : undefined);

  if (!rightPanelTab) return null;

  const currentArtist = artistData?.artist;

  const currentSeconds = progressMs / 1000;

  return (
    <aside className="w-80 h-full glass-panel border-l border-foreground/5 flex flex-col z-30 select-none animate-in slide-in-from-right duration-200">
      {/* Panel Tab Header */}
      <div className="flex items-center justify-between p-4 border-b border-foreground/5">
        <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-xl">
          <button
            onClick={() => setRightPanelTab("queue")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              rightPanelTab === "queue"
                ? "bg-foreground/15 text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Queue</span>
          </button>
          <button
            onClick={() => setRightPanelTab("lyrics")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              rightPanelTab === "lyrics"
                ? "bg-foreground/15 text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>
          <button
            onClick={() => setRightPanelTab("artist")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              rightPanelTab === "artist"
                ? "bg-foreground/15 text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Artist</span>
          </button>
        </div>

        <button
          onClick={() => setRightPanelTab(null)}
          aria-label="Close panel"
          className="p-1.5 rounded-xl hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ================= QUEUE TAB ================= */}
        {rightPanelTab === "queue" && (
          <div className="space-y-5">
            {/* Now Playing */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2">
                Now Playing
              </p>
              {currentTrack ? (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-foreground/10 border border-foreground/10 shadow-sm">
                  <img
                    src={currentTrack.album?.images?.[0]?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100"}
                    alt={currentTrack.name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{currentTrack.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {currentTrack.artists?.map((a) => a.name).join(", ")}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No track playing</p>
              )}
            </div>

            {/* Next in Queue */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                  Next In Queue ({queue.length})
                </p>
                {queue.length > 0 && (
                  <button
                    onClick={() => setQueue([])}
                    className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {queue.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs glass-card rounded-2xl p-4">
                  <ListMusic className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Your queue is empty. Click any track to start adding!
                </div>
              ) : (
                <div className="space-y-1.5">
                  {queue.map((track, idx) => (
                    <div
                      key={`${track.id}-${idx}`}
                      className="group flex items-center justify-between p-2 rounded-xl hover:bg-foreground/5 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <img
                          src={track.album?.images?.[0]?.url || ""}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{track.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {track.artists?.map((a) => a.name).join(", ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCurrentTrack(track);
                            removeFromQueue(idx);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-cyan-400 transition-opacity"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeFromQueue(idx)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= LYRICS TAB ================= */}
        {rightPanelTab === "lyrics" && (
          <div ref={lyricsContainerRef} className="space-y-4 py-2">
            <div className="flex items-center justify-between pb-2 border-b border-foreground/5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Time-Synced Lyrics
              </span>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                LRCLIB Synced
              </span>
            </div>

            {lyrics && lyrics.lines && lyrics.lines.length > 0 ? (
              <div className="space-y-3">
                {lyrics.lines.map((line, idx) => {
                  const nextLine = lyrics.lines![idx + 1];
                  const isActive =
                    currentSeconds >= line.time_seconds &&
                    (!nextLine || currentSeconds < nextLine.time_seconds);

                  return (
                    <p
                      key={idx}
                      className={cn(
                        "text-sm font-semibold transition-all duration-300 cursor-pointer rounded-xl px-2 py-1.5",
                        isActive
                          ? "text-foreground text-base scale-[1.02] bg-foreground/10 font-bold shadow-sm"
                          : "text-muted-foreground/50 hover:text-muted-foreground"
                      )}
                    >
                      {line.words}
                    </p>
                  );
                })}
              </div>
            ) : (
              loadingLyrics ? (
                <p className="text-xs text-muted-foreground text-center py-10">Loading lyrics…</p>
              ) : lyrics?.plain_lyrics ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/80 leading-relaxed">{lyrics.plain_lyrics}</pre>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-10">No lyrics found for this track.</p>
              )
            )}
          </div>
        )}

        {/* ================= ARTIST TAB ================= */}
        {rightPanelTab === "artist" && currentArtist && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden aspect-video border border-foreground/10 shadow-lg">
              <img
                src={currentArtist.images?.[0]?.url || ""}
                alt={currentArtist.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                <h3 className="text-xl font-bold text-white tracking-tight">{currentArtist.name}</h3>
                <p className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">
                  {currentArtist.followers ? `${formatCompactNumber(currentArtist.followers)} Followers` : "Artist"}
                </p>
              </div>
            </div>

            {/* Genres */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Genres
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(currentArtist.genres ?? []).map((g) => (
                  <span
                    key={g}
                    className="text-xs px-2.5 py-1 rounded-full bg-foreground/5 border border-foreground/10 text-foreground/80 capitalize"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>

            {/* Artist Spotlight */}
            <div className="p-3.5 rounded-2xl glass-card flex items-start gap-3">
              <Disc3 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-foreground">Artist Spotlight</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Available in lossless master audio. Verified artist catalogue streamed through Sonara.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
