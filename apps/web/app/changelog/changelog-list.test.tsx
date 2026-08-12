import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Release } from "../../content/changelog";
import { ChangelogList } from "./changelog-list";

const RELEASES: Release[] = [
  {
    version: "v0.2.0",
    date: "2026-08-12",
    title: "Newer release",
    lead: "Newer lead.",
    changes: ["Newer bullet"],
  },
  {
    version: "v0.1.0",
    date: "2026-05-29",
    title: "Older release, no bullets yet",
    lead: "Older lead.",
    changes: [],
  },
];

describe("ChangelogList", () => {
  it("renders releases in the order given (newest-first is the caller's responsibility)", () => {
    const { container } = render(<ChangelogList releases={RELEASES} />);
    const headings = Array.from(container.querySelectorAll("h2")).map((el) => el.textContent);
    expect(headings).toEqual(["Newer release", "Older release, no bullets yet"]);
  });

  it("still renders a release with no bullets", () => {
    const { container } = render(<ChangelogList releases={RELEASES} />);
    const scoped = within(container);
    expect(scoped.getByText("Older release, no bullets yet")).toBeTruthy();
    expect(scoped.getByText("Older lead.")).toBeTruthy();
    expect(scoped.getByText("Newer bullet")).toBeTruthy();
  });

  it("formats the ISO date for display and keeps it machine-readable", () => {
    const { container } = render(<ChangelogList releases={RELEASES} />);
    const time = container.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe("2026-08-12");
    expect(time?.textContent).toBe("Wednesday, August 12, 2026");
  });
});
