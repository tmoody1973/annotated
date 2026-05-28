import Link from "next/link";

const items = [
  { label: "Latest", glyph: "◷", href: "/", active: true },
  { label: "Topics", glyph: "#", href: "/topics", active: false },
  { label: "For You", glyph: "✦", href: "/", active: false },
];

/** Brutalist left dashboard rail: section nav + an acid tagline block. */
export function LeftNav() {
  return (
    <aside className="hidden lg:block">
      <nav className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
        {items.map((it, i) => (
          <Link
            key={it.label}
            href={it.href}
            className={`flex items-center gap-3 px-4 py-3 text-[14px] font-extrabold ${
              i < items.length - 1 ? "border-b-2 border-[color:var(--b-line)]" : ""
            } ${
              it.active
                ? "bg-[color:var(--b-chrome)] text-[color:var(--b-acid)]"
                : "hover:bg-[color:var(--b-acid)]"
            }`}
          >
            <span className="w-5 text-center">{it.glyph}</span>
            {it.label}
          </Link>
        ))}
      </nav>

      <div className="mt-5 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] p-4 text-[color:var(--b-acid-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
        <h4 className="font-display text-[17px] leading-[1.05]">IDEAS MULTIPLY WHEN SHARED.</h4>
        <p className="mt-2 text-[13px] font-semibold leading-snug">
          Clip the web. Add your take. Publish the receipt.
        </p>
      </div>
    </aside>
  );
}
