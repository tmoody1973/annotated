"use client";

import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { ExtensionCta } from "./extension-cta";
import { useBrowserInfo } from "../_lib/use-browser-info";

const primaryCta =
  "border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-6 py-3.5 font-mono text-[14px] font-bold uppercase tracking-wide text-[color:var(--b-acid)] shadow-[5px_5px_0_0_rgba(10,10,10,0.35)] active:translate-x-[2px] active:translate-y-[2px]";
const secondaryCta =
  "border-[3px] border-[color:var(--b-line)] bg-transparent px-5 py-3.5 font-mono text-[14px] font-bold uppercase tracking-wide text-[color:var(--b-acid-ink)] hover:bg-[color:var(--b-card)]";

/** §1 thin hero band: shown to logged-out visitors above the feed, explaining
 *  the product without gating it. Fully unmounts once signed in. */
export function LoggedOutHero() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const browser = useBrowserInfo();

  // Render nothing while auth resolves (avoids a hero flash for signed-in users)
  // and nothing at all once signed in.
  if (isLoading || isAuthenticated) return null;

  return (
    <section className="border-b-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)]">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-end justify-between gap-8 px-6 py-9">
        <div className="max-w-[760px]">
          <span className="mb-3.5 inline-block border-2 border-[color:var(--b-line)] px-2.5 py-1 font-mono text-[12px] font-bold uppercase tracking-wide">
            ◷ The liner notes for the whole web
          </span>
          <h1 className="font-display text-[clamp(30px,4.4vw,52px)] leading-[0.98] tracking-tight">
            Clip the web.
            <br />
            Add your take.
            <br />
            Publish the receipt.
          </h1>
          <p className="mt-3.5 max-w-[54ch] text-[clamp(15px,1.5vw,18px)] font-semibold leading-snug">
            Annotated turns any page into a clip you can mark up and share — your sources and your
            argument, together, in public.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <SignInButton mode="modal">
              <button className={primaryCta}>+ Start a clip</button>
            </SignInButton>
            <SignInButton mode="modal">
              <button className={secondaryCta}>Sign in</button>
            </SignInButton>
            {browser.supported && (
              <ExtensionCta href={browser.storeUrl} ariaLabel={browser.label} className={secondaryCta}>
                ⊕ {browser.label}
              </ExtensionCta>
            )}
          </div>
          <p className="mt-2.5 font-mono text-[11px]">
            No account needed to read —{" "}
            <a href="#feed" className="underline underline-offset-2">
              browse the feed below ↓
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
