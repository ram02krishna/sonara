"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChevronsLeft, ChevronsRight, Compass, Heart, Home, Library, Music, Plus, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useUiStore } from "@/store/useUiStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useFollowing, usePlaylists, useSavedAlbums, useSavedTracks } from "@/hooks/useSonara";
import { Cover, PlaylistCover } from "@/components/ui/media";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
];

type Filter = "all" | "playlists" | "artists" | "albums";

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const openCreatePlaylist = useUiStore((s) => s.openCreatePlaylist);
  const [filter, setFilter] = useState<Filter>("all");
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const { data: playlists } = usePlaylists();
  const { data: artists } = useFollowing();
  const { data: albums } = useSavedAlbums();
  const { data: liked } = useSavedTracks();

  const items = useMemo(() => {
    const out: { key: string; href: string; title: string; sub: string; node: React.ReactNode; kind: Filter }[] = [];
    (playlists ?? []).forEach((p) =>
      out.push({ key: `p-${p.id}`, href: `/playlist/${p.id}`, title: p.name, sub: `Playlist · ${p.track_count} songs`, kind: "playlists", node: <PlaylistCover covers={p.covers} className="w-11 h-11 rounded-lg shrink-0" /> })
    );
    (artists ?? []).forEach((a) =>
      out.push({ key: `a-${a.id}`, href: `/artist/${a.id}`, title: a.name, sub: "Artist", kind: "artists", node: <Cover round src={a.images?.[0]?.url} alt={a.name} className="w-11 h-11 shrink-0" /> })
    );
    (albums ?? []).forEach((al) =>
      out.push({ key: `al-${al.id}`, href: `/album/${al.id}`, title: al.name, sub: "Album", kind: "albums", node: <Cover src={al.images?.[0]?.url} alt={al.name} className="w-11 h-11 rounded-lg shrink-0" /> })
    );
    return filter === "all" ? out : out.filter((i) => i.kind === filter);
  }, [playlists, artists, albums, filter]);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col gap-2 p-2 shrink-0 h-full transition-[width,padding] duration-200",
        collapsed ? "w-[84px]" : "w-[300px]",
        currentTrack ? "pb-[104px]" : "pb-2"
      )}
      aria-label="Sidebar"
    >
      <nav className="glass-panel rounded-3xl p-2 space-y-0.5">
        <Link href="/" className={cn("flex items-center gap-3 px-3 py-3 mb-1", collapsed && "justify-center px-0")}>
          <span className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-brand shrink-0">
            <Music className="w-5 h-5" />
          </span>
          {!collapsed && <span className="text-xl font-extrabold tracking-tight text-foreground">Sonara</span>}
        </Link>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            aria-current={active(href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-4 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
              collapsed && "justify-center px-0",
              active(href) ? "text-foreground bg-foreground/10" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!collapsed && label}
          </Link>
        ))}
      </nav>

      <section className="glass-panel rounded-3xl flex-1 min-h-0 flex flex-col p-2">
        <div className={cn("flex items-center px-2 py-2", collapsed ? "justify-center" : "justify-between")}>
          <Link href="/library" className="flex items-center gap-3 text-sm font-semibold text-muted-foreground hover:text-foreground" title="Your Library">
            <Library className="w-5 h-5 shrink-0" />
            {!collapsed && "Your Library"}
          </Link>
          {!collapsed && (
            <button onClick={() => openCreatePlaylist()} aria-label="Create playlist" title="Create playlist" className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10">
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="flex gap-1.5 px-2 pb-2">
            {(["playlists", "artists", "albums"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(filter === f ? "all" : f)}
                aria-pressed={filter === f}
                className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors", filter === f ? "bg-foreground text-background" : "bg-foreground/10 text-foreground hover:bg-foreground/15")}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
          <Link
            href="/library?tab=liked"
            title="Liked Songs"
            className={cn("flex items-center gap-3 p-2 rounded-xl hover:bg-foreground/5", collapsed && "justify-center", pathname === "/library" && "bg-foreground/5")}
          >
            <span className="w-11 h-11 rounded-lg bg-brand flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 fill-current" />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground truncate">Liked Songs</span>
                <span className="block text-xs text-muted-foreground">{liked?.length ?? 0} songs</span>
              </span>
            )}
          </Link>
          {items.map((i) => (
            <Link key={i.key} href={i.href} title={i.title} className={cn("flex items-center gap-3 p-2 rounded-xl hover:bg-foreground/5", collapsed && "justify-center", pathname === i.href && "bg-foreground/10")}>
              {i.node}
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate">{i.title}</span>
                  <span className="block text-xs text-muted-foreground truncate">{i.sub}</span>
                </span>
              )}
            </Link>
          ))}
          {!collapsed && items.length === 0 && filter === "all" && (
            <button onClick={() => openCreatePlaylist()} className="w-full mt-2 p-4 rounded-2xl bg-foreground/5 hover:bg-foreground/10 text-left">
              <p className="text-sm font-semibold text-foreground">Create your first playlist</p>
              <p className="text-xs text-muted-foreground mt-1">Save songs you love and follow artists to see them here.</p>
            </button>
          )}
        </div>

        <div className="pt-2 mt-1 border-t border-foreground/10 space-y-0.5">
          {[{ href: "/stats", label: "Insights", icon: BarChart3 }, { href: "/settings", label: "Settings", icon: Settings }].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} title={label} className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5", collapsed && "justify-center px-0", pathname.startsWith(href) && "text-foreground bg-foreground/5")}>
              <Icon className="w-4.5 h-4.5 w-[18px] h-[18px] shrink-0" />
              {!collapsed && label}
            </Link>
          ))}
          <button onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5", collapsed && "justify-center px-0")}>
            {collapsed ? <ChevronsRight className="w-[18px] h-[18px]" /> : <ChevronsLeft className="w-[18px] h-[18px]" />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </section>
    </aside>
  );
}
