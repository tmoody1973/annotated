import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { AppShell } from "../_components/app-shell";
import { AddTakeButton, CAMPAIGN_TOPIC_SLUG } from "./add-take-button";
import { clipPath } from "../_lib/urls";

const CAMPAIGN = "2026";
/** Wisconsin votes 3 November 2026. Source: elections.wi.gov/calendar. */
const ELECTION_DAY = Date.UTC(2026, 10, 3);

interface TakePreview {
  _id: string;
  takeText: string | null;
  authorName: string;
  authorUsername: string | null;
}

interface RecordRow {
  _id: string;
  jurisdiction: string;
  body: string;
  question: string;
  status: string;
  statusLabel: string;
  retrievedAt: number;
  selectionNote: string;
  nextDateAt?: number;
  nextDateLabel?: string;
  curatedBy: "agent" | "editor";
  byline: string;
  source: { _id: string; title: string; url: string | null; siteName: string | null };
  takeCount: number;
  takes: TakePreview[];
}

const listPublished = makeFunctionReference<"query", { campaign: string }, RecordRow[]>(
  "recordEntries:listPublished"
);

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

async function fetchRecord(): Promise<RecordRow[]> {
  if (!convexUrl) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL");
  try {
    const client = new ConvexHttpClient(convexUrl);
    return await client.query(listPublished, { campaign: CAMPAIGN });
  } catch {
    return [];
  }
}

/** Published on the page so selection can be argued with rather than guessed at. */
const RULES = [
  "No endorsement, no scorecard, no advice on how to vote, no predictions.",
  "Every claim carries its document and the date it was retrieved.",
  "Preliminary results stay labelled preliminary until a body certifies them.",
  "Election dates come from the state authority, never a summary of one.",
  "Interpretation is visibly separate from the source.",
  "Anyone named can respond, and a response cannot delete the criticism it answers.",
];

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function daysUntilElection(): number {
  const today = new Date();
  const midnightUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  return Math.max(0, Math.round((ELECTION_DAY - midnightUtc) / 86_400_000));
}

export const metadata = {
  title: "The 2026 Record — Annotated",
  description:
    "A running record of verified public sources for the 2026 Wisconsin election. The record is kept by machine; the meaning is supplied by people.",
};

export const revalidate = 60;

export default async function RecordPage() {
  const rows = await fetchRecord();
  const days = daysUntilElection();
  const takeTotal = rows.reduce((sum, row) => sum + row.takeCount, 0);
  const openRows = rows.filter((row) => row.takeCount === 0).length;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1000px]">
        {/* Masthead. The page's one peak: the record announces itself, and the
            countdown is the only thing on the page that changes on its own. */}
        <header className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] text-[color:var(--b-acid-ink)] shadow-[10px_10px_0_0_var(--b-shadow)]">
          <div className="flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-[clamp(2.75rem,10vw,5.5rem)] leading-[0.86] tracking-[-0.03em]">
                THE 2026
                <br />
                RECORD
              </h1>
              <p className="mt-4 max-w-[46ch] text-[15px] font-bold leading-snug sm:text-base">
                Every row is a public document — what it is, which body decides
                it, where it stands, and when we last checked. The record is the
                evidence. The take is the point, and the take is yours.
              </p>
            </div>

            <div className="shrink-0 self-start border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-line)] px-5 py-4 text-[color:var(--b-acid)] md:self-end">
              <p className="font-display text-[clamp(2.5rem,9vw,4rem)] leading-none tracking-[-0.03em] tabular-nums">
                {days}
              </p>
              <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em]">
                {days === 1 ? "day to the vote" : "days to the vote"}
              </p>
              <p className="mt-2 font-mono text-[11px] tracking-[0.08em] opacity-80">
                Wisconsin · 3 Nov 2026
              </p>
            </div>
          </div>

          <dl className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t-[3px] border-[color:var(--b-line)] px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] sm:px-8">
            <div className="flex gap-2">
              <dt>Entries</dt>
              <dd className="tabular-nums">{rows.length}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Takes</dt>
              <dd className="tabular-nums">{takeTotal}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Waiting for one</dt>
              <dd className="tabular-nums">{openRows}</dd>
            </div>
          </dl>
        </header>

        {/* The record holds the evidence; the room holds the arguments. Both
            addresses matter, so the page names the other one. */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={`/topics/${CAMPAIGN_TOPIC_SLUG}`}
            className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-card)] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--b-ink)] hover:bg-[color:var(--b-acid)]"
          >
            #Wisconsin 2026
          </Link>
          <span className="font-mono text-[11px] text-[color:var(--b-dim-onbg)]">
            every take written here lands in that room
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="mt-8 border-[3px] border-dashed border-[color:var(--b-line)] p-6 text-[15px] font-semibold text-[color:var(--b-dim-onbg)]">
            Nothing has been published to the record yet. Entries appear here
            only after a person has reviewed them.
          </p>
        ) : (
          <ol className="mt-8 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] text-[color:var(--b-ink)] shadow-[10px_10px_0_0_var(--b-shadow)]">
            {rows.map((row, index) => (
              <li
                key={row._id}
                className="record-row border-t-[3px] border-[color:var(--b-line)] first:border-t-0"
                style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
              >
                <div className="flex flex-col gap-5 p-5 sm:p-7 md:flex-row md:gap-8">
                  {/* Left rail: who decides, and where it stands. */}
                  <div className="flex shrink-0 flex-row flex-wrap items-center gap-3 md:w-[168px] md:flex-col md:items-start md:gap-3">
                    <span className="bg-[color:var(--b-line)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-card)]">
                      {row.statusLabel}
                    </span>
                    <p className="font-mono text-[11px] font-bold uppercase leading-tight tracking-[0.12em] text-[color:var(--b-dim)]">
                      {row.jurisdiction}
                      <span className="block font-normal normal-case tracking-normal">
                        {row.body}
                      </span>
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-[clamp(1.35rem,3.2vw,1.9rem)] leading-[1.05] tracking-[-0.02em]">
                      {row.question}
                    </h2>

                    <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed">
                      {row.selectionNote}
                    </p>

                    <dl className="mt-4 flex flex-col gap-1 font-mono text-[11px] text-[color:var(--b-dim)]">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-bold uppercase tracking-[0.12em]">Source</dt>
                        <dd className="min-w-0">
                          {row.source.url ? (
                            <a
                              href={row.source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline decoration-2 underline-offset-2 hover:bg-[color:var(--b-acid)] hover:text-[color:var(--b-acid-ink)]"
                            >
                              {row.source.title}
                              {row.source.siteName ? ` — ${row.source.siteName}` : ""} ↗
                            </a>
                          ) : (
                            row.source.title
                          )}
                        </dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-bold uppercase tracking-[0.12em]">Checked</dt>
                        <dd className="tabular-nums">{formatDate(row.retrievedAt)}</dd>
                        {row.nextDateLabel && (
                          <>
                            <dt className="ml-4 font-bold uppercase tracking-[0.12em]">
                              Next
                            </dt>
                            <dd className="tabular-nums">
                              {row.nextDateLabel}
                              {row.nextDateAt ? ` · ${formatDate(row.nextDateAt)}` : ""}
                            </dd>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-bold uppercase tracking-[0.12em]">Selected by</dt>
                        <dd>
                          {row.byline}
                          {row.curatedBy === "agent"
                            ? " · machine-drafted, human-reviewed"
                            : ""}
                        </dd>
                      </div>
                    </dl>

                    {row.takeCount > 0 && (
                      <ul className="mt-5 flex flex-col gap-2 border-t-2 border-dotted border-[color:var(--b-line)] pt-4">
                        {row.takes.map((take) => (
                          <li key={take._id}>
                            <Link
                              href={clipPath(row.source.title, take._id)}
                              className="block text-[14px] font-semibold leading-snug hover:bg-[color:var(--b-acid)] hover:text-[color:var(--b-acid-ink)]"
                            >
                              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--b-dim)]">
                                {take.authorUsername
                                  ? `@${take.authorUsername}`
                                  : take.authorName}
                                {" · "}
                              </span>
                              {take.takeText ?? "Listen to the take"}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* The invitation is the loud part. A row nobody has answered is
                    the whole reason the record exists, so it reads as an opening
                    rather than a gap. */}
                {row.source.url && (
                  <div
                    className={
                      row.takeCount === 0
                        ? "flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] px-5 py-3 text-[color:var(--b-acid-ink)] sm:px-7"
                        : "flex flex-wrap items-center justify-between gap-3 border-t-2 border-dotted border-[color:var(--b-line)] px-5 py-3 sm:px-7"
                    }
                  >
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">
                      {row.takeCount === 0
                        ? "No one has answered this yet"
                        : `${row.takeCount} ${row.takeCount === 1 ? "take" : "takes"}`}
                    </p>
                    <AddTakeButton sourceUrl={row.source.url} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        <section className="mt-10 text-[color:var(--b-onbg)]">
          <h2 className="font-display text-2xl leading-none tracking-[-0.02em]">
            How things get on the record
          </h2>
          <ul className="mt-4 flex max-w-[70ch] list-none flex-col gap-2 text-[14px] font-semibold leading-snug">
            {RULES.map((rule) => (
              <li key={rule} className="flex gap-3">
                <span aria-hidden className="font-mono text-[color:var(--b-dim-onbg)]">
                  —
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-[70ch] text-[13px] font-semibold leading-snug text-[color:var(--b-dim-onbg)]">
            A machine may propose an entry; a person publishes it. Takes belong
            to whoever wrote them, not to Annotated.
          </p>
        </section>

        <footer className="mt-10 text-center font-mono text-xs text-[color:var(--b-dim-onbg)]">
          annotated.com
        </footer>
      </div>
    </AppShell>
  );
}
