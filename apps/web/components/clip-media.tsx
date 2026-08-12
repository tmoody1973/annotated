import { WaveformPlayer } from "../app/_components/waveform-player";

export type MediaState = "processing" | "ready" | "failed" | undefined;

const noticeText =
  "font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-acid)]";

/**
 * The single place a clip becomes a player. Optimistic publish means a row can
 * exist before its media does, so every surface that shows a clip must handle
 * three states — rendering them here keeps the feed, the landing page, and the
 * thread page from drifting. An absent mediaState means "ready": every row
 * created before optimistic publish had its clip attached at insert time. A
 * missing clipUrl is treated the same as "processing" (belt-and-suspenders —
 * there's nothing to play either way).
 */
export function ClipMedia({
  mediaState,
  clipUrl,
  sourceType,
  captionsUrl,
  className = "",
  bare = false,
}: {
  mediaState: MediaState;
  clipUrl: string | null;
  sourceType: "youtube" | "podcast" | "article";
  /** Same-origin WebVTT URL for a <track>; only the landing page has one. */
  captionsUrl?: string;
  /** Border/position classes the caller controls (its position in the card differs per surface). */
  className?: string;
  /** Feed card's pre-existing youtube render: no chrome wrapper, no height cap. */
  bare?: boolean;
}) {
  if (sourceType === "article") return null;

  if (mediaState === "failed") {
    return (
      <div className={`bg-[color:var(--b-chrome)] p-6 text-center ${className}`}>
        <p className={noticeText}>This clip couldn&apos;t be made</p>
        <p className="mt-1 text-[13px] text-[color:var(--b-dim-onbg)]">
          The take and source link below are still here — try clipping it again.
        </p>
      </div>
    );
  }

  if (mediaState === "processing") {
    return (
      <div aria-live="polite" className={`bg-[color:var(--b-chrome)] p-6 text-center ${className}`}>
        <p className={noticeText}>Clip processing…</p>
        <p className="mt-1 text-[13px] text-[color:var(--b-dim-onbg)]">
          This page updates itself when it&apos;s ready.
        </p>
      </div>
    );
  }

  // No mediaState + no clipUrl is a legacy row (mediaState absent means
  // "ready" per the contract above), not one that's still processing — it
  // will never resolve, so don't promise it will.
  if (!clipUrl) {
    return (
      <div className={`bg-[color:var(--b-chrome)] p-6 text-center ${className}`}>
        <p className={noticeText}>Clip unavailable</p>
      </div>
    );
  }

  if (sourceType === "podcast") {
    return <WaveformPlayer src={clipUrl} />;
  }

  if (bare) {
    return <video controls playsInline src={clipUrl} className={`block w-full bg-black ${className}`} />;
  }

  return (
    <div className={`bg-[color:var(--b-chrome)] ${className}`}>
      <video controls playsInline className="block max-h-[60vh] w-full bg-black">
        <source src={clipUrl} />
        {captionsUrl && (
          <track kind="captions" srcLang="en" label="English" src={captionsUrl} default />
        )}
      </video>
    </div>
  );
}
