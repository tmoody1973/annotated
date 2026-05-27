"use client";

import { useEffect, useRef, useState } from "react";
import { computeWaveformPeaks } from "@annotated/shared";

const BARS = 56;

/**
 * Brutalist audio player for podcast clips: a real waveform (acid bars on the
 * dark chrome) with a hard-edged play button and a played/unplayed split.
 * Peaks are decoded client-side from the clip via Web Audio API and the shared
 * `computeWaveformPeaks`. If decode fails (e.g. CORS), it degrades to the native
 * <audio> control so playback always works.
 */
export function WaveformPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        const buffer = await res.arrayBuffer();
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const decoded = await ctx.decodeAudioData(buffer);
        if (!cancelled) setPeaks(computeWaveformPeaks(decoded.getChannelData(0), BARS));
        void ctx.close();
      } catch {
        if (!cancelled) setDecodeFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const toggle = (): void => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  if (decodeFailed) {
    return (
      <div className="border-y-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] p-4">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user audio clip */}
        <audio controls src={src} className="block w-full" />
      </div>
    );
  }

  const playedBars = Math.round(progress * BARS);

  return (
    <div className="flex items-center gap-3 border-y-[3px] border-[color:var(--b-line)] bg-[color:var(--b-chrome)] p-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause clip" : "Play clip"}
        className="grid size-11 flex-none place-items-center bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)] text-lg"
      >
        {playing ? "■" : "▶"}
      </button>
      <div className="flex h-9 flex-1 items-center gap-[2px]" aria-hidden="true">
        {(peaks ?? new Array(BARS).fill(0.15)).map((peak, i) => (
          <span
            key={i}
            className={i < playedBars ? "bg-[color:var(--b-acid)]" : "bg-[color:#5f5f59]"}
            style={{ width: 3, height: `${Math.max(8, peak * 100)}%` }}
          />
        ))}
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user audio clip */}
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgress(el.duration ? el.currentTime / el.duration : 0);
        }}
        className="hidden"
      />
    </div>
  );
}
