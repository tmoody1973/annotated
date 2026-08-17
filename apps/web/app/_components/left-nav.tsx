"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { SignInButton } from "@clerk/nextjs";

interface NavItem {
  label: string;
  glyph: string;
  href: string;
}

/** Section/room nav reused by the mobile drawer (glyph/label/href only). */
export const NAV_ITEMS: NavItem[] = [
  { label: "Curated", glyph: "★", href: "/?room=curated" },
  { label: "Latest", glyph: "◷", href: "/?room=latest" },
  { label: "Topics", glyph: "#", href: "/topics" },
  { label: "Midterm Record", glyph: "▮", href: "/2026" },
];

/** Marketing destinations surfaced in the header nav + the mobile drawer. */
export const MARKETING_ITEMS: NavItem[] = [
  { label: "Publishers", glyph: "▣", href: "/publishers" },
  { label: "Extension", glyph: "⊕", href: "/extension" },
  { label: "About", glyph: "◧", href: "/about" },
  { label: "Changelog", glyph: "▤", href: "/changelog" },
];

const SIGNED_IN_ROOMS: NavItem[] = [
  { label: "Latest", glyph: "◷", href: "/?room=latest" },
  { label: "Topics", glyph: "#", href: "/topics" },
  { label: "Midterm Record", glyph: "▮", href: "/2026" },
];

/** Brutalist left dashboard rail: section/room nav + an acid tagline block.
 *  Logged-out visitors lead with "Curated" and see "For You" locked (the §1
 *  cold-start guard); signed-in users default to Latest. Rendered inside
 *  `AppShell`'s left column, which owns the sticky/hidden-below-lg behavior. */
export function LeftNav() {
  const { isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
  const onHome = pathname === "/";
  const rooms = isAuthenticated ? SIGNED_IN_ROOMS : NAV_ITEMS;

  return (
    <div>
      <nav className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
        {rooms.map((it, i) => {
          const active = onHome && i === 0;
          return (
            <Link
              key={it.label}
              href={it.href}
              className={`flex items-center gap-3 border-b-2 border-[color:var(--b-line)] px-4 py-3 text-[14px] font-extrabold ${
                active
                  ? "bg-[color:var(--b-chrome)] text-[color:var(--b-acid)]"
                  : "hover:bg-[color:var(--b-acid)]"
              }`}
            >
              <span className="w-5 text-center">{it.glyph}</span>
              {it.label}
            </Link>
          );
        })}

        {!isAuthenticated && (
          <SignInButton mode="modal">
            <button
              title="Sign in to personalize"
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] font-extrabold text-[color:var(--b-dim)] hover:bg-[color:var(--b-bg)]"
            >
              <span className="w-5 text-center">✦</span>
              <span>
                For You
                <small className="block font-mono text-[9px] font-bold uppercase tracking-wide">
                  sign in to personalize
                </small>
              </span>
            </button>
          </SignInButton>
        )}
      </nav>

      {/* Publishers / Extension / About / Changelog. These previously lived only
          in the mobile drawer and on three marketing pages' footers — which meant
          they were unreachable from the feed, a clip page, or a profile, i.e.
          everywhere people actually are. AppShell renders LeftNav on every page,
          so putting them here makes them reachable from all of them. */}
      <nav
        aria-label="More"
        className="mt-5 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]"
      >
        {MARKETING_ITEMS.map((it, i) => (
          <Link
            key={it.label}
            href={it.href}
            aria-current={pathname === it.href ? "page" : undefined}
            className={`flex items-center gap-3 px-4 py-2.5 text-[13px] font-extrabold ${
              i < MARKETING_ITEMS.length - 1
                ? "border-b-2 border-[color:var(--b-line)]"
                : ""
            } ${
              pathname === it.href
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
    </div>
  );
}
