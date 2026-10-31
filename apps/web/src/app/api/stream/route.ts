import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_FIELD = 200;

export async function GET(request: NextRequest) {
  // The player only calls this for signed-in listeners. Without a session cookie this route was an
  // open endpoint that fetched YouTube pages on behalf of anyone on the internet.
  if (!request.cookies.get("sonara_session")?.value) {
    return NextResponse.json({ found: false, error: "Sign in to play full songs" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") || "").slice(0, MAX_FIELD);
  const artist = (searchParams.get("artist") || "").slice(0, MAX_FIELD);
  const quality = searchParams.get("quality") || "lossless";

  let defaultQuery = `${name} ${artist} audio`;
  if (quality === "lossless") {
    defaultQuery = `${name} ${artist} official audio high quality lossless flac`;
  } else if (quality === "high") {
    defaultQuery = `${name} ${artist} official audio`;
  }

  const q = (searchParams.get("q") || defaultQuery).slice(0, MAX_FIELD * 2);

  if (!q.trim()) {
    return NextResponse.json({ found: false, error: "Missing query parameter" }, { status: 400 });
  }

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q.trim())}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ found: false, error: "Upstream search error" }, { status: 502 });
    }

    const html = await res.text();
    const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    let match;
    let videoId: string | null = null;
    while ((match = regex.exec(html)) !== null) {
      if (match[1]) {
        videoId = match[1];
        break;
      }
    }

    if (!videoId) {
      // Fallback search with standard query
      const fallbackUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} ${artist} audio`)}`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (fallbackRes.ok) {
        const fallbackHtml = await fallbackRes.text();
        const fbRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
        let fbMatch;
        while ((fbMatch = fbRegex.exec(fallbackHtml)) !== null) {
          if (fbMatch[1]) {
            videoId = fbMatch[1];
            break;
          }
        }
      }
    }

    if (!videoId) {
      return NextResponse.json({ found: false, error: "No stream found" }, { status: 404 });
    }

    return NextResponse.json({
      found: true,
      videoId,
      title: `${name} - ${artist}`,
      quality,
      bitrate: quality === "lossless" ? "24-bit / 96kHz Lossless FLAC" : quality === "high" ? "320 kbps High Fidelity" : "160 kbps AAC",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ found: false, error: message }, { status: 500 });
  }
}
