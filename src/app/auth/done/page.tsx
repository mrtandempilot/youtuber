import type { Metadata } from "next";
import { AuthDone } from "@/components/AuthDone";

export const metadata: Metadata = { title: "Connected", robots: { index: false, follow: false } };

// Landing page for the Google permission popup: tells the opener window and closes itself.
export default function Page() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <AuthDone />
    </div>
  );
}
