import { ImageResponse } from "next/og";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { splitSlugId, slugId } from "@annotated/shared";
import { ShareCard, type ShareFormat, type ShareCardData } from "../../../_components/share-card";

interface CardAnnotation {
  _id: string;
  selectedText?: string;
  commentaryText?: string;
  commentaryAudioTranscript?: string;
  isAnonymous?: boolean;
  screenshotUrl?: string | null;
  source:
    | { title: string; type: string; imageUrl?: string | null; youtubeThumbnailUrl?: string | null }
    | null;
  author: { displayName: string; avatarUrl?: string | null; isVerified?: boolean } | null;
}

const getById = makeFunctionReference<
  "query",
  { annotationId: string },
  CardAnnotation | null
>("annotations:getById");

const STORY = { width: 1080, height: 1920 };
const GRID = { width: 1080, height: 1080 };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: param } = await params;
  const { id } = splitSlugId(param);
  const url = new URL(request.url);
  const format: ShareFormat = url.searchParams.get("format") === "story" ? "story" : "grid";
  const download = url.searchParams.get("dl") === "1";
  const size = format === "story" ? STORY : GRID;

  let data: ShareCardData = { quote: "A clip on Annotated", sourceType: "" };
  let slug = "clip";
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl) {
    try {
      const annotation = await new ConvexHttpClient(convexUrl).query(getById, {
        annotationId: id,
      });
      if (annotation) {
        const anonymous = annotation.isAnonymous === true;
        data = {
          quote:
            annotation.selectedText ??
            annotation.commentaryText ??
            annotation.commentaryAudioTranscript ??
            "A clip on Annotated",
          commentary: annotation.selectedText ? annotation.commentaryText : undefined,
          authorName: anonymous ? undefined : annotation.author?.displayName,
          avatarUrl: anonymous ? undefined : annotation.author?.avatarUrl,
          isVerified: anonymous ? false : annotation.author?.isVerified,
          sourceTitle: annotation.source?.title,
          sourceType: annotation.source?.type ?? "",
          imageUrl:
            annotation.screenshotUrl ??
            annotation.source?.imageUrl ??
            annotation.source?.youtubeThumbnailUrl ??
            undefined,
        };
        slug = slugId(annotation.source?.title ?? "clip", annotation._id);
      }
    } catch {
      // Bad id (fails Convex v.id validation) — render the default card, never 500.
    }
  }

  const headers: Record<string, string> = {};
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="annotated-${slug}-${format}.png"`;
  }

  return new ImageResponse(<ShareCard data={data} format={format} />, {
    ...size,
    headers,
  });
}
