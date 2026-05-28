import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { SiteHeader } from "../../_components/site-header";
import { TopicFeed } from "../../_components/topic-feed";

interface TopicSummary {
  _id: string;
  slug: string;
  name: string;
  description?: string;
}

const getBySlug = makeFunctionReference<"query", { slug: string }, TopicSummary | null>(
  "topics:getBySlug"
);

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

async function fetchTopic(slug: string): Promise<TopicSummary | null> {
  if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  try {
    const client = new ConvexHttpClient(convexUrl);
    return await client.query(getBySlug, { slug });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = await fetchTopic(slug);
  if (!topic) return { title: "Not found — Annotated" };
  return { title: `#${topic.name} — Annotated` };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = await fetchTopic(slug);
  if (!topic) notFound();

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-[800px] px-6 py-8">
        <header className="mb-6">
          <h1 className="font-display text-3xl tracking-tight text-[color:var(--b-onbg)]">
            #{topic.name}
          </h1>
          {topic.description && (
            <p className="mt-2 text-[15px] font-semibold text-[color:var(--b-dim-onbg)]">
              {topic.description}
            </p>
          )}
        </header>
        <TopicFeed slug={topic.slug} />
      </div>
    </main>
  );
}
