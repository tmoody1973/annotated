import type { Release } from "../../content/changelog";

function formatReleaseDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Reverse-chronological release list. Callers pass releases already sorted newest-first. */
export function ChangelogList({ releases }: { releases: Release[] }) {
  return (
    <ol className="flex flex-col gap-6">
      {releases.map((release) => (
        <li
          key={release.version}
          className="border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-card)] p-5 text-[color:var(--b-ink)] shadow-[6px_6px_0_0_var(--b-shadow)]"
        >
          <div className="flex flex-wrap items-center gap-3">
            <time
              dateTime={release.date}
              className="font-mono text-[12px] uppercase tracking-[0.1em] text-[color:var(--b-dim)]"
            >
              {formatReleaseDate(release.date)}
            </time>
            <span className="border-2 border-[color:var(--b-line)] bg-[color:var(--b-chrome)] px-2 py-0.5 font-mono text-[11px] font-bold text-[color:var(--b-acid)]">
              {release.version}
            </span>
          </div>

          <h2 className="mt-2 font-display text-xl tracking-tight">{release.title}</h2>
          <p className="mt-2 text-[15px] leading-relaxed">{release.lead}</p>

          {release.changes.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {release.changes.map((change) => (
                <li
                  key={change}
                  className="relative pl-5 text-[14px] leading-relaxed before:absolute before:left-0 before:font-bold before:text-[color:var(--b-ink)] before:content-['›']"
                >
                  {change}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
