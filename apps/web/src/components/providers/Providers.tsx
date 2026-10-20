"use client";

import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { RightPanel } from "@/components/layout/RightPanel";
import { Player } from "@/components/player/Player";
import { FullScreenPlayer } from "@/components/player/FullScreenPlayer";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ToastContainer } from "@/components/layout/ToastContainer";
import { MobileNavBar } from "@/components/layout/MobileNavBar";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { MOCK_TRACKS } from "@/data/mockCatalog";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const { setCurrentTrack, currentTrack } = usePlayerStore();
  const { setUser } = useAppStore();

  // Initialize with seed track and mock user session if not authenticated
  useEffect(() => {
    if (!currentTrack && MOCK_TRACKS.length > 0) {
      setCurrentTrack(MOCK_TRACKS[0]);
    }
    // Set initial user representation
    setUser({
      id: "usr-sonara-demo",
      spotify_id: "spotify_audio_enthusiast",
      display_name: "Audiophile",
      email: "audiophile@sonara.app",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      product: "premium",
      country: "US",
    });
  }, [currentTrack, setCurrentTrack, setUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* Left Sidebar (Desktop) */}
        <Sidebar />

        {/* Center Main Stage */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto pb-28 md:pb-24">
            {children}
          </main>
        </div>

        {/* Right Tabbed Panel (Queue / Lyrics / Artist) */}
        <RightPanel />

        {/* Persistent Floating Bottom Player */}
        <Player />

        {/* Mobile Nav Bar */}
        <MobileNavBar />

        {/* Full Screen Now Playing with dynamic album glow */}
        <FullScreenPlayer />

        {/* Global Command Palette (Cmd+K) */}
        <CommandPalette />

        {/* Toast Notifications */}
        <ToastContainer />
      </div>
    </QueryClientProvider>
  );
}
