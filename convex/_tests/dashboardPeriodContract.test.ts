import { describe, expect, it } from "vitest";
import {
  bucketsForPeriod,
  resolveComparisonPeriods,
} from "../helpers/dashboardMetrics";

const at = (date: string) => Date.parse(`${date}+07:00`);

describe("agreed dashboard calendar semantics", () => {
  it("compares October 1–26 with September 1–26, not the whole month", () => {
    const p = resolveComparisonPeriods(at("2026-10-26T12:34:56"), "this_month");
    expect(p.current).toEqual({
      start: at("2026-10-01T00:00:00"),
      end: at("2026-10-26T12:34:56"),
    });
    expect(p.previous).toEqual({
      start: at("2026-09-01T00:00:00"),
      end: at("2026-09-26T12:34:56"),
    });
  });

  it("compares the same elapsed calendar position of the preceding quarter", () => {
    const p = resolveComparisonPeriods(
      at("2026-11-26T12:00:00"),
      "this_quarter",
    );
    expect(p.current.start).toBe(at("2026-10-01T00:00:00"));
    expect(p.previous).toEqual({
      start: at("2026-07-01T00:00:00"),
      end: at("2026-08-26T12:00:00"),
    });
  });

  it("keeps calendar dates across unequal quarter lengths", () => {
    const p = resolveComparisonPeriods(
      at("2026-12-26T12:00:00"),
      "this_quarter",
    );
    expect(p.previous).toEqual({
      start: at("2026-07-01T00:00:00"),
      end: at("2026-09-26T12:00:00"),
    });
  });

  it("keeps calendar dates when the preceding year was a leap year", () => {
    const p = resolveComparisonPeriods(at("2025-10-26T12:00:00"), "this_year");
    expect(p.previous).toEqual({
      start: at("2024-01-01T00:00:00"),
      end: at("2024-10-26T12:00:00"),
    });
  });

  it("clamps a running comparison at the shorter month end without spilling into March", () => {
    const p = resolveComparisonPeriods(at("2024-03-31T12:00:00"), "this_month");
    expect(p.previous).toEqual({
      start: at("2024-02-01T00:00:00"),
      end: at("2024-03-01T00:00:00"),
    });
  });

  it("compares a completed month with the full month before it", () => {
    const p = resolveComparisonPeriods(at("2026-01-15T12:00:00"), "last_month");
    expect(p.current).toEqual({
      start: at("2025-12-01T00:00:00"),
      end: at("2026-01-01T00:00:00"),
    });
    expect(p.previous).toEqual({
      start: at("2025-11-01T00:00:00"),
      end: at("2025-12-01T00:00:00"),
    });
  });

  it("starts a new WIB year before the UTC year changes", () => {
    const p = resolveComparisonPeriods(
      Date.parse("2025-12-31T17:30:00Z"),
      "this_year",
    );
    expect(p.current).toEqual({
      start: at("2026-01-01T00:00:00"),
      end: at("2026-01-01T00:30:00"),
    });
    expect(p.previous).toEqual({
      start: at("2025-01-01T00:00:00"),
      end: at("2025-01-01T00:30:00"),
    });
  });

  it("gives month charts daily buckets, with a partial final day", () => {
    const p = resolveComparisonPeriods(at("2026-10-03T12:00:00"), "this_month");
    const bins = bucketsForPeriod(p.current, "this_month");
    expect(bins).toHaveLength(3);
    expect(bins[0]).toMatchObject({
      start: p.current.start,
      end: at("2026-10-02T00:00:00"),
    });
    expect(bins[2]).toMatchObject({
      start: at("2026-10-03T00:00:00"),
      end: p.current.end,
    });
    expect(
      bins.every((bin, i) => i === 0 || bin.start === bins[i - 1].end),
    ).toBe(true);
  });
});
