import { describe, expect, it } from "vitest";
import { attachedExtras, readJobExtras } from "@/lib/import-extras";
import { parseJsonImport } from "@/lib/json-import";

const exportedJob = (over: Record<string, unknown> = {}) => ({
  id: "job-abc",
  company: "PostHog",
  role: "Site Reliability Engineer",
  priorityTier: "1 - Top",
  status: "Screen",
  dateApplied: "2026-08-23",
  compNotes: "Formula-driven, no negotiation room",
  nextAction: "Culture screen Thu",
  followUpDate: "2026-08-28",
  contact: "Mark D",
  notes: "Cold apply",
  postingUrl: "https://jobs.ashbyhq.com/posthog/1",
  resumeVersion: "2026-08-26 multi-account",
  compBase: "246383-269724",
  compBonus: null,
  compEquity: "equity",
  source: "manual",
  skillMatch: '{"score":0.75,"matched":["AWS"],"missing":[]}',
  jdSnapshot: "Site Reliability Engineer - PostHog ...",
  resumeId: "doc-1",
  coverLetterId: null,
  createdAt: "2026-08-23T07:03:10.050Z",
  updatedAt: "2026-08-26T08:00:00.000Z",
  resume: {
    id: "doc-1",
    kind: "resume",
    name: "Pavlo_Lisnykov_Resume_V2",
    fileName: "Pavlo_Lisnykov_Resume.pdf",
    skills: ["AWS", "Kubernetes"],
    bullets: [],
    experience: [],
    extractedText: "PAVLO LISNYKOV\nSenior Platform / DevOps Engineer",
  },
  coverLetter: null,
  prep: [
    {
      stage: "Screen",
      scheduledFor: "2026-08-27",
      prepNotes: "# PostHog Thursday\nThree beats...",
      outcome: null,
      questions: [
        { id: "q1", text: "How do you place level and step?", response: null, askedBy: "me" },
      ],
    },
  ],
  eddReports: [
    {
      stage: "Applied",
      reportedOn: "2026-08-24",
      createdAt: "2026-08-24T17:00:00.000Z",
    },
    {
      stage: "Screen",
      reportedOn: "2026-08-31",
      createdAt: "2026-08-31T17:00:00.000Z",
    },
  ],
  ...over,
});

describe("readJobExtras", () => {
  it("reads the rich fields the flat tracker columns drop", () => {
    const extras = readJobExtras(exportedJob());
    expect(extras).not.toBeNull();
    expect(extras).toMatchObject({
      id: "job-abc",
      source: "manual",
      compNotes: "Formula-driven, no negotiation room",
      compBase: "246383-269724",
      compEquity: "equity",
      resumeVersion: "2026-08-26 multi-account",
      jdSnapshot: "Site Reliability Engineer - PostHog ...",
      createdAt: "2026-08-23T07:03:10.050Z",
      updatedAt: "2026-08-26T08:00:00.000Z",
    });
    expect(extras!.skillMatch).toContain('"score":0.75');
  });

  it("carries the embedded resume with its parsed text and skills", () => {
    const extras = readJobExtras(exportedJob())!;
    expect(extras.resume).toMatchObject({
      id: "doc-1",
      kind: "resume",
      name: "Pavlo_Lisnykov_Resume_V2",
      fileName: "Pavlo_Lisnykov_Resume.pdf",
    });
    expect(extras.resume!.skills).toEqual(["AWS", "Kubernetes"]);
    expect(extras.resume!.extractedText).toContain("PAVLO LISNYKOV");
    expect(extras.coverLetter).toBeNull();
  });

  it("infers a mime type from the file name when the export predates the field", () => {
    expect(readJobExtras(exportedJob())!.resume!.mimeType).toBe("application/pdf");
  });

  it("keeps an explicit mime type when the export carries one", () => {
    const entry = exportedJob();
    const extras = readJobExtras({
      ...entry,
      resume: { ...entry.resume, fileName: "resume.bin", mimeType: "text/plain" },
    })!;
    expect(extras.resume!.mimeType).toBe("text/plain");
  });

  it("carries booked prep steps with notes and structured questions", () => {
    const extras = readJobExtras(exportedJob())!;
    expect(extras.prep).toHaveLength(1);
    expect(extras.prep[0]).toMatchObject({
      stage: "Screen",
      scheduledFor: "2026-08-27",
      prepNotes: "# PostHog Thursday\nThree beats...",
      outcome: null,
    });
    expect(extras.prep[0].questions[0].text).toBe(
      "How do you place level and step?",
    );
    expect(extras.droppedPrep).toBe(0);
  });

  it("defaults askedBy on legacy questions that predate the field", () => {
    const entry = exportedJob({
      prep: [
        {
          stage: "Screen",
          scheduledFor: "2026-08-27",
          prepNotes: null,
          outcome: null,
          questions: [{ id: "q1", text: "Remote?", response: null }],
        },
      ],
    });
    expect(readJobExtras(entry)!.prep[0].questions[0].askedBy).toBe("me");
  });

  it("drops prep entries that aren't booked steps and reports the count", () => {
    // Hand-authored prep in the wild looks like { title, type, summary } —
    // document descriptions, not stage_schedule rows. They can't be restored,
    // and must not take the whole job's import down with them.
    const entry = exportedJob({
      prep: [
        { title: "PostHog_Thursday.md", type: "stage-2-brief", summary: "..." },
        {
          stage: "Screen",
          scheduledFor: "2026-08-27",
          prepNotes: null,
          outcome: null,
          questions: [],
        },
      ],
    });
    const extras = readJobExtras(entry)!;
    expect(extras.prep).toHaveLength(1);
    expect(extras.prep[0].stage).toBe("Screen");
    expect(extras.droppedPrep).toBe(1);
  });

  it("drops prep steps with an unschedulable stage or a malformed date", () => {
    const entry = exportedJob({
      prep: [
        { stage: "Rejected", scheduledFor: "2026-08-27", questions: [] },
        { stage: "Screen", scheduledFor: "8/27/2026", questions: [] },
      ],
    });
    const extras = readJobExtras(entry)!;
    expect(extras.prep).toEqual([]);
    expect(extras.droppedPrep).toBe(2);
  });

  it("carries EDD reports with the day each stage was reported", () => {
    const extras = readJobExtras(exportedJob())!;
    expect(extras.eddReports).toEqual([
      {
        stage: "Applied",
        reportedOn: "2026-08-24",
        createdAt: "2026-08-24T17:00:00.000Z",
      },
      {
        stage: "Screen",
        reportedOn: "2026-08-31",
        createdAt: "2026-08-31T17:00:00.000Z",
      },
    ]);
    expect(extras.droppedEddReports).toBe(0);
  });

  it("accepts a hand-written EDD report that has no createdAt", () => {
    const extras = readJobExtras(
      exportedJob({
        eddReports: [{ stage: "Offer", reportedOn: "2026-09-15" }],
      }),
    )!;
    expect(extras.eddReports).toEqual([
      { stage: "Offer", reportedOn: "2026-09-15", createdAt: null },
    ]);
  });

  it("keeps a report whose createdAt is not a timestamp, without trusting the value", () => {
    // createdAt only orders same-day rows; a bad one isn't worth losing the
    // report over, but it mustn't reach the database either
    const extras = readJobExtras(
      exportedJob({
        eddReports: [
          { stage: "Applied", reportedOn: "2026-08-24", createdAt: "yesterday" },
        ],
      }),
    )!;
    expect(extras.eddReports).toEqual([
      { stage: "Applied", reportedOn: "2026-08-24", createdAt: null },
    ]);
    expect(extras.droppedEddReports).toBe(0);
  });

  it("drops malformed EDD reports and reports the count", () => {
    const extras = readJobExtras(
      exportedJob({
        eddReports: [
          { stage: "Evaluating", reportedOn: "2026-08-24" }, // not reportable
          { stage: "Applied", reportedOn: "8/24/2026" }, // not ISO
          { stage: "Applied", reportedOn: "2026-02-30" }, // not a real day
          "Applied",
          { stage: "Screen", reportedOn: "2026-08-31" },
        ],
      }),
    )!;
    expect(extras.eddReports.map((r) => r.stage)).toEqual(["Screen"]);
    expect(extras.droppedEddReports).toBe(4);
  });

  it("reads a backup that predates EDD reports as having none", () => {
    const older = Object.fromEntries(
      Object.entries(exportedJob()).filter(([key]) => key !== "eddReports"),
    );
    const extras = readJobExtras(older)!;
    expect(extras.eddReports).toEqual([]);
    expect(extras.droppedEddReports).toBe(0);
  });

  it("returns null for a flat spreadsheet row (the csv/xlsx path)", () => {
    expect(readJobExtras({ Company: "Acme", Role: "SRE" })).toBeNull();
    expect(readJobExtras(null)).toBeNull();
    expect(readJobExtras("nope")).toBeNull();
  });

  it("survives a job whose rich fields are all absent", () => {
    const extras = readJobExtras({ company: "Acme", role: "SRE", prep: [] });
    expect(extras).not.toBeNull();
    expect(extras!.prep).toEqual([]);
    expect(extras!.resume).toBeNull();
    expect(extras!.skillMatch).toBeNull();
  });
});

describe("parseJsonImport carries extras alongside the tracker columns", () => {
  it("attaches extras to each row without disturbing the column mapping", () => {
    const rows = parseJsonImport(JSON.stringify([exportedJob()]));
    expect(rows[0].Company).toBe("PostHog");
    const extras = attachedExtras(rows[0]);
    expect(extras).not.toBeNull();
    expect(extras!.prep).toHaveLength(1);
    expect(extras!.jdSnapshot).toContain("PostHog");
  });

  it("leaves no extras behind on rows from a plain spreadsheet import", () => {
    expect(attachedExtras({ Company: "Acme", Role: "SRE" })).toBeNull();
  });
});
