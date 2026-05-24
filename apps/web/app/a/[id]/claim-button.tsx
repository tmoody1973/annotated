"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

const fieldClass =
  "w-full border-2 border-[#111] bg-white px-3 py-2 text-sm outline-none focus:bg-[#fffce0] disabled:opacity-60";

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
        className="border-[3px] border-[#111] bg-[#ff5c00] px-5 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow-[5px_5px_0_0_#111] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_0_#111]"
      >
        File a claim
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 border-[3px] border-[#111] bg-white p-5 shadow-[5px_5px_0_0_#111]"
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#555]">
            Report a fair-use issue with this clip
          </p>

          {status === "success" ? (
            <p className="border-2 border-[#111] bg-[#ffe600] px-3 py-2 text-sm font-bold">
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
                <p className="border-2 border-[#111] bg-[#ff5c00] px-3 py-2 text-sm font-bold text-white">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={status === "submitting"}
                className="self-start border-[3px] border-[#111] bg-[#111] px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#333] disabled:opacity-60"
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
