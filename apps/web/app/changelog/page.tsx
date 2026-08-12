import type { Metadata } from "next";
import { AppShell } from "../_components/app-shell";
import { CHANGELOG } from "../../content/changelog";
import { ChangelogList } from "./changelog-list";

export const metadata: Metadata = {
  title: "Changelog — Annotated",
  description:
    "What's changed in Annotated, in plain English — no jargon, no invented metrics, and the limits stated plainly when there are any.",
};

const sectionLabel =
  "flex items-center gap-3 font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-[color:var(--b-dim-onbg)] before:h-px before:w-7 before:bg-[color:var(--b-acid)] before:content-['']";

export default function ChangelogPage() {
  return (
    <AppShell narrow>
      <h1 className="font-display text-3xl leading-none tracking-tight">Changelog</h1>
      <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em] text-[color:var(--b-dim-onbg)]">
        What&rsquo;s actually changed, in plain English
      </p>

      <div className="mt-6 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
        <p className="text-[15px] leading-relaxed">
          Updated when we ship, not on a schedule. Every release below is real and already
          live — check back for what changed.
        </p>
      </div>

      <p className={`${sectionLabel} mt-9 mb-4`}>Releases</p>

      <ChangelogList releases={CHANGELOG} />
    </AppShell>
  );
}
