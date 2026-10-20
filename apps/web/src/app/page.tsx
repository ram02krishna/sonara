"use client";

import React from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  Heart,
  TrendingUp,
  Sparkles,
  Disc3,
  Clock,
  Radio,
  Flame,
  ArrowRight,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_TRACKS, MOCK_ARTISTS, MOCK_PLAYLISTS } from "@/data/mockCatalog";
import { cn, formatDuration } from "@/lib/utils";

export default function HomePage() {
  const { currentTrack, isPlaying, setIsPlaying, setCurrentTrack } = usePlayerStore();
  const { user, mood } = useAppStore();

  const handlePlayTrack = (track: any) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
    }
  };

  const heroTrack = MOCK_TRACKS[0];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner Hero / Greeting */}
      <div className="relative rounded-3xl overflow-hidden glass-card p-6 md:p-10 border border-white/10 shadow-xl bg-gradient-to-r from-violet-950/60 via-purple-900/30 to-cyan-950/40">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-cyan-300 border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Lossless Hi-Fi Streaming • 24-bit 96kHz</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Good morning,{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              {user?.display_name || "Audiophile"}
            </span>
          </h1>

          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            Your personalized morning frequency is primed with synthwave, ambient electronica, and today&apos;s chart toppers.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => handlePlayTrack(heroTrack)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-violet-700/30 hover:scale-105 active:scale-95 transition-all"
            >
              {currentTrack?.id === heroTrack.id && isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause Resonance</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Resume Mix</span>
                </>
              )}
            </button>

            <Link
              href="/library"
              className="px-5 py-3 rounded-2xl glass-pill hover:bg-white/10 text-white font-semibold text-sm transition-all"
            >
              Explore Your Library
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />
      </div>

      {/* Bento Grid Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
        
        {/* Bento 1: Jump Back In (Spans 2 columns) */}
        <div className="md:col-span-2 glass-card rounded-3xl p-6 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Jump Back In</h2>
            </div>
            <span className="text-xs text-muted-foreground">Recent Sessions</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MOCK_TRACKS.slice(0, 4).map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => handlePlayTrack(track)}
                  className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/10 border border-white/5 hover:border-white/10 cursor-pointer transition-all group"
                >
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                    <img
                      src={track.album?.images?.[0]?.url || ""}
                      alt={track.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      {isCurrent && isPlaying ? (
                        <Pause className="w-5 h-5 text-cyan-300 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 text-white fill-current ml-0.5" />
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
              );
            })}
          </div>
        </div>

        {/* Bento 2: Listening Stats & Streak Card */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Listening Pulse
              </span>
              <Flame className="w-5 h-5 text-orange-400" />
            </div>

            <div>
              <p className="text-4xl font-extrabold text-white tracking-tight">14.8 hrs</p>
              <p className="text-xs text-muted-foreground mt-0.5">Streamed this week (+22%)</p>
            </div>

            <div className="pt-2 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/70">Daily Goal</span>
                <span className="font-semibold text-cyan-400">85% Complete</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full w-[85%]" />
              </div>
            </div>
          </div>

          <Link
            href="/stats"
            className="mt-4 flex items-center justify-between text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
          >
            <span>Detailed Analytics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Bento 3: Top Artist Spotlight */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Top Artist
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="relative rounded-2xl overflow-hidden aspect-video group">
            <img
              src={MOCK_ARTISTS[0].images?.[0]?.url || ""}
              alt={MOCK_ARTISTS[0].name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
              <p className="text-base font-bold text-white">{MOCK_ARTISTS[0].name}</p>
              <p className="text-[11px] text-cyan-300 font-medium capitalize">
                {MOCK_ARTISTS[0].genres[0]}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Ranked #1 in your heavy rotation for 3 consecutive months.
          </p>
        </div>

      </div>

      {/* Featured Curated Playlists */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Curated Soundscapes</h2>
            <p className="text-xs text-muted-foreground">Tuned specifically for your vibe</p>
          </div>
          <Link href="/library" className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
            See All Playlists
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {MOCK_PLAYLISTS.map((playlist) => (
            <Link
              key={playlist.id}
              href={`/playlist/${playlist.id}`}
              className="glass-card rounded-3xl p-4 border border-white/5 hover:border-white/15 transition-all group flex flex-col justify-between"
            >
              <div className="relative rounded-2xl overflow-hidden aspect-square mb-3 shadow-md">
                <img
                  src={playlist.images?.[0]?.url || ""}
                  alt={playlist.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-cyan-400 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-xl transition-all scale-90 group-hover:scale-100">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              </div>

              <div>
                <h3 className="font-bold text-white text-base truncate group-hover:text-cyan-300 transition-colors">
                  {playlist.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {playlist.description}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground/80 pt-2 border-t border-white/5">
                  <span>{playlist.tracks_total} tracks</span>
                  <span className="text-cyan-400 font-medium">{playlist.owner_name}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Top Artists Row */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Top Artists</h2>
            <p className="text-xs text-muted-foreground">Your most streamed creators</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {MOCK_ARTISTS.map((artist) => (
            <Link
              key={artist.id}
              href={`/artist/${artist.id}`}
              className="glass-card rounded-3xl p-4 border border-white/5 flex flex-col items-center text-center group hover:border-white/15 transition-all"
            >
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden mb-3 border-2 border-white/10 group-hover:border-cyan-400/60 shadow-lg transition-colors">
                <img
                  src={artist.images?.[0]?.url || ""}
                  alt={artist.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <h4 className="font-bold text-white text-sm truncate w-full group-hover:text-cyan-300 transition-colors">
                {artist.name}
              </h4>
              <p className="text-xs text-muted-foreground capitalize mt-0.5 truncate w-full">
                {artist.genres[0]}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
