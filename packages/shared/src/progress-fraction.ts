/**
 * The fraction a determinate-feeling progress bar should fill for an operation
 * whose true completion can't be measured (e.g. a Deepgram sync transcription
 * gives no real %). The bar fills linearly toward `PROGRESS_CAP` over the
 * estimated duration, then holds there — so an overrun reads as "almost there"
 * and the bar never shows a false 100% while work is still in flight. The caller
 * signals real completion by unmounting the indicator (the status flips to ready).
 *
 * @param elapsedMs  time since the operation started
 * @param estimateMs the expected duration
 * @returns a value in [0, PROGRESS_CAP]
 */
const PROGRESS_CAP = 0.92;

export function progressFraction(elapsedMs: number, estimateMs: number): number {
  if (estimateMs <= 0 || elapsedMs <= 0) return 0;
  const ratio = Math.min(elapsedMs / estimateMs, 1);
  return ratio * PROGRESS_CAP;
}
