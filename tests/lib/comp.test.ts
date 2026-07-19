import { describe, expect, it } from "vitest";
import { composeComp } from "@/lib/comp";

describe("composeComp", () => {
  it("joins the structured parts with labels", () => {
    expect(
      composeComp({
        compBase: "$170k",
        compBonus: "10%",
        compEquity: "0.05%",
        compNotes: null,
      }),
    ).toBe("base $170k · bonus 10% · equity 0.05%");
  });

  it("appends free-form notes last", () => {
    expect(
      composeComp({
        compBase: "$170k",
        compBonus: null,
        compEquity: null,
        compNotes: "3-tier on-call",
      }),
    ).toBe("base $170k · 3-tier on-call");
  });

  it("falls back to notes alone (legacy rows)", () => {
    expect(
      composeComp({
        compBase: null,
        compBonus: null,
        compEquity: null,
        compNotes: "$150-180k",
      }),
    ).toBe("$150-180k");
  });

  it("returns null when nothing is set", () => {
    expect(
      composeComp({
        compBase: null,
        compBonus: null,
        compEquity: null,
        compNotes: null,
      }),
    ).toBeNull();
  });
});
