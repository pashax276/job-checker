import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { jobCreateSchema } from "@/lib/schemas";
import { createJob } from "@/server/jobs";
import {
  addQuestion,
  listAllSchedules,
  removeQuestion,
  setQuestions,
  updateQuestion,
  upsertStageSchedule,
} from "@/server/schedule";

let db: DB;
let jobId: string;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  jobId = createJob(
    db,
    jobCreateSchema.parse({ company: "Acme", role: "Senior SRE" }),
  ).id;
  upsertStageSchedule(db, jobId, "Screen", "2026-08-01");
});

describe("question CRUD", () => {
  it("starts empty", () => {
    const [row] = listAllSchedules(db);
    expect(row.questions).toEqual([]);
  });

  it("adds a question with a null response", () => {
    const questions = addQuestion(db, jobId, "Screen", "Is this remote?");
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      text: "Is this remote?",
      response: null,
    });
    expect(questions[0].id).toBeTruthy();
  });

  it("records a response to a specific question without touching others", () => {
    addQuestion(db, jobId, "Screen", "Is this remote?");
    const [, second] = addQuestion(db, jobId, "Screen", "What's the timeline?");
    const questions = updateQuestion(db, jobId, "Screen", second.id, {
      response: "ASAP, they want someone in 2 weeks",
    });
    expect(questions[0].response).toBeNull();
    expect(questions[1].response).toBe("ASAP, they want someone in 2 weeks");
  });

  it("edits question text", () => {
    const [q] = addQuestion(db, jobId, "Screen", "Draft wording");
    const questions = updateQuestion(db, jobId, "Screen", q.id, {
      text: "Final wording?",
    });
    expect(questions[0].text).toBe("Final wording?");
  });

  it("removes a question", () => {
    const [q1] = addQuestion(db, jobId, "Screen", "First");
    addQuestion(db, jobId, "Screen", "Second");
    const questions = removeQuestion(db, jobId, "Screen", q1.id);
    expect(questions).toHaveLength(1);
    expect(questions[0].text).toBe("Second");
  });

  it("setQuestions replaces the whole list (bulk import from AI text)", () => {
    addQuestion(db, jobId, "Screen", "Stale question");
    const questions = setQuestions(db, jobId, "Screen", [
      { id: "a", text: "Imported one", response: null },
      { id: "b", text: "Imported two", response: null },
    ]);
    expect(questions.map((q) => q.text)).toEqual([
      "Imported one",
      "Imported two",
    ]);
  });

  it("rejects operations against a step with no booked date", () => {
    expect(() => addQuestion(db, jobId, "Panel", "x")).toThrow(/no booked/i);
  });

  it("rejects updating a question id that doesn't exist", () => {
    expect(() =>
      updateQuestion(db, jobId, "Screen", "missing-id", { response: "x" }),
    ).toThrow(/no question/i);
  });

  it("rebooking a date does not wipe out captured questions/responses", () => {
    const [q] = addQuestion(db, jobId, "Screen", "Q1");
    updateQuestion(db, jobId, "Screen", q.id, { response: "Answered" });
    upsertStageSchedule(db, jobId, "Screen", "2026-08-05"); // reschedule
    const [row] = listAllSchedules(db);
    expect(row.questions).toHaveLength(1);
    expect(row.questions[0].response).toBe("Answered");
  });
});
