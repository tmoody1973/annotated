import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useActiveTabYoutubeId } from "./lib/use-active-tab-youtube";

const convexUrl = process.env.PLASMO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing PLASMO_PUBLIC_CONVEX_URL");
}
const convex = new ConvexReactClient(convexUrl);

interface SourceSummary {
  _id: string;
  title: string;
}

const getSourceByYoutubeId = makeFunctionReference<
  "query",
  { youtubeVideoId: string },
  SourceSummary | null
>("sources:getByYoutubeId");

function VideoStatus({ videoId }: { videoId: string }) {
  const source = useQuery(getSourceByYoutubeId, { youtubeVideoId: videoId });

  return (
    <section>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
        YouTube video detected
      </p>
      <code style={{ fontSize: 13 }}>{videoId}</code>
      <p style={{ fontSize: 13, marginTop: 12 }}>
        {source === undefined
          ? "Checking Convex…"
          : source === null
            ? "New video — not clipped yet."
            : `Already a source: ${source.title}`}
      </p>
    </section>
  );
}

function Sidepanel() {
  const videoId = useActiveTabYoutubeId();

  return (
    <ConvexProvider client={convex}>
      <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Annotated</h1>
        {videoId ? (
          <VideoStatus videoId={videoId} />
        ) : (
          <p style={{ fontSize: 14, color: "#666" }}>
            Open a YouTube video to clip it.
          </p>
        )}
      </main>
    </ConvexProvider>
  );
}

export default Sidepanel;
