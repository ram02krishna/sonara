"use client";

import React, { useState } from "react";
import {
  ListMusic,
  Heart,
  Disc,
  User,
  Plus,
  Play,
  Pause,
  Clock,
  Trash2,
  Sparkles,
} from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_TRACKS, MOCK_ARTISTS, MOCK_PLAYLISTS } from "@/data/mockCatalog";
import { cn, formatDuration } from "@/lib/utils";

type LibraryTab = "playlists" | "liked" | "albums" | "artists";

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryTab>("playlists");
  const [playlists, setPlaylists] = useState(MOCK_PLAYLISTS);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const { currentTrack, isPlaying, setIsPlaying, setCurrentTrack } = usePlayerStore();
  const { addToast } = useAppStore();

  const handlePlayTrack = (track: any) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(track);
    }
  };

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    const newPl = {
      id: `pl-${Date.now()}`,
      name: newPlaylistName.trim(),
      description: "Custom user playlist created on Sonara.",
      tracks_total: 0,
      owner_name: "You",
      images: [
        { url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80" },
      ],
    };

    setPlaylists([newPl, ...playlists]);
    setNewPlaylistName("");
    setIsCreating(false);
    addToast({
      title: "Playlist created!",
      description: `"${newPl.name}" added to your collection.`,
      type: "success",
    });
  };

  const tabs = [
    { id: "playlists", label: "Playlists", icon: ListMusic },
    { id: "liked", label: "Liked Songs", icon: Heart },
    { id: "artists", label: "Artists", icon: User },
    { id: "albums", label: "Saved Albums", icon: Disc },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Library</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Curated music, collections, and followed creators
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-semibold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as LibraryTab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0",
                active
                  ? "bg-white text-black font-bold shadow-md shadow-white/10"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Create Modal Dialog */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePlaylist}
            className="glass-panel p-6 rounded-3xl border border-white/10 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <h3 className="text-lg font-bold text-white">Create New Playlist</h3>
            <input
              autoFocus
              type="text"
              placeholder="Give your playlist a name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs shadow-md transition-all"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content based on tab */}
      {activeTab === "playlists" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {/* Liked Songs Card */}
          <div
            onClick={() => setActiveTab("liked")}
            className="glass-card rounded-3xl p-5 border border-white/5 hover:border-white/15 transition-all group cursor-pointer flex flex-col justify-between aspect-square bg-gradient-to-br from-violet-900/60 via-purple-800/40 to-fuchsia-900/50"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Heart className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Liked Songs</h3>
              <p className="text-xs text-white/70 mt-1">{MOCK_TRACKS.length} favorite tracks</p>
            </div>
          </div>

          {/* Playlists */}
          {playlists.map((pl) => (
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
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {pl.owner_name} • {pl.tracks_total} songs
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "liked" && (
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
      )}

      {activeTab === "artists" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {MOCK_ARTISTS.map((artist) => (
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
              <p className="text-xs text-muted-foreground capitalize mt-0.5">
                {artist.genres[0]}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "albums" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {MOCK_TRACKS.map((t) => (
            <div
              key={t.album.id}
              className="glass-card rounded-3xl p-4 border border-white/5 group hover:border-white/15 transition-all cursor-pointer"
            >
              <div className="rounded-2xl overflow-hidden aspect-square mb-3 shadow-md">
                <img
                  src={t.album.images?.[0]?.url || ""}
                  alt={t.album.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <h3 className="font-bold text-white text-sm truncate group-hover:text-cyan-300">
                {t.album.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {t.artists[0]?.name} • {t.album.release_date?.slice(0, 4)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
