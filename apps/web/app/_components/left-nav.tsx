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
];

/** Marketing destinations surfaced in the header nav + the mobile drawer. */
export const MARKETING_ITEMS: NavItem[] = [
  { label: "Publishers", glyph: "▣", href: "/publishers" },
  { label: "Extension", glyph: "⊕", href: "/extension" },
  { label: "About", glyph: "◧", href: "/about" },
];

const SIGNED_IN_ROOMS: NavItem[] = [
  { label: "Latest", glyph: "◷", href: "/?room=latest" },
  { label: "Topics", glyph: "#", href: "/topics" },
];

/** Brutalist left dashboard rail: section/room nav + an acid tagline block.
 *  Logged-out visitors lead with "Curated" and see "For You" locked (the §1
 *  cold-start guard); signed-in users default to Latest. */
export function LeftNav() {
  const { isAuthenticated } = useConvexAuth();
  const pathname = usePathname();
  const onHome = pathname === "/";
  const rooms = isAuthenticated ? SIGNED_IN_ROOMS : NAV_ITEMS;

  return (
    <aside className="hidden lg:block lg:sticky lg:top-[76px] lg:self-start">
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

      <div className="mt-5 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] p-4 text-[color:var(--b-acid-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
        <h4 className="font-display text-[17px] leading-[1.05]">IDEAS MULTIPLY WHEN SHARED.</h4>
        <p className="mt-2 text-[13px] font-semibold leading-snug">
          Clip the web. Add your take. Publish the receipt.
        </p>
      </div>
    </aside>
  );
}
