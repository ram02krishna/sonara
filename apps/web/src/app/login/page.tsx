"use client";

import React from "react";
import Link from "next/link";
import {
  Music,
  Sparkles,
  ShieldCheck,
  Disc3,
  Mic2,
  BarChart2,
  Radio,
  ArrowRight,
  Check,
} from "lucide-react";

export default function LoginPage() {
  const handleConnectSpotify = () => {
    // Redirects to backend BFF OAuth PKCE endpoint
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";
    window.location.href = `${apiUrl}/auth/login`;
  };

  return (
    <div className="min-h-full py-12 px-6 max-w-5xl mx-auto flex flex-col justify-center items-center text-center space-y-12">
      {/* Brand Hero */}
      <div className="space-y-4 max-w-2xl">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 via-purple-500 to-cyan-400 p-[2px] shadow-2xl shadow-violet-500/30 mx-auto flex items-center justify-center">
          <div className="w-full h-full bg-black/80 rounded-[22px] flex items-center justify-center">
            <Music className="w-8 h-8 text-cyan-300 animate-pulseGlow" />
          </div>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Sound as Pure as{" "}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            the Studio Master.
          </span>
        </h1>

        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
          Sonara blends Spotify’s limitless catalog with Apple Music’s breathtaking aesthetics, dynamic album-reactive ambient glassmorphism, and instant time-synced lyrics.
        </p>
      </div>

      {/* CTA Box */}
      <div className="glass-card p-8 rounded-3xl border border-white/10 max-w-md w-full space-y-5 shadow-2xl backdrop-blur-2xl">
        <button
          onClick={handleConnectSpotify}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-base shadow-xl shadow-emerald-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Music className="w-5 h-5 fill-current" />
          <span>Connect with Spotify</span>
        </button>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Secured by Spotify OAuth 2.0 PKCE. Tokens are encrypted server-side with AES-256 GCM. Sonara operates as a secure Backend-For-Frontend (BFF).
        </p>

        <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-cyan-300">
          <ShieldCheck className="w-4 h-4" />
          <span>Spotify Premium recommended for Web Playback</span>
        </div>
      </div>

      {/* Feature Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left pt-6">
        <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Dynamic Album Glow</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Realtime client-side color extraction tints your player, backdrop, and controls to match the album artwork.
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Mic2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Time-Synced Lyrics</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            LRCLIB-powered millisecond accurate lyrics scroll automatically alongside every track with vocal line tracking.
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-white/5 space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400">
            <BarChart2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Personal Analytics</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Local Postgres telemetry tracks listening streaks, genre affinity curves, and top songs over time.
          </p>
        </div>
      </div>
    </div>
  );
}
