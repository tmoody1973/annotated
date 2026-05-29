"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import { ThemeToggle } from "../ThemeToggle";
import { NewClipButton } from "./new-clip-button";
import { MobileNav } from "./mobile-nav";

/** Mirrors the Clerk user into Convex once auth is ready (idempotent). */
function useEnsureUser(): void {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.users.ensureCurrentUser);
  useEffect(() => {
    if (isAuthenticated) void ensure();
  }, [isAuthenticated, ensure]);
}

/** Quiet marketing links in the top nav. The active page (Home) gets the acid
 *  fill; the rest are ghost links so they never compete with New clip / Sign in.
 *  Extension carries the ⊕ glyph to read as the install destination (§2). */
const NAV_LINKS = [
  { label: "Home", href: "/", active: true },
  { label: "Publishers", href: "/publishers" },
  { label: "⊕ Extension", href: "/extension" },
  { label: "About", href: "/about" },
];

export function SiteHeader() {
  useEnsureUser();
  const { isAuthenticated } = useConvexAuth();
  return (
    <header className="sticky top-0 z-50 flex items-center gap-5 border-b-[3px] border-[color:var(--b-acid)] bg-[color:var(--b-chrome)] px-6 py-3 text-[color:var(--b-card)]">
      <MobileNav />
      <Link href="/" aria-label="Annotated home" className="font-display text-[22px] leading-none tracking-tight">
        <span className="bg-[color:var(--b-acid)] px-1.5 text-[color:var(--b-acid-ink)]">A</span>NNOTATED
      </Link>
      <nav className="hidden gap-1 lg:flex">
        {NAV_LINKS.map((link) =>
          link.active ? (
            <Link
              key={link.href}
              href={link.href}
              className="bg-[color:var(--b-acid)] px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wide text-[color:var(--b-acid-ink)]"
            >
              {link.label}
            </Link>
          ) : (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wide text-[color:var(--b-card)] hover:text-[color:var(--b-acid)]"
            >
              {link.label}
            </Link>
          )
        )}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <NewClipButton />
        <span className="hidden lg:block">
          <ThemeToggle />
        </span>
        {isAuthenticated ? (
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Link
                label="Edit profile"
                labelIcon={<span aria-hidden>✎</span>}
                href="/settings"
              />
            </UserButton.MenuItems>
          </UserButton>
        ) : (
          <SignInButton mode="modal">
            <button className="border-2 border-[color:var(--b-acid)] bg-[color:var(--b-acid)] px-4 py-2 text-[13px] font-black uppercase tracking-wide text-[color:var(--b-acid-ink)]">
              Sign in
            </button>
          </SignInButton>
        )}
      </div>
    </header>
  );
}
