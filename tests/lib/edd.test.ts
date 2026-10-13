import { describe, expect, it } from "vitest";
import { defaultEddStage, isCurrentStageReported, isEddStage } from "@/lib/edd";

describe("isEddStage", () => {
  it("accepts the stages that are work-search contacts", () => {
    expect(isEddStage("Applied")).toBe(true);
    expect(isEddStage("HM Interview")).toBe(true);
  });

  it.each(["Evaluating", "Skipped", "Rejected", "nonsense"])(
    "rejects %s",
    (status) => {
      expect(isEddStage(status)).toBe(false);
    },
  );
});

describe("defaultEddStage", () => {
  it("offers the job's current status when it can be reported", () => {
    expect(defaultEddStage("Screen", [])).toBe("Screen");
  });

  it("still offers the current status when it is already reported, so its date can be corrected", () => {
    expect(defaultEddStage("Screen", ["Applied", "Screen"])).toBe("Screen");
  });

  it("falls back to the first unreported stage for a status that cannot be reported", () => {
    expect(defaultEddStage("Evaluating", [])).toBe("Applied");
    expect(defaultEddStage("Rejected", ["Applied"])).toBe("Screen");
  });

  it("falls back to the first stage once everything is reported", () => {
    expect(
      defaultEddStage("Rejected", [
        "Applied",
        "Screen",
        "Assessment",
        "HM Interview",
        "Panel",
        "Offer",
      ]),
    ).toBe("Applied");
  });
});

describe("isCurrentStageReported", () => {
  it("is true when the job's current status is among the reported stages", () => {
    expect(isCurrentStageReported("Screen", ["Applied", "Screen"])).toBe(true);
  });

  it("is false when only an earlier stage was reported", () => {
    expect(isCurrentStageReported("Screen", ["Applied"])).toBe(false);
  });

  it("is false for a status that cannot be reported", () => {
    expect(isCurrentStageReported("Rejected", ["Applied"])).toBe(false);
    expect(isCurrentStageReported("Evaluating", [])).toBe(false);
  });

  it("treats missing list data as nothing reported", () => {
    expect(isCurrentStageReported("Applied", undefined)).toBe(false);
  });
});
