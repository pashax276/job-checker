import { describe, expect, it } from "vitest";
import {
  daysInCurrentStage,
  daysSinceApplied,
  isFollowUpDue,
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
