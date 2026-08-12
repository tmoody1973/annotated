import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { LeftNav } from "./left-nav";
import { PeopleSuggestions } from "./people-suggestions";
import { ExtensionToast } from "./extension-toast";

/**
 * The persistent app shell: sticky site header + a two-column grid (left nav ·
 * content), the left column sticky below the header. Every page renders inside
 * it so navigation feels like one surface (the feed, a clip, a profile — same
 * chrome).
 *
 * The feed's masonry cards are media-first (video, waveform) and want the
 * width, so there's no right rail — `PeopleSuggestions` (join card + follow
 * suggestions) lives under `LeftNav` in the left column instead, revealed only
 * at `xl` so it doesn't cramp the 260px column at `lg`.
 *
 * `narrow` caps the center content to a readable column (clip/profile/settings);
 * leave it off for feeds, which fill the center as a masonry.
 */
export function AppShell({
  children,
  narrow = false,
  hero,
}: {
  children: ReactNode;
  narrow?: boolean;
  /** Optional full-width band rendered between the header and the grid (e.g.
   *  the logged-out hero). The slot component owns its own auth gating. */
  hero?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-1 flex-col bg-[color:var(--b-bg)] text-[color:var(--b-onbg)]">
      <SiteHeader />
      {hero}
      <div className="mx-auto grid w-full max-w-[2000px] grid-cols-1 gap-7 px-6 py-7 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden lg:sticky lg:top-[76px] lg:flex lg:flex-col lg:gap-5 lg:self-start">
          <LeftNav />
          <PeopleSuggestions />
        </div>
        <section className="min-w-0">
          {narrow ? <div className="mx-auto w-full max-w-2xl">{children}</div> : children}
        </section>
      </div>
      <ExtensionToast />
    </main>
  );
}
