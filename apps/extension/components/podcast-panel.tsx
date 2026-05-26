import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { PodcastDetection } from "../lib/use-active-tab-podcast";
import { ink, monoStack, muted, sansStack } from "../lib/clip-styles";
import { PodcastClipper } from "./podcast-clipper";

type ResolveArgs = {
  platform: "apple" | "spotify" | "generic" | "enclosure";
  canonicalUrl: string;
  podcastId?: string;
  episodeId?: string;
  rssUrl?: string;
  pageTitle?: string;
  enclosureUrl?: string;
  showName?: string;
};

type ResolveResult =
  | {
      status: "resolved";
      sourceId: string;
      podcastName: string;
      episodeTitle: string;
      mp3Url: string;
    }
  | { status: "unsupported"; reason: string }
  | { status: "not_found"; reason: string };

const resolvePodcast = makeFunctionReference<"action", ResolveArgs, ResolveResult>(
  "podcasts:resolvePodcast"
);

const SPOTIFY_MESSAGE =
  "Spotify exclusives have no RSS feed and can't be clipped. Open the Apple Podcasts or web RSS version of this show.";

/** Maps a resolvable detection (Apple/generic) to resolver args. Spotify never
 * reaches the resolver — it has no enclosure — so it is excluded here. */
function toArgs(
  detection: Exclude<PodcastDetection, { kind: "spotify" }>
): ResolveArgs {
  if (detection.kind === "apple") {
    return {
      platform: "apple",
      canonicalUrl: detection.canonicalUrl,
      podcastId: detection.podcastId,
      ...(detection.episodeId ? { episodeId: detection.episodeId } : {}),
    };
  }
  if (detection.kind === "enclosure") {
    return {
      platform: "enclosure",
      canonicalUrl: detection.canonicalUrl,
      enclosureUrl: detection.enclosureUrl,
      pageTitle: detection.pageTitle,
      showName: detection.showName,
    };
  }
  return {
    platform: "generic",
    canonicalUrl: detection.canonicalUrl,
    rssUrl: detection.rssUrl,
    pageTitle: detection.pageTitle,
  };
}

const label = {
  fontFamily: sansStack,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: muted,
};

function GracefulNote({ text }: { text: string }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div style={label}>🎙 Podcast detected</div>
      <p style={{ fontSize: 14, color: ink, margin: "8px 0 0", lineHeight: 1.4 }}>
        {text}
      </p>
    </section>
  );
}

/**
 * Resolves a detected podcast page to a clippable episode and shows its title
 * and show. Spotify exclusives short-circuit to a graceful message (no enclosure
 * exists to resolve). The clip UI itself arrives in Step 7.
 */
export function PodcastPanel({ detection }: { detection: PodcastDetection }) {
  const resolve = useAction(resolvePodcast);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSpotify = detection.kind === "spotify";
  const detectionKey =
    detection.canonicalUrl +
    (detection.kind === "apple" ? `:${detection.episodeId ?? ""}` : "") +
    (detection.kind === "generic"
      ? `:${detection.rssUrl}:${detection.pageTitle}`
      : "") +
    (detection.kind === "enclosure" ? `:${detection.enclosureUrl}` : "");

  useEffect(() => {
    if (detection.kind === "spotify") return;
    let cancelled = false;
    setResult(null);
    setError(null);
    resolve(toArgs(detection))
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Couldn't resolve this episode.");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectionKey]);

  if (isSpotify) return <GracefulNote text={SPOTIFY_MESSAGE} />;

  if (error) return <GracefulNote text={error} />;
  if (result === null) {
    return (
      <section style={{ marginBottom: 18 }}>
        <div style={label}>🎙 Podcast detected</div>
        <p style={{ fontSize: 14, color: muted, margin: "8px 0 0" }}>
          Resolving episode…
        </p>
      </section>
    );
  }
  if (result.status !== "resolved") return <GracefulNote text={result.reason} />;

  return (
    <section style={{ marginBottom: 18 }}>
      <div style={label}>🎙 Podcast detected</div>
      <h2
        style={{
          fontFamily: monoStack,
          fontSize: 16,
          fontWeight: 800,
          color: ink,
          margin: "8px 0 4px",
          lineHeight: 1.3,
        }}
      >
        {result.episodeTitle}
      </h2>
      <p style={{ fontSize: 13, color: muted, margin: 0 }}>{result.podcastName}</p>
      <PodcastClipper sourceId={result.sourceId} mp3Url={result.mp3Url} />
    </section>
  );
}
