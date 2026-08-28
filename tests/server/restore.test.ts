import { describe, expect, it, beforeEach } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import type { JobExtras } from "@/lib/import-extras";
import { jobCreateSchema } from "@/lib/schemas";
import { getDocument } from "@/server/documents";
import { getJob } from "@/server/jobs";
import { createJob } from "@/server/jobs";
import { applyJobExtras } from "@/server/restore";
import { listSchedule } from "@/server/schedule";

let db: DB;
let jobId: string;

const extras = (over: Partial<JobExtras> = {}): JobExtras => ({
  id: null,
  source: "manual",
  compNotes: "Formula-driven",
  compBase: "246383-269724",
  compBonus: null,
  compEquity: "equity",
  resumeVersion: "v2",
  skillMatch: '{"score":0.75}',
  jdSnapshot: "Long JD text",
  createdAt: "2026-08-23T07:03:10.050Z",
  updatedAt: "2026-08-26T08:00:00.000Z",
  resume: {
    id: "doc-1",
    kind: "resume",
    name: "Resume V2",
    fileName: "resume.pdf",
    mimeType: "application/pdf",
    skills: ["AWS", "Kubernetes"],
    bullets: ["Ran EKS"],
    experience: [],
    extractedText: "PAVLO LISNYKOV",
  },
  coverLetter: null,
  prep: [
    {
      stage: "Screen",
      scheduledFor: "2026-08-27",
      prepNotes: "Three beats",
      outcome: null,
      questions: [
        { id: "q1", text: "Level and step?", response: null, askedBy: "me" },
      ],
    },
  ],
  droppedPrep: 0,
  ...over,
});

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  jobId = createJob(
    db,
    jobCreateSchema.parse({ company: "PostHog", role: "SRE" }),
  ).id;
});

describe("applyJobExtras", () => {
  it("restores the job fields the flat columns drop", () => {
    applyJobExtras(db, jobId, extras());
    const job = getJob(db, jobId)!;
    expect(job.compNotes).toBe("Formula-driven");
    expect(job.compBase).toBe("246383-269724");
    expect(job.compEquity).toBe("equity");
    expect(job.skillMatch).toBe('{"score":0.75}');
    expect(job.jdSnapshot).toBe("Long JD text");
    expect(job.source).toBe("manual");
    expect(job.createdAt).toBe("2026-08-23T07:03:10.050Z");
    expect(job.updatedAt).toBe("2026-08-26T08:00:00.000Z");
  });

  it("recreates the resume document and links it to the job", () => {
    applyJobExtras(db, jobId, extras());
    const doc = getDocument(db, "doc-1");
    expect(doc).not.toBeNull();
    expect(doc!.name).toBe("Resume V2");
    expect(doc!.mimeType).toBe("application/pdf");
    expect(doc!.extractedText).toBe("PAVLO LISNYKOV");
    expect(JSON.parse(doc!.skills!)).toEqual(["AWS", "Kubernetes"]);

    const job = getJob(db, jobId)!;
    expect(job.resumeId).toBe("doc-1");
    expect(job.resumeVersion).toBe("v2");
  });

  it("restores booked prep steps with notes and questions", () => {
    applyJobExtras(db, jobId, extras());
    const steps = listSchedule(db, jobId);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      stage: "Screen",
      scheduledFor: "2026-08-27",
      prepNotes: "Three beats",
      outcome: null,
    });
    expect(JSON.parse(steps[0].questions!)).toHaveLength(1);
  });

  it("reports what it restored", () => {
    const counts = applyJobExtras(db, jobId, extras());
    expect(counts).toEqual({ documents: 1, prepSteps: 1, prepSkipped: 0 });
  });

  it("counts prep entries the parser could not use", () => {
    const counts = applyJobExtras(db, jobId, extras({ prep: [], droppedPrep: 3 }));
    expect(counts.prepSkipped).toBe(3);
  });

  it("is idempotent — a second apply neither duplicates nor errors", () => {
    applyJobExtras(db, jobId, extras());
    const counts = applyJobExtras(db, jobId, extras());
    expect(listSchedule(db, jobId)).toHaveLength(1);
    expect(counts.documents).toBe(0); // already present, not re-inserted
    expect(getJob(db, jobId)!.resumeId).toBe("doc-1");
  });

  it("rebooks a stage that moved rather than inserting a second row", () => {
    applyJobExtras(db, jobId, extras());
    applyJobExtras(
      db,
      jobId,
      extras({
        prep: [
          {
            stage: "Screen",
            scheduledFor: "2026-09-02",
            prepNotes: "Rescheduled",
            outcome: "passed",
            questions: [],
          },
        ],
      }),
    );
    const steps = listSchedule(db, jobId);
    expect(steps).toHaveLength(1);
    expect(steps[0].scheduledFor).toBe("2026-09-02");
    expect(steps[0].prepNotes).toBe("Rescheduled");
    expect(steps[0].outcome).toBe("passed");
  });

  it("shares one document row across every job that referenced it", () => {
    const other = createJob(
      db,
      jobCreateSchema.parse({ company: "Assured", role: "Staff SRE" }),
    ).id;
    applyJobExtras(db, jobId, extras());
    const counts = applyJobExtras(db, other, extras());
    expect(counts.documents).toBe(0);
    expect(getJob(db, other)!.resumeId).toBe("doc-1");
  });

  it("leaves fields alone when the backup has nothing for them", () => {
    applyJobExtras(db, jobId, extras());
    applyJobExtras(
      db,
      jobId,
      extras({ skillMatch: null, jdSnapshot: null, resume: null, prep: [] }),
    );
    const job = getJob(db, jobId)!;
    expect(job.skillMatch).toBe('{"score":0.75}');
    expect(job.jdSnapshot).toBe("Long JD text");
    expect(job.resumeId).toBe("doc-1");
    expect(listSchedule(db, jobId)).toHaveLength(1);
  });
});
