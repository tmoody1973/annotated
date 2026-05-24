"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { Button } from "@heroui/react";
import { api } from "@annotated/backend/convex/_generated/api";
import { ThemeToggle } from "../ThemeToggle";

/** Mirrors the Clerk user into Convex once auth is ready (idempotent). */
function useEnsureUser(): void {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.users.ensureCurrentUser);
  useEffect(() => {
    if (isAuthenticated) void ensure();
  }, [isAuthenticated, ensure]);
}

/** App header: logo home link, theme toggle, and Clerk sign-in / account. */
export function SiteHeader() {
  useEnsureUser();
  const { isAuthenticated } = useConvexAuth();
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <Link href="/" aria-label="Annotated home">
        <h1 className="text-2xl">Annotated</h1>
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {isAuthenticated ? (
          <UserButton />
        ) : (
          <SignInButton mode="modal">
            <Button size="sm">Sign in</Button>
          </SignInButton>
        )}
      </div>
    </header>
  );
}
