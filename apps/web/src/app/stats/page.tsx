"use client";

import React, { useMemo, useState } from "react";
import { Clock, Flame, Music2, Sparkles, Users } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { friendlyError, useStats, useTopArtists, useTopTracks } from "@/hooks/useSonara";
import { ArtistCard, EmptyState, ErrorState, SectionHeader, TrackRow } from "@/components/ui/media";
import { cn } from "@/lib/utils";

type Range = "4weeks" | "6months" | "alltime";
const RANGES: { id: Range; label: string }[] = [
  { id: "4weeks", label: "Last 4 weeks" },
  { id: "6months", label: "Last 6 months" },
  { id: "alltime", label: "All time" },
];

function Kpi({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: React.ElementType }) {
  return (
    <div className="glass-card rounded-3xl p-5 space-y-2">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className="text-3xl font-extrabold text-foreground tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function InsightsPage() {
  const [range, setRange] = useState<Range>("4weeks");
  const stats = useStats(range);
  const topTracks = useTopTracks(range);
  const topArtists = useTopArtists(range);

  // Genres from the artists you actually play.
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    (topArtists.data ?? []).forEach((a, i) => (a.genres ?? []).forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1 / (i + 2))));
    const total = Array.from(counts.values()).reduce((x, y) => x + y, 0) || 1;
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, v]) => ({ name, percent: Math.round((v / total) * 100) }));
  }, [topArtists.data]);

  const err = stats.error ? friendlyError(stats.error) : null;
  const s = stats.data;
  const empty = !!s && s.play_count === 0;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Your insights</h1>
          <p className="text-xs text-muted-foreground mt-1">Built from what you listen to in Sonara. A song counts after 15 seconds.</p>
        </div>
        <div role="tablist" className="flex items-center gap-1 p-1 rounded-full glass-panel self-start">
          {RANGES.map((r) => (
            <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)} className={cn("px-4 py-1.5 rounded-full text-xs font-semibold transition-all", range === r.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{r.label}</button>
          ))}
        </div>
      </div>

      {err && <ErrorState title={err.title} detail={err.detail} onRetry={() => stats.refetch()} />}

      {s && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Listening time" value={`${(s.total_minutes / 60).toFixed(1)} h`} hint={`${s.play_count} plays`} icon={Clock} />
            <Kpi label="Streak" value={`${s.streak_days} ${s.streak_days === 1 ? "day" : "days"}`} hint="Consecutive days with a play" icon={Flame} />
            <Kpi label="Different songs" value={s.unique_tracks.toLocaleString()} icon={Music2} />
            <Kpi label="Different artists" value={s.unique_artists.toLocaleString()} icon={Users} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card rounded-3xl p-6 space-y-4">
              <div><h2 className="text-lg font-bold">Listening activity</h2><p className="text-xs text-muted-foreground">Hours played</p></div>
              {empty || s.daily_listening.length === 0 ? (
                <EmptyState icon={Sparkles} title="No plays yet" detail="Listen to a few songs and your activity shows up here." />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={s.daily_listening}>
                      <defs>
                        <linearGradient id="hours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 16, fontSize: 12, color: "hsl(var(--popover-foreground))" }} />
                      <Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#hours)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="glass-card rounded-3xl p-6 space-y-4">
              <div><h2 className="text-lg font-bold">Your sound</h2><p className="text-xs text-muted-foreground">Genres of the artists you play</p></div>
              {genres.length === 0 ? (
                <p className="text-sm text-muted-foreground">Play a few songs to see your genres.</p>
              ) : (
                <div className="space-y-3 pt-1">
                  {genres.map((g) => (
                    <div key={g.name} className="space-y-1">
                      <div className="flex justify-between text-xs"><span className="font-medium capitalize">{g.name}</span><span className="font-mono text-muted-foreground">{g.percent}%</span></div>
                      <div className="h-2 rounded-full bg-foreground/10 overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${g.percent}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <SectionHeader title="Top songs" />
          {(topTracks.data ?? []).slice(0, 10).map((t, i) => <TrackRow key={t.id} track={t} index={i} context={topTracks.data} showAlbum={false} />)}
          {topTracks.data?.length === 0 && <EmptyState title="No top songs for this period" />}
        </section>
        <section>
          <SectionHeader title="Top artists" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{(topArtists.data ?? []).slice(0, 6).map((a) => <ArtistCard key={a.id} artist={a} />)}</div>
          {topArtists.data?.length === 0 && <EmptyState title="No top artists for this period" />}
        </section>
      </div>
    </div>
  );
}
