import { isThumbnailKey, isValidVideoId, thumbnailUrl } from "@/lib/youtube";

// Proxies a YouTube thumbnail so the browser downloads it as a file
// (cross-origin images can't be force-downloaded with <a download>).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  const q = searchParams.get("q") ?? "";

  if (!isValidVideoId(id) || !isThumbnailKey(q)) {
    return Response.json({ error: "Invalid video ID or size." }, { status: 400 });
  }

  const upstream = await fetch(thumbnailUrl(id, q));
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "Thumbnail not found." }, { status: 404 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Content-Disposition": `attachment; filename="youtube-thumbnail-${id}-${q}.jpg"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
