import { Track, Artist, AlbumSummary, PlaylistSummary, Lyrics } from "@/types/api";

export const MOCK_TRACKS: Track[] = [
  {
    id: "track-1",
    name: "Starboy",
    uri: "spotify:track:7MXVkk9YM5IZxh0wAE2Upv",
    preview_url: "https://p.scdn.co/mp3-preview/starboy.mp3",
    duration_ms: 230453,
    popularity: 94,
    artists: [
      { id: "artist-the-weeknd", name: "The Weeknd", uri: "spotify:artist:1Xyo4u8uXC1ZmMpatF05PJ" },
      { id: "artist-daft-punk", name: "Daft Punk", uri: "spotify:artist:4tZwfgrHOc3mvqYxwDOJC0" },
    ],
    album: {
      id: "album-starboy",
      name: "Starboy",
      release_date: "2016-11-25",
      images: [
        { url: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80", width: 600, height: 600 }
      ],
    },
    is_liked: true,
  },
  {
    id: "track-2",
    name: "Midnight City",
    uri: "spotify:track:6GyFP1nfCDB87D2bGGF6dH",
    preview_url: "https://p.scdn.co/mp3-preview/midnight-city.mp3",
    duration_ms: 243266,
    popularity: 88,
    artists: [
      { id: "artist-m83", name: "M83", uri: "spotify:artist:63MQldKLHvIQACtVJYKi4E" },
    ],
    album: {
      id: "album-hurry-up",
      name: "Hurry Up, We're Dreaming",
      release_date: "2011-10-18",
      images: [
        { url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80", width: 600, height: 600 }
      ],
    },
    is_liked: true,
  },
  {
    id: "track-3",
    name: "Levitating",
    uri: "spotify:track:463CkQjx2Zk1yXoBu1bsPrem",
    preview_url: "https://p.scdn.co/mp3-preview/levitating.mp3",
    duration_ms: 203807,
    popularity: 91,
    artists: [
      { id: "artist-dua-lipa", name: "Dua Lipa", uri: "spotify:artist:6M2wZ9GZgrQXHCFfjv46we" },
    ],
    album: {
      id: "album-future-nostalgia",
      name: "Future Nostalgia",
      release_date: "2020-03-27",
      images: [
        { url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80", width: 600, height: 600 }
      ],
    },
    is_liked: false,
  },
  {
    id: "track-4",
    name: "Time",
    uri: "spotify:track:6ZFbIcPtQ9apMphGEZkeK2",
    preview_url: "https://p.scdn.co/mp3-preview/time.mp3",
    duration_ms: 335000,
    popularity: 85,
    artists: [
      { id: "artist-hans-zimmer", name: "Hans Zimmer", uri: "spotify:artist:0YC192cP3KUr29dybG394e" },
    ],
    album: {
      id: "album-inception",
      name: "Inception (OST)",
      release_date: "2010-07-13",
      images: [
        { url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80", width: 600, height: 600 }
      ],
    },
    is_liked: true,
  },
  {
    id: "track-5",
    name: "Resonance",
    uri: "spotify:track:1TuopWDI4GQJ1p95qFqfgv",
    preview_url: "https://p.scdn.co/mp3-preview/resonance.mp3",
    duration_ms: 212000,
    popularity: 89,
    artists: [
      { id: "artist-home", name: "HOME", uri: "spotify:artist:2exeb85q5sMsmZk1v4rK07" },
    ],
    album: {
      id: "album-odyssey",
      name: "Odyssey",
      release_date: "2014-06-03",
      images: [
        { url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80", width: 600, height: 600 }
      ],
    },
    is_liked: true,
  },
];

export const MOCK_ARTISTS: Artist[] = [
  {
    id: "artist-the-weeknd",
    name: "The Weeknd",
    uri: "spotify:artist:1Xyo4u8uXC1ZmMpatF05PJ",
    genres: ["canadian contemporary r&b", "pop", "synth-pop"],
    followers: 86450000,
    popularity: 98,
    images: [
      { url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80", width: 600, height: 600 }
    ],
  },
  {
    id: "artist-daft-punk",
    name: "Daft Punk",
    uri: "spotify:artist:4tZwfgrHOc3mvqYxwDOJC0",
    genres: ["electro", "french house", "synthpop"],
    followers: 12400000,
    popularity: 89,
    images: [
      { url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80", width: 600, height: 600 }
    ],
  },
  {
    id: "artist-dua-lipa",
    name: "Dua Lipa",
    uri: "spotify:artist:6M2wZ9GZgrQXHCFfjv46we",
    genres: ["dance pop", "pop", "uk pop"],
    followers: 43200000,
    popularity: 92,
    images: [
      { url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80", width: 600, height: 600 }
    ],
  },
  {
    id: "artist-hans-zimmer",
    name: "Hans Zimmer",
    uri: "spotify:artist:0YC192cP3KUr29dybG394e",
    genres: ["soundtrack", "orchestral", "epic"],
    followers: 9800000,
    popularity: 88,
    images: [
      { url: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80", width: 600, height: 600 }
    ],
  },
];

export const MOCK_PLAYLISTS: PlaylistSummary[] = [
  {
    id: "playlist-focus-flow",
    name: "Deep Focus Flow",
    description: "Atmospheric ambient and electronic soundscapes for supreme concentration.",
    tracks_total: 42,
    owner_name: "Sonara Curated",
    images: [
      { url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80" },
    ],
  },
  {
    id: "playlist-workout-surge",
    name: "Adrenaline Workout",
    description: "High-BPM club anthems and bass-heavy heaters pushing your max reps.",
    tracks_total: 35,
    owner_name: "Sonara Curated",
    images: [
      { url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80" },
    ],
  },
  {
    id: "playlist-late-night-drive",
    name: "Late Night Drive",
    description: "Synthwave, neo-noir vibes, and chillwave for neon highway journeys.",
    tracks_total: 58,
    owner_name: "Sonara Curated",
    images: [
      { url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80" },
    ],
  },
];

export const MOCK_LYRICS: Record<string, Lyrics> = {
  "track-1": {
    id: 101,
    track_name: "Starboy",
    artist_name: "The Weeknd",
    synced: true,
    lines: [
      { time_seconds: 14.5, words: "I'm tryna put you in the worst mood, ah" },
      { time_seconds: 18.2, words: "P1 cleaner than your church shoes, ah" },
      { time_seconds: 22.0, words: "Milli point two just to hurt you, ah" },
      { time_seconds: 25.8, words: "All red Lamb' just to tease you, ah" },
      { time_seconds: 29.5, words: "None of these toys on lease too, ah" },
      { time_seconds: 33.1, words: "Made your whole year in a week too, yah" },
      { time_seconds: 37.0, words: "Main bitch out your league too, ah" },
      { time_seconds: 40.8, words: "Side bitch out of your league too, ah" },
      { time_seconds: 44.5, words: "Look what you've done" },
      { time_seconds: 48.0, words: "I'm a motherfuckin' starboy" },
      { time_seconds: 52.2, words: "Look what you've done" },
      { time_seconds: 55.6, words: "I'm a motherfuckin' starboy" },
    ],
  },
};
