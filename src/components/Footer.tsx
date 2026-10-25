import Link from "next/link";
import { site } from "@/lib/site";
import { liveTools } from "@/lib/tools";
import { Logo } from "./Header";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted">{site.description}</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Free tools</h2>
          <ul className="space-y-2 text-sm text-muted">
            {liveTools.map((t) => (
              <li key={t.slug}>
                <Link href={`/${t.slug}`} className="hover:text-ink">
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">Company</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/about" className="hover:text-ink">About</Link></li>
            <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-6 text-center text-xs text-muted">
        © {site.name}. Not affiliated with YouTube, TikTok or Instagram.
      </div>
    </footer>
  );
}
