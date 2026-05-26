"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

const fieldClass =
  "w-full rounded-[7px] border border-[color:var(--calm-hair)] bg-[color:var(--calm-panel)] px-3 py-2 text-sm text-[color:var(--calm-ink)] outline-none focus:border-[color:var(--calm-accent)] disabled:opacity-60";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * The SPEC-required "File a claim" button. Visible on every annotation page;
 * opens a fair-use dispute form. Submitting persists a claim (public, no auth)
 * and schedules an email to the site owner via Resend.
 */
export function ClaimButton({ annotationId }: { annotationId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const submitClaim = useMutation(api.claims.submit);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      await submitClaim({
        annotationId: annotationId as Id<"annotations">,
        claimantName: name,
        claimantEmail: email,
        reason,
      });
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Couldn't file your claim. Check your details and try again.");
    }
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-[7px] border border-[color:var(--calm-hair)] bg-[color:var(--calm-panel)] px-4 py-2 text-sm font-medium text-[color:var(--calm-ink-2)] hover:bg-[color:var(--calm-surface)]"
      >
        File a claim
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-[10px] border border-[color:var(--calm-hair)] bg-[color:var(--calm-panel)] p-5 shadow-[0_1px_2px_rgba(27,26,23,0.06),0_18px_40px_-26px_rgba(27,26,23,0.22)]"
        >
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[color:var(--calm-ink-3)]">
            Report a fair-use issue with this clip
          </p>

          {status === "success" ? (
            <p className="rounded-[7px] border border-[color:var(--calm-accent)] bg-[color:var(--calm-accent-tint)] px-3 py-2 text-sm text-[color:var(--calm-ink)]">
              Thanks — your claim was filed. We&apos;ll review it and follow up by email.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                className={fieldClass}
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={status === "submitting"}
                required
              />
              <input
                className={fieldClass}
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "submitting"}
                required
              />
              <textarea
                className={fieldClass}
                rows={3}
                placeholder="What's the issue?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={status === "submitting"}
                required
              />
              {status === "error" && (
                <p className="rounded-[7px] border border-[#9a3b2f] bg-[#9a3b2f12] px-3 py-2 text-sm text-[#9a3b2f]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={status === "submitting"}
                className="self-start rounded-[7px] bg-[color:var(--calm-ink)] px-4 py-2 text-sm font-medium text-[color:var(--calm-panel)] hover:bg-black disabled:opacity-60"
              >
                {status === "submitting" ? "Filing…" : "Submit claim"}
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
