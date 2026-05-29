import { ImageResponse } from "next/og";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { splitSlugId } from "@annotated/shared";
import { OgCard, type OgCardData } from "../../_components/og-card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "An annotated thread";

interface OgThreadClip {
  selectedText?: string;
  commentaryText?: string;
}
interface OgThread {
  title: string | null;
  source:
    | { title: string; type: string; imageUrl?: string | null; youtubeThumbnailUrl?: string | null }
    | null;
  author: { displayName: string } | null;
  clips: OgThreadClip[];
}

const getWithClips = makeFunctionReference<
  "query",
  { threadId: string },
  OgThread | null
>("threads:getWithClips");

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: param } = await params;
  const { id } = splitSlugId(param);

  let data: OgCardData = { quote: "A thread on Annotated", sourceType: "" };
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl) {
    try {
      const thread = await new ConvexHttpClient(convexUrl).query(getWithClips, {
        threadId: id,
      });
      if (thread) {
        const first = thread.clips[0];
        data = {
          quote:
            thread.title ??
            first?.selectedText ??
            first?.commentaryText ??
            thread.source?.title ??
            "A thread on Annotated",
          author: thread.author?.displayName,
          sourceTitle: thread.source?.title,
          sourceType: thread.source?.type ?? "",
          clipCount: thread.clips.length,
          imageUrl:
            thread.source?.imageUrl ??
            thread.source?.youtubeThumbnailUrl ??
            undefined,
        };
      }
    } catch {
      // Fall back to the default card on a bad id rather than crashing.
    }
  }

  return new ImageResponse(<OgCard data={data} />, { ...size });
}
