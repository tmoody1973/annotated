"use client";

import Link from "next/link";
import { Avatar, Card } from "@heroui/react";
import { slugId } from "@annotated/shared";
import { VoteButtons } from "./vote-buttons";

export interface FeedItem {
  _id: string;
  selectedText?: string;
  commentaryText?: string;
  commentaryAudioTranscript?: string;
  clipUrl: string | null;
  commentCount: number;
  likeCount: number;
  downCount: number;
  threadId?: string | null;
  clipCount?: number;
  source: {
    type: string;
    title: string;
    canonicalUrl: string;
    siteName?: string;
  } | null;
  author: {
    username: string;
    displayName: string;
    avatarUrl?: string;
  } | null;
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

/** A single feed/profile card: author, the clip or quote, commentary, and the
 *  social row (like, comments, source link). Clicking through goes to /a/[id]. */
export function AnnotationCard({ item }: { item: FeedItem }) {
  const { source, author } = item;
  const isPodcast = source?.type === "podcast";
  const isThread = item.threadId != null && (item.clipCount ?? 1) > 1;
  const detailHref =
    isThread && item.threadId
      ? `/t/${slugId(source?.title ?? "thread", item.threadId)}`
      : `/a/${slugId(source?.title ?? "clip", item._id)}`;

  return (
    <Card className="w-full">
      <Card.Header>
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            {author?.avatarUrl && (
              <Avatar.Image src={author.avatarUrl} alt={author.displayName} />
            )}
            <Avatar.Fallback>
              {initials(author?.displayName ?? "?")}
            </Avatar.Fallback>
          </Avatar>
          <div className="leading-tight">
            <Card.Title className="text-base">
              {author ? (
                <Link href={`/u/${author.username}`} className="hover:underline">
                  {author.displayName}
                </Link>
              ) : (
                "Unknown"
              )}
            </Card.Title>
            {author && (
              <Card.Description>@{author.username}</Card.Description>
            )}
          </div>
        </div>
      </Card.Header>

      <Card.Content className="flex flex-col gap-3">
        {isThread && (
          <Link
            href={detailHref}
            className="inline-flex w-fit items-center gap-1 border border-border bg-accent/10 px-2 py-1 text-sm font-bold hover:bg-accent/20"
          >
            🧵 {item.clipCount} clips
          </Link>
        )}

        {item.clipUrl &&
          (isPodcast ? (
            <audio controls src={item.clipUrl} className="w-full" />
          ) : (
            <video controls src={item.clipUrl} className="max-h-80 w-full bg-black" />
          ))}

        {item.selectedText && (
          <blockquote className="border-l-4 border-accent pl-3 text-lg">
            “{item.selectedText}”
          </blockquote>
        )}

        {item.commentaryText ? (
          <p>{item.commentaryText}</p>
        ) : item.commentaryAudioTranscript ? (
          <p className="text-muted italic">🎙 “{item.commentaryAudioTranscript}”</p>
        ) : null}

        {source && (
          <a
            href={source.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted text-sm hover:underline"
          >
            ↗ {source.siteName ? `${source.siteName} — ` : ""}
            {source.title}
          </a>
        )}
      </Card.Content>

      <Card.Footer>
        <div className="flex w-full items-center gap-2">
          <VoteButtons
            annotationId={item._id}
            upCount={item.likeCount}
            downCount={item.downCount}
          />
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 border border-border px-2 py-1 text-sm hover:bg-surface-secondary"
          >
            💬 {item.commentCount}
          </Link>
        </div>
      </Card.Footer>
    </Card>
  );
}
