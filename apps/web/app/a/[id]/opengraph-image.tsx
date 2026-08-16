import { ImageResponse } from "next/og";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { splitSlugId } from "@annotated/shared";
import { OgCard, type OgCardData } from "../../_components/og-card";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "An annotated clip";

interface OgAnnotation {
  removed?: boolean;
  selectedText?: string;
  takeText?: string;
  takeAudioTranscript?: string;
  screenshotUrl?: string | null;
  source:
    | { title: string; type: string; siteName?: string; imageUrl?: string | null; youtubeThumbnailUrl?: string | null }
    | null;
  author: { displayName: string; username: string } | null;
}

const getById = makeFunctionReference<
  "query",
  { annotationId: string },
  OgAnnotation | null
>("annotations:getById");

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: param } = await params;
  const { id } = splitSlugId(param);

  let data: OgCardData = { quote: "A clip on Annotated", sourceType: "" };
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl) {
    try {
      const annotation = await new ConvexHttpClient(convexUrl).query(getById, {
        annotationId: id,
      });
      // A removed clip unfurls as the generic card. Otherwise the quote and
      // take would keep showing up in every chat window the link was pasted
      // into — the opposite of taking it down.
      if (annotation && !annotation.removed) {
        data = {
          quote:
            annotation.selectedText ??
            annotation.takeText ??
            annotation.takeAudioTranscript ??
            "A clip on Annotated",
          take: annotation.selectedText
            ? annotation.takeText
            : undefined,
          author: annotation.author?.displayName,
          sourceTitle: annotation.source?.title,
          sourceType: annotation.source?.type ?? "",
          imageUrl:
            annotation.screenshotUrl ??
            annotation.source?.imageUrl ??
            annotation.source?.youtubeThumbnailUrl ??
            undefined,
        };
      }
    } catch {
      // Fall back to the default card on a bad id rather than crashing.
    }
  }

  return new ImageResponse(<OgCard data={data} />, { ...size });
}
