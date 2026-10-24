"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListMusic, Loader2, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { PlaylistCover } from "@/components/ui/media";
import { useUiStore } from "@/store/useUiStore";
import { useAppStore } from "@/store/useAppStore";
import { friendlyError, usePlaylistActions, usePlaylists } from "@/hooks/useSonara";

const field =
  "w-full px-4 py-3 rounded-xl bg-foreground/5 border border-foreground/10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

function AddToPlaylistDialog() {
  const { addToPlaylist, closeAddToPlaylist, openCreatePlaylist } = useUiStore();
  const addToast = useAppStore((s) => s.addToast);
  const { data: playlists, isLoading } = usePlaylists(!!addToPlaylist);
  const { addTracks } = usePlaylistActions();
  const [filter, setFilter] = useState("");
  useEffect(() => setFilter(""), [addToPlaylist]);

  const list = (playlists ?? []).filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));
  const tracks = addToPlaylist ?? [];

  const add = (id: string, name: string) =>
    addTracks.mutate(
      { id, tracks },
      {
        onSuccess: (r) => {
          addToast({
            title: r.added > 0 ? `Added to ${name}` : "Already in this playlist",
            description: tracks.length === 1 ? tracks[0].name : `${r.added} songs added`,
            type: r.added > 0 ? "success" : "info",
          });
          closeAddToPlaylist();
        },
        onError: (e) => addToast({ title: "Couldn't add the song", description: friendlyError(e).detail, type: "error" }),
      }
    );

  return (
    <Modal open={!!addToPlaylist} onClose={closeAddToPlaylist} title="Add to playlist">
      <button onClick={() => openCreatePlaylist(tracks)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-brand text-sm font-semibold mb-3">
        <Plus className="w-4 h-4" /> New playlist
      </button>
      {(playlists?.length ?? 0) > 6 && <input className={`${field} mb-3`} placeholder="Find a playlist" value={filter} onChange={(e) => setFilter(e.target.value)} />}
      {isLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
      {!isLoading && list.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No playlists yet. Create your first one above.</p>}
      <div className="space-y-1">
        {list.map((p) => (
          <button key={p.id} onClick={() => add(p.id, p.name)} disabled={addTracks.isPending} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-foreground/10 text-left disabled:opacity-60">
            <PlaylistCover covers={p.covers} className="w-11 h-11 rounded-lg shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.track_count} songs</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function CreatePlaylistDialog() {
  const { createPlaylist, closeCreatePlaylist } = useUiStore();
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const { create } = usePlaylistActions();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  useEffect(() => {
    if (createPlaylist) {
      setName(createPlaylist.tracks.length === 1 ? createPlaylist.tracks[0].name : "");
      setDesc("");
    }
  }, [createPlaylist]);

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), description: desc.trim(), tracks: createPlaylist?.tracks },
      {
        onSuccess: (p) => {
          closeCreatePlaylist();
          addToast({ title: "Playlist created", description: p.name, type: "success" });
          router.push(`/playlist/${p.id}`);
        },
        onError: (e) => addToast({ title: "Couldn't create the playlist", description: friendlyError(e).detail, type: "error" }),
      }
    );
  };

  return (
    <Modal open={!!createPlaylist} onClose={closeCreatePlaylist} title="Create playlist">
      <div className="space-y-3">
        <input autoFocus className={field} placeholder="Playlist name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <textarea className={`${field} resize-none h-24`} placeholder="Add an optional description" value={desc} maxLength={500} onChange={(e) => setDesc(e.target.value)} />
        {(createPlaylist?.tracks.length ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ListMusic className="w-3.5 h-3.5" /> Starts with {createPlaylist!.tracks.length} song{createPlaylist!.tracks.length > 1 ? "s" : ""}</p>
        )}
        <button onClick={submit} disabled={!name.trim() || create.isPending} className="w-full py-3 rounded-xl bg-brand text-sm font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2">
          {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Create
        </button>
      </div>
    </Modal>
  );
}

function EditPlaylistDialog() {
  const { editPlaylist, openEditPlaylist } = useUiStore();
  const addToast = useAppStore((s) => s.addToast);
  const { update } = usePlaylistActions();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  useEffect(() => {
    if (editPlaylist) {
      setName(editPlaylist.name);
      setDesc(editPlaylist.description);
    }
  }, [editPlaylist]);

  const submit = () => {
    if (!editPlaylist || !name.trim()) return;
    update.mutate(
      { id: editPlaylist.id, name: name.trim(), description: desc.trim() },
      {
        onSuccess: () => {
          openEditPlaylist(null);
          addToast({ title: "Playlist updated", type: "success" });
        },
        onError: (e) => addToast({ title: "Couldn't save changes", description: friendlyError(e).detail, type: "error" }),
      }
    );
  };

  return (
    <Modal open={!!editPlaylist} onClose={() => openEditPlaylist(null)} title="Edit details">
      <div className="space-y-3">
        <input autoFocus className={field} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <textarea className={`${field} resize-none h-24`} value={desc} maxLength={500} placeholder="Description" onChange={(e) => setDesc(e.target.value)} />
        <button onClick={submit} disabled={!name.trim() || update.isPending} className="w-full py-3 rounded-xl bg-brand text-sm font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-2">
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
        </button>
      </div>
    </Modal>
  );
}

function ConfirmDialog() {
  const { confirm, closeConfirm } = useUiStore();
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={!!confirm} onClose={closeConfirm} title={confirm?.title ?? ""}>
      {confirm?.detail && <p className="text-sm text-muted-foreground mb-5">{confirm.detail}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={closeConfirm} className="px-4 py-2.5 rounded-xl text-sm hover:bg-foreground/10">Cancel</button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await confirm?.onConfirm();
            } finally {
              setBusy(false);
              closeConfirm();
            }
          }}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white ${confirm?.danger ? "bg-red-600 hover:bg-red-500" : "bg-brand"}`}
        >
          {confirm?.confirmLabel ?? "Confirm"}
        </button>
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  ["→ / ←", "Skip 10 seconds forward / back"],
  ["Shift + → / ←", "Next / previous song"],
  ["↑ / ↓", "Volume up / down"],
  ["M", "Mute"],
  ["S", "Shuffle"],
  ["R", "Repeat"],
  ["L", "Like current song"],
  ["Q", "Open queue"],
  ["Y", "Open lyrics"],
  ["F", "Full-screen player"],
  ["/", "Focus search"],
  ["Ctrl / ⌘ + K", "Command palette"],
  ["?", "Show this help"],
];

function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useAppStore();
  return (
    <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="Keyboard shortcuts">
      <div className="space-y-1">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">{d}</span>
            <kbd className="px-2 py-0.5 rounded-md bg-foreground/10 text-xs font-mono">{k}</kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function DialogHost() {
  return (
    <>
      <AddToPlaylistDialog />
      <CreatePlaylistDialog />
      <EditPlaylistDialog />
      <ConfirmDialog />
      <ShortcutsDialog />
    </>
  );
}
