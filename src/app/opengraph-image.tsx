import { ogImage, ogSize } from "@/lib/og";
import { site } from "@/lib/site";

export const alt = `${site.name} – ${site.tagline}`;
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogImage("Free AI tools for video creators", "YouTube · TikTok · Instagram");
}
