"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { api } from "@annotated/backend/convex/_generated/api";
import { Feed } from "./feed";
import { FeedGrid } from "./feed-grid";
import type { FeedItem } from "./annotation-card";

type Room = "curated" | "latest";

/** The home feed with auth-aware rooms (§1): signed-out defaults to the curated
 *  Editor's Picks reel (cold-start fix); signed-in defaults to Latest. "For You"
 *  is dimmed/locked until sign-in. Room is URL-driven so the left nav stays in
 *  sync. */
export function HomeFeed() {
  const { isAuthenticated } = useConvexAuth();
  const params = useSearchParams();
  const raw = params.get("room");
  const requested: Room | null = raw === "curated" || raw === "latest" ? raw : null;
  const room: Room = requested ?? (isAuthenticated ? "latest" : "curated");

  return (
    <div id="feed">
      <FeedHead room={room} signedIn={isAuthenticated} />
      {room === "curated" ? <CuratedList /> : <Feed />}
    </div>
  );
}

const tabBase =
  "px-3 py-1.5 font-mono text-[12px] font-bold uppercase tracking-wide border-2 border-[color:var(--b-line)]";

function FeedHead({ room, signedIn }: { room: Room; signedIn: boolean }) {
  const activeTab = `${tabBase} bg-[color:var(--b-chrome)] text-[color:var(--b-acid)]`;
  const idleTab = `${tabBase} bg-[color:var(--b-card)] text-[color:var(--b-ink)] hover:bg-[color:var(--b-acid)]`;

  return (
    <div className="mb-5 border-b-[3px] border-[color:var(--b-line)] pb-3">
      <div className="flex flex-wrap items-center gap-2">
        {room === "curated" ? (
          <span className="bg-[color:var(--b-chrome)] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-wide text-[color:var(--b-acid)]">
            ★ Editor&apos;s Picks
          </span>
        ) : null}
        <h2 className="font-display text-xl tracking-tight">
          {room === "curated" ? "The best of Annotated" : "Latest"}
        </h2>
        {room === "curated" && (
          <span className="ml-auto font-mono text-[11px] text-[color:var(--b-dim-onbg)]">
            hand-picked · updated daily
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href="/?room=curated" className={room === "curated" ? activeTab : idleTab}>
          ★ Curated
        </Link>
        <Link href="/?room=latest" className={room === "latest" ? activeTab : idleTab}>
          ◷ Latest
        </Link>
        {!signedIn && (
          <SignInButton mode="modal">
            <button
              className={`${tabBase} cursor-pointer bg-transparent text-[color:var(--b-dim-onbg)]`}
              title="Sign in to personalize"
            >
              ✦ For You — sign in
            </button>
          </SignInButton>
        )}
      </div>
    </div>
  );
}

/** Curated picks; if none are curated yet, transparently fall back to Latest so
 *  a cold visitor never lands on an empty feed. */
function CuratedList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.annotations.listCurated,
    {},
    { initialNumItems: 10 }
  );

  if (status === "LoadingFirstPage") {
    return <p className="font-mono text-sm text-[color:var(--b-dim-onbg)]">Loading picks…</p>;
  }
  if (results.length === 0) {
    return <Feed />;
  }

  return (
    <FeedGrid
      results={results as FeedItem[]}
      canLoadMore={status === "CanLoadMore"}
      onLoadMore={() => loadMore(10)}
    />
  );
}
