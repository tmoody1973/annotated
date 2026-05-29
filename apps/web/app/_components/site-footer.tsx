import Link from "next/link";

const LINKS = [
  { label: "About", href: "/about" },
  { label: "Topics", href: "/topics" },
  { label: "Publishers", href: "/publishers" },
  { label: "Extension", href: "/extension" },
  { label: "Privacy", href: "/privacy" },
];

/** Brutalist site footer for marketing/detail pages (publishers, extension). */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-[3px] border-[color:var(--b-acid)] bg-[color:var(--b-chrome)] text-[color:var(--b-card)]">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4 px-6 py-6 font-mono text-[12px]">
        <Link href="/" className="font-display text-base leading-none tracking-tight">
          <span className="bg-[color:var(--b-acid)] px-1 text-[color:var(--b-acid-ink)]">A</span>NNOTATED
        </Link>
        <nav className="flex flex-wrap gap-5">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-bold uppercase tracking-[0.1em] hover:text-[color:var(--b-acid)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="text-[color:var(--b-dim)]">© 2026 annotated</span>
      </div>
    </footer>
  );
}
