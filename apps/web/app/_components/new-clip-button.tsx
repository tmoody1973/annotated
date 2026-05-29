"use client";

import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { ArticleClipModal } from "./article-clip-modal";

/** Opens the article composer when signed in; otherwise prompts sign-in. */
export function NewClipButton() {
  const { isAuthenticated } = useConvexAuth();
  const [open, setOpen] = useState(false);

  const className =
    "whitespace-nowrap border-2 border-[color:var(--b-acid)] bg-[color:var(--b-acid)] px-3 py-1.5 text-[13px] font-black uppercase tracking-wide text-[color:var(--b-acid-ink)]";

  // Compact "+" on phones, full label once there's room — keeps the mobile
  // header from wrapping/overflowing.
  const label = (
    <>
      <span className="sm:hidden">+</span>
      <span className="hidden sm:inline">+ New clip</span>
    </>
  );

  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <button className={className} aria-label="New clip">{label}</button>
      </SignInButton>
    );
  }
  return (
    <>
      <button className={className} aria-label="New clip" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && <ArticleClipModal onClose={() => setOpen(false)} />}
    </>
  );
}
