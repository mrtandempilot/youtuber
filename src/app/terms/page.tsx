import type { Metadata } from "next";
import { Prose } from "@/components/Prose";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: `Terms for using ${site.name}.`,
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return (
    <Prose title="Terms of Use">
      <p>By using {site.name} you agree to use the tools lawfully and at your own responsibility.</p>
      <h2>Content you download</h2>
      <p>
        Thumbnails and other media belong to their original creators. Make sure you have the right to reuse any
        content before publishing it.
      </p>
      <h2>AI output</h2>
      <p>AI-generated suggestions can be inaccurate. Review results before using them.</p>
      <h2>Fair use of the service</h2>
      <p>Automated or abusive use that degrades the service for others is not allowed. Free limits may change.</p>
      <h2>No warranty</h2>
      <p>The tools are provided “as is” without warranties of any kind.</p>
    </Prose>
  );
}
