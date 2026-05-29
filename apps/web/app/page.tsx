import { AppShell } from "./_components/app-shell";
import { Feed } from "./_components/feed";
import { TopicRail } from "./_components/topic-rail";

export default function Home() {
  return (
    <AppShell>
      <TopicRail />
      <Feed />
    </AppShell>
  );
}
