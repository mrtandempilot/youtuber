// Single source of truth for every tool on the site.
// Adding a tool = add an entry here + create its page under src/app/<slug>/page.tsx.
// Home page, header, footer, sitemap, llms.txt and related-tool links all read from this list.

export type Faq = { q: string; a: string };

export type Tool = {
  slug: string;
  name: string; // short name used in nav and cards
  status: "live" | "soon";
  category: "YouTube" | "Social" | "AI Writing" | "Video";
  platforms: string[];
  cardDescription: string; // one line for cards
  // SEO
  metaTitle: string; // ~50-60 chars
  metaDescription: string; // ~140-160 chars
  h1: string;
  intro: string; // short, quotable answer of what the tool does (GEO)
  keywords: string[];
  howTo: string[];
  faqs: Faq[];
  updated: string; // ISO date, shown on page and used in sitemap
};

export const tools: Tool[] = [
  {
    slug: "youtube-channel-analyzer",
    name: "YouTube Channel Analyzer",
    status: "live",
    category: "YouTube",
    platforms: ["YouTube", "YouTube Shorts"],
    cardDescription: "Find what works on your channel and get AI titles, tags and hashtags for every video.",
    metaTitle: "Free YouTube Channel Analyzer – AI Audit, Tags & SEO Ideas",
    metaDescription:
      "Analyze any YouTube channel for free: best and worst videos, winning tags, best upload days, Shorts vs long. Connect your channel for AI fixes for old videos and SEO for new ones.",
    h1: "YouTube Channel Analyzer",
    intro:
      "Paste any channel link or connect your own YouTube account to see which videos, tags, hashtags, title lengths and upload days actually drive views. The AI then rewrites titles, descriptions and tags for weak videos and plans SEO for your next upload — based on your channel's real data.",
    keywords: [
      "youtube channel analyzer",
      "youtube channel audit",
      "youtube seo tool",
      "youtube tag analyzer",
      "youtube analytics tool",
      "youtube video optimizer",
    ],
    howTo: [
      "Connect your channel with Google (read-only) for private analytics, or paste any public channel link or @handle.",
      "Review the report: performance score per video, tags and hashtags linked to your best videos, best upload days and Shorts vs long videos.",
      "Click “Improve with AI” on any old video for better titles, description, tags and hashtags, or describe your next video to get a full SEO package.",
    ],
    faqs: [
      {
        q: "How is the performance score calculated?",
        a: "Each video's views per day since publishing is divided by the channel's median views per day for the same format (Shorts and long videos are scored separately). 1.0× is a typical video for the channel, 2.0× is twice as good. Videos younger than 3 days are left out until their numbers settle.",
      },
      {
        q: "Is connecting my YouTube channel safe?",
        a: "The connection uses Google's official sign-in with read-only permissions. The tool can read your channel data and analytics but cannot upload, edit or delete anything. You can disconnect at any time, which also revokes access in your Google account.",
      },
      {
        q: "What extra data do I get by connecting my channel?",
        a: "Private YouTube Analytics for the last 90 days: watch time, average view duration and percentage, subscribers gained per video, traffic sources and the actual YouTube search terms viewers used to find you. The AI uses those search terms as keyword ideas.",
      },
      {
        q: "Can I analyze a competitor's channel?",
        a: "Yes. Paste any public channel link or @handle to see its public stats: views, tags, hashtags, upload patterns and top videos. Private analytics are only available for your own connected channel.",
      },
      {
        q: "How many videos are analyzed?",
        a: "The 50 most recent uploads, which reflects how the channel performs today rather than years ago.",
      },
      {
        q: "Do tags still matter on YouTube?",
        a: "Tags play a small role compared with titles, descriptions and thumbnails, but they help with misspellings and related searches. That's why the analyzer focuses on titles and descriptions first and treats tags as a supporting signal.",
      },
    ],
    updated: "2026-10-27",
  },
  {
    slug: "youtube-thumbnail-downloader",
    name: "YouTube Thumbnail Downloader",
    status: "live",
    category: "YouTube",
    platforms: ["YouTube", "YouTube Shorts"],
    cardDescription: "Grab any YouTube video thumbnail in HD, SD and every other size.",
    metaTitle: "YouTube Thumbnail Downloader – Free HD (1280×720) Download",
    metaDescription:
      "Download any YouTube or Shorts thumbnail in full HD (1280×720), SD and smaller sizes. Paste the video link and save the image in one click. Free, no sign-up.",
    h1: "YouTube Thumbnail Downloader",
    intro:
      "Paste a YouTube or YouTube Shorts link to instantly see and download the video's thumbnail in every available size, from full HD (1280×720) down to 120×90. It's free, works in any browser and needs no account.",
    keywords: [
      "youtube thumbnail downloader",
      "download youtube thumbnail",
      "youtube thumbnail grabber",
      "youtube shorts thumbnail download",
      "hd youtube thumbnail",
    ],
    howTo: [
      "Copy the link of the YouTube video or Short (from the address bar or the Share button).",
      "Paste it into the box above and press “Get thumbnails”.",
      "Pick the size you need and click “Download”, or copy the image URL.",
    ],
    faqs: [
      {
        q: "What sizes can I download?",
        a: "Up to five sizes: Max resolution (1280×720), Standard (640×480), High (480×360), Medium (320×180) and Default (120×90). Max resolution only exists if the uploader added an HD thumbnail; older or low-quality uploads may not have it.",
      },
      {
        q: "Does it work with YouTube Shorts?",
        a: "Yes. Paste a youtube.com/shorts/ link and the tool extracts the video ID and loads its thumbnails the same way as a regular video.",
      },
      {
        q: "Which link formats are supported?",
        a: "youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/, youtube.com/live/ and mobile m.youtube.com links. You can also paste the 11-character video ID directly.",
      },
      {
        q: "Is it free and do I need an account?",
        a: "It's completely free with no sign-up and no limit on the number of thumbnails.",
      },
      {
        q: "Can I reuse a downloaded thumbnail?",
        a: "Thumbnails belong to the channel that uploaded the video. Downloading one for reference, research or your own video is common, but republishing someone else's thumbnail may require the owner's permission.",
      },
      {
        q: "Why is the HD version missing?",
        a: "YouTube only generates the 1280×720 “maxresdefault” image when the source thumbnail is high resolution. If it doesn't exist, use the Standard (640×480) or High (480×360) version.",
      },
    ],
    updated: "2026-10-25",
  },
  {
    slug: "hashtag-generator",
    name: "Hashtag Generator",
    status: "live",
    category: "Social",
    platforms: ["TikTok", "Instagram", "YouTube"],
    cardDescription: "AI hashtags for TikTok, Instagram Reels and YouTube Shorts.",
    metaTitle: "AI Hashtag Generator for TikTok, Instagram & YouTube – Free",
    metaDescription:
      "Generate relevant hashtags for TikTok, Instagram Reels and YouTube Shorts with AI. Describe your video, get broad, niche and community tags to copy. Free.",
    h1: "AI Hashtag Generator for TikTok, Instagram & YouTube",
    intro:
      "Describe your video in a few words and the AI suggests a balanced set of hashtags for TikTok, Instagram or YouTube: broad tags for reach, niche tags for targeted viewers and community tags for engagement. Copy them all with one click.",
    keywords: [
      "hashtag generator",
      "tiktok hashtag generator",
      "instagram hashtag generator",
      "youtube hashtag generator",
      "ai hashtag generator",
    ],
    howTo: [
      "Write what your video is about, e.g. “morning routine for busy moms” or “beginner guitar chords”.",
      "Choose the platform you're posting to and press “Generate hashtags”.",
      "Remove any tags that don't fit, then copy the rest into your caption or description.",
    ],
    faqs: [
      {
        q: "How many hashtags should I use?",
        a: "As a rule of thumb: 3–5 on TikTok, 3–10 on Instagram Reels and 3–5 on YouTube (YouTube ignores all hashtags if a video has more than 15). Relevance matters more than quantity on every platform.",
      },
      {
        q: "Are the hashtags different for each platform?",
        a: "Yes. The generator adapts the mix and style to the platform you select, since TikTok, Instagram and YouTube surface hashtags differently.",
      },
      {
        q: "Should I mix broad and niche hashtags?",
        a: "Yes. Broad tags have huge audiences but heavy competition; niche tags reach smaller, more interested viewers. A mix of both usually performs best.",
      },
      {
        q: "Are the results trending hashtags?",
        a: "The AI suggests tags that are relevant and commonly used for your topic. It doesn't read live trend data, so check the platform's search or trend page for time-sensitive tags.",
      },
      {
        q: "Is there a limit?",
        a: "Free users can generate a generous number of hashtag sets per day. Higher limits will be part of the upcoming Pro plan.",
      },
    ],
    updated: "2026-10-25",
  },
  // ---- Coming soon (listed on the home page, no page yet) ----
  {
    slug: "youtube-transcript-generator",
    name: "YouTube Transcript Generator",
    status: "soon",
    category: "YouTube",
    platforms: ["YouTube"],
    cardDescription: "Turn any YouTube video into a clean, copyable transcript.",
    metaTitle: "",
    metaDescription: "",
    h1: "",
    intro: "",
    keywords: [],
    howTo: [],
    faqs: [],
    updated: "2026-10-25",
  },
  {
    slug: "ai-subtitle-generator",
    name: "AI Subtitle Generator",
    status: "soon",
    category: "Video",
    platforms: ["TikTok", "Instagram", "YouTube"],
    cardDescription: "Auto-generate SRT and VTT subtitles from your video.",
    metaTitle: "",
    metaDescription: "",
    h1: "",
    intro: "",
    keywords: [],
    howTo: [],
    faqs: [],
    updated: "2026-10-25",
  },
  {
    slug: "youtube-title-generator",
    name: "Title & Description Generator",
    status: "soon",
    category: "AI Writing",
    platforms: ["YouTube", "TikTok"],
    cardDescription: "Click-worthy titles and SEO descriptions written by AI.",
    metaTitle: "",
    metaDescription: "",
    h1: "",
    intro: "",
    keywords: [],
    howTo: [],
    faqs: [],
    updated: "2026-10-25",
  },
];

export const liveTools = tools.filter((t) => t.status === "live");

export function getTool(slug: string): Tool {
  const tool = tools.find((t) => t.slug === slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return tool;
}
