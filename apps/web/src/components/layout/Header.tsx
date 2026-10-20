"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Command,
  Sun,
  Moon,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

function HeaderContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = pathname === "/search" ? searchParams.get("q") ?? "" : "";
  const [value, setValue] = useState(urlQuery);

  useEffect(() => setValue(urlQuery), [urlQuery]);

  useEffect(() => {
    const q = value.trim();
    if (q === urlQuery.trim()) return;
    const t = setTimeout(() => {
      if (q) {
        router.push(`/search?q=${encodeURIComponent(q)}`);
      } else if (pathname === "/search") {
        router.push("/search");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value, urlQuery, router, pathname]);

  const { theme, toggleTheme, setCommandPaletteOpen, user, isAuthenticated } = useAppStore();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 py-3 bg-background/80 backdrop-blur-xl border-b border-foreground/5">
      {/* Navigation history controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => router.forward()}
          aria-label="Go forward"
          className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Center Search Bar (Spotify-Style Primary Search) */}
      <div className="flex-1 max-w-lg mx-3 md:mx-6">
        <div className="relative group flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors pointer-events-none" />
          <input
            id="sonara-navbar-search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) {
                router.push(`/search?q=${encodeURIComponent(value.trim())}`);
              } else if (e.key === "Escape") {
                setValue("");
                if (pathname === "/search") router.push("/search");
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="What do you want to play?"
            aria-label="Search songs, artists, albums, playlists"
            className="w-full pl-10 pr-20 py-2.5 rounded-full bg-foreground/5 hover:bg-foreground/10 focus:bg-foreground/10 border border-foreground/10 focus:border-primary/60 outline-none text-xs md:text-sm text-foreground placeholder:text-muted-foreground transition-all shadow-inner"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  if (pathname === "/search") router.push("/search");
                  document.getElementById("sonara-navbar-search")?.focus();
                }}
                aria-label="Clear search"
                className="p-1 rounded-full hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-xs leading-none">✕</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open command palette"
              className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-foreground/10 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <Command className="w-3 h-3" />
              <span>K</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Controls: Theme Toggle + Login & Signup / User Pill */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2 rounded-full bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {isAuthenticated && user ? (
          <Link
            href="/settings"
            className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-xs font-semibold text-foreground transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs">
              {user.display_name?.charAt(0).toUpperCase() || "U"}
            </div>
            <span className="hidden sm:inline max-w-[100px] truncate">{user.display_name?.split(" ")[0]}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login?tab=signup"
              className="text-xs md:text-sm font-bold text-muted-foreground hover:text-foreground hover:scale-105 transition-all px-2.5 sm:px-3.5 py-2 rounded-full hover:bg-foreground/5"
            >
              Sign up
            </Link>
            <Link
              href="/login?tab=signin"
              className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-foreground text-background font-bold text-xs md:text-sm hover:scale-105 active:scale-95 transition-all shadow-md"
            >
              Log in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export function Header() {
  return (
    <React.Suspense fallback={<header className="h-16 w-full border-b border-foreground/5 bg-background/80" />}>
      <HeaderContent />
    </React.Suspense>
  );
}
