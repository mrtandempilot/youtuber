// Global site settings. Change the name and URL here (or via env) once the domain is chosen.
export const site = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "CreatorKit",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  tagline: "Free AI tools for video creators",
  description:
    "Free online tools for YouTube, TikTok and Instagram creators: analyze your channel with AI, optimize titles, tags and hashtags, download thumbnails and more. No sign-up required.",
  twitter: process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? "",
  locale: "en_US",
};

export function absoluteUrl(path = "/") {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
