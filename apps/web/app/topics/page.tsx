import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { SiteHeader } from "../_components/site-header";

interface TopicSummary {
  _id: string;
  slug: string;
  name: string;
  description?: string;
}

const listTopics = makeFunctionReference<"query", Record<string, never>, TopicSummary[]>(
  "topics:list"
);

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

async function fetchTopics(): Promise<TopicSummary[]> {
  if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  try {
    const client = new ConvexHttpClient(convexUrl);
    return await client.query(listTopics, {});
  } catch {
    return [];
  }
}

export const metadata = { title: "Topics — Annotated" };

export default async function TopicsPage() {
  const topics = await fetchTopics();
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-[1100px] px-6 py-8">
        <h1 className="mb-6 font-display text-3xl tracking-tight text-[color:var(--b-onbg)]">
          TOPICS
        </h1>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <Link
              key={t.slug}
              href={`/topics/${t.slug}`}
              className="block border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-4 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)] hover:bg-[color:var(--b-acid)]"
            >
              <p className="font-display text-xl leading-tight">#{t.name}</p>
              {t.description && (
                <p className="mt-1.5 text-[13px] font-semibold leading-snug text-[color:var(--b-dim)]">
                  {t.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
