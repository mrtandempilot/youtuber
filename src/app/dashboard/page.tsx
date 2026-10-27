import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Growth dashboard",
  description: "Your YouTube channel's growth: views, watch time, subscribers, traffic sources and the impact of your changes.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <Dashboard />
    </div>
  );
}
