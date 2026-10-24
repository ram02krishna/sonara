"use client";

import React, { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Music } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { RightPanel } from "@/components/layout/RightPanel";
import { Player } from "@/components/player/Player";
import { PlaybackEngine } from "@/components/player/PlaybackEngine";
import { VideoDock } from "@/components/player/VideoDock";
import { FullScreenPlayer } from "@/components/player/FullScreenPlayer";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ToastContainer } from "@/components/layout/ToastContainer";
import { MobileNavBar } from "@/components/layout/MobileNavBar";
import { TrackMenuHost } from "@/components/ui/TrackMenuHost";
import { DialogHost } from "@/components/ui/DialogHost";
import { ErrorState } from "@/components/ui/media";
import { useGlobalShortcuts } from "@/components/providers/useGlobalShortcuts";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { useSession, useTrackLiked } from "@/hooks/useSonara";

function Splash() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center shadow-brand animate-pulse">
        <Music className="w-7 h-7" />
      </div>
    </div>
  );
}

// "L" shortcut: like/unlike whatever is playing.
function LikeShortcut() {
  const track = usePlayerStore((s) => s.currentTrack);
  const { liked, toggle } = useTrackLiked(track);
  useEffect(() => {
    const on = () => track && toggle.mutate(!liked);
    window.addEventListener("sonara:toggle-like", on);
    return () => window.removeEventListener("sonara:toggle-like", on);
  }, [track, liked, toggle]);
  return null;
}

const PUBLIC_PATHS = ["/login"];

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isLoading, isError, refetch } = useSession();
  const { setUser, hydrateSettings } = useAppStore();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const authenticated = !!session?.authenticated;

  useGlobalShortcuts();
  useEffect(() => hydrateSettings(), [hydrateSettings]);

  useEffect(() => {
    if (isLoading) return;
    setUser(authenticated && session?.user ? session.user : null, !!session?.guest);
  }, [isLoading, authenticated, session, setUser]);

  useEffect(() => {
    if (isLoading || isError) return;
    if (!authenticated && !isPublic) router.replace("/login");
    if (authenticated && pathname === "/login") router.replace("/");
  }, [isLoading, isError, authenticated, isPublic, pathname, router]);

  if (isLoading) return <Splash />;
  if (isError) {
    return (
      <div className="h-screen flex items-center justify-center p-6 bg-background">
        <ErrorState title="Can't reach Sonara's server" detail="Make sure the API is running (docker compose up, or make dev), then try again." onRetry={() => refetch()} />
      </div>
    );
  }

  if (isPublic) {
    return (
      <div className="h-screen w-screen overflow-y-auto bg-background text-foreground page-glow">
        {children}
        <ToastContainer />
      </div>
    );
  }
  if (!authenticated) return <Splash />;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground antialiased selection:bg-primary/30">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:m-2 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground">Skip to content</a>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden my-2 mr-2 max-md:m-0 rounded-3xl max-md:rounded-none glass-panel page-glow">
        <Suspense fallback={<div className="h-16" />}>
          <Header />
        </Suspense>
        <main id="main" className="flex-1 overflow-y-auto pb-44 md:pb-28">{children}</main>
      </div>
      <RightPanel />
      <PlaybackEngine />
      <Player />
      <VideoDock />
      <MobileNavBar />
      <FullScreenPlayer />
      <CommandPalette />
      <TrackMenuHost />
      <DialogHost />
      <LikeShortcut />
      <ToastContainer />
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false } },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>{children}</AppShell>
    </QueryClientProvider>
  );
}
