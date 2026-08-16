"use client";

import { clipPath } from "../_lib/urls";
import { ClipMedia } from "../../components/clip-media";

/** The receipt shape `comments.listByAnnotation` joins onto a reply. */
export type Evidence =
  | {
      kind: "annotation";
      annotationId: string;
      removed: boolean;
      takeText?: string;
      clipUrl?: string | null;
      sourceTitle?: string;
      sourceUrl?: string;
      sourceType?: string;
    }
  | { kind: "url"; url: string }
  | null;

const label =
  "font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-dim)]";

/** Domain only. The full URL is the href; the display is what a reader can judge. */
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * A reply's receipt, rendered at the weight of a claim rather than a footnote.
 *
 * This is the whole reason the Receipt Chain was built on replies instead of
 * first-class response clips: whether a counter-clip reads as an argument or as
 * a citation is a rendering decision. So a cited clip gets a real player here,
 * the same one the landing page uses, and a reader can hear both sides without
 * leaving the thread.
 */
export function EvidenceCard({ evidence }: { evidence: Evidence }) {
  if (!evidence) return null;

  if (evidence.kind === "url") {
    return (
      <a
        href={evidence.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-2 block border-2 border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-3 py-2 hover:border-[color:var(--b-acid)]"
      >
        <span className={label}>Source ↗</span>
        <span className="mt-0.5 block truncate text-[13px] font-bold text-[color:var(--b-ink)]">
          {domainOf(evidence.url)}
        </span>
      </a>
    );
  }

  // Cited, then taken down by its author. Say so rather than showing a broken
  // player — and note the take never reaches the client at all, the server
  // stops projecting it the moment the clip is removed.
  if (evidence.removed) {
    return (
      <p className="mt-2 border-2 border-dashed border-[color:var(--b-line)] px-3 py-2 text-[13px] text-[color:var(--b-dim)]">
        The clip cited here was removed by the person who published it.
      </p>
    );
  }

  const href = clipPath(evidence.sourceTitle ?? "clip", evidence.annotationId);
  const kind =
    evidence.sourceType === "article"
      ? "article"
      : evidence.sourceType === "podcast"
        ? "podcast"
        : "youtube";

  return (
    <figure className="mt-2 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)]">
      <figcaption className="flex items-baseline justify-between gap-2 border-b-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-3 py-1.5">
        <span className={label}>Receipt</span>
        <a
          href={href}
          className="truncate font-mono text-[11px] text-[color:var(--b-acid)] underline underline-offset-2"
        >
          {evidence.sourceTitle ?? "View clip"} ↗
        </a>
      </figcaption>

      <ClipMedia
        mediaState={undefined}
        clipUrl={evidence.clipUrl ?? null}
        sourceType={kind}
      />

      {evidence.takeText && (
        <p className="border-t-[3px] border-[color:var(--b-line)] px-3 py-2 text-[13px] leading-relaxed text-[color:var(--b-ink)]">
          {evidence.takeText}
        </p>
      )}
    </figure>
  );
}
