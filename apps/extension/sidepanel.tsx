import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useActiveTabYoutubeId } from "./lib/use-active-tab-youtube";
import { useActiveTabPodcast } from "./lib/use-active-tab-podcast";
import { ClipComposer } from "./components/clip-composer";
import { PodcastPanel } from "./components/podcast-panel";
import {
  accent,
  clipPanelCss,
  ink,
  monoStack,
  muted,
  paper,
  sansStack,
} from "./lib/clip-styles";

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

function SourceNote({ videoId }: { videoId: string }) {
  const source = useQuery(getSourceByYoutubeId, { youtubeVideoId: videoId });
  const text =
    source === undefined
      ? "Checking Convex…"
      : source === null
        ? "New video — not clipped yet."
        : `Already clipped: ${source.title}`;
  return <p style={{ fontSize: 12, color: muted, margin: "6px 0 0" }}>{text}</p>;
}

function Header() {
  return (
    <header style={{ borderBottom: `3px solid ${ink}`, paddingBottom: 10, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 12, height: 12, background: accent, border: `2px solid ${ink}`, borderRadius: "50%" }} />
        <h1 style={{ margin: 0, fontFamily: sansStack, fontWeight: 900, fontSize: 18, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Annotated
        </h1>
      </div>
    </header>
  );
}

function Sidepanel() {
  const videoId = useActiveTabYoutubeId();
  const podcast = useActiveTabPodcast();

  return (
    <ConvexProvider client={convex}>
      <style>{clipPanelCss}</style>
      <main
        className="ann-root"
        style={{
          minHeight: "100vh",
          padding: 18,
          background: paper,
          color: ink,
          fontFamily: sansStack,
        }}
      >
        <Header />
        {videoId ? (
          <>
            <section style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: monoStack, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: muted }}>
                YouTube clip
              </div>
              <code style={{ fontFamily: monoStack, fontSize: 13, fontWeight: 700 }}>{videoId}</code>
              <SourceNote videoId={videoId} />
            </section>
            <ClipComposer videoId={videoId} />
          </>
        ) : podcast ? (
          <PodcastPanel detection={podcast} />
        ) : (
          <p style={{ fontSize: 14, color: muted }}>
            Open a YouTube video or podcast to clip it.
          </p>
        )}
      </main>
    </ConvexProvider>
  );
}

export default Sidepanel;
