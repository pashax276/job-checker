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

  it("rejects a seed file that is not a JSON array", () => {
    const bad = path.join(os.tmpdir(), `bad-shape-${Date.now()}.json`);
    fs.writeFileSync(bad, JSON.stringify({ jobs: [] }));
    expect(() => seedIfEmpty(db, bad)).toThrow(/array/i);
    fs.unlinkSync(bad);
  });
});
