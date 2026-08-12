/**
 * Screen 4. The URL is the payload.
 *
 * Plan A made the annotation exist in about two seconds; this screen makes that
 * felt. The link is on the clipboard before the user reaches for it, and the
 * clip finishing its slice is something they watch happen rather than something
 * they reload to discover.
 */
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { getWebUrl } from "../../lib/worker-client";

interface LandingView {
  mediaState?: "processing" | "ready" | "failed";
  takeText?: string;
  commentaryText?: string;
  source?: { title?: string; siteName?: string; type?: string } | null;
}

const getAnnotation = makeFunctionReference<
  "query",
  { annotationId: string },
  LandingView | null
>("annotations:getById");

interface PublishedScreenProps {
  annotationId: string;
  onAnnounce: (message: string) => void;
  onAddToThread: () => void;
  onNewClip: () => void;
}

export function PublishedScreen({
  annotationId,
  onAnnounce,
  onAddToThread,
  onNewClip,
}: PublishedScreenProps) {
  const url = `${getWebUrl()}/a/${annotationId}`;
  const annotation = useQuery(getAnnotation, { annotationId });
  const [copied, setCopied] = useState(false);

  // Copy on arrival, without being asked. A clipboard write can fail outside a
  // user gesture, and that is not worth a message — the URL is on screen,
  // selectable, either way.
  useEffect(() => {
    let cancelled = false;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        if (cancelled) return;
        setCopied(true);
        onAnnounce("URL copied");
      })
      .catch(() => {
        if (!cancelled) onAnnounce("Published");
      });
    return () => {
      cancelled = true;
    };
  }, [url, onAnnounce]);

  const take = annotation?.takeText ?? annotation?.commentaryText ?? "";
  const processing = annotation?.mediaState === "processing";
  const failed = annotation?.mediaState === "failed";

  return (
    <>
      <UrlBlock url={url} copied={copied} onCopied={() => onAnnounce("URL copied")} />

      <div className="ann-card" style={{ padding: "11px 12px", margin: "14px 0" }}>
        {take ? (
          <p style={{ fontSize: 14, lineHeight: 1.45, margin: 0, fontWeight: 600 }}>{take}</p>
        ) : (
          <p className="ann-dim" style={{ fontSize: 13, margin: 0 }}>
            Your recorded take.
          </p>
        )}
        {annotation?.source?.title ? (
          <p className="ann-dim" style={{ fontSize: 12, margin: "6px 0 0" }}>
            {annotation.source.siteName || annotation.source.title}
          </p>
        ) : null}
        {processing ? <ProcessingLine /> : null}
        {failed ? (
          <p className="ann-dim" style={{ fontSize: 12, margin: "8px 0 0" }}>
            The clip didn't finish. The page and your take are live; the media is missing.
          </p>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <button type="button" className="ann-publish ann-press" onClick={onAddToThread}>
          + Add another clip → thread
        </button>
        <button
          type="button"
          className="ann-capture ann-press"
          style={{ padding: 11 }}
          onClick={() => void chrome.tabs.create({ url })}
        >
          Open the page ⟶
        </button>
        <button type="button" className="ann-link" style={{ marginTop: 2 }} onClick={onNewClip}>
          New clip
        </button>
      </div>
    </>
  );
}

/**
 * The URL, readable and re-copyable. When the automatic copy fails the input is
 * focused and selected instead, so one keystroke finishes the job — a clipboard
 * error message would be noise about something the user can already do.
 */
function UrlBlock({
  url,
  copied,
  onCopied,
}: {
  url: string;
  copied: boolean;
  onCopied: () => void;
}) {
  return (
    <div>
      <span
        className="ann-dim"
        style={{
          display: "block",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {copied ? "Copied to your clipboard" : "Your link"}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="ann-field"
          readOnly
          value={url}
          style={{ fontSize: 12 }}
          onFocus={(event) => event.currentTarget.select()}
          ref={(node) => {
            if (node && !copied) {
              node.focus();
              node.select();
            }
          }}
          aria-label="Link to your annotation"
        />
        <button
          type="button"
          className="ann-capture ann-press"
          style={{ padding: "0 10px", flexShrink: 0 }}
          onClick={() => {
            void navigator.clipboard.writeText(url).then(onCopied).catch(() => undefined);
          }}
        >
          Copy
        </button>
      </div>
    </div>
  );
}

/** A live elapsed count, so the wait is visibly moving rather than merely open. */
function ProcessingLine() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <p className="ann-dim ann-mono" style={{ fontSize: 12, margin: "8px 0 0" }} role="status">
      ◐ clip processing… {seconds}s
    </p>
  );
}
