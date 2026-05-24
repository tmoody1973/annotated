import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@annotated/backend/convex/_generated/api";
import { SiteHeader } from "../../_components/site-header";
import { AnnotationCard, type FeedItem } from "../../_components/annotation-card";
import { FollowButton } from "../../_components/follow-button";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

async function fetchProfile(username: string) {
  if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  const client = new ConvexHttpClient(convexUrl);
  const user = await client.query(api.users.getByUsername, { username });
  if (!user) return null;
  const [annotations, counts] = await Promise.all([
    client.query(api.annotations.listByAuthor, { authorId: user._id }),
    client.query(api.follows.getCounts, { userId: user._id }),
  ]);
  return { user, annotations, counts };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username} — Annotated` };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await fetchProfile(username);
  if (!profile) notFound();
  const { user, annotations, counts } = profile;

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader />
      <section className="mx-auto w-full max-w-2xl p-6">
        <div className="flex items-center gap-4 border-b border-border pb-6">
          <div className="flex size-16 items-center justify-center border border-border bg-surface-secondary text-xl">
            {initials(user.displayName)}
          </div>
          <div>
            <h1 className="text-2xl">{user.displayName}</h1>
            <p className="text-muted">@{user.username}</p>
            <p className="text-muted text-sm">
              {counts.followers} followers · {counts.following} following
            </p>
          </div>
          <div className="ml-auto">
            <FollowButton targetUserId={user._id} />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {annotations.length === 0 ? (
            <p className="text-muted">No annotations yet.</p>
          ) : (
            annotations.map((item) => (
              <AnnotationCard key={item._id} item={item as FeedItem} />
            ))
          )}
        </div>
      </section>
    </main>
  );
}
