/**
 * What a chapter pick should do to the take box.
 *
 * Picking a chapter titles the take so the writer starts from a labelled point
 * instead of a blank box, and re-picking keeps that title in step. The one rule
 * that matters: words the user actually typed are never overwritten, so this
 * returns null whenever the box holds anything but an untouched stub.
 */

/** An untouched "Chapter: X — " stub, with no user text after the dash. */
function isUneditedSeed(text: string): boolean {
  return /^Chapter: .+ — $/.test(text);
}

export function seedTakeFromChapter(
  currentTake: string,
  chapterTitle: string
): string | null {
  if (currentTake.trim().length !== 0 && !isUneditedSeed(currentTake)) return null;
  return `Chapter: ${chapterTitle} — `;
}
