"use client";

import React from "react";
import Link from "next/link";
import { friendlyError, useBrowseCategories } from "@/hooks/useSonara";
import { ErrorState, SectionHeader } from "@/components/ui/media";
import { BrowseCategory } from "@/types/api";

const GROUPS: { id: BrowseCategory["group"]; title: string; subtitle: string }[] = [
  { id: "language", title: "By language", subtitle: "Music from every corner of the world" },
  { id: "genre", title: "By genre", subtitle: "Dive into a sound" },
  { id: "mood", title: "By mood", subtitle: "Music for the moment" },
];

export default function ExplorePage() {
  const { data, isLoading, error, refetch } = useBrowseCategories();
  if (error) {
    const e = friendlyError(error);
    return <div className="p-8"><ErrorState title={e.title} detail={e.detail} onRetry={() => refetch()} /></div>;
  }
  return (
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Explore</h1>
        <p className="text-sm text-muted-foreground mt-1">Find something new, in any language.</p>
      </header>
      {isLoading && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 rounded-2xl skeleton" />)}</div>}
      {GROUPS.map((g) => {
        const items = (data ?? []).filter((c) => c.group === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id}>
            <SectionHeader title={g.title} subtitle={g.subtitle} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {items.map((c) => (
                <Link
                  key={c.slug}
                  href={`/explore/${c.slug}`}
                  style={{ backgroundImage: `linear-gradient(135deg, ${c.color}, ${c.color}99)` }}
                  className="relative h-32 rounded-2xl p-4 overflow-hidden text-white font-extrabold text-xl leading-tight shadow-lg hover:scale-[1.03] transition-transform"
                >
                  {c.title}
                  <span aria-hidden className="absolute -right-3 -bottom-3 w-20 h-20 rounded-2xl bg-white/20 rotate-[24deg]" />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
