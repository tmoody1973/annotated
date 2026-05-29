import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@annotated/backend/convex/_generated/api";
import { AppShell } from "../../_components/app-shell";
import { AnnotationCard, type FeedItem } from "../../_components/annotation-card";
import { FollowButton } from "../../_components/follow-button";
import { AuthorAvatar, VerifiedBadge } from "../../_components/author-avatar";
import { ProfileEmptyState } from "../../_components/profile-empty-state";
import { absoluteUrl } from "../../_lib/urls";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

/** Build the public X/Twitter profile URL from a stored handle (with or without @). */
function xProfileUrl(handle: string): string {
  return `https://x.com/${handle.replace(/^@/, "")}`;
}

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username} — Annotated`,
    alternates: { canonical: absoluteUrl(`/@${username}`) },
  };
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
    <AppShell narrow>
        <div className="border-b-[3px] border-[color:var(--b-line)] pb-6">
          <div className="flex items-center gap-4">
            <span className="inline-block flex-none shadow-[5px_5px_0_0_var(--b-shadow)]">
              <AuthorAvatar displayName={user.displayName} avatarUrl={user.avatarUrl} size={64} />
            </span>
            <div className="min-w-0">
              <h1 className="flex items-center gap-1.5 font-display text-3xl leading-none tracking-tight">
                {user.displayName}
                {user.isVerified && <VerifiedBadge />}
              </h1>
              <p className="mt-1 font-mono text-[13px] text-[color:var(--b-dim-onbg)]">@{user.username}</p>
              <p className="font-mono text-[12px] uppercase tracking-wide text-[color:var(--b-dim-onbg)]">
                {counts.followers} followers · {counts.following} following
              </p>
            </div>
            <div className="ml-auto">
              <FollowButton targetUserId={user._id} />
            </div>
          </div>

          {user.bio && (
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-[color:var(--b-onbg)]">
              {user.bio}
            </p>
          )}
          {(user.xHandle || user.website) && (
            <div className="mt-2 flex flex-wrap items-center gap-4">
              {user.xHandle && (
                <a
                  href={xProfileUrl(user.xHandle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold text-[color:var(--b-dim-onbg)] hover:text-[color:var(--b-onbg)] hover:underline"
                >
                  𝕏 @{user.xHandle.replace(/^@/, "")}
                </a>
              )}
              {user.website && (
                <a
                  href={user.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold text-[color:var(--b-dim-onbg)] hover:text-[color:var(--b-onbg)] hover:underline"
                >
                  🔗 {user.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {annotations.length === 0 ? (
            <ProfileEmptyState username={user.username} />
          ) : (
            annotations.map((item) => (
              <AnnotationCard key={item._id} item={item as FeedItem} />
            ))
          )}
        </div>
    </AppShell>
  );
}
