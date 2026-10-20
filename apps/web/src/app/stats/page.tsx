"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Flame, Disc3, Award, BarChart2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { friendlyError, useStats, useTopArtists, useTopTracks } from "@/hooks/useSonara";
import { ArtistCard, EmptyState, ErrorState, SectionHeader, TrackRow } from "@/components/ui/media";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

type Range = "4weeks" | "6months" | "alltime";
const RANGES: { id: Range; label: string; term: string }[] = [
  { id: "4weeks", label: "Last 4 Weeks", term: "short_term" },
  { id: "6months", label: "Last 6 Months", term: "medium_term" },
  { id: "alltime", label: "All Time", term: "long_term" },
];
const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f97316", "#ec4899", "#eab308"];

function Kpi({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: string; icon: React.ElementType; tone: string }) {
  return (
    <div className="glass-card rounded-3xl p-5 space-y-2">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <Icon className={cn("w-4 h-4", tone)} />
      </div>
      <p className="text-3xl font-extrabold text-foreground tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function StatsPage() {
  const [range, setRange] = useState<Range>("4weeks");
  const { isAuthenticated } = useAppStore();
  const rangeTerm = RANGES.find((r) => r.id === range)!.term;
  const stats = useStats(range, isAuthenticated);
  const topArtists = useTopArtists(rangeTerm, isAuthenticated);
  const topTracks = useTopTracks(rangeTerm, isAuthenticated);

  // Genre affinity from the user's real top artists.
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    (topArtists.data ?? []).forEach((a, i) => (a.genres ?? []).forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1 / (i + 2))));
    const total = Array.from(counts.values()).reduce((x, y) => x + y, 0) || 1;
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, v], i) => ({ name, percent: Math.round((v / total) * 100), color: COLORS[i % COLORS.length] }));
  }, [topArtists.data]);

  const err = stats.error ? friendlyError(stats.error) : null;
  const s = stats.data;
  const hours = s ? (s.total_minutes / 60).toFixed(1) : "0";
  const noPlays = !!s && s.play_count === 0;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Listening Analytics</h1>
          <p className="text-xs text-muted-foreground mt-1">Plays and listening analytics recorded as you listen in Sonara.</p>
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-panel self-start sm:self-auto">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={cn("px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all", range === r.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="glass-card rounded-3xl p-10 text-center max-w-lg mx-auto space-y-4 my-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mx-auto">
            <BarChart2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Track your listening habits</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Sign in to Sonara to view your personal listening time, top tracks, and favorite artists.
          </p>
          <div className="pt-2">
            <Link
              href="/login?tab=signin"
              className="inline-block px-8 py-3 rounded-full bg-foreground text-background font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              Log in
            </Link>
          </div>
        </div>
      ) : (
        <>
          {err && <ErrorState title={err.title} detail={err.detail} onRetry={() => stats.refetch()} />}

          {s && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <Kpi label="Listening time" value={`${hours} hrs`} hint={`${s.play_count} plays (estimated)`} icon={Clock} tone="text-cyan-500" />
              <Kpi label="Streak" value={`${s.streak_days} ${s.streak_days === 1 ? "day" : "days"}`} hint="Consecutive days with a play" icon={Flame} tone="text-orange-500" />
              <Kpi label="Unique tracks" value={s.unique_tracks.toLocaleString()} hint={`Across ${s.unique_artists} artists`} icon={Disc3} tone="text-primary" />
              <Kpi label="Top genre" value={genres[0]?.name ?? "—"} hint={genres[0] ? `${genres[0].percent}% of your top artists` : "Appears as you listen to more artists"} icon={Award} tone="text-fuchsia-500" />
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card rounded-3xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight">Listening activity</h2>
                <p className="text-xs text-muted-foreground">Hours played in Sonara</p>
              </div>
              {noPlays || s.daily_listening.length === 0 ? (
                <EmptyState title="No plays recorded yet" detail="Play a few songs in Sonara and your activity chart will fill in." />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={s.daily_listening}>
                      <defs>
                        <linearGradient id="hoursGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#8b8b99" fontSize={11} tickLine={false} />
                      <YAxis stroke="#8b8b99" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 16, fontSize: 12, color: "hsl(var(--popover-foreground))" }} />
                      <Area type="monotone" dataKey="hours" stroke="#8b5cf6" strokeWidth={3} fill="url(#hoursGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="glass-card rounded-3xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight">Genre affinity</h2>
                <p className="text-xs text-muted-foreground">From your top artists in Sonara</p>
              </div>
              {genres.length === 0 ? (
                <p className="text-sm text-muted-foreground">No genre data yet.</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {genres.map((g) => (
                    <div key={g.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-foreground capitalize">{g.name}</span>
                        <span className="font-mono text-muted-foreground">{g.percent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-foreground/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${g.percent}%`, backgroundColor: g.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>)}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <SectionHeader title="Top tracks" />
            {(topTracks.data ?? []).slice(0, 10).map((t, i) => <TrackRow key={t.id} track={t} index={i} context={topTracks.data} />)}
            {topTracks.data && topTracks.data.length === 0 && <EmptyState title="No top tracks for this period" />}
          </section>
          <section>
            <SectionHeader title="Top artists" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(topArtists.data ?? []).slice(0, 6).map((a) => <ArtistCard key={a.id} artist={a} />)}
            </div>
            {topArtists.data && topArtists.data.length === 0 && <EmptyState title="No top artists for this period" />}
          </section>
        </div>
      </>
    )}
    </div>
  );
}
