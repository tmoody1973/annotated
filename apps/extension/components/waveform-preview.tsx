import { useEffect, useRef } from "react";
import { computeWaveformPeaks } from "@annotated/shared";
import { accent, paper } from "../lib/clip-styles";

const WIDTH = 320;
const HEIGHT = 44;

/**
 * Draws a static waveform of a recorded take (gap §7) so the user can see they
 * captured real audio, not silence. Decodes the blob with the Web Audio API,
 * downsamples to per-bar peaks (shared `computeWaveformPeaks`), and paints the
 * bars. Renders nothing visible if decoding fails — the <audio> preview remains.
 */
export function WaveformPreview({ blob }: { blob: Blob }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const audioContext = new AudioContext();

    const render = async (): Promise<void> => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const buffer = await blob.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(buffer);
      if (cancelled) return;

      const channel = decoded.getChannelData(0);
      const barCount = Math.floor(WIDTH / 3);
      const peaks = computeWaveformPeaks(channel, barCount);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = accent;
      const barWidth = WIDTH / peaks.length;
      peaks.forEach((peak, i) => {
        const barHeight = Math.max(1, peak * HEIGHT);
        ctx.fillRect(
          i * barWidth,
          (HEIGHT - barHeight) / 2,
          Math.max(1, barWidth - 1),
          barHeight
        );
      });
    };

    void render().catch(() => {
      /* decode failed — leave the canvas blank; the <audio> preview still plays */
    });

    return () => {
      cancelled = true;
      void audioContext.close();
    };
  }, [blob]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      aria-label="Waveform of the recorded commentary"
      style={{ width: "100%", height: HEIGHT, background: paper, display: "block" }}
    />
  );
}
