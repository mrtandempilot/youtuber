import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-4xl font-bold">Page not found</h1>
      <p className="mt-4 text-muted">That page doesn&apos;t exist. Try one of our free tools instead.</p>
      <Link href="/#tools" className="mt-8 inline-block rounded-full bg-accent px-5 py-2.5 font-medium text-accent-ink">
        See all tools
      </Link>
    </div>
  );
}
