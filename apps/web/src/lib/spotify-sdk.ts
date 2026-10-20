/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal typings + singleton holder for the Spotify Web Playback SDK (Premium only).

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

let player: any = null;

export const getSdkPlayer = () => player;
export const setSdkPlayer = (p: any) => {
  player = p;
};

let scriptPromise: Promise<void> | null = null;

export function loadSpotifySdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Spotify) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement("script");
    s.src = "https://sdk.scdn.co/spotify-player.js";
    s.async = true;
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Spotify SDK failed to load"));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}
