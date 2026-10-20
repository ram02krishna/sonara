import { NextRequest, NextResponse } from "next/server";
import { Track, Artist, SearchResult } from "@/types/api";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "15", 10);

  if (!q || !q.trim()) {
    return NextResponse.json({ tracks: [], artists: [], albums: [], playlists: [] });
  }

  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      q.trim()
    )}&entity=song&limit=${Math.min(25, limit)}`;

    const res = await fetch(itunesUrl, {
      headers: {
        "User-Agent": "Sonara-Music-App/1.0",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`iTunes API responded with status ${res.status}`);
    }

    const data = await res.json();
    const tracks: Track[] = [];
    const artistsMap = new Map<string, Artist>();

    if (data.results && Array.isArray(data.results)) {
      for (const item of data.results) {
        const highResArt = (item.artworkUrl100 || "").replace("100x100bb.jpg", "600x600bb.jpg");
        const track: Track = {
          id: `track-${item.trackId}`,
          name: item.trackName || "Unknown Track",
          uri: `spotify:track:${item.trackId}`,
          preview_url: item.previewUrl || null,
          duration_ms: item.trackTimeMillis || 210000,
          popularity: 88,
          artists: [
            {
              id: `artist-${encodeURIComponent(item.artistName || "Unknown")}`,
              name: item.artistName || "Unknown Artist",
            },
          ],
          album: {
            id: `album-${item.collectionId || item.trackId}`,
            name: item.collectionName || item.trackName || "Single",
            images: [
              {
                url: highResArt || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600",
                width: 600,
                height: 600,
              },
            ],
          },
          is_liked: false,
        };
        tracks.push(track);

        if (item.artistName && !artistsMap.has(item.artistName)) {
          artistsMap.set(item.artistName, {
            id: `artist-${encodeURIComponent(item.artistName)}`,
            name: item.artistName,
            uri: `spotify:artist:${item.artistId}`,
            genres: [item.primaryGenreName ? item.primaryGenreName.toLowerCase() : "pop"],
            followers: 1850000,
            popularity: 85,
            images: [
              {
                url: highResArt,
                width: 600,
                height: 600,
              },
            ],
          });
        }
      }
    }

    const searchResult: SearchResult = {
      tracks,
      artists: Array.from(artistsMap.values()),
      albums: [],
      playlists: [],
    };

    return NextResponse.json(searchResult);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { tracks: [], artists: [], albums: [], playlists: [], error: "Search request failed" },
      { status: 500 }
    );
  }
}
