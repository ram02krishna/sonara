import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") || "";
  const artist = searchParams.get("artist") || "";
  const q = searchParams.get("q") || `${name} ${artist} audio`;

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
      return NextResponse.json({ found: false, error: "No stream found" }, { status: 404 });
    }

    return NextResponse.json({
      found: true,
      videoId,
      title: `${name} - ${artist}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ found: false, error: message }, { status: 500 });
  }
}
