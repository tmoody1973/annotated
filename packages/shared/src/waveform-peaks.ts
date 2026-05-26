/**
 * Downsamples raw audio samples (e.g. a channel from AudioContext.decodeAudioData)
 * into `buckets` peak values for drawing a waveform preview. Each bucket holds
 * the maximum absolute amplitude of its segment, so transients stay visible
 * instead of averaging out. Samples are assumed to be in [-1, 1], so peaks come
 * out in [0, 1] — ready to scale to bar heights.
 */
export function computeWaveformPeaks(
  samples: ArrayLike<number>,
  buckets: number
): number[] {
  if (buckets <= 0) return [];
  if (samples.length === 0) return new Array(buckets).fill(0);

  const segment = samples.length / buckets;
  const peaks: number[] = [];
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = Math.floor(bucket * segment);
    const end = Math.floor((bucket + 1) * segment);
    let peak = 0;
    for (let i = start; i < end; i += 1) {
      const amplitude = Math.abs(samples[i] ?? 0);
      if (amplitude > peak) peak = amplitude;
    }
    peaks.push(peak);
  }
  return peaks;
}
