"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";
import type { Id } from "@annotated/backend/convex/_generated/dataModel";

const fieldClass =
  "w-full border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-3 py-2 text-sm text-[color:var(--b-ink)] outline-none focus:border-[color:var(--b-acid)] disabled:opacity-60";

type Status = "idle" | "submitting" | "success" | "error";

type Category =
  | "misleading_excerpt"
  | "missing_context"
  | "wrong_attribution"
  | "harassment"
  | "spam"
  | "other";

/** Order matters: the two reasons a clip most often goes wrong come first. */
const CATEGORIES: { value: Category; label: string }[] = [
  { value: "misleading_excerpt", label: "The clip is misleading" },
  { value: "missing_context", label: "Important context is missing" },
  { value: "wrong_attribution", label: "Wrong person or source credited" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
];

/**
 * The conduct/context report path. Deliberately separate from "File a claim",
 * which is a rights assertion: reporting a misleading excerpt should not
 * require asserting copyright, and should not require identifying yourself.
 */
export function ReportButton({ annotationId }: { annotationId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("misleading_excerpt");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const submitReport = useMutation(api.reports.submit);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      await submitReport({
        annotationId: annotationId as Id<"annotations">,
        category,
        details,
        ...(email.trim() ? { reporterEmail: email } : {}),
      });
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Couldn't send your report. Check your details and try again.");
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
        Report a problem
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]"
        >
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-dim)]">
            Report a problem with this clip
          </p>

          {status === "success" ? (
            <p className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-3 py-2 text-sm font-semibold text-[color:var(--b-acid-ink)]">
              Thanks — your report was sent. A person reads every one.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-dim)]">
                  What&apos;s wrong?
                </span>
                <select
                  className={fieldClass}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  disabled={status === "submitting"}
                >
                  {CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                className={fieldClass}
                rows={3}
                placeholder="What should we know? Be specific — what was left out, or who was misquoted."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                disabled={status === "submitting"}
                required
              />
              <input
                className={fieldClass}
                type="email"
                placeholder="Your email (optional — only if you want a reply)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "submitting"}
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
                {status === "submitting" ? "Sending…" : "Send report"}
              </button>
              <p className="font-mono text-[11px] text-[color:var(--b-dim)]">
                Copyright or rights issue? Use “File a claim” instead.
              </p>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
