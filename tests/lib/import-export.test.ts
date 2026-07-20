import { describe, expect, it } from "vitest";
import { TRACKER_COLUMNS } from "@/lib/constants";
import { buildTrackerCsv, parseCsv } from "@/lib/csv";
import {
  buildImportPreview,
  coerceCellDate,
  duplicateKey,
  trackerRowToJobInput,
} from "@/lib/import";
import { buildTrackerWorkbook, parseTrackerWorkbook } from "@/lib/xlsx";
import type { Job } from "@/lib/types";

const job = (over: Partial<Job>): Job => ({
  id: "job-001",
  company: "Acme",
  role: "Senior SRE",
  priorityTier: "3 - Mid",
  status: "Evaluating",
  dateApplied: null,
  compNotes: null,
  nextAction: null,
  followUpDate: null,
  contact: null,
  notes: null,
  postingUrl: null,
  resumeVersion: null,
  compBase: null,
  compBonus: null,
  compEquity: null,
  resumeId: null,
  coverLetterId: null,
  source: "manual" as const,
  skillMatch: null,
  jdSnapshot: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  ...over,
});

describe("xlsx round-trip", () => {
  it("writes the original tracker column order and reads values back", async () => {
    const jobs = [
      job({
        company: "Platform Science",
        role: "Senior Platform Engineer",
        priorityTier: "1 - Top",
        status: "Screen",
        dateApplied: "2026-07-02",
        followUpDate: "2026-07-15",
        compNotes: "$165-190k",
        nextAction: "Follow up",
        contact: "Maria G",
        notes: "SD HQ",
        postingUrl: "https://boards.greenhouse.io/platformscience/jobs/1",
      }),
      job({ id: "job-002", company: "Babylist", role: "Staff SRE" }),
    ];
    const buffer = await buildTrackerWorkbook(jobs);
    const { headers, rows } = await parseTrackerWorkbook(buffer);
    expect(headers).toEqual([...TRACKER_COLUMNS]);
    expect(rows).toHaveLength(2);
    expect(rows[0].Company).toBe("Platform Science");
    expect(rows[0]["Priority Tier"]).toBe("1 - Top");
    expect(rows[0]["Follow-Up Date"]).toBe("2026-07-15");
    expect(rows[0]["Posting URL"]).toBe(
      "https://boards.greenhouse.io/platformscience/jobs/1",
    );
    expect(rows[1].Company).toBe("Babylist");
  });
});

describe("csv round-trip", () => {
  it("writes the original tracker column order and reads values back", () => {
    const jobs = [
      job({
        company: "Platform Science",
        role: "Senior Platform Engineer",
        priorityTier: "1 - Top",
        status: "Screen",
        followUpDate: "2026-07-15",
        compNotes: "$165-190k",
        notes: "Notes, with comma",
        postingUrl: "https://boards.greenhouse.io/platformscience/jobs/1",
      }),
      job({ id: "job-002", company: "Babylist", role: "Staff SRE" }),
    ];
    const csv = buildTrackerCsv(jobs);
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].Company).toBe("Platform Science");
    expect(rows[0]["Priority Tier"]).toBe("1 - Top");
    expect(rows[0]["Follow-Up Date"]).toBe("2026-07-15");
    expect(rows[0].Notes).toBe("Notes, with comma");
    expect(rows[0]["Posting URL"]).toBe(
      "https://boards.greenhouse.io/platformscience/jobs/1",
    );
    expect(rows[1].Company).toBe("Babylist");
  });
});

describe("csv parsing", () => {
  it("parses a tracker-layout csv into header-keyed rows", () => {
    const csv = [
      "Company,Role,Priority Tier,Status,Date Applied,Comp Notes,Next Action,Follow-Up Date,Contact,Notes,Posting URL",
      'Acme,Senior SRE,2 - High,Applied,2026-07-01,"$150k",Ping recruiter,2026-07-20,Dana,"Notes, with comma",https://x.example/1',
    ].join("\n");
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].Company).toBe("Acme");
    expect(rows[0]["Priority Tier"]).toBe("2 - High");
    expect(rows[0].Notes).toBe("Notes, with comma");
  });
});

describe("coerceCellDate", () => {
  it("passes through ISO strings and empties", () => {
    expect(coerceCellDate("2026-07-17")).toBe("2026-07-17");
    expect(coerceCellDate("")).toBeNull();
    expect(coerceCellDate(null)).toBeNull();
  });

  it("converts Date instances to local ISO dates", () => {
    expect(coerceCellDate(new Date(2026, 6, 17, 12))).toBe("2026-07-17");
  });

  it("converts Excel serial numbers", () => {
    // Excel serial 45000 = 2023-03-15 (1900 date system)
    expect(coerceCellDate(45000)).toBe("2023-03-15");
  });
});

describe("trackerRowToJobInput", () => {
  it("maps tracker headers to job fields", () => {
    const input = trackerRowToJobInput({
      Company: "Acme",
      Role: "Senior SRE",
      "Priority Tier": "1 - Top",
      Status: "Applied",
      "Date Applied": "2026-07-01",
      "Comp Notes": "$150k",
      "Next Action": "Ping",
      "Follow-Up Date": "2026-07-20",
      Contact: "Dana",
      Notes: "n",
      "Posting URL": "https://x.example/1",
    });
    expect(input).toMatchObject({
      company: "Acme",
      role: "Senior SRE",
      priorityTier: "1 - Top",
      status: "Applied",
      dateApplied: "2026-07-01",
      followUpDate: "2026-07-20",
      postingUrl: "https://x.example/1",
    });
  });
});

describe("duplicate detection", () => {
  it("keys on case-insensitive trimmed company+role", () => {
    expect(duplicateKey(" Acme ", "SENIOR sre")).toBe(
      duplicateKey("acme", "Senior SRE"),
    );
    expect(duplicateKey("Acme", "SRE")).not.toBe(duplicateKey("Acme", "SRE II"));
  });

  it("flags duplicates against existing jobs and validates rows", () => {
    const existing = [job({ id: "job-009", company: "Acme", role: "Senior SRE" })];
    const preview = buildImportPreview(
      [
        { Company: "ACME", Role: "senior sre", Status: "Applied" },
        { Company: "NewCo", Role: "Platform Engineer" },
        { Company: "", Role: "Ghost" },
      ],
      existing,
    );
    expect(preview[0].duplicateOfId).toBe("job-009");
    expect(preview[0].error).toBeNull();
    expect(preview[1].duplicateOfId).toBeNull();
    expect(preview[1].error).toBeNull();
    expect(preview[2].error).toMatch(/company/i);
  });
});
