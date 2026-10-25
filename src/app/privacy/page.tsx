import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${site.name} handles your data.`,
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return (
    <Prose title="Privacy Policy">
      <p>We collect as little data as possible. The tools work without an account.</p>
      <h2>What we process</h2>
      <p>
        Text you enter into AI tools (for example a video description for the hashtag generator) is sent to our
        AI provider only to generate the result and is not stored by us. Links you paste into the thumbnail
        downloader are processed to fetch public thumbnail images from YouTube.
      </p>
      <h2>Analytics</h2>
      <p>
        We use privacy-friendly, cookie-free analytics to count visits and tool usage. No personal profiles are
        built and no data is sold.
      </p>
      <h2>Rate limiting</h2>
      <p>Your IP address is used temporarily to enforce fair daily usage limits and is not stored long-term.</p>
      <h2>Contact</h2>
      <p>Questions about privacy? Contact us through the details on the About page.</p>
    </Prose>
  );
}
