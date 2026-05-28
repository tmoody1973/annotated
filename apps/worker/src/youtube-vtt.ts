import type { TranscriptWord } from "./transcript-mapper.js";

const INLINE_TS = /<\d{2}:\d{2}:\d{2}\.\d{3}>/;
// The auto-caption word unit `<ts><c>`. Used for file-level detection so a manual
// cue that merely quotes a timestamp can't be mistaken for an auto-sub file.
const WORD_UNIT = /<\d{2}:\d{2}:\d{2}\.\d{3}><c[^>]*>/;
const CUE_HEADER =
  /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;
// `<ts><c> word</c>` — the per-word units inside an auto-caption line.
const INLINE_WORD = /<(\d{2}):(\d{2}):(\d{2})\.(\d{3})><c[^>]*>([^<]*)<\/c>/g;

function clockToMs(h: string, m: string, s: string, ms: string): number {
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(ms);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

/**
 * Extracts word-level entries from one auto-caption line. The leading text
 * before the first tag is the word spoken at the cue start; each `<ts><c>…</c>`
 * unit is a subsequent word at its own timestamp. endMs is the next word's start
 * (cue end for the last word) — enough for clip-window slicing and display.
 */
function extractInlineWords(
  line: string,
  cueStartMs: number,
  cueEndMs: number
): TranscriptWord[] {
  const stamped: { word: string; startMs: number }[] = [];

  const firstTag = line.indexOf("<");
  const lead = decodeEntities(firstTag === -1 ? line : line.slice(0, firstTag)).trim();
  if (lead.length > 0) stamped.push({ word: lead, startMs: cueStartMs });

  INLINE_WORD.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_WORD.exec(line)) !== null) {
    const word = decodeEntities(match[5] ?? "").trim();
    if (word.length > 0) {
      stamped.push({
        word,
        startMs: clockToMs(match[1]!, match[2]!, match[3]!, match[4]!),
      });
    }
  }

  return stamped.map((entry, index) => {
    const next = index < stamped.length - 1 ? stamped[index + 1]!.startMs : cueEndMs;
    // Guard against non-monotonic auto-caption timestamps so no word ends up with
    // a non-positive duration (which the clip-window slice would silently drop).
    return { word: entry.word, startMs: entry.startMs, endMs: Math.max(next, entry.startMs) };
  });
}

/**
 * Parses a WebVTT subtitle file into transcript words. YouTube auto-captions
 * carry per-word inline timestamps (and rolling duplicate lines we must ignore),
 * so when inline timestamps are present we read word-level timing from them and
 * skip the plain carry-over/transition cues. Manual captions have no inline
 * timing, so each cue becomes one entry (consecutive duplicates deduped).
 */
export function parseVttToWords(raw: string): TranscriptWord[] {
  if (!raw || !raw.includes("-->")) return [];

  const hasInline = WORD_UNIT.test(raw);
  const words: TranscriptWord[] = [];
  let lastCueText = "";

  for (const block of raw.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const headerIndex = lines.findIndex((line) => CUE_HEADER.test(line));
    if (headerIndex === -1) continue;

    const header = lines[headerIndex]!.match(CUE_HEADER)!;
    const cueStartMs = clockToMs(header[1]!, header[2]!, header[3]!, header[4]!);
    const cueEndMs = clockToMs(header[5]!, header[6]!, header[7]!, header[8]!);
    const textLines = lines
      .slice(headerIndex + 1)
      .filter((line) => line.trim().length > 0);

    if (hasInline) {
      const tagged = textLines.find((line) => INLINE_TS.test(line));
      if (!tagged) continue; // plain carry-over or 10ms transition cue
      words.push(...extractInlineWords(tagged, cueStartMs, cueEndMs));
    } else {
      const text = decodeEntities(stripTags(textLines.join(" ")))
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > 0 && text !== lastCueText) {
        words.push({ word: text, startMs: cueStartMs, endMs: cueEndMs });
        lastCueText = text;
      }
    }
  }

  return words;
}
