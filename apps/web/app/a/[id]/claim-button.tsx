"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

const fieldClass =
  "w-full border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-3 py-2 text-sm text-[color:var(--b-ink)] outline-none focus:border-[color:var(--b-acid)] disabled:opacity-60";

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
        className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-[color:var(--b-ink)] shadow-[5px_5px_0_0_var(--b-shadow)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[color:var(--b-acid)] hover:shadow-[2px_2px_0_0_var(--b-shadow)]"
      >
        File a claim
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]"
        >
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-dim)]">
            Report a fair-use issue with this clip
          </p>

          {status === "success" ? (
            <p className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-3 py-2 text-sm font-semibold text-[color:var(--b-acid-ink)]">
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
                <p className="border-2 border-[#ff3b30] bg-[#ff3b3014] px-3 py-2 text-sm font-semibold text-[#ff3b30]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={status === "submitting"}
                className="self-start border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--b-shadow)] disabled:opacity-60"
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
