import { apiFetch } from "@/lib/api-client";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppStore } from "@/store/useAppStore";
import { SearchResult, Track } from "@/types/api";

/** More music like a track: songs by the same artist, shuffled, without the seed. */
export async function fetchSimilar(seed: Track): Promise<Track[]> {
  const artist = seed.artists?.[0]?.name;
  if (!artist) return [];
  const pages = await Promise.all(
    [0, 10].map((offset) =>
      apiFetch<SearchResult>("/search", { params: { q: `artist:"${artist}"`, type: "track", limit: 10, offset } }).catch(() => ({ tracks: [] } as SearchResult))
    )
  );
  const seen = new Set<string>([seed.id]);
  const tracks: Track[] = [];
  pages.forEach((p) =>
    (p.tracks ?? []).forEach((t) => {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        tracks.push(t);
      }
    })
  );
  return tracks.sort(() => Math.random() - 0.5);
}

/** Start a "radio" from a track: more music from the same artist, seed first. */
export async function startRadio(seed: Track) {
  const toast = useAppStore.getState().addToast;
  try {
    const tracks = await fetchSimilar(seed);
    if (tracks.length === 0) {
      toast({ title: "No radio available", description: `Couldn't find more music like ${seed.name}.`, type: "info" });
      return;
    }
    usePlayerStore.getState().playList([seed, ...tracks], 0);
    toast({ title: `Radio: ${seed.name}`, description: `More like ${seed.artists?.[0]?.name}`, type: "success" });
  } catch {
    toast({ title: "Couldn't start radio", type: "error" });
  }
}
