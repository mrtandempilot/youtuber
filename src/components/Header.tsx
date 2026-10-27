import Link from "next/link";
import { site } from "@/lib/site";
import { liveTools } from "@/lib/tools";
import { ThemePicker } from "@/components/ThemePicker";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-ink text-xs"
      >
        ▶
      </span>
      {site.name}
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav aria-label="Tools" className="hidden gap-6 text-sm text-muted md:flex">
          {liveTools.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`} className="hover:text-ink">
              {t.name}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-ink">
            Dashboard
          </Link>
          <ThemePicker />
          <Link
            href="/start"
            className="whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink hover:opacity-90 sm:px-4"
          >
            Get your plan
          </Link>
        </div>
      </div>
    </header>
  );
}
