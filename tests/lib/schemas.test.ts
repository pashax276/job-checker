import { describe, expect, it } from "vitest";
import {
  jobCreateSchema,
  jobPatchSchema,
  listQuerySchema,
} from "@/lib/schemas";

describe("jobCreateSchema", () => {
  it("accepts minimal input and applies defaults", () => {
    const job = jobCreateSchema.parse({ company: "Acme", role: "Senior SRE" });
    expect(job.company).toBe("Acme");
    expect(job.role).toBe("Senior SRE");
    expect(job.priorityTier).toBe("3 - Mid");
    expect(job.status).toBe("Evaluating");
    expect(job.dateApplied).toBeNull();
    expect(job.followUpDate).toBeNull();
    expect(job.notes).toBeNull();
  });

  it("rejects missing company", () => {
    expect(() => jobCreateSchema.parse({ role: "SRE" })).toThrow();
  });

  it("rejects empty-string company", () => {
    expect(() =>
      jobCreateSchema.parse({ company: "   ", role: "SRE" }),
    ).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() =>
      jobCreateSchema.parse({ company: "A", role: "B", status: "Ghosted" }),
    ).toThrow();
  });

  it("rejects an unknown priority tier", () => {
    expect(() =>
      jobCreateSchema.parse({ company: "A", role: "B", priorityTier: "6 - Nope" }),
    ).toThrow();
  });

  it("accepts every legal status and tier", () => {
    const statuses = [
      "Evaluating", "Applied", "Screen", "Assessment",
      "Panel", "Offer", "Skipped", "Rejected",
    ];
    const tiers = ["1 - Top", "2 - High", "3 - Mid", "4 - Queue", "5 - Hold", "Closed"];
    for (const status of statuses) {
      for (const priorityTier of tiers) {
        expect(
          jobCreateSchema.parse({ company: "A", role: "B", status, priorityTier })
            .status,
        ).toBe(status);
      }
    }
  });

  it("rejects a non-ISO date and accepts YYYY-MM-DD", () => {
    expect(() =>
      jobCreateSchema.parse({ company: "A", role: "B", dateApplied: "07/17/2026" }),
    ).toThrow();
    expect(
      jobCreateSchema.parse({ company: "A", role: "B", dateApplied: "2026-07-17" })
        .dateApplied,
    ).toBe("2026-07-17");
  });

  it("normalizes empty strings to null for optional fields", () => {
    const job = jobCreateSchema.parse({
      company: "A",
      role: "B",
      compNotes: "  ",
      postingUrl: "",
    });
    expect(job.compNotes).toBeNull();
    expect(job.postingUrl).toBeNull();
  });

  it("rejects an invalid posting URL and accepts https", () => {
    expect(() =>
      jobCreateSchema.parse({ company: "A", role: "B", postingUrl: "not a url" }),
    ).toThrow();
    expect(
      jobCreateSchema.parse({
        company: "A",
        role: "B",
        postingUrl: "https://boards.greenhouse.io/acme/jobs/1",
      }).postingUrl,
    ).toBe("https://boards.greenhouse.io/acme/jobs/1");
  });

  it("rejects unknown keys", () => {
    expect(() =>
      jobCreateSchema.parse({ company: "A", role: "B", salary: "1M" }),
    ).toThrow();
  });

  it("accepts an explicit seed id", () => {
    expect(
      jobCreateSchema.parse({ id: "job-001", company: "A", role: "B" }).id,
    ).toBe("job-001");
  });
});

describe("jobPatchSchema", () => {
  it("accepts an empty patch", () => {
    expect(jobPatchSchema.parse({})).toEqual({});
  });

  it("keeps absent fields absent (does not inject nulls)", () => {
    const patch = jobPatchSchema.parse({ status: "Applied" });
    expect(patch.status).toBe("Applied");
    expect("followUpDate" in patch).toBe(false);
    expect("company" in patch).toBe(false);
  });

  it("allows explicitly clearing a nullable field", () => {
    const patch = jobPatchSchema.parse({ followUpDate: null });
    expect(patch.followUpDate).toBeNull();
  });

  it("rejects clearing company to empty", () => {
    expect(() => jobPatchSchema.parse({ company: "" })).toThrow();
  });

  it("rejects an invalid status in a patch", () => {
    expect(() => jobPatchSchema.parse({ status: "OnHold" })).toThrow();
  });
});

describe("listQuerySchema", () => {
  it("parses full query with dueOnly coercion", () => {
    const q = listQuerySchema.parse({
      status: "Applied",
      tier: "1 - Top",
      q: "acme",
      dueOnly: "true",
    });
    expect(q.dueOnly).toBe(true);
    expect(q.status).toBe("Applied");
    expect(q.tier).toBe("1 - Top");
    expect(q.q).toBe("acme");
  });

  it("defaults dueOnly to false when absent or 'false'", () => {
    expect(listQuerySchema.parse({}).dueOnly).toBe(false);
    expect(listQuerySchema.parse({ dueOnly: "false" }).dueOnly).toBe(false);
  });

  it("rejects an invalid status filter", () => {
    expect(() => listQuerySchema.parse({ status: "Anything" })).toThrow();
  });
});
