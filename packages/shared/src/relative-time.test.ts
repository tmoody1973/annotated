import { describe, expect, test } from "vitest";
import { formatRelativeTime } from "./relative-time";

const NOW = Date.UTC(2026, 4, 26, 18, 0, 0); // 2026-05-26T18:00:00Z
const ago = (ms: number) => NOW - ms;
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  test("under a minute reads 'now'", () => {
    expect(formatRelativeTime(ago(5 * SEC), NOW)).toBe("now");
    expect(formatRelativeTime(NOW, NOW)).toBe("now");
  });

  test("minutes, hours, days are compact", () => {
    expect(formatRelativeTime(ago(5 * MIN), NOW)).toBe("5m");
    expect(formatRelativeTime(ago(3 * HOUR), NOW)).toBe("3h");
    expect(formatRelativeTime(ago(2 * DAY), NOW)).toBe("2d");
    expect(formatRelativeTime(ago(6 * DAY), NOW)).toBe("6d");
  });

  test("a week or older shows an absolute month/day (same year)", () => {
    expect(formatRelativeTime(Date.UTC(2026, 4, 10), NOW)).toBe("May 10");
  });

  test("a different year includes the year", () => {
    expect(formatRelativeTime(Date.UTC(2024, 11, 31), NOW)).toBe("Dec 31, 2024");
  });

  test("a future timestamp is clamped to 'now' (clock skew)", () => {
    expect(formatRelativeTime(NOW + 5 * MIN, NOW)).toBe("now");
  });
});
