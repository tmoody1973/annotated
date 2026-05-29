import Link from "next/link";
import { AppShell } from "./_components/app-shell";

/** Branded 404 — rendered inside the app shell so a missing clip/profile/page
 *  still feels like the app, with a way back to the feed. */
export default function NotFound() {
  return (
    <AppShell narrow>
      <div className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-8 text-center text-[color:var(--b-ink)] shadow-[8px_8px_0_0_var(--b-shadow)]">
        <p className="font-display text-7xl leading-none tracking-tight">404</p>
        <p className="mt-4 text-[18px] font-extrabold">This page could not be found.</p>
        <p className="mt-1 font-mono text-[13px] text-[color:var(--b-dim)]">
          The clip or page you&rsquo;re looking for isn&rsquo;t here.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block border-2 border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-5 py-2.5 text-sm font-black uppercase tracking-wide text-[color:var(--b-acid-ink)] shadow-[4px_4px_0_0_var(--b-shadow)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--b-shadow)]"
        >
          ← Back to the feed
        </Link>
      </div>
    </AppShell>
  );
}
