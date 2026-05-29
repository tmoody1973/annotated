"use client";

import Link from "next/link";
import { slugId, formatRelativeTime } from "@annotated/shared";
import { VoteButtons } from "./vote-buttons";
import { WaveformPlayer } from "./waveform-player";
import { AuthorAvatar, VerifiedBadge } from "./author-avatar";
import { CardShareMenu } from "./card-share-menu";
import { SourceByline } from "./source-byline";

export interface FeedItem {
  _id: string;
  publishedAt?: number;
  selectedText?: string;
  commentaryText?: string;
  commentaryAudioTranscript?: string;
  clipUrl: string | null;
  screenshotUrl?: string | null;
  commentCount: number;
  likeCount: number;
  downCount: number;
  threadId?: string | null;
  clipCount?: number;
  isAnonymous?: boolean;
  source: {
    type: string;
    title: string;
    canonicalUrl: string;
    siteName?: string;
    imageUrl?: string | null;
    author?: string | null;
    podcastName?: string | null;
    youtubeChannelUrl?: string | null;
  } | null;
  author: {
    username: string;
    displayName: string;
    avatarUrl?: string;
    isVerified?: boolean;
  } | null;
  topics?: { slug: string; name: string }[];
}

type TypeKey = "youtube" | "podcast" | "article";

const TYPE_META: Record<TypeKey, { label: string; glyph: string; box: string }> = {
  youtube: { label: "Clipped · YouTube", glyph: "▶", box: "bg-[#ff3b30] text-white" },
  podcast: { label: "Podcast", glyph: "♪", box: "bg-[color:var(--b-chrome)] text-[color:var(--b-acid)]" },
  article: { label: "Highlighted · Article", glyph: "A", box: "bg-[color:var(--b-chrome)] text-[color:var(--b-acid)]" },
};

/** A single brutalist clip card (Tumblr-style block): hard border, acid offset
 *  shadow, mono type-label + relative date, type-aware media, notes + vote. */
export function AnnotationCard({ item }: { item: FeedItem }) {
  const { source, author } = item;
  const type = (source?.type as TypeKey) ?? "article";
  const meta = TYPE_META[type] ?? TYPE_META.article;
  const isThread = item.threadId != null && (item.clipCount ?? 1) > 1;
  const detailHref =
    isThread && item.threadId
      ? `/t/${slugId(source?.title ?? "thread", item.threadId)}`
      : `/a/${slugId(source?.title ?? "clip", item._id)}`;
  const cardSlug = slugId(source?.title ?? "clip", item._id);
  const shareQuote =
    item.selectedText ??
    item.commentaryText ??
    item.commentaryAudioTranscript ??
    source?.title ??
    "";
  const age = item.publishedAt ? formatRelativeTime(item.publishedAt) : "";
  return (
    <article className="mb-6 break-inside-avoid border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        {item.isAnonymous ? (
          <AuthorAvatar displayName="Anonymous" avatarUrl={null} />
        ) : author ? (
          <Link href={`/@${author.username}`} className="flex-none">
            <AuthorAvatar displayName={author.displayName} avatarUrl={author.avatarUrl} />
          </Link>
        ) : (
          <AuthorAvatar displayName="Unknown" avatarUrl={null} />
        )}
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1">
            {item.isAnonymous ? (
              <span className="truncate text-[14px] font-extrabold">Anonymous</span>
            ) : author ? (
              <Link href={`/@${author.username}`} className="truncate text-[14px] font-extrabold hover:underline">
                {author.displayName}
              </Link>
            ) : (
              <span className="truncate text-[14px] font-extrabold">Unknown</span>
            )}
            {!item.isAnonymous && author?.isVerified && <VerifiedBadge />}
          </div>
          <span className="font-mono text-[11px] text-[color:var(--b-dim)]">{age}</span>
        </div>
        <span className={`ml-auto grid size-[22px] flex-none place-items-center text-xs font-black ${meta.box}`}>
          {meta.glyph}
        </span>
      </div>

      <h2 className="px-4 pb-0.5 pt-2.5 text-[21px] font-extrabold leading-[1.06] tracking-[-0.01em]">
        <Link href={detailHref} className="hover:bg-[color:var(--b-acid)]">
          {source?.title ?? "Untitled clip"}
        </Link>
      </h2>

      {isThread && (
        <div className="px-4 pb-1">
          <Link
            href={detailHref}
            className="inline-block border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[color:var(--b-acid-ink)]"
          >
            🧵 {item.clipCount} clips
          </Link>
        </div>
      )}

      {type === "youtube" && item.clipUrl && (
        <video controls src={item.clipUrl} className="block w-full border-y-[3px] border-[color:var(--b-line)] bg-black" />
      )}

      {type === "podcast" && item.clipUrl && <WaveformPlayer src={item.clipUrl} />}

      {type === "article" && (item.screenshotUrl ?? item.source?.imageUrl) && (
        <Link href={detailHref} className="block border-y-[3px] border-[color:var(--b-line)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Convex storage URL or source og:image */}
          <img
            src={item.screenshotUrl ?? item.source?.imageUrl ?? undefined}
            alt="Source page visual"
            className="block max-h-[200px] w-full object-cover object-top"
          />
        </Link>
      )}

      {source && <SourceByline source={source} className="mx-4 mt-3.5" />}

      {item.selectedText && (
        <blockquote className="mx-4 mt-4 border-l-[5px] border-[color:var(--b-acid)] pl-3 text-[17px] font-semibold leading-snug">
          “{item.selectedText}”
        </blockquote>
      )}

      {item.commentaryText ? (
        <p className="px-4 pt-3 text-[15px] leading-relaxed">{item.commentaryText}</p>
      ) : item.commentaryAudioTranscript ? (
        <p className="px-4 pt-3 text-[15px] italic leading-relaxed text-[color:var(--b-dim)]">
          🎙 “{item.commentaryAudioTranscript}”
        </p>
      ) : null}

      {item.topics && item.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {item.topics.map((t) => (
            <Link
              key={t.slug}
              href={`/topics/${t.slug}`}
              className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[color:var(--b-ink)] hover:bg-[color:var(--b-acid)]"
            >
              #{t.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 border-t-[3px] border-[color:var(--b-line)] p-3">
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1.5 border-2 border-[color:var(--b-line)] px-2.5 py-1.5 text-[13px] font-extrabold hover:bg-[color:var(--b-acid)]"
        >
          💬 {item.commentCount} notes
        </Link>
        <VoteButtons annotationId={item._id} upCount={item.likeCount} downCount={item.downCount} />
        <span className="flex-1" />
        <CardShareMenu
          cardSlug={cardSlug}
          detailPath={detailHref}
          quote={shareQuote}
          sourceUrl={source?.canonicalUrl}
        />
      </div>
    </article>
  );
}
