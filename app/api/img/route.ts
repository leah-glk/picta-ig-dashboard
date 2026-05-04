import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// Server-side image proxy for Instagram CDN thumbnails.
//
// Two reasons we proxy instead of using the IG CDN URL directly:
//  1. IG returns 403 for browser-originated requests (hotlink prevention).
//  2. The signed URLs from /{media-id} expire quickly (despite their "oe="
//     claim), so we must fetch a *fresh* URL at request time and pipe the
//     bytes back.
//
// Usage: <img src="/api/img?id={ig_post_id}" />

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "missing or invalid id" }, { status: 400 });
  }

  // 1. Get a fresh thumbnail URL from Graph API.
  let freshUrl: string | undefined;
  try {
    const meta = await fetch(
      `https://graph.facebook.com/${env.GRAPH_API_VERSION}/${id}?fields=thumbnail_url,media_url&access_token=${env.IG_ACCESS_TOKEN}`,
      { cache: "no-store" },
    );
    if (!meta.ok) {
      return NextResponse.json({ error: "graph api error" }, { status: 502 });
    }
    const data = (await meta.json()) as { thumbnail_url?: string; media_url?: string };
    freshUrl = data.thumbnail_url ?? data.media_url;
  } catch {
    return NextResponse.json({ error: "graph api unreachable" }, { status: 502 });
  }
  if (!freshUrl) {
    return NextResponse.json({ error: "no media url" }, { status: 404 });
  }

  // 2. Fetch the image bytes server-side.
  const upstream = await fetch(freshUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "image fetch failed" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      // Browser caches for 1h, CDN/edge for 1d. Even if the URL goes stale,
      // we'll re-fetch a fresh one on next miss.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
