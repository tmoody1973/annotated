"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { api } from "@annotated/backend/convex/_generated/api";

const BIO_MAX = 280;

const fieldLabel =
  "font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-dim-onbg)]";
const inputClass =
  "w-full border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] p-3 text-[color:var(--b-ink)] shadow-[3px_3px_0_0_var(--b-shadow)] outline-none placeholder:text-[color:var(--b-dim)] focus:border-[color:var(--b-acid)]";

/** Edits the fields Annotated owns — bio + social links. Account basics (name,
 *  photo, email) stay in Clerk's account menu. Prefilled from the current user;
 *  empty fields clear on save. */
export function SettingsForm() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");
  const update = useMutation(api.users.updateProfile);

  const [bio, setBio] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [website, setWebsite] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me && !seeded) {
      setBio(me.bio ?? "");
      setXHandle(me.xHandle ?? "");
      setWebsite(me.website ?? "");
      setSeeded(true);
    }
  }, [me, seeded]);

  if (isLoading || (isAuthenticated && me === undefined)) {
    return <p className="mt-8 font-mono text-sm text-[color:var(--b-dim-onbg)]">Loading…</p>;
  }

  if (!isAuthenticated) {
    return (
      <p className="mt-8 text-sm text-[color:var(--b-dim-onbg)]">
        <SignInButton mode="modal">
          <button className="font-bold text-[color:var(--b-onbg)] underline decoration-[color:var(--b-acid)] decoration-2 underline-offset-2">
            Sign in
          </button>
        </SignInButton>{" "}
        to edit your profile.
      </p>
    );
  }

  async function onSave(): Promise<void> {
    setStatus("saving");
    setError(null);
    try {
      await update({ bio, xHandle, website });
      setStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStatus("error");
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>Bio</span>
        <textarea
          className={`${inputClass} min-h-28`}
          value={bio}
          maxLength={BIO_MAX}
          placeholder="A line about you and what you clip…"
          onChange={(e) => {
            setBio(e.target.value);
            setStatus("idle");
          }}
        />
        <span className="self-end font-mono text-[11px] text-[color:var(--b-dim-onbg)]">
          {bio.length}/{BIO_MAX}
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>X / Twitter</span>
        <input
          className={inputClass}
          value={xHandle}
          placeholder="@handle"
          onChange={(e) => {
            setXHandle(e.target.value);
            setStatus("idle");
          }}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={fieldLabel}>Website</span>
        <input
          className={inputClass}
          value={website}
          placeholder="yoursite.com"
          inputMode="url"
          onChange={(e) => {
            setWebsite(e.target.value);
            setStatus("idle");
          }}
        />
      </label>

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={status === "saving"}
          onClick={() => void onSave()}
          className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-6 py-2.5 text-sm font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--b-shadow)] disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {status === "saved" && (
          <span className="font-mono text-[13px] font-bold text-[color:var(--b-onbg)]">Saved ✓</span>
        )}
        {status === "error" && (
          <span className="font-mono text-[13px] font-bold text-[#ff3b30]">{error}</span>
        )}
      </div>
    </div>
  );
}
