import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { splitSlugId, sliceTranscriptToSpan, wordsToVtt, type CaptionWord } from "@annotated/shared";

// Served same-origin so the cross-origin clip <video> can attach it as a
// captions <track> without CORS friction. Only YouTube (video) clips get a
// track; audio-only podcasts use the transcript accordion instead.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

const getById = makeFunctionReference<
  "query",
  { annotationId: string },
  {
    sourceId: string;
    clipStartMs?: number;
    clipEndMs?: number;
    source: { type: string } | null;
  } | null
>("annotations:getById");

const getTranscriptBySource = makeFunctionReference<
  "query",
  { sourceId: string },
  { wordsJson?: string; words?: CaptionWord[] } | null
>("transcripts:getBySource");

const VTT_HEADERS = { "Content-Type": "text/vtt; charset=utf-8" } as const;

function emptyTrack(): Response {
  return new Response("WEBVTT\n", { headers: VTT_HEADERS });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: param } = await params;
  const { id } = splitSlugId(param);
  if (!convexUrl) return emptyTrack();

  try {
    const client = new ConvexHttpClient(convexUrl);
    const annotation = await client.query(getById, { annotationId: id });
    if (
      !annotation ||
      annotation.source?.type !== "youtube" ||
      annotation.clipStartMs == null ||
      annotation.clipEndMs == null
    ) {
      return emptyTrack();
    }

    const row = await client.query(getTranscriptBySource, { sourceId: annotation.sourceId });
    const words: CaptionWord[] = row?.wordsJson
      ? (JSON.parse(row.wordsJson) as CaptionWord[])
      : (row?.words ?? []);
    if (words.length === 0) return emptyTrack();

    const windowed = sliceTranscriptToSpan(words, annotation.clipStartMs, annotation.clipEndMs);
    const vtt = wordsToVtt(windowed, annotation.clipStartMs);
    return new Response(vtt, {
      headers: { ...VTT_HEADERS, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return emptyTrack();
  }
}
