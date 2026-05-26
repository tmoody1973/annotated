import { describe, expect, test } from "vitest";
import { progressFraction } from "./progress-fraction";

describe("progressFraction", () => {
  test("is 0 before any time elapses", () => {
    expect(progressFraction(0, 30_000)).toBe(0);
  });

  test("rises monotonically toward the cap as elapsed approaches the estimate", () => {
    const quarter = progressFraction(7_500, 30_000);
    const half = progressFraction(15_000, 30_000);
    expect(quarter).toBeGreaterThan(0);
    expect(half).toBeGreaterThan(quarter);
    expect(half).toBeLessThan(1);
  });

  test("caps below 1 at the estimate so it never claims done while processing", () => {
    const atEstimate = progressFraction(30_000, 30_000);
    expect(atEstimate).toBeLessThan(1);
    expect(atEstimate).toBeGreaterThan(0.5);
  });

  test("holds at the cap when elapsed overruns the estimate (honest, no overflow)", () => {
    const atEstimate = progressFraction(30_000, 30_000);
    const wayOver = progressFraction(120_000, 30_000);
    expect(wayOver).toBe(atEstimate);
    expect(wayOver).toBeLessThan(1);
  });

  test("guards against a non-positive estimate and negative elapsed", () => {
    expect(progressFraction(5_000, 0)).toBe(0);
    expect(progressFraction(5_000, -1)).toBe(0);
    expect(progressFraction(-100, 30_000)).toBe(0);
  });
});
