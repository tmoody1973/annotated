/**
 * What a reply says it is doing.
 *
 * The label is always words, never a colour or an icon alone — a reader who
 * cannot see the colour still has to be able to tell a counterpoint from a
 * question, and it is the difference the whole thread design rests on.
 *
 * `source_response` is not here on purpose: it is not something a person may
 * choose. It is placed through the right-of-reply slot, which is the only way
 * a reply can present itself as coming from the clip's source.
 */
export const REPLY_INTENTS = [
  {
    value: "context",
    label: "Add context",
    hint: "Something a reader is missing",
  },
  {
    value: "challenge",
    label: "Challenge with a source",
    hint: "Disagree, and show why",
  },
  {
    value: "support",
    label: "Support with a source",
    hint: "Back it up with evidence",
  },
  {
    value: "question",
    label: "Ask a question",
    hint: "No source needed",
  },
] as const;

export type ReplyIntent = (typeof REPLY_INTENTS)[number]["value"];

/** Intents that assert a source, so a missing receipt is worth flagging. */
export const CLAIMS_A_SOURCE: readonly string[] = ["challenge", "support"];

const LABELS: Record<string, string> = {
  ...Object.fromEntries(REPLY_INTENTS.map((i) => [i.value, i.label])),
  source_response: "Response from the source",
};

const chip =
  "inline-block border-2 border-[color:var(--b-line)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]";

/**
 * The intent shown on a posted reply. Renders nothing for a reply written
 * before intents existed — those are left exactly as they were rather than
 * being relabelled into a category their author never picked.
 */
export function IntentTag({
  intent,
  unsourced,
}: {
  intent: string | null;
  unsourced: boolean;
}) {
  if (!intent) return null;
  const isResponse = intent === "source_response";
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      <span
        className={`${chip} ${
          isResponse
            ? "bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)]"
            : "text-[color:var(--b-dim)]"
        }`}
      >
        {LABELS[intent] ?? intent}
      </span>
      {unsourced && (
        // Said plainly rather than hidden. The reply is allowed to exist; the
        // reader is just told it arrived without the source it implied.
        <span
          className={`${chip} border-dashed text-[color:var(--b-dim)]`}
          title="This reply claims a source but none was attached"
        >
          Unsourced
        </span>
      )}
    </span>
  );
}
