"use client";

import { useState } from "react";

const fieldClass =
  "w-full border-2 border-[#111] bg-white px-3 py-2 text-sm outline-none focus:bg-[#fffce0]";

/**
 * The SPEC-required "File a claim" button. Visible on every annotation page;
 * opens a fair-use dispute form. Submission (persisting the claim + emailing
 * the owner) is wired in Step 10 — for now it acknowledges without losing data
 * silently.
 */
export function ClaimButton() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="mt-4 border-[3px] border-[#111] bg-white p-5 shadow-[5px_5px_0_0_#111]"
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#555]">
            Report a fair-use issue with this clip
          </p>
          <div className="flex flex-col gap-3">
            <input className={fieldClass} placeholder="Your name" required />
            <input className={fieldClass} type="email" placeholder="Your email" required />
            <textarea className={fieldClass} rows={3} placeholder="What's the issue?" required />
            {submitted ? (
              <p className="border-2 border-[#111] bg-[#ffe600] px-3 py-2 text-sm font-bold">
                Thanks — claim handling goes live in the next build step.
              </p>
            ) : (
              <button
                type="submit"
                className="self-start border-[3px] border-[#111] bg-[#111] px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#333]"
              >
                Submit claim
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
