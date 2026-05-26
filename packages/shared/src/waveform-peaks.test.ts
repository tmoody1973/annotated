import { describe, expect, test } from "vitest";
import { computeWaveformPeaks } from "./waveform-peaks";

describe("computeWaveformPeaks", () => {
  test("returns an empty array for a non-positive bucket count", () => {
    expect(computeWaveformPeaks([0.5, -0.5], 0)).toEqual([]);
    expect(computeWaveformPeaks([0.5, -0.5], -3)).toEqual([]);
  });

  test("returns all-zero buckets for empty samples", () => {
    expect(computeWaveformPeaks([], 4)).toEqual([0, 0, 0, 0]);
  });

  test("each bucket is the peak absolute amplitude of its segment", () => {
    // 8 samples, 2 buckets → first half peaks at |-1|=1, second half at |1|=1.
    const samples = [0, 0.5, -1, 0.25, 0, 0, 1, -0.5];
    expect(computeWaveformPeaks(samples, 2)).toEqual([1, 1]);
  });

  test("captures differing peaks per bucket", () => {
    const samples = [0.2, 0.1, 0, 0, 0.9, -0.3];
    const peaks = computeWaveformPeaks(samples, 3);
    expect(peaks).toEqual([0.2, 0, 0.9]);
  });

  test("all peaks are normalized into 0..1", () => {
    const samples = [-1, 0.999, -0.0001, 0.5];
    for (const p of computeWaveformPeaks(samples, 4)) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  test("works with a Float32Array (what decodeAudioData yields)", () => {
    const samples = Float32Array.from([0, -0.7, 0.4, 0.1]);
    const peaks = computeWaveformPeaks(samples, 2);
    expect(peaks[0]).toBeCloseTo(0.7, 5);
    expect(peaks[1]).toBeCloseTo(0.4, 5);
  });
});
