import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `What ${site.name} is, who it's for and how the free tools work.`,
  alternates: { canonical: "/about" },
};

export default function Page() {
  return (
    <Prose title={`About ${site.name}`}>
      <p>
        {site.name} builds small, fast tools for people who make videos for YouTube, TikTok and Instagram.
        Each tool does one job — grabbing a thumbnail, suggesting hashtags, writing a transcript — and works
        in the browser without an account.
      </p>
      <h2>Why free?</h2>
      <p>
        The core of every tool is free forever. A Pro plan with higher limits, bulk processing and longer
        videos will help fund development for creators who need more.
      </p>
      <h2>Independence</h2>
      <p>{site.name} is an independent project and is not affiliated with YouTube, Google, TikTok or Meta.</p>
    </Prose>
  );
}
