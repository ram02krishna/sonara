"use client";

import React from "react";
import { useParams } from "next/navigation";
import {
  Play,
  Pause,
  Clock,
  Heart,
  Share2,
  Sparkles,
  Award,
  Disc3,
  UserCheck,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_ARTISTS, MOCK_TRACKS } from "@/data/mockCatalog";
import { cn, formatDuration, formatCompactNumber } from "@/lib/utils";

export default function ArtistDetailPage() {
  const params = useParams();
  const { currentTrack, isPlaying, setIsPlaying, setCurrentTrack } = usePlayerStore();
  const { addToast } = useAppStore();

  const artistId = params?.id as string;
  const artist = MOCK_ARTISTS.find((a) => a.id === artistId) || MOCK_ARTISTS[0];

  const handlePlayTrack = (track: any) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden aspect-[21/9] max-h-80 shadow-2xl border border-white/10 group">
        <img
          src={artist.images?.[0]?.url || ""}
          alt={artist.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-6 md:p-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-cyan-300 border border-white/10 w-fit mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Verified Artist</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">
            {artist.name}
          </h1>
          <p className="text-sm text-cyan-300 font-medium mt-1">
            {formatCompactNumber(artist.followers || 0)} Monthly Listeners
          </p>
        </div>
      </div>

      {/* Action Row */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => handlePlayTrack(MOCK_TRACKS[0])}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white flex items-center justify-center shadow-xl shadow-cyan-600/20 hover:scale-105 active:scale-95 transition-all"
        >
          {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
        </button>

        <button
          onClick={() => addToast({ title: "Following " + artist.name, type: "success" })}
          className="px-5 py-2.5 rounded-2xl border border-white/20 hover:bg-white/10 text-white text-xs font-bold transition-all"
        >
          Follow
        </button>
      </div>

      {/* Popular Tracks Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight">Popular Releases</h2>

        <div className="glass-card rounded-3xl border border-white/5 divide-y divide-white/5 overflow-hidden">
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
                      {track.album?.name}
                    </p>
                  </div>
                </div>

                <div className="w-16 text-right text-xs font-mono text-muted-foreground">
                  {formatDuration(track.duration_ms)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
