import type { Metadata } from "next";
import { Wizard } from "@/components/onboarding/Wizard";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Get your free YouTube growth plan",
  description: `Connect your channel and get a personal 4-week YouTube growth plan from ${site.name}, based on your real data.`,
  alternates: { canonical: "/start" },
};

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-10">
      <p className="mb-2 text-sm font-medium text-accent">Free · 2 minutes</p>
      <h1 className="mb-8 font-display text-4xl font-bold tracking-tight md:text-5xl">Get your YouTube growth plan</h1>
      <Wizard />
    </div>
  );
}
