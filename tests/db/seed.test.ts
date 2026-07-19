import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { seedIfEmpty } from "@/db/seed";
import { getJob, listJobs } from "@/server/jobs";
import { listQuerySchema } from "@/lib/schemas";

const SEED_PATH = path.join(process.cwd(), "data", "jobs_seed.json");

let db: DB;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
});

describe("seedIfEmpty", () => {
  it("imports all 53 seed jobs into an empty database", () => {
    const result = seedIfEmpty(db, SEED_PATH);
    expect(result.imported).toBe(53);
    expect(listJobs(db, listQuerySchema.parse({}))).toHaveLength(53);
  });

  it("writes an initial status_history row per imported job", () => {
    seedIfEmpty(db, SEED_PATH);
    const detail = getJob(db, "job-001");
    expect(detail?.statusHistory).toHaveLength(1);
    expect(detail?.statusHistory[0].fromStatus).toBeNull();
  });

  it("marks seeded jobs with import provenance", () => {
    seedIfEmpty(db, SEED_PATH);
    expect(getJob(db, "job-001")?.source).toBe("import");
  });

  it("is a no-op when the database already has jobs", () => {
    seedIfEmpty(db, SEED_PATH);
    const second = seedIfEmpty(db, SEED_PATH);
    expect(second.imported).toBe(0);
    expect(listJobs(db, listQuerySchema.parse({}))).toHaveLength(53);
  });

  it("is a no-op when the seed file does not exist", () => {
    expect(seedIfEmpty(db, "/nonexistent/seed.json").imported).toBe(0);
  });

  it("fails fast with the row index when a seed row is malformed", () => {
    const bad = path.join(os.tmpdir(), `bad-seed-${Date.now()}.json`);
    fs.writeFileSync(
      bad,
      JSON.stringify([
        { id: "job-001", company: "Good Co", role: "SRE" },
        { id: "job-002", company: "", role: "Missing company" },
      ]),
    );
    expect(() => seedIfEmpty(db, bad)).toThrow(/row 1/i);
    fs.unlinkSync(bad);
  });

  it("accepts an export-envelope seed ({ exportedAt, source, jobs: [...] })", () => {
    const wrapped = path.join(os.tmpdir(), `wrapped-seed-${Date.now()}.json`);
    fs.writeFileSync(
      wrapped,
      JSON.stringify({
        exportedAt: "2026-07-17",
        source: "excel-tracker",
        jobs: [
          { id: "job-001", company: "Acme", role: "Senior SRE" },
          { id: "job-002", company: "NewCo", role: "Staff SRE" },
        ],
      }),
    );
    expect(seedIfEmpty(db, wrapped).imported).toBe(2);
    fs.unlinkSync(wrapped);
  });

  it("tolerates exporter metadata fields and preserves supplied history", () => {
    const wrapped = path.join(os.tmpdir(), `history-seed-${Date.now()}.json`);
    fs.writeFileSync(
      wrapped,
      JSON.stringify({
        jobs: [
          {
            id: "job-001",
            company: "Acme",
            role: "Senior SRE",
            status: "Screen",
            createdAt: "2026-06-01",
            updatedAt: "2026-07-10",
            statusHistory: [
              { fromStatus: null, toStatus: "Applied", changedAt: "2026-06-01" },
              { fromStatus: "Applied", toStatus: "Screen", changedAt: "2026-07-10" },
            ],
          },
          {
            id: "job-002",
            company: "NewCo",
            role: "Staff SRE",
            createdAt: "2026-07-01",
            updatedAt: "2026-07-01",
            statusHistory: [],
          },
        ],
      }),
    );
    expect(seedIfEmpty(db, wrapped).imported).toBe(2);

    const withHistory = getJob(db, "job-001");
    expect(withHistory?.createdAt).toBe("2026-06-01");
    expect(withHistory?.statusHistory).toHaveLength(2);
    expect(withHistory?.statusHistory[1]).toMatchObject({
      fromStatus: "Applied",
      toStatus: "Screen",
      changedAt: "2026-07-10",
    });

    // empty statusHistory falls back to the standard initial row
    const withoutHistory = getJob(db, "job-002");
    expect(withoutHistory?.statusHistory).toHaveLength(1);
    expect(withoutHistory?.statusHistory[0].fromStatus).toBeNull();
    fs.unlinkSync(wrapped);
  });

  it("rejects a seed file with neither an array nor a jobs array", () => {
    const bad = path.join(os.tmpdir(), `bad-shape-${Date.now()}.json`);
    fs.writeFileSync(bad, JSON.stringify({ jobs: "nope" }));
    expect(() => seedIfEmpty(db, bad)).toThrow(/array/i);
    fs.unlinkSync(bad);
  });
});
