import { Suspense } from "react";
import { AppShell } from "./_components/app-shell";
import { HomeFeed } from "./_components/home-feed";
import { TopicRail } from "./_components/topic-rail";
import { LoggedOutHero } from "./_components/logged-out-hero";

export default function Home() {
  return (
    <AppShell hero={<LoggedOutHero />}>
      <TopicRail />
      <Suspense
        fallback={<p className="font-mono text-sm text-[color:var(--b-dim-onbg)]">Loading feed…</p>}
      >
        <HomeFeed />
      </Suspense>
    </AppShell>
  );
}
