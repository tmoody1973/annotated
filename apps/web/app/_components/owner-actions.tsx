"use client";

/**
 * Delete (and, briefly, edit) for the person who published a clip.
 *
 * Renders nothing for anyone else — ownership is answered by the server via
 * `annotations.ownerActions`, not by shipping the author id to every client for
 * the UI to compare, because an annotation can be published anonymously.
 *
 * Delete is confirmed rather than instant. It is the one action here that a
 * reader can notice from the outside, so it gets a beat.
 */
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

export function OwnerActions({
  annotationId,
  currentTake,
  onRemoved,
}: {
  annotationId: string;
  currentTake: string;
  /** Called after a successful removal so the surface can stop rendering it. */
  onRemoved?: () => void;
}) {
  const id = annotationId as Id<"annotations">;
  const actions = useQuery(api.annotations.ownerActions, { annotationId: id });
  const remove = useMutation(api.annotations.remove);
  const updateTake = useMutation(api.annotations.updateTake);

  const [mode, setMode] = useState<"idle" | "confirming" | "editing" | "working">("idle");
  const [draft, setDraft] = useState(currentTake);
  const [error, setError] = useState<string | null>(null);

  if (!actions?.isOwner) return null;

  const onDelete = async (): Promise<void> => {
    setMode("working");
    setError(null);
    try {
      await remove({ annotationId: id });
      onRemoved?.();
    } catch (cause: unknown) {
      setMode("confirming");
      setError(cause instanceof Error ? cause.message : "That didn't work.");
    }
  };

  const onSave = async (): Promise<void> => {
    setMode("working");
    setError(null);
    try {
      const result = await updateTake({ annotationId: id, takeText: draft });
      if (!result.updated) {
        setError(result.reason ?? "That didn't work.");
        setMode("editing");
        return;
      }
      setMode("idle");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "That didn't work.");
      setMode("editing");
    }
  };

  if (mode === "editing") {
    return (
      <div className="mt-3 border-2 border-[color:var(--b-line)] p-3">
        <label
          htmlFor={`take-${annotationId}`}
          className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-[color:var(--b-dim)]"
        >
          Your take
        </label>
        <textarea
          id={`take-${annotationId}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          className="mt-1 w-full border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] p-2 text-[14px] text-[color:var(--b-ink)]"
        />
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => void onSave()} className={primaryButton}>
            Save
          </button>
          <button type="button" onClick={() => setMode("idle")} className={quietButton}>
            Cancel
          </button>
        </div>
        {error ? <Problem>{error}</Problem> : null}
      </div>
    );
  }

  if (mode === "confirming" || mode === "working") {
    return (
      <div className="mt-3 border-2 border-[color:var(--b-line)] p-3">
        <p className="text-[13px] text-[color:var(--b-ink)]">
          Remove this clip? The page keeps working for anyone who already has the
          link — it will say you removed it.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={mode === "working"}
            className={primaryButton}
          >
            {mode === "working" ? "Removing…" : "Remove it"}
          </button>
          <button type="button" onClick={() => setMode("idle")} className={quietButton}>
            Keep it
          </button>
        </div>
        {error ? <Problem>{error}</Problem> : null}
      </div>
    );
  }

  return (
    <div className="mt-3 flex gap-3 text-[12px] font-bold">
      {actions.canEditTake ? (
        <button
          type="button"
          onClick={() => {
            setDraft(currentTake);
            setMode("editing");
          }}
          className="underline underline-offset-[3px]"
        >
          Edit take
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setMode("confirming")}
        className="underline underline-offset-[3px]"
      >
        Remove
      </button>
    </div>
  );
}

const primaryButton =
  "border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-[color:var(--b-acid-ink)] disabled:opacity-60";
const quietButton =
  "border-2 border-[color:var(--b-line)] px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em]";

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-2 text-[13px] text-[color:var(--b-dim)]">
      {children}
    </p>
  );
}
