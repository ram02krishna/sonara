"use client";

import React, { useState, useEffect } from "react";
import {
  Search as SearchIcon,
  Play,
  Pause,
  Music,
  User,
  Disc,
  ListMusic,
  Heart,
  X,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_TRACKS, MOCK_ARTISTS, MOCK_PLAYLISTS } from "@/data/mockCatalog";
import { cn, formatDuration, formatCompactNumber } from "@/lib/utils";

type SearchFilter = "all" | "tracks" | "artists" | "albums" | "playlists";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SearchFilter>("all");
  const { currentTrack, isPlaying, setIsPlaying, setCurrentTrack } = usePlayerStore();
  const { addToast } = useAppStore();

  const handlePlayTrack = (track: any) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
    }
  };

  const filteredTracks = MOCK_TRACKS.filter(
    (t) =>
      !query ||
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.artists?.some((a) => a.name.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredArtists = MOCK_ARTISTS.filter(
    (a) =>
      !query ||
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.genres?.some((g) => g.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredPlaylists = MOCK_PLAYLISTS.filter(
    (p) =>
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description?.toLowerCase().includes(query.toLowerCase())
  );

  const filterTabs: { id: SearchFilter; label: string; icon: any }[] = [
    { id: "all", label: "All Results", icon: SearchIcon },
    { id: "tracks", label: "Songs", icon: Music },
    { id: "artists", label: "Artists", icon: User },
    { id: "playlists", label: "Playlists", icon: ListMusic },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Search Header Input */}
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Search Catalog</h1>
        <div className="relative max-w-2xl">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search songs, artists, albums, or lyrics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl glass-panel border border-white/10 text-white placeholder:text-muted-foreground focus:border-cyan-400 focus:outline-none transition-all text-sm md:text-base shadow-lg"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filterTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0",
                  active
                    ? "bg-white text-black shadow-md shadow-white/10 font-bold"
                    : "glass-pill text-muted-foreground hover:text-white hover:bg-white/10"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Content */}
      <div className="space-y-8">
        {/* Songs Section */}
        {(activeFilter === "all" || activeFilter === "tracks") && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight">Songs</h2>
            <div className="glass-card rounded-3xl border border-white/5 divide-y divide-white/5 overflow-hidden">
              {filteredTracks.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayTrack(track)}
                    className="flex items-center justify-between p-3.5 hover:bg-white/5 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <span className="w-5 text-center text-xs font-mono text-muted-foreground group-hover:text-cyan-400">
                        {idx + 1}
                      </span>
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

                    <div className="hidden sm:block text-xs text-muted-foreground truncate max-w-[200px] px-4">
                      {track.album?.name}
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatDuration(track.duration_ms)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Artists Section */}
        {(activeFilter === "all" || activeFilter === "artists") && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight">Artists</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {filteredArtists.map((artist) => (
                <div
                  key={artist.id}
                  className="glass-card rounded-3xl p-4 border border-white/5 flex flex-col items-center text-center group hover:border-white/15 transition-all cursor-pointer"
                >
                  <div className="w-24 h-24 rounded-full overflow-hidden mb-3 border-2 border-white/10 group-hover:border-cyan-400 shadow-lg transition-colors">
                    <img
                      src={artist.images?.[0]?.url || ""}
                      alt={artist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <h3 className="font-bold text-white text-sm truncate w-full group-hover:text-cyan-300">
                    {artist.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatCompactNumber(artist.followers || 0)} followers
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Playlists Section */}
        {(activeFilter === "all" || activeFilter === "playlists") && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight">Playlists</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {filteredPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  className="glass-card rounded-3xl p-4 border border-white/5 hover:border-white/15 transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative rounded-2xl overflow-hidden aspect-square mb-3 shadow-md">
                    <img
                      src={pl.images?.[0]?.url || ""}
                      alt={pl.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base truncate group-hover:text-cyan-300">
                      {pl.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {pl.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
