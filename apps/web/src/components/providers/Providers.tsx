"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { useSession } from "@/hooks/useSonara";
import { saveStoredToken } from "@/lib/api-client";

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isLoading } = useSession();
  const { setUser, syncThemeFromDom } = useAppStore();
  const setIsPremiumRequired = usePlayerStore((s) => s.setIsPremiumRequired);

  const onLogin = pathname === "/login";

  useEffect(() => {
    syncThemeFromDom();
  }, [syncThemeFromDom]);

  useEffect(() => {
    if (isLoading) return;
    if (session?.authenticated && session?.user) {
      setUser(session.user);
      if (session.token) {
        saveStoredToken(session.token);
      }
    } else {
      setUser(null);
    }
    // Studio master mode - HTML5 playback engine is active
    setIsPremiumRequired(false);
  }, [isLoading, session, setUser, setIsPremiumRequired]);

  // If already authenticated and visiting /login, direct to main studio
  useEffect(() => {
    if (!isLoading && session?.authenticated && onLogin) {
      router.replace("/");
    }
  }, [isLoading, session?.authenticated, onLogin, router]);

  if (onLogin) {
    return (
      <div className="h-screen w-screen overflow-y-auto bg-background text-foreground page-glow">
        {children}
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground antialiased selection:bg-cyan-500/30">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden page-glow">
        <Header />
        <main className="flex-1 overflow-y-auto pb-32 md:pb-28">{children}</main>
      </div>
      <RightPanel />
      <Player />
      <MobileNavBar />
      <FullScreenPlayer />
      <CommandPalette />
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
