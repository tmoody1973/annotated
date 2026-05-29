"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@annotated/backend/convex/_generated/api";

/** Publisher-accounts waitlist signup. Persists the email via Convex; shows a
 *  brutalist confirm on success. Used twice on /publishers (hero + final CTA). */
export function WaitlistForm({
  placeholder = "you@newsroom.com",
  submitLabel = "Notify me",
  align = "left",
}: {
  placeholder?: string;
  submitLabel?: string;
  align?: "left" | "center";
}) {
  const submit = useMutation(api.publishers.submitWaitlist);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "done") {
    return (
      <p
        className={`flex items-center gap-2 font-mono text-[14px] font-bold text-[color:var(--b-onbg)] ${
          align === "center" ? "justify-center" : ""
        }`}
      >
        ✓ You&rsquo;re on the list. We&rsquo;ll reach out before launch.
      </p>
    );
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setState("submitting");
        setError(null);
        try {
          await submit({ email });
          setState("done");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong");
          setState("error");
        }
      }}
      className={`flex w-full max-w-md flex-wrap gap-3 ${align === "center" ? "mx-auto justify-center" : ""}`}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state === "error") setState("idle");
        }}
        placeholder={placeholder}
        aria-label="Work email"
        className="min-w-[220px] flex-1 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] px-4 py-3 text-[color:var(--b-ink)] shadow-[3px_3px_0_0_var(--b-shadow)] outline-none placeholder:text-[color:var(--b-dim)] focus:border-[color:var(--b-acid)]"
      />
      <button
        type="submit"
        disabled={state === "submitting"}
        className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-6 py-3 text-sm font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--b-shadow)] disabled:opacity-50"
      >
        {state === "submitting" ? "Sending…" : `${submitLabel} →`}
      </button>
      {state === "error" && (
        <p className="w-full font-mono text-[12px] font-bold text-[#ff3b30]">{error}</p>
      )}
    </form>
  );
}
