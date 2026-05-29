import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { LeftNav } from "./left-nav";
import { RightRail } from "./right-rail";

/**
 * The persistent app shell: sticky site header + a symmetric three-column grid
 * (left nav · content · right rail), both rails sticky below the header. Every
 * page renders inside it so navigation feels like one surface (the feed, a clip,
 * a profile — same chrome).
 *
 * `narrow` caps the center content to a readable column (clip/profile/settings);
 * leave it off for feeds, which fill the center as a masonry.
 */
export function AppShell({
  children,
  narrow = false,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <main className="flex min-h-screen flex-1 flex-col bg-[color:var(--b-bg)] text-[color:var(--b-onbg)]">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-[2000px] grid-cols-1 gap-7 px-6 py-7 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_260px]">
        <LeftNav />
        <section className="min-w-0">
          {narrow ? <div className="mx-auto w-full max-w-2xl">{children}</div> : children}
        </section>
        <RightRail />
      </div>
    </main>
  );
}
