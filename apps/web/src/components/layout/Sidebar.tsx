"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Library,
  BarChart2,
  Heart,
  ChevronLeft,
  ChevronRight,
  Disc3,
  ListMusic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useMyPlaylists } from "@/hooks/useSonara";

export function Sidebar() {
  const { data: myPlaylists, isLoading: playlistsLoading } = useMyPlaylists();
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, user } = useAppStore();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Your Library", href: "/library", icon: Library },
    { label: "Analytics", href: "/analytics", icon: BarChart2 },
  ];

  return (
    <aside
      className={cn(
        "relative flex flex-col h-full bg-card/60 backdrop-blur-xl border-r border-foreground/5 transition-all duration-300 z-30 select-none",
        sidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-md shadow-primary/20 group-hover:scale-105 transition-transform shrink-0">
            <Disc3 className="w-5 h-5 animate-[spin_8s_linear_infinite]" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-extrabold text-lg tracking-tight text-foreground">
              Sonara
            </span>
          )}
        </Link>

        <button
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
          className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation */}
      <div className="px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === "/analytics" && pathname === "/stats");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (item.href === "/search") {
                  setTimeout(() => document.getElementById("sonara-navbar-search")?.focus(), 50);
                }
              }}
              className={cn(
                "flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                isActive
                  ? "bg-foreground/10 text-foreground font-bold shadow-inner"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform group-hover:scale-105 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {isActive && !sidebarCollapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>

      <div className="h-[1px] bg-foreground/5 mx-4 my-2" />

      {/* Playlists & Collection */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        <Link
          href="/library?tab=liked"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all group",
            pathname === "/library"
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          )}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-sm">
            <Heart className="w-3.5 h-3.5 text-white fill-white" />
          </div>
          {!sidebarCollapsed && <span>Liked Songs</span>}
        </Link>

        {!sidebarCollapsed && (
          <div className="pt-3 pb-1">
            <p className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-2 mb-1.5">
              Playlists
            </p>
            {playlistsLoading && <div className="h-4 w-3/4 mx-2 my-2 rounded skeleton" />}
            {!playlistsLoading && (myPlaylists ?? []).length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">No playlists yet</p>
            )}
            {(myPlaylists ?? []).map((pl) => (
              <Link
                key={pl.id}
                href={`/playlist/${pl.id}`}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors group",
                  pathname === `/playlist/${pl.id}`
                    ? "bg-foreground/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <ListMusic className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{pl.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  {pl.tracks_total ?? 0}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
