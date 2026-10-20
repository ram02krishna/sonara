"use client";

import React, { useState } from "react";
import {
  BarChart2,
  Calendar,
  Flame,
  Clock,
  TrendingUp,
  Sparkles,
  Award,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { MOCK_TRACKS, MOCK_ARTISTS } from "@/data/mockCatalog";
import { cn } from "@/lib/utils";

type TimeRange = "4weeks" | "6months" | "alltime";

const LISTENING_DATA = {
  "4weeks": [
    { date: "Mon", hours: 2.4 },
    { date: "Tue", hours: 3.1 },
    { date: "Wed", hours: 1.8 },
    { date: "Thu", hours: 4.2 },
    { date: "Fri", hours: 5.6 },
    { date: "Sat", hours: 6.8 },
    { date: "Sun", hours: 4.5 },
  ],
  "6months": [
    { date: "May", hours: 45 },
    { date: "Jun", hours: 58 },
    { date: "Jul", hours: 62 },
    { date: "Aug", hours: 78 },
    { date: "Sep", hours: 82 },
    { date: "Oct", hours: 94 },
  ],
  "alltime": [
    { date: "2023 Q1", hours: 180 },
    { date: "2023 Q2", hours: 210 },
    { date: "2023 Q3", hours: 240 },
    { date: "2023 Q4", hours: 290 },
    { date: "2024 Q1", hours: 340 },
    { date: "2024 Q2", hours: 380 },
  ],
};

const GENRE_DATA = [
  { name: "Synthwave", percent: 38, color: "#8b5cf6" },
  { name: "Electro Pop", percent: 26, color: "#06b6d4" },
  { name: "Ambient / Lo-Fi", percent: 18, color: "#10b981" },
  { name: "Cinematic OST", percent: 12, color: "#f97316" },
  { name: "Indie Rock", percent: 6, color: "#ec4899" },
];

export default function StatsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("4weeks");

  const currentListening = LISTENING_DATA[timeRange];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Listening Analytics</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Aggregated from Spotify telemetry and Sonara lossless sessions
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-panel border border-white/5 self-start sm:self-auto">
          {(["4weeks", "6months", "alltime"] as TimeRange[]).map((r) => {
            const labels: Record<TimeRange, string> = {
              "4weeks": "Last 4 Weeks",
              "6months": "Last 6 Months",
              "alltime": "All Time",
            };
            return (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  timeRange === r
                    ? "bg-white text-black font-bold shadow"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                {labels[r]}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card rounded-3xl p-5 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Listening Time</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">128.4 hrs</p>
          <p className="text-[11px] text-emerald-400 font-medium">↑ 18% from previous period</p>
        </div>

        <div className="glass-card rounded-3xl p-5 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Listening Streak</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">24 Days</p>
          <p className="text-[11px] text-muted-foreground">Personal best is 42 days</p>
        </div>

        <div className="glass-card rounded-3xl p-5 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Unique Tracks</span>
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-3xl font-extrabold text-white tracking-tight">1,492</p>
          <p className="text-[11px] text-cyan-300">Across 320 distinct artists</p>
        </div>

        <div className="glass-card rounded-3xl p-5 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Top Taste Genre</span>
            <Award className="w-4 h-4 text-fuchsia-400" />
          </div>
          <p className="text-2xl font-extrabold text-white tracking-tight">Synthwave</p>
          <p className="text-[11px] text-muted-foreground">38% of your overall playtime</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Listening Trend Chart */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Listening Activity</h2>
              <p className="text-xs text-muted-foreground">Hours streamed over time</p>
            </div>
            <span className="text-xs font-semibold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-800/40">
              Peak: 6.8 hrs / day
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentListening}>
                <defs>
                  <linearGradient id="hoursGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(18, 18, 26, 0.9)",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                    fontSize: "12px",
                    color: "#fff",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#hoursGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Genres Breakdown */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Genre Affinity</h2>
            <p className="text-xs text-muted-foreground">Breakdown of acoustic preferences</p>
          </div>

          <div className="space-y-3 pt-2">
            {GENRE_DATA.map((genre) => (
              <div key={genre.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-white">{genre.name}</span>
                  <span className="font-mono text-muted-foreground">{genre.percent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${genre.percent}%`, backgroundColor: genre.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Tracks & Artists Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Tracks */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-white tracking-tight">Top Tracks</h3>
          <div className="space-y-2">
            {MOCK_TRACKS.map((t, idx) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 text-center font-bold text-sm text-cyan-400">#{idx + 1}</span>
                  <img src={t.album.images?.[0]?.url || ""} alt="" className="w-10 h-10 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.artists[0]?.name}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{t.popularity}% score</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Artists */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
          <h3 className="text-lg font-bold text-white tracking-tight">Top Artists</h3>
          <div className="space-y-2">
            {MOCK_ARTISTS.map((a, idx) => (
              <div key={a.id} className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 text-center font-bold text-sm text-violet-400">#{idx + 1}</span>
                  <img src={a.images?.[0]?.url || ""} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground capitalize truncate">{a.genres[0]}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Rank #{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
