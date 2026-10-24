/** Tiny bridge so UI components can seek without owning the audio/YouTube engines. */
let seekImpl: ((ms: number) => void) | null = null;
let destroyVideoImpl: (() => void) | null = null;

export const playback = {
  register(impl: { seek: (ms: number) => void; destroyVideo: () => void }) {
    seekImpl = impl.seek;
    destroyVideoImpl = impl.destroyVideo;
  },
  seek: (ms: number) => seekImpl?.(ms),
  destroyVideo: () => destroyVideoImpl?.(),
};
