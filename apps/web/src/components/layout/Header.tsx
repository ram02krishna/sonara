"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Command, Keyboard, LogOut, Moon, Search, Settings, Sun, UserRound } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useLogout } from "@/hooks/useSonara";
import { usePlayerStore } from "@/store/usePlayerStore";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, toggleTheme, user, isGuest, setCommandPaletteOpen, setShortcutsOpen } = useAppStore();
  const logout = useLogout();

  const urlQuery = pathname === "/search" ? searchParams.get("q") ?? "" : "";
  const [value, setValue] = useState(urlQuery);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setValue(urlQuery), [urlQuery]);

  // Typing here drives the same /search?q= page everything else uses: one search, one source of truth.
  useEffect(() => {
    const text = value.trim();
    if (!text || text === urlQuery.trim()) return;
    const t = setTimeout(() => router.push(`/search?q=${encodeURIComponent(text)}`), 400);
    return () => clearTimeout(t);
  }, [value, urlQuery, router]);

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    window.addEventListener("sonara:focus-search", focus);
    return () => window.removeEventListener("sonara:focus-search", focus);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const initial = (user?.display_name || "S").trim().charAt(0).toUpperCase();

  return (
    <header className="h-16 shrink-0 flex items-center gap-3 px-4 md:px-6 sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-foreground/5">
      <div className="hidden md:flex items-center gap-1.5">
        <button onClick={() => router.back()} aria-label="Go back" className="w-8 h-8 rounded-full bg-foreground/10 hover:bg-foreground/15 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={() => router.forward()} aria-label="Go forward" className="w-8 h-8 rounded-full bg-foreground/10 hover:bg-foreground/15 flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`);
              if (e.key === "Escape") inputRef.current?.blur();
            }}
            placeholder="What do you want to listen to?"
            aria-label="Search"
            className="w-full pl-10 pr-14 py-2.5 rounded-full bg-foreground/[0.07] hover:bg-foreground/10 focus:bg-foreground/10 border border-transparent focus:border-foreground/20 outline-none text-sm text-foreground placeholder:text-muted-foreground transition-all"
          />
          <button onClick={() => setCommandPaletteOpen(true)} aria-label="Open command palette" className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-foreground/10 text-[10px] font-mono text-muted-foreground hover:text-foreground">
            <Command className="w-3 h-3" />K
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <button onClick={toggleTheme} aria-label="Toggle theme" className="w-9 h-9 rounded-full hover:bg-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground">
          {theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu" className="w-9 h-9 rounded-full bg-brand text-sm font-bold flex items-center justify-center shadow-brand">
            {initial}
          </button>
          {menuOpen && (
            <div role="menu" className="pop-in absolute right-0 top-11 w-60 p-1.5 rounded-2xl border border-foreground/10 bg-popover/95 backdrop-blur-xl shadow-2xl">
              <div className="px-3 py-2 border-b border-foreground/10 mb-1">
                <p className="text-sm font-semibold truncate">{user?.display_name}</p>
                <p className="text-xs text-muted-foreground truncate">{isGuest ? "Guest profile" : user?.email}</p>
              </div>
              {[{ href: "/settings", label: "Settings", icon: Settings }, { href: "/settings#account", label: isGuest ? "Save my profile" : "Account", icon: UserRound }].map(({ href, label, icon: Icon }) => (
                <Link key={label} href={href} role="menuitem" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm hover:bg-foreground/10"><Icon className="w-4 h-4" />{label}</Link>
              ))}
              <button role="menuitem" onClick={() => { setMenuOpen(false); setShortcutsOpen(true); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm hover:bg-foreground/10"><Keyboard className="w-4 h-4" />Keyboard shortcuts</button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  usePlayerStore.getState().setCurrentTrack(null);
                  logout.mutate(undefined, { onSuccess: () => router.replace("/login") });
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-foreground/10"
              >
                <LogOut className="w-4 h-4" />Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
