import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { SiteHeader } from "../_components/site-header";
import { AddTakeButton } from "./add-take-button";
import { clipPath } from "../_lib/urls";

const CAMPAIGN = "2026";

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

const listPublished = makeFunctionReference<
  "query",
  { campaign: string },
  RecordRow[]
>("recordEntries:listPublished");

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
  "Election dates link to the state authority, never a summary of one.",
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

export const metadata = {
  title: "The 2026 Record — Annotated",
  description:
    "A running record of verified public sources for the 2026 Wisconsin election. The record is kept by machine; the meaning is supplied by people.",
};

export const revalidate = 60;

export default async function RecordPage() {
  const rows = await fetchRecord();

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-[900px] px-6 py-8">
        <header className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-6 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--b-dim)]">
            The Record · Wisconsin · 3 November 2026
          </p>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">
            THE 2026 RECORD
          </h1>
          <p className="mt-3 max-w-[62ch] text-[15px] font-semibold leading-snug">
            Each row below is a public document — what it is, which body decides
            it, where it stands, and when we last checked. The record is the
            evidence. The take is the point, and the take is yours.
          </p>
        </header>

        <section className="mt-8">
          <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--b-dim-onbg)]">
            {rows.length > 0 ? `${rows.length} entries on the record` : "The record"}
          </h2>

          {rows.length === 0 ? (
            <p className="border-[3px] border-dashed border-[color:var(--b-line)] p-6 text-[15px] font-semibold text-[color:var(--b-dim-onbg)]">
              Nothing has been published to the record yet. Entries appear here
              only after a person has reviewed them.
            </p>
          ) : (
            <ol className="flex flex-col gap-5">
              {rows.map((row) => (
                <li
                  key={row._id}
                  className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]"
                >
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-dim)]">
                    {row.jurisdiction} · {row.body}
                  </p>

                  <h3 className="mt-2 font-display text-2xl leading-tight">
                    {row.question}
                  </h3>

                  {/* Status is words, never colour alone. */}
                  <p className="mt-3 inline-block border-2 border-[color:var(--b-line)] px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
                    {row.statusLabel}
                  </p>

                  <p className="mt-3 border-l-4 border-[color:var(--b-line)] pl-3 text-[14px] font-semibold italic leading-snug">
                    {row.selectionNote}
                  </p>

                  <dl className="mt-4 flex flex-col gap-1 font-mono text-[11px] text-[color:var(--b-dim)]">
                    <div className="flex gap-2">
                      <dt className="font-bold uppercase tracking-[0.12em]">Source</dt>
                      <dd>
                        {row.source.url ? (
                          <a
                            href={row.source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2 hover:text-[color:var(--b-ink)]"
                          >
                            {row.source.title}
                            {row.source.siteName ? ` — ${row.source.siteName}` : ""} ↗
                          </a>
                        ) : (
                          row.source.title
                        )}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-bold uppercase tracking-[0.12em]">Retrieved</dt>
                      <dd>{formatDate(row.retrievedAt)}</dd>
                    </div>
                    {row.nextDateLabel && (
                      <div className="flex gap-2">
                        <dt className="font-bold uppercase tracking-[0.12em]">Next</dt>
                        <dd>
                          {row.nextDateLabel}
                          {row.nextDateAt ? ` · ${formatDate(row.nextDateAt)}` : ""}
                        </dd>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <dt className="font-bold uppercase tracking-[0.12em]">On the record by</dt>
                      <dd>
                        {row.byline}
                        {row.curatedBy === "agent" ? " (machine-drafted, human-reviewed)" : ""}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 border-t-2 border-dashed border-[color:var(--b-line)] pt-4">
                    {row.takeCount === 0 ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-dim)]">
                          Needs a take
                        </span>
                        {row.source.url && <AddTakeButton sourceUrl={row.source.url} />}
                      </div>
                    ) : (
                      <>
                        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--b-dim)]">
                          {row.takeCount} {row.takeCount === 1 ? "take" : "takes"}
                        </p>
                        <ul className="mt-2 flex flex-col gap-2">
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
                        {row.source.url && (
                          <div className="mt-3">
                            <AddTakeButton sourceUrl={row.source.url} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-10 border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--b-dim)]">
            How things get on the record
          </h2>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[14px] font-semibold leading-snug">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] font-semibold leading-snug text-[color:var(--b-dim)]">
            Entries are selected and reviewed by a person before they appear.
            Takes belong to whoever wrote them, not to Annotated.
          </p>
        </section>

        <footer className="mt-8 text-center font-mono text-xs text-[color:var(--b-dim-onbg)]">
          annotated.com
        </footer>
      </div>
    </main>
  );
}
