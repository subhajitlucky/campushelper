import { describe, expect, it } from "vitest";
import {
  fillDailySeries,
  formatDuration,
  funnelPercentages,
  medianTimeToReturnHours,
  resolutionRate,
} from "@/lib/analytics";

describe("medianTimeToReturnHours", () => {
  it("returns null for an empty sample", () => {
    expect(medianTimeToReturnHours([])).toBeNull();
  });

  it("returns the single value rounded to one decimal", () => {
    expect(medianTimeToReturnHours([5])).toBe(5);
    expect(medianTimeToReturnHours([3.14])).toBe(3.1);
    expect(medianTimeToReturnHours([3.16])).toBe(3.2);
  });

  it("takes the middle value for an odd count regardless of input order", () => {
    expect(medianTimeToReturnHours([10, 1, 2])).toBe(2);
    expect(medianTimeToReturnHours([9, 1, 5, 3, 7])).toBe(5);
  });

  it("averages the two middle values for an even count", () => {
    expect(medianTimeToReturnHours([1, 2, 3, 4])).toBe(2.5);
    expect(medianTimeToReturnHours([4, 3, 2, 1])).toBe(2.5);
    expect(medianTimeToReturnHours([1, 1.2, 1.3, 1.4])).toBe(1.3);
  });

  it("resists outliers where an arithmetic mean would not", () => {
    const durations = [1, 2, 3, 4, 100];
    const mean = durations.reduce((sum, value) => sum + value, 0) / durations.length;

    expect(medianTimeToReturnHours(durations)).toBe(3);
    expect(mean).toBe(22);
    expect(medianTimeToReturnHours(durations)).not.toBeCloseTo(mean, 1);
  });

  it("ignores negative and non-finite durations", () => {
    expect(medianTimeToReturnHours([-4, Number.NaN, 3, Number.POSITIVE_INFINITY, 7])).toBe(5);
    expect(medianTimeToReturnHours([-1, Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
    expect(medianTimeToReturnHours([Number.NEGATIVE_INFINITY])).toBeNull();
  });
});

describe("resolutionRate", () => {
  it("returns zero instead of dividing by zero", () => {
    expect(resolutionRate(0, 0)).toBe(0);
    expect(resolutionRate(5, 0)).toBe(0);
    expect(resolutionRate(5, -3)).toBe(0);
    expect(Number.isNaN(resolutionRate(0, 0))).toBe(false);
  });

  it("divides resolved by total rounded to four decimals", () => {
    expect(resolutionRate(3, 4)).toBe(0.75);
    expect(resolutionRate(0, 5)).toBe(0);
    expect(resolutionRate(5, 5)).toBe(1);
    expect(resolutionRate(1, 3)).toBe(0.3333);
  });

  it("clamps impossible inputs into the 0..1 range", () => {
    expect(resolutionRate(20, 10)).toBe(1);
    expect(resolutionRate(-5, 10)).toBe(0);
  });
});

describe("funnelPercentages", () => {
  it("computes each stage against its own base", () => {
    expect(funnelPercentages(100, 50, 25)).toEqual({
      createdToApproved: 50,
      approvedToCompleted: 50,
      createdToCompleted: 25,
    });
  });

  it("returns all zeros when nothing was created", () => {
    expect(funnelPercentages(0, 0, 0)).toEqual({
      createdToApproved: 0,
      approvedToCompleted: 0,
      createdToCompleted: 0,
    });
    expect(funnelPercentages(0, 5, 5)).toEqual({
      createdToApproved: 0,
      approvedToCompleted: 100,
      createdToCompleted: 0,
    });
  });

  it("returns zero for a zero denominator without losing the other stages", () => {
    expect(funnelPercentages(10, 0, 5)).toEqual({
      createdToApproved: 0,
      approvedToCompleted: 0,
      createdToCompleted: 50,
    });
  });

  it("rounds percentages to one decimal", () => {
    expect(funnelPercentages(3, 1, 1)).toEqual({
      createdToApproved: 33.3,
      approvedToCompleted: 100,
      createdToCompleted: 33.3,
    });
  });

  it("never lets a stage exceed 100 percent", () => {
    expect(funnelPercentages(10, 20, 40)).toEqual({
      createdToApproved: 100,
      approvedToCompleted: 100,
      createdToCompleted: 100,
    });
    expect(funnelPercentages(100, 100, 50)).toEqual({
      createdToApproved: 100,
      approvedToCompleted: 50,
      createdToCompleted: 50,
    });
  });

  it("clamps negative stages to zero", () => {
    expect(funnelPercentages(10, -5, 2)).toEqual({
      createdToApproved: 0,
      approvedToCompleted: 0,
      createdToCompleted: 20,
    });
  });
});

describe("fillDailySeries", () => {
  it("fills missing days with zeros and preserves supplied values", () => {
    const points = [
      { date: "2024-01-01", posted: 2, resolved: 1 },
      { date: "2024-01-03", posted: 4, resolved: 3 },
    ];

    expect(fillDailySeries(points, "2024-01-01", "2024-01-03")).toEqual([
      { date: "2024-01-01", posted: 2, resolved: 1 },
      { date: "2024-01-02", posted: 0, resolved: 0 },
      { date: "2024-01-03", posted: 4, resolved: 3 },
    ]);
  });

  it("returns a single bucket when start and end are the same day", () => {
    expect(fillDailySeries([], "2024-05-09", "2024-05-09")).toEqual([
      { date: "2024-05-09", posted: 0, resolved: 0 },
    ]);
  });

  it("returns an empty series when the range is reversed or invalid", () => {
    expect(fillDailySeries([], "2024-02-01", "2024-01-01")).toEqual([]);
    expect(fillDailySeries([], "not-a-date", "2024-01-01")).toEqual([]);
  });

  it("crosses a month boundary", () => {
    expect(fillDailySeries([], "2024-01-30", "2024-02-02").map((day) => day.date)).toEqual([
      "2024-01-30",
      "2024-01-31",
      "2024-02-01",
      "2024-02-02",
    ]);
  });

  it("crosses a year boundary", () => {
    expect(fillDailySeries([], "2023-12-31", "2024-01-02").map((day) => day.date)).toEqual([
      "2023-12-31",
      "2024-01-01",
      "2024-01-02",
    ]);
  });

  it("includes a leap day and omits it in a non-leap year", () => {
    expect(fillDailySeries([], "2024-02-28", "2024-03-01").map((day) => day.date)).toEqual([
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
    expect(fillDailySeries([], "2023-02-28", "2023-03-01").map((day) => day.date)).toEqual([
      "2023-02-28",
      "2023-03-01",
    ]);
  });

  it("accepts ISO timestamps and ignores out-of-range points", () => {
    const points = [
      { date: "2024-01-02T15:30:00.000Z", posted: 3, resolved: 2 },
      { date: "2023-12-25", posted: 9, resolved: 9 },
    ];

    const series = fillDailySeries(points, "2024-01-01T00:00:00.000Z", "2024-01-03T00:00:00.000Z");

    expect(series).toEqual([
      { date: "2024-01-01", posted: 0, resolved: 0 },
      { date: "2024-01-02", posted: 3, resolved: 2 },
      { date: "2024-01-03", posted: 0, resolved: 0 },
    ]);
    expect(series[1]).not.toBe(points[0]);
  });
});

describe("formatDuration", () => {
  it("renders null as an em dash", () => {
    expect(formatDuration(null)).toBe("—");
  });

  it("renders sub-hour durations in minutes with correct plurals", () => {
    expect(formatDuration(0)).toBe("0 minutes");
    expect(formatDuration(1 / 60)).toBe("1 minute");
    expect(formatDuration(2 / 60)).toBe("2 minutes");
    expect(formatDuration(0.5)).toBe("30 minutes");
    expect(formatDuration(0.99)).toBe("59 minutes");
  });

  it("renders hours below the two-day mark, dropping a zero decimal", () => {
    expect(formatDuration(1)).toBe("1 hour");
    expect(formatDuration(5.25)).toBe("5.3 hours");
    expect(formatDuration(24)).toBe("24 hours");
    expect(formatDuration(47.9)).toBe("47.9 hours");
  });

  it("renders two days and beyond in days, dropping a zero decimal", () => {
    expect(formatDuration(48)).toBe("2 days");
    expect(formatDuration(60)).toBe("2.5 days");
    expect(formatDuration(24 * 30)).toBe("30 days");
  });

  // The homepage renders this immediately beside whole-number stats
  // ("35 reports"), where a trailing ".0" reads as false precision.
  it("never emits a trailing zero decimal at any magnitude", () => {
    for (const hours of [1, 2, 12, 24, 25, 47, 48, 72, 240, 2400]) {
      expect(formatDuration(hours)).not.toMatch(/\.0\b/);
    }
  });
});
