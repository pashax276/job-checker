import { afterEach, describe, expect, it } from "vitest";
import {
  daysInCurrentStage,
  daysSinceApplied,
  formatStamp,
  isFollowUpDue,
  localDayOf,
} from "@/lib/dates";

// Fixed local "today": 2026-07-17 at noon (noon avoids DST edge ambiguity).
const TODAY = new Date(2026, 6, 17, 12, 0, 0);

describe("daysSinceApplied", () => {
  it("returns null when never applied", () => {
    expect(daysSinceApplied(null, TODAY)).toBeNull();
  });

  it("returns 0 for an application made today", () => {
    expect(daysSinceApplied("2026-07-17", TODAY)).toBe(0);
  });

  it("returns whole days for a past application", () => {
    expect(daysSinceApplied("2026-07-10", TODAY)).toBe(7);
  });

  it("counts across month boundaries", () => {
    expect(daysSinceApplied("2026-06-30", TODAY)).toBe(17);
  });
});

describe("daysInCurrentStage", () => {
  it("returns 0 for a change made today", () => {
    expect(daysInCurrentStage(TODAY.toISOString(), TODAY)).toBe(0);
  });

  it("returns whole days since the last status change timestamp", () => {
    const changed = new Date(2026, 6, 1, 9, 30, 0).toISOString();
    expect(daysInCurrentStage(changed, TODAY)).toBe(16);
  });

  it("never returns a negative value for future timestamps", () => {
    const future = new Date(2026, 6, 20, 9, 0, 0).toISOString();
    expect(daysInCurrentStage(future, TODAY)).toBe(0);
  });

  it("treats date-only strings as local dates (no UTC off-by-one)", () => {
    expect(daysInCurrentStage("2026-07-10", TODAY)).toBe(7);
  });
});

describe("isFollowUpDue", () => {
  it("is false with no follow-up date", () => {
    expect(isFollowUpDue(null, TODAY)).toBe(false);
  });

  it("is true when the follow-up date is today", () => {
    expect(isFollowUpDue("2026-07-17", TODAY)).toBe(true);
  });

  it("is true when the follow-up date has passed", () => {
    expect(isFollowUpDue("2026-07-16", TODAY)).toBe(true);
  });

  it("is false when the follow-up date is tomorrow", () => {
    expect(isFollowUpDue("2026-07-18", TODAY)).toBe(false);
  });
});

describe("date-only stamps west of UTC", () => {
  // new Date("2026-10-12") is UTC midnight, which is still the 11th in
  // California. CI runs in UTC where that slip is invisible, so pin the zone.
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("localDayOf keeps a date-only stamp as written", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(localDayOf("2026-10-12")).toBe("2026-10-12");
  });

  it("localDayOf gives a timestamp's local day, not its UTC day", () => {
    process.env.TZ = "America/Los_Angeles";
    // 23:30 on the 12th in California is already the 13th in UTC
    const lateEvening = new Date(2026, 9, 12, 23, 30, 0).toISOString();
    expect(lateEvening.slice(0, 10)).toBe("2026-10-13");
    expect(localDayOf(lateEvening)).toBe("2026-10-12");
  });

  it("formatStamp renders a date-only stamp as that calendar day", () => {
    process.env.TZ = "America/Los_Angeles";
    const expected = new Date(2026, 9, 12).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(formatStamp("2026-10-12")).toBe(expected);
  });

  it("formatStamp renders a timestamp on its local day", () => {
    process.env.TZ = "America/Los_Angeles";
    const lateEvening = new Date(2026, 9, 12, 23, 30, 0);
    expect(formatStamp(lateEvening.toISOString())).toBe(
      lateEvening.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    );
  });
});
