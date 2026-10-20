"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Clock,
  Heart,
  Share2,
  ChevronLeft,
  Music,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_PLAYLISTS, MOCK_TRACKS } from "@/data/mockCatalog";
import { cn, formatDuration } from "@/lib/utils";

export default function PlaylistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentTrack, isPlaying, setIsPlaying, setCurrentTrack } = usePlayerStore();
  const { addToast } = useAppStore();

  const playlistId = params?.id as string;
  const playlist = MOCK_PLAYLISTS.find((p) => p.id === playlistId) || MOCK_PLAYLISTS[0];

  const handlePlayTrack = (track: any) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 glass-card p-6 md:p-8 rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent">
        <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden shrink-0 shadow-2xl border border-white/10">
          <img
            src={playlist.images?.[0]?.url || ""}
            alt={playlist.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="space-y-3 flex-1 text-center md:text-left">
          <span className="text-xs uppercase font-bold tracking-widest text-cyan-300">
            Curated Playlist
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            {playlist.name}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {playlist.description}
          </p>
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-white/80 pt-1">
            <span className="font-semibold text-cyan-400">{playlist.owner_name}</span>
            <span>•</span>
            <span>{MOCK_TRACKS.length} tracks, 18 min</span>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => handlePlayTrack(MOCK_TRACKS[0])}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white flex items-center justify-center shadow-xl shadow-cyan-600/20 hover:scale-105 active:scale-95 transition-all"
        >
          {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
        </button>

        <button
          onClick={() => addToast({ title: "Saved to Library", type: "success" })}
          className="p-3 rounded-full glass-pill hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
        >
          <Heart className="w-5 h-5" />
        </button>

        <button
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            addToast({ title: "Link copied to clipboard", type: "info" });
          }}
          className="p-3 rounded-full glass-pill hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Track Listing Table */}
      <div className="glass-card rounded-3xl border border-white/5 divide-y divide-white/5 overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-white/[0.02] text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="w-8 text-center">#</span>
          <span className="flex-1">Title</span>
          <span className="hidden md:block flex-1">Album</span>
          <span className="w-16 text-right flex items-center justify-end gap-1">
            <Clock className="w-3.5 h-3.5" />
          </span>
        </div>

        {MOCK_TRACKS.map((track, idx) => {
          const isCurrent = currentTrack?.id === track.id;
          return (
            <div
              key={track.id}
              onClick={() => handlePlayTrack(track)}
              className="flex items-center justify-between p-3.5 hover:bg-white/5 cursor-pointer transition-colors group"
            >
              <div className="w-8 text-center text-xs font-mono text-muted-foreground group-hover:text-cyan-400">
                {idx + 1}
              </div>

              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow">
                  <img
                    src={track.album?.images?.[0]?.url || ""}
                    alt={track.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    {isCurrent && isPlaying ? (
                      <Pause className="w-4 h-4 text-cyan-300 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold truncate", isCurrent ? "text-cyan-300" : "text-white")}>
                    {track.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {track.artists?.map((a) => a.name).join(", ")}
                  </p>
                </div>
              </div>

              <div className="hidden md:block flex-1 text-xs text-muted-foreground truncate px-4">
                {track.album?.name}
              </div>

              <div className="w-16 text-right text-xs font-mono text-muted-foreground">
                {formatDuration(track.duration_ms)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
