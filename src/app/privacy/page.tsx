import type { Metadata } from "next";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { Prose } from "@/components/Prose";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${site.name} handles your data, including YouTube data accessed through Google sign-in.`,
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return (
    <Prose title="Privacy Policy">
      <p>Last updated: October 27, 2026</p>
      <p>
        {site.name} collects as little data as possible. Most tools work without an account. This page explains what
        we process when you use the tools and when you connect your YouTube channel.
      </p>

      <h2>Using the tools without an account</h2>
      <p>
        Links you paste are used to fetch public data from YouTube. Text you enter into AI tools (for example a video
        description) is sent to our AI provider only to generate the result and is not stored by us. A plan you create
        without signing in is saved only in your own browser.
      </p>

      <h2>Connecting your YouTube channel (Google sign-in)</h2>
      <p>When you choose “Connect with Google”, you grant read-only access to:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>your basic Google profile (name, email address, profile picture) to create your account;</li>
        <li>your YouTube channel and video data (youtube.readonly) to analyze your channel;</li>
        <li>your YouTube Analytics reports (yt-analytics.readonly) such as watch time, traffic sources and search terms.</li>
      </ul>
      <p>
        Optionally, when you click “Apply to YouTube” for the first time, we ask for permission to edit your videos
        (youtube.force-ssl). We use it only to update the title, description and tags of the specific video you choose,
        after you confirm, and we show you the previous version so you can undo it. We never delete videos, comments,
        ratings or captions, and we never change anything without your click.
      </p>
      <p>
        We never upload or delete anything on your channel. We store your profile, your channel&apos;s public
        statistics, daily progress snapshots and the growth plans you create, so you can see them on any device. Your
        Google refresh token is stored encrypted so we can update your reports; it is never shared.
      </p>
      <p>
        {site.name}&apos;s use and transfer of information received from Google APIs adheres to the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. We do not sell your data, use it for advertising, or use it to train
        general AI models. Channel data is sent to our AI provider only to generate the analysis and plans you request.
      </p>
      <p>
        {site.name} uses YouTube API Services. By connecting your channel you also agree to the{" "}
        <a href="https://www.youtube.com/t/terms" className="underline" target="_blank" rel="noopener noreferrer">
          YouTube Terms of Service
        </a>
        , and Google&apos;s{" "}
        <a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>{" "}
        applies to data held by Google.
      </p>

      <h2>Your choices</h2>
      <p>
        You can disconnect at any time, and you can also remove access in your{" "}
        <a href="https://myaccount.google.com/permissions" className="underline" target="_blank" rel="noopener noreferrer">
          Google account permissions
        </a>
        . Deleting your data removes your profile, channels, plans and history from our database and revokes our access
        to your Google account:
      </p>
      <DeleteAccountButton />

      <h2>Analytics and limits</h2>
      <p>
        We use privacy-friendly, cookie-free analytics to count visits and tool usage. Your IP address is used
        temporarily to enforce fair daily usage limits and is not stored long-term. A single encrypted cookie keeps you
        signed in.
      </p>

      <h2>Where data is stored</h2>
      <p>Account data is stored with our database provider (Supabase). Data is kept until you delete it.</p>

      <h2>Contact</h2>
      <p>Questions about privacy? Contact us through the details on the About page.</p>
    </Prose>
  );
}
