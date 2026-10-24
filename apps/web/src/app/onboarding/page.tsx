"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search, X } from "lucide-react";
import { usePreferences, useSavePreferences, useSearch } from "@/hooks/useSonara";
import { useAppStore } from "@/store/useAppStore";
import { ArtistSummary } from "@/types/api";
import { cn } from "@/lib/utils";

const LANGUAGES = ["English", "Hindi", "Punjabi", "Tamil", "Telugu", "Malayalam", "Kannada", "Bengali", "Marathi", "Gujarati", "Urdu", "Korean", "Japanese", "Spanish", "Portuguese", "Arabic", "French", "German", "Turkish"];
const GENRES = ["Pop", "Rock", "Hip Hop", "R&B", "EDM", "Lofi", "Indie", "Jazz", "Classical", "Metal", "Country", "Reggae", "Afrobeats", "Latin", "Devotional", "Sufi", "Ghazal", "Soul", "Blues", "Folk"];
const COUNTRIES: [string, string][] = [["", "Auto-detect (Global)"], ["IN", "India"], ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["BR", "Brazil"], ["MX", "Mexico"], ["JP", "Japan"], ["KR", "South Korea"], ["AE", "United Arab Emirates"], ["ID", "Indonesia"], ["NG", "Nigeria"], ["ZA", "South Africa"]];

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all",
        active
          ? "bg-brand border-transparent shadow-md shadow-brand font-semibold"
          : "glass-pill text-foreground hover:bg-foreground/10"
      )}
    >
      {active && <Check className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const addToast = useAppStore((s) => s.addToast);
  const { data: saved } = usePreferences();
  const save = useSavePreferences();

  const [languages, setLanguages] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [country, setCountry] = useState("");
  const [artistQuery, setArtistQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!saved) return;
    const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
    setLanguages(saved.languages.map(cap));
    setGenres(saved.genres.map(cap));
    setArtists(saved.artists);
    setCountry(saved.country ?? "");
  }, [saved]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(artistQuery), 300);
    return () => clearTimeout(t);
  }, [artistQuery]);

  const { data: found, isFetching } = useSearch(debounced, "artist");
  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const totalSelected = languages.length + genres.length + artists.length;
  const canSave = totalSelected > 0;

  const onSave = () =>
    save.mutate(
      { languages, genres, artists, country },
      {
        onSuccess: () => router.push("/"),
        onError: () => addToast({ title: "Couldn't save your taste", description: "Please try again.", type: "error" }),
      }
    );

  const onSkip = () => {
    try {
      sessionStorage.setItem("sonara-skip-onboarding", "1");
    } catch {
      /* ignore */
    }
    router.push("/");
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-10 pb-20">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
          Make Sonara <span className="text-gradient">yours</span>
        </h1>
        <p className="text-muted-foreground">
          Everyone listens differently. Tell us what you love and your home page is built around your taste.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Languages you listen in</h2>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l} label={l} active={languages.includes(l)} onClick={() => toggle(languages, setLanguages, l)} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Genres</h2>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <Chip key={g} label={g} active={genres.includes(g)} onClick={() => toggle(genres, setGenres, g)} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Favourite artists</h2>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={artistQuery}
            onChange={(e) => setArtistQuery(e.target.value)}
            placeholder="Search any artist, in any language…"
            className="w-full pl-10 pr-10 py-3 rounded-2xl glass-pill text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          {isFetching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        {debounced && found?.artists && found.artists.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {found.artists.map((a) => {
              const on = artists.some((x) => x.id === a.id);
              return (
                <Chip
                  key={a.id}
                  label={a.name}
                  active={on}
                  onClick={() => setArtists(on ? artists.filter((x) => x.id !== a.id) : [...artists, { id: a.id, name: a.name, uri: a.uri }])}
                />
              );
            })}
          </div>
        )}
        {artists.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {artists.map((a) => (
              <span key={a.id || a.name} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-primary/15 text-foreground dark:text-blue-400 border border-blue-500/20 text-sm font-medium">
                {a.name}
                <button aria-label={`Remove ${a.name}`} onClick={() => setArtists(artists.filter((x) => x.name !== a.name))} className="p-0.5 rounded-full hover:bg-blue-500/20">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Your region</h2>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full md:w-72 px-4 py-3 rounded-2xl glass-card border border-foreground/10 text-sm text-foreground outline-none bg-card focus:ring-2 focus:ring-blue-500/50"
        >
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code} className="bg-popover text-popover-foreground">
              {name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Select your region to discover songs and releases available in your area.</p>
      </section>

      {/* Action Footer */}
      <div className="pt-6 border-t border-foreground/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-muted-foreground">
          {canSave ? (
            <span className="text-blue-500 dark:text-blue-400 font-medium">
              {totalSelected} preference{totalSelected === 1 ? "" : "s"} selected
            </span>
          ) : (
            <span>Select a few languages, genres, or artists to personalize your experience</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="px-4 py-2.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={onSave}
            disabled={!canSave || save.isPending}
            className="px-6 py-2.5 rounded-full bg-brand font-semibold text-sm shadow-md shadow-blue-600/25 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all inline-flex items-center gap-2"
          >
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Build my home</span>
          </button>
        </div>
      </div>
    </div>
  );
}
