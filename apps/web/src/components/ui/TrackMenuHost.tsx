"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Disc3, Heart, ListPlus, ListEnd, Plus, Radio, Trash2, User } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { useTrackLiked } from "@/hooks/useSonara";
import { startRadio } from "@/lib/radio";

function Item({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-left hover:bg-foreground/10 ${danger ? "text-red-500" : "text-foreground"}`}
    >
      <Icon className="w-4 h-4 shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </button>
  );
}

/** One global context menu for every track in the app (⋯ button or right-click). */
export function TrackMenuHost() {
  const { menu, closeMenu, openAddToPlaylist, openCreatePlaylist } = useUiStore();
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const { addToQueue, playNextInQueue } = usePlayerStore();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const { liked, toggle } = useTrackLiked(menu?.track);

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - height - 8)),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const close = () => closeMenu();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu, closeMenu]);

  if (!menu) return null;
  const t = menu.track;
  const artist = t.artists?.[0];
  const run = (fn: () => void) => () => {
    closeMenu();
    fn();
  };

  return (
    <div className="fixed inset-0 z-[80]" onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}>
      <div
        ref={ref}
        role="menu"
        onClick={(e) => e.stopPropagation()}
        style={{ left: pos.left, top: pos.top }}
        className="pop-in fixed w-60 p-1.5 rounded-2xl border border-foreground/10 bg-popover/95 backdrop-blur-xl shadow-2xl"
      >
        <div className="px-3 pt-2 pb-1.5 border-b border-foreground/10 mb-1">
          <p className="text-sm font-semibold truncate">{t.name}</p>
          <p className="text-xs text-muted-foreground truncate">{t.artists?.map((a) => a.name).join(", ")}</p>
        </div>
        <Item icon={ListEnd} label="Play next" onClick={run(() => { playNextInQueue(t); addToast({ title: "Playing next", description: t.name, type: "success", duration: 2000 }); })} />
        <Item icon={ListPlus} label="Add to queue" onClick={run(() => { addToQueue(t); addToast({ title: "Added to queue", description: t.name, type: "success", duration: 2000 }); })} />
        <Item icon={Heart} label={liked ? "Remove from Liked Songs" : "Save to Liked Songs"} onClick={run(() => toggle.mutate(!liked))} />
        <Item icon={Plus} label="Add to playlist…" onClick={() => openAddToPlaylist([t])} />
        <Item icon={Plus} label="New playlist with this song" onClick={() => openCreatePlaylist([t])} />
        <Item icon={Radio} label="Start song radio" onClick={run(() => void startRadio(t))} />
        {artist?.id && <Item icon={User} label={`Go to ${artist.name}`} onClick={run(() => router.push(`/artist/${artist.id}`))} />}
        {t.album?.id && <Item icon={Disc3} label="Go to album" onClick={run(() => router.push(`/album/${t.album.id}`))} />}
        <Item icon={Copy} label="Copy song name" onClick={run(() => { void navigator.clipboard?.writeText(`${t.name} - ${t.artists?.map((a) => a.name).join(", ")}`); addToast({ title: "Copied", type: "success", duration: 1500 }); })} />
        {menu.onRemove && <Item icon={Trash2} label={menu.onRemove.label} danger onClick={run(menu.onRemove.run)} />}
      </div>
    </div>
  );
}
