import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useActiveTabYoutubeId } from "./lib/use-active-tab-youtube";
import { useActiveTabPodcast } from "./lib/use-active-tab-podcast";
import { useActiveTabArticle } from "./lib/use-active-tab-article";
import { ClipComposer } from "./components/clip-composer";
import { PodcastPanel } from "./components/podcast-panel";
import { ArticlePanel } from "./components/article-panel";
import {
  clipPanelCss,
  faint,
  hair,
  ink,
  monoStack,
  muted,
  paper,
  sansStack,
  serifStack,
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
    <header style={{ borderBottom: `1px solid ${hair}`, paddingBottom: 12, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          style={{
            width: 24,
            height: 24,
            background: ink,
            color: paper,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: serifStack,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          A
        </span>
        <h1 style={{ margin: 0, fontFamily: serifStack, fontWeight: 600, fontSize: 18, letterSpacing: "-0.01em" }}>
          Annotated
        </h1>
      </div>
    </header>
  );
}

function Sidepanel() {
  const videoId = useActiveTabYoutubeId();
  const podcast = useActiveTabPodcast();
  const article = useActiveTabArticle();

  // Apple/Spotify podcast pages win outright. But many news articles also
  // advertise a site RSS feed, which the generic podcast detector picks up — so
  // a page declaring og:type=article is treated as an article even when it has
  // an RSS link. A generic-RSS page with no article markup stays a podcast.
  const explicitPodcast = podcast !== null && podcast.kind !== "generic";

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
              <div style={{ fontFamily: sansStack, fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: faint }}>
                YouTube clip
              </div>
              <code style={{ fontFamily: monoStack, fontSize: 13, fontWeight: 700 }}>{videoId}</code>
              <SourceNote videoId={videoId} />
            </section>
            <ClipComposer videoId={videoId} />
          </>
        ) : explicitPodcast && podcast ? (
          <PodcastPanel detection={podcast} />
        ) : article ? (
          <ArticlePanel detection={article} />
        ) : podcast ? (
          <PodcastPanel detection={podcast} />
        ) : (
          <p style={{ fontSize: 14, color: muted }}>
            Open a YouTube video, podcast, or article to clip it.
          </p>
        )}
      </main>
    </ConvexProvider>
  );
}

export default Sidepanel;
