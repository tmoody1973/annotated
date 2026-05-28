import { SiteHeader } from "./_components/site-header";
import { Feed } from "./_components/feed";
import { LeftNav } from "./_components/left-nav";
import { RightRail } from "./_components/right-rail";
import { TopicRail } from "./_components/topic-rail";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-[1340px] grid-cols-1 gap-7 px-6 py-7 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_290px]">
        <LeftNav />
        <section className="min-w-0">
          <TopicRail />
          <Feed />
        </section>
        <RightRail />
      </div>
    </main>
  );
}
