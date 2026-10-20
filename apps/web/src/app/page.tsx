"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDashboard, friendlyError } from "@/hooks/useSonara";
import { useAppStore } from "@/store/useAppStore";
import { Hero, SectionRenderer } from "@/components/dashboard/SectionRenderer";
import { EmptyState, ErrorState, ShelfSkeleton } from "@/components/ui/media";

const SKIP_KEY = "sonara-skip-onboarding";

export default function HomePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const { data, isLoading, error, refetch } = useDashboard();

  // Brand-new accounts with no history and no saved taste choose languages/genres first.
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
  // "Play your mix" queues the user's own blend, then their top tracks, then any shelf.
  const playable = useMemo(() => {
    const pick = (id: string) => data?.sections.find((s) => s.id === id)?.tracks;
    return pick("mix") ?? pick("top-tracks") ?? data?.sections.find((s) => s.kind === "tracks" && s.type !== "hero")?.tracks ?? [];
  }, [data]);

  if (error) {
    const e = friendlyError(error);
    return (
      <div className="p-6 md:p-8 pt-16">
        <ErrorState
          title={e.title}
          detail={e.detail}
          onRetry={() => refetch()}
          action={e.needsLogin ? <Link href="/login" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm">Log in</Link> : undefined}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto">
      {isLoading ? (
        <>
          <div className="h-[280px] rounded-[2rem] skeleton" />
          <ShelfSkeleton />
          <ShelfSkeleton rounded />
        </>
      ) : (
        <>
          <Hero section={hero} name={user?.display_name} genres={data?.top_genres ?? []} playable={playable} />
          {rest.length === 0 ? (
            <EmptyState
              title="Nothing to show yet"
              detail="Pick the languages and genres you love and Sonara will build your home from them."
              action={
                <Link href="/onboarding" className="inline-block mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                  Choose your taste
                </Link>
              }
            />
          ) : (
            rest.map((s) => <SectionRenderer key={s.id} section={s} />)
          )}
        </>
      )}
    </div>
  );
}
