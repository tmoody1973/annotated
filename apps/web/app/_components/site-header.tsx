"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import { ThemeToggle } from "../ThemeToggle";
import { NewClipButton } from "./new-clip-button";

/** Mirrors the Clerk user into Convex once auth is ready (idempotent). */
function useEnsureUser(): void {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.users.ensureCurrentUser);
  useEffect(() => {
    if (isAuthenticated) void ensure();
  }, [isAuthenticated, ensure]);
}

/** Brutalist top chrome: black bar, acid-block wordmark, theme toggle, Clerk auth. */
// Chrome Web Store install link — set NEXT_PUBLIC_EXTENSION_URL once the listing
// is live to reveal the "Get the extension" CTA; hidden until then.
const extensionUrl = process.env.NEXT_PUBLIC_EXTENSION_URL;

export function SiteHeader() {
  useEnsureUser();
  const { isAuthenticated } = useConvexAuth();
  return (
    <header className="sticky top-0 z-50 flex items-center gap-5 border-b-[3px] border-[color:var(--b-acid)] bg-[color:var(--b-chrome)] px-6 py-3 text-[color:var(--b-card)]">
      <Link href="/" aria-label="Annotated home" className="font-display text-[22px] leading-none tracking-tight">
        <span className="bg-[color:var(--b-acid)] px-1.5 text-[color:var(--b-acid-ink)]">A</span>NNOTATED
      </Link>
      <nav className="flex gap-1">
        <Link
          href="/"
          className="bg-[color:var(--b-acid)] px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wide text-[color:var(--b-acid-ink)]"
        >
          Home
        </Link>
        {extensionUrl && (
          <a
            href={extensionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-[color:var(--b-acid)] px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wide text-[color:var(--b-acid)] hover:bg-[color:var(--b-acid)] hover:text-[color:var(--b-acid-ink)]"
          >
            Get the extension
          </a>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <NewClipButton />
        <ThemeToggle />
        {isAuthenticated ? (
          <UserButton />
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
