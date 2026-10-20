"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDashboard, friendlyError } from "@/hooks/useSonara";
import { useAppStore } from "@/store/useAppStore";
import { Hero, SectionRenderer, greeting } from "@/components/dashboard/SectionRenderer";
import { EmptyState, ErrorState, QuickPlayCard, ShelfSkeleton } from "@/components/ui/media";

const SKIP_KEY = "sonara-skip-onboarding";

export default function HomePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const { data, isLoading, error, refetch } = useDashboard();

  useEffect(() => {
    if (!data?.needs_onboarding) return;
    let skipped = false;
    try {
      skipped = sessionStorage.getItem(SKIP_KEY) === "1";
    } catch {
      skipped = false;
    }
    if (!skipped) router.replace("/onboarding");
  }, [data?.needs_onboarding, router]);

  const hero = data?.sections.find((s) => s.type === "hero");
  const rest = useMemo(() => data?.sections.filter((s) => s.type !== "hero") ?? [], [data]);

  const playable = useMemo(() => {
    const pick = (id: string) => data?.sections.find((s) => s.id === id)?.tracks;
    return (
      pick("mix") ??
      pick("top-tracks") ??
      data?.sections.find((s) => s.kind === "tracks" && s.type !== "hero")?.tracks ??
      []
    );
  }, [data]);

  // Top 6 tracks for the iconic Spotify Quick Access Grid
  const quickAccessTracks = useMemo(() => {
    const pool = playable.length > 0 ? playable : (data?.sections.flatMap((s) => s.tracks ?? []) ?? []);
    const unique = new Map();
    for (const t of pool) {
      if (t.id && !unique.has(t.id)) {
        unique.set(t.id, t);
      }
      if (unique.size >= 6) break;
    }
    return Array.from(unique.values());
  }, [playable, data]);

  if (error) {
    const e = friendlyError(error);
    if (e.needsLogin) {
      return (
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
          {/* Guest Welcome Banner */}
          <div className="relative rounded-3xl overflow-hidden border border-foreground/10 bg-gradient-to-r from-card via-card/90 to-card p-6 md:p-10 shadow-xl">
            <div className="max-w-xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Lossless Audio Streaming
              </span>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground">
                Sound as pure as the studio master.
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Log in or sign up to stream full songs, see live time-synced lyrics, and personalize your sound across all devices.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Link
                  href="/login?tab=signup"
                  className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-md"
                >
                  Sign up free
                </Link>
                <Link
                  href="/login?tab=signin"
                  className="px-6 py-2.5 rounded-full glass-pill text-foreground font-semibold text-sm hover:bg-foreground/10 transition-all"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="p-6 md:p-8 pt-16">
        <ErrorState
          title={e.title}
          detail={e.detail}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const displayName = user?.display_name ? user.display_name.split(" ")[0] : "";

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Greeting */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
          {greeting()}
          {displayName ? `, ${displayName}` : ""}
        </h1>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl skeleton" />
            ))}
          </div>
          <div className="h-56 rounded-3xl skeleton" />
          <ShelfSkeleton />
          <ShelfSkeleton rounded />
        </div>
      ) : (
        <>
          {/* Spotify-style Quick Access 6-Grid */}
          {quickAccessTracks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quickAccessTracks.map((t) => (
                <QuickPlayCard key={t.id} track={t} context={playable} />
              ))}
            </div>
          )}

          {/* Apple Music Style Spotlight Banner */}
          <Hero
            section={hero}
            name={user?.display_name}
            genres={data?.top_genres ?? []}
            playable={playable}
          />

          {/* Shelves & Content */}
          {rest.length === 0 ? (
            <EmptyState
              title="Nothing to show yet"
              detail="Pick the languages and genres you love and Sonara will build your home from them."
              action={
                <Link
                  href="/onboarding"
                  className="inline-block mt-2 px-5 py-2.5 rounded-full bg-primary text-white text-xs font-bold"
                >
                  Choose your taste
                </Link>
              }
            />
          ) : (
            <div className="space-y-8">
              {rest.map((s) => (
                <SectionRenderer key={s.id} section={s} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
