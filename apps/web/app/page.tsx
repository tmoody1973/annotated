import { SiteHeader } from "./_components/site-header";
import { Feed } from "./_components/feed";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader />
      <section className="mx-auto w-full max-w-2xl p-6">
        <Feed />
      </section>
    </main>
  );
}
