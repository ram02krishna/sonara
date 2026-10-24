"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { friendlyError, useBrowseCategories, useDashboard, usePlaylists, usePreferences, useSavedTracks } from "@/hooks/useSonara";
import { useAppStore } from "@/store/useAppStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { Hero, SectionRenderer } from "@/components/dashboard/SectionRenderer";
import { Cover, EmptyState, ErrorState, PlaylistCard, QuickPlayCard, SectionHeader, ShelfSkeleton } from "@/components/ui/media";
import { Track } from "@/types/api";

const SKIP_KEY = "sonara-skip-onboarding";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Late night";
}

export default function HomePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const playList = usePlayerStore((s) => s.playList);
  const { data, isLoading, error, refetch } = useDashboard();
  const { data: playlists } = usePlaylists();
  const { data: liked } = useSavedTracks();
  const { data: categories } = useBrowseCategories();
  const { data: prefs } = usePreferences();

  // Brand-new listeners choose their languages and genres first.
  useEffect(() => {
    if (!data?.needs_onboarding) return;
    let skipped = false;
    try {
      skipped = sessionStorage.getItem(SKIP_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (!skipped) router.replace("/onboarding");
  }, [data?.needs_onboarding, router]);

  const hero = data?.sections.find((s) => s.type === "hero");
  const rest = useMemo(() => data?.sections.filter((s) => s.type !== "hero") ?? [], [data]);
  const playable: Track[] = useMemo(() => {
    const pick = (id: string) => data?.sections.find((s) => s.id === id)?.tracks;
    return pick("mix") ?? pick("top-tracks") ?? data?.sections.find((s) => s.kind === "tracks" && s.type !== "hero")?.tracks ?? [];
  }, [data]);
  const recent = data?.sections.find((s) => s.id === "recent")?.tracks ?? [];
  const quickTracks = recent.length > 0 ? recent : playable;

  const tunedCategories = useMemo(() => {
    if (!categories || categories.length === 0) return [];
    if (!prefs) return categories.slice(0, 8);
    const userLikes = new Set([
      ...(prefs.languages || []).map((l) => l.toLowerCase()),
      ...(prefs.genres || []).map((g) => g.toLowerCase()),
    ]);
    const matches: typeof categories = [];
    const others: typeof categories = [];
    for (const c of categories) {
      if (userLikes.has(c.slug.toLowerCase()) || userLikes.has(c.title.toLowerCase())) {
        matches.push(c);
      } else {
        others.push(c);
      }
    }
    return [...matches, ...others].slice(0, 8);
  }, [categories, prefs]);

  if (error) {
    const e = friendlyError(error);
    return (
      <div className="p-6 md:p-8 pt-16">
        <ErrorState title={e.title} detail={e.detail} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
          {greeting()}{user?.display_name ? `, ${user.display_name.split(" ")[0]}` : ""}
        </h1>
      </header>

      {/* Quick access: Liked Songs, your playlists, then recent or tuned taste tracks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <Link href="/library?tab=liked" className="group flex items-center overflow-hidden rounded-xl bg-foreground/[0.06] hover:bg-foreground/[0.12] transition-colors">
          <span className="w-14 h-14 bg-brand flex items-center justify-center shrink-0"><Heart className="w-6 h-6 fill-current" /></span>
          <span className="flex-1 px-3 min-w-0">
            <span className="block text-sm font-semibold truncate">Liked Songs</span>
            <span className="block text-xs text-muted-foreground">{liked?.length ?? 0} songs</span>
          </span>
        </Link>
        {(playlists ?? []).slice(0, 2).map((p) => (
          <QuickPlayCard key={p.id} title={p.name} image={p.covers?.[0]} href={`/playlist/${p.id}`} />
        ))}
        {quickTracks.slice(0, Math.max(0, 5 - Math.min(2, playlists?.length ?? 0))).map((t) => (
          <QuickPlayCard key={t.id} title={t.name} image={t.album?.images?.[0]?.url} onPlay={() => playList(quickTracks, quickTracks.findIndex((x) => x.id === t.id))} />
        ))}
      </div>

      {isLoading ? (
        <>
          <div className="h-[260px] rounded-[2rem] skeleton" />
          <ShelfSkeleton />
          <ShelfSkeleton rounded />
        </>
      ) : (
        <>
          <Hero section={hero} genres={data?.top_genres ?? []} playable={playable} />
          {rest.length === 0 ? (
            <EmptyState
              title="Nothing to show yet"
              detail="Pick the languages and genres you love and Sonara will build your home from them."
              action={<Link href="/onboarding" className="inline-block mt-2 px-5 py-2.5 rounded-full bg-brand text-sm font-semibold">Choose your taste</Link>}
            />
          ) : (
            rest.map((s) => <SectionRenderer key={s.id} section={s} />)
          )}
        </>
      )}

      {(playlists?.length ?? 0) > 0 && (
        <section>
          <SectionHeader title="Your playlists" href="/library?tab=playlists" />
          <div className="shelf shelf-fade">{playlists!.map((p) => <PlaylistCard key={p.id} playlist={p} />)}</div>
        </section>
      )}

      {tunedCategories.length > 0 && (
        <section>
          <SectionHeader title="Browse by language & mood" href="/explore" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {tunedCategories.map((c) => (
              <Link key={c.slug} href={`/explore/${c.slug}`} style={{ backgroundColor: c.color }} className="relative h-24 rounded-2xl p-4 overflow-hidden text-white font-bold text-lg hover:scale-[1.02] transition-transform">
                {c.title}
                <Cover alt="" className="absolute -right-4 -bottom-4 w-16 h-16 rotate-12 opacity-30 rounded-lg" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
