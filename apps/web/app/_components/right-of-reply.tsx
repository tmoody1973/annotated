"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { formatRelativeTime } from "@annotated/shared";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

/**
 * The seat reserved for whoever owns the clipped source.
 *
 * It appears only once someone has actually challenged the clip. Empty boxes on
 * every quiet page would read as an unfinished product; appearing on challenge
 * makes the promise concrete at the moment it means something — the instant a
 * clip is contested, its subject's place in the thread exists, is visible, and
 * sits above the challenge rather than below it.
 *
 * Standing, not veto. The response occupies this position and does nothing else:
 * it cannot hide, delete, de-rank, or outrank the criticism it answers. That is
 * the whole deal, and it is worth being able to see before anybody has used it.
 */
export function RightOfReply({ annotationId }: { annotationId: string }) {
  const id = annotationId as Id<"annotations">;
  const slot = useQuery(api.comments.rightOfReply, { annotationId: id });

  if (!slot?.show) return null;

  return (
    <section
      aria-label="Right of reply"
      className="mt-6 border-[3px] border-[color:var(--b-acid)] bg-[color:var(--b-card)] shadow-[6px_6px_0_0_var(--b-shadow)]"
    >
      <p className="border-b-[3px] border-[color:var(--b-acid)] bg-[color:var(--b-acid)] px-4 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--b-acid-ink)]">
        {slot.response ? "Response from the source" : "Right of reply — reserved"}
      </p>

      <div className="p-4">
        {slot.response ? (
          <>
            <p className="text-[15px] leading-relaxed text-[color:var(--b-ink)]">
              {slot.response.text}
            </p>
            <p className="mt-2 font-mono text-[11px] text-[color:var(--b-dim)]">
              {slot.sourceTitle} · {formatRelativeTime(slot.response.createdAt)}
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-[color:var(--b-ink)]">
              This clip has been challenged. The place to answer belongs to
              whoever published{" "}
              <strong>{slot.sourceTitle ?? "the original"}</strong> — it stays
              open whether or not they use it.
            </p>
            <ClaimSource />
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Claiming is a waitlist, not a verification flow, and says so. Anything that
 * let someone assert ownership without proving it would make the label worse
 * than useless — a badge anyone can pick is a lie with a border around it.
 */
function ClaimSource() {
  const join = useMutation(api.publishers.submitWaitlist);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  if (state === "done") {
    return (
      <p className="mt-3 font-mono text-[12px] text-[color:var(--b-dim)]">
        Thanks — we&rsquo;ll be in touch to verify you own this source.
      </p>
    );
  }

  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (state === "sending" || email.trim().length === 0) return;
        setState("sending");
        try {
          await join({ email: email.trim() });
          setState("done");
        } catch {
          setState("error");
        }
      }}
    >
      <label htmlFor="claim-source-email" className="sr-only">
        Your email
      </label>
      <input
        id="claim-source-email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@yourpublication.com"
        className="min-w-0 flex-1 border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-3 py-2 text-[14px] text-[color:var(--b-ink)] outline-none placeholder:text-[color:var(--b-dim)] focus:border-[color:var(--b-acid)]"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-4 py-2 font-mono text-[11px] font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] disabled:opacity-50"
      >
        {state === "sending" ? "…" : "Is this you?"}
      </button>
      {state === "error" && (
        <p role="alert" className="w-full font-mono text-[12px] text-[color:var(--b-dim)]">
          That didn&rsquo;t send. Try again?
        </p>
      )}
    </form>
  );
}
