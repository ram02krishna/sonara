"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Keyboard, LogOut, Monitor, Moon, Palette, PlayCircle, ShieldCheck, Sun, Trash2, User, Globe, Sparkles } from "lucide-react";
import { ACCENTS, Accent, Density, ThemePref, useAppStore } from "@/store/useAppStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import {
  friendlyError, useChangePassword, useClearHistory, useDeleteAccount, useLogout, usePreferences, useSavePreferences, useUpdateProfile, useUpgradeGuest,
} from "@/hooks/useSonara";
import { useUiStore } from "@/store/useUiStore";
import { cn } from "@/lib/utils";

const field = "w-full px-4 py-2.5 rounded-xl bg-foreground/5 border border-foreground/10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20";
const COUNTRIES: [string, string][] = [["IN", "India"], ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["BR", "Brazil"], ["MX", "Mexico"], ["JP", "Japan"], ["KR", "South Korea"], ["AE", "United Arab Emirates"], ["ID", "Indonesia"], ["NG", "Nigeria"], ["ZA", "South Africa"]];

function Card({ id, icon: Icon, title, desc, children }: { id: string; icon: React.ElementType; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="glass-card rounded-3xl p-6 space-y-5 scroll-mt-24">
      <header className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
        <div><h2 className="text-lg font-bold tracking-tight">{title}</h2>{desc && <p className="text-sm text-muted-foreground">{desc}</p>}</div>
      </header>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0"><p className="text-sm font-medium">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={cn("relative w-11 h-6 rounded-full transition-colors disabled:opacity-40", checked ? "bg-primary" : "bg-foreground/20")}>
      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { settings, updateSettings, resetSettings, user, isGuest, addToast, setShortcutsOpen } = useAppStore();
  const openConfirm = useUiStore((s) => s.openConfirm);
  const { data: prefs } = usePreferences();
  const savePrefs = useSavePreferences();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const upgrade = useUpgradeGuest();
  const clearHistory = useClearHistory();
  const deleteAccount = useDeleteAccount();
  const logout = useLogout();

  const [name, setName] = useState(user?.display_name ?? "");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [email, setEmail] = useState("");
  const [guestPw, setGuestPw] = useState("");
  useEffect(() => setName(user?.display_name ?? ""), [user?.display_name]);

  const ok = (title: string) => addToast({ title, type: "success", duration: 2200 });
  const fail = (title: string) => (e: unknown) => addToast({ title, description: friendlyError(e).detail, type: "error" });

  const themes: { id: ThemePref; label: string; icon: React.ElementType }[] = [
    { id: "system", label: "System", icon: Monitor }, { id: "dark", label: "Dark", icon: Moon }, { id: "light", label: "Light", icon: Sun },
  ];
  const region = prefs?.country || user?.country || "";

  const nav = [["account", "Account"], ["appearance", "Appearance"], ["playback", "Playback"], ["taste", "Taste & region"], ["privacy", "Privacy & data"]];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Make Sonara yours.</p>
      </header>

      <div className="grid md:grid-cols-[11rem_minmax(0,1fr)] gap-8">
        <nav aria-label="Settings sections" className="hidden md:block sticky top-20 self-start space-y-1">
          {nav.map(([id, label]) => <a key={id} href={`#${id}`} className="block px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5">{label}</a>)}
        </nav>

        <div className="space-y-6">
          <Card id="account" icon={User} title="Account" desc={isGuest ? "You're using a guest profile." : user?.email}>
            {isGuest && (
              <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 space-y-3">
                <p className="text-sm"><b>Keep your playlists and taste.</b> Add an email and password so you can sign in on any device.</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  <input className={field} type="password" placeholder="Password (8+ characters)" value={guestPw} onChange={(e) => setGuestPw(e.target.value)} autoComplete="new-password" />
                </div>
                <button disabled={upgrade.isPending || !email || guestPw.length < 8} onClick={() => upgrade.mutate({ email, password: guestPw }, { onSuccess: () => { ok("Profile saved"); setEmail(""); setGuestPw(""); }, onError: fail("Couldn't save your profile") })} className="px-5 py-2 rounded-full bg-brand text-sm font-semibold disabled:opacity-40">
                  {upgrade.isPending ? "Saving…" : "Save my profile"}
                </button>
              </div>
            )}
            <Row label="Display name" hint="Shown in greetings and your account menu">
              <div className="flex gap-2">
                <input className={cn(field, "w-48")} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
                <button disabled={updateProfile.isPending || !name.trim() || name === user?.display_name} onClick={() => updateProfile.mutate({ display_name: name }, { onSuccess: () => ok("Name updated"), onError: fail("Couldn't update your name") })} className="px-4 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-40"><Check className="w-4 h-4" /></button>
              </div>
            </Row>
            {!isGuest && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Change password</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input className={field} type="password" placeholder="Current password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
                  <input className={field} type="password" placeholder="New password (8+ characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
                </div>
                <button disabled={changePassword.isPending || newPw.length < 8 || !curPw} onClick={() => changePassword.mutate({ current_password: curPw, new_password: newPw }, { onSuccess: () => { ok("Password changed"); setCurPw(""); setNewPw(""); }, onError: fail("Couldn't change your password") })} className="px-5 py-2 rounded-full glass-pill text-sm font-semibold disabled:opacity-40">Update password</button>
              </div>
            )}
            <button onClick={() => { usePlayerStore.getState().setCurrentTrack(null); logout.mutate(undefined, { onSuccess: () => router.replace("/login") }); }} className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass-pill text-sm font-semibold"><LogOut className="w-4 h-4" />Log out</button>
          </Card>

          <Card id="appearance" icon={Palette} title="Appearance">
            <div>
              <p className="text-sm font-medium mb-2">Theme</p>
              <div className="grid grid-cols-3 gap-3">
                {themes.map(({ id, label, icon: Icon }) => (
                  <button key={id} aria-pressed={settings.themePref === id} onClick={() => updateSettings({ themePref: id })} className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border text-sm font-medium transition-colors", settings.themePref === id ? "border-primary bg-primary/10" : "border-foreground/10 hover:border-foreground/30")}>
                    <Icon className="w-5 h-5" />{label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Accent colour</p>
              <div className="flex gap-3">
                {(Object.keys(ACCENTS) as Accent[]).map((a) => (
                  <button key={a} aria-label={ACCENTS[a].label} aria-pressed={settings.accent === a} title={ACCENTS[a].label} onClick={() => updateSettings({ accent: a })} style={{ backgroundColor: ACCENTS[a].swatch }} className={cn("w-9 h-9 rounded-full flex items-center justify-center ring-offset-2 ring-offset-background transition-all", settings.accent === a ? "ring-2 ring-foreground scale-110" : "hover:scale-105")}>
                    {settings.accent === a && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <Row label="Compact lists" hint="Fit more songs on screen"><Toggle label="Compact lists" checked={settings.density === "compact"} onChange={(v) => updateSettings({ density: (v ? "compact" : "comfortable") as Density })} /></Row>
            <Row label="Reduce motion" hint="Turn off animations and transitions"><Toggle label="Reduce motion" checked={settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} /></Row>
          </Card>

          <Card id="playback" icon={PlayCircle} title="Playback">
            <Row label="Autoplay" hint="Keep playing similar music when your queue ends"><Toggle label="Autoplay" checked={settings.autoplay} onChange={(v) => updateSettings({ autoplay: v })} /></Row>
            <Row label="Hide explicit songs" hint="Filter explicit songs out of lists"><Toggle label="Hide explicit songs" checked={settings.hideExplicit} onChange={(v) => updateSettings({ hideExplicit: v })} /></Row>
            <Row label="Full songs" hint="Plays complete full-length tracks instead of 30-second clips">
              <Toggle label="Full songs" checked={settings.fullSongs !== false} onChange={(v) => updateSettings({ fullSongs: v, fullSongVideo: v })} />
            </Row>
            <Row label="Show video window" hint="Show floating music video card. When off, songs still play in full length as pure background audio">
              <Toggle label="Show video window" checked={settings.showVideoWindow} onChange={(v) => updateSettings({ showVideoWindow: v })} />
            </Row>
            <Row label="Preview speed" hint="Applies to 30-second previews">
              <select value={settings.playbackSpeed} onChange={(e) => updateSettings({ playbackSpeed: Number(e.target.value) })} className="px-3 py-2 rounded-xl bg-foreground/5 border border-foreground/10 text-sm outline-none">
                {[0.75, 1, 1.25, 1.5, 2].map((s) => <option key={s} value={s} className="bg-popover">{s}×</option>)}
              </select>
            </Row>
            <button onClick={() => setShortcutsOpen(true)} className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass-pill text-sm font-semibold"><Keyboard className="w-4 h-4" />Keyboard shortcuts</button>
          </Card>

          <Card id="taste" icon={Globe} title="Taste & region" desc="This is what Sonara uses to build your home page.">
            <Row label="Region" hint="Decides which songs are available to you">
              <select
                value={region}
                onChange={(e) => {
                  const country = e.target.value;
                  updateProfile.mutate({ country }, { onError: fail("Couldn't change your region") });
                  savePrefs.mutate({ ...(prefs ?? { languages: [], genres: [], artists: [], onboarded: true }), country }, { onSuccess: () => ok("Region updated") });
                }}
                className="px-3 py-2 rounded-xl bg-foreground/5 border border-foreground/10 text-sm outline-none"
              >
                {!region && <option value="">Select…</option>}
                {COUNTRIES.map(([c, n]) => <option key={c} value={c} className="bg-popover">{n}</option>)}
              </select>
            </Row>
            <div className="flex flex-wrap gap-2">
              {[...(prefs?.languages ?? []), ...(prefs?.genres ?? [])].map((t) => <span key={t} className="px-3 py-1 rounded-full bg-foreground/10 text-xs font-medium capitalize">{t}</span>)}
              {!(prefs?.languages?.length || prefs?.genres?.length) && <p className="text-sm text-muted-foreground">You haven&apos;t chosen any languages or genres yet.</p>}
            </div>
            <button onClick={() => router.push("/onboarding")} className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-brand text-sm font-semibold"><Sparkles className="w-4 h-4" />Edit languages, genres & artists</button>
          </Card>

          <Card id="privacy" icon={ShieldCheck} title="Privacy & data" desc="Your data stays yours. Download it or delete it any time.">
            <div className="flex flex-wrap gap-3">
              <a href="/api/v1/me/export" download className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass-pill text-sm font-semibold"><Download className="w-4 h-4" />Download my data</a>
              <button onClick={() => openConfirm({ title: "Clear listening history?", detail: "This resets your insights and recently played, and makes recommendations start over.", confirmLabel: "Clear history", danger: true, onConfirm: () => clearHistory.mutateAsync().then(() => ok("History cleared")) })} className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass-pill text-sm font-semibold"><Trash2 className="w-4 h-4" />Clear listening history</button>
            </div>
            <div className="rounded-2xl border border-red-500/30 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-500">Delete account</p>
              <p className="text-xs text-muted-foreground">Permanently deletes your profile, playlists, likes, follows and history. This can&apos;t be undone.</p>
              <button onClick={() => openConfirm({ title: "Delete your account?", detail: "Everything will be permanently removed.", confirmLabel: "Delete forever", danger: true, onConfirm: () => deleteAccount.mutateAsync().then(() => { usePlayerStore.getState().setCurrentTrack(null); window.location.href = "/login"; }).catch(fail("Couldn't delete your account")) })} className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-sm font-semibold">Delete my account</button>
            </div>
          </Card>

          <div className="flex items-center justify-between text-xs text-muted-foreground pb-4">
            <p>Sonara · music metadata from public catalogues · lyrics from LRCLIB</p>
            <button onClick={() => { resetSettings(); ok("Settings reset"); }} className="hover:text-foreground">Reset appearance & playback</button>
          </div>
        </div>
      </div>
    </div>
  );
}
