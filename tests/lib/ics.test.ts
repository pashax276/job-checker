import { describe, expect, it } from "vitest";
import { buildFollowUpCalendar } from "@/lib/ics";
import type { Job } from "@/lib/types";

const TODAY = new Date(2026, 6, 17, 12, 0, 0);

const job = (over: Partial<Job>): Job => ({
  id: "job-001",
  company: "Acme",
  role: "Senior SRE",
  priorityTier: "3 - Mid",
  status: "Applied",
  dateApplied: null,
  compNotes: null,
  nextAction: null,
  followUpDate: null,
  contact: null,
  notes: null,
  postingUrl: null,
  resumeVersion: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  ...over,
});

describe("buildFollowUpCalendar", () => {
  it("emits a VEVENT per upcoming follow-up (today or later)", () => {
    const ics = buildFollowUpCalendar(
      [
        job({ id: "a", followUpDate: "2026-07-17" }),
        job({ id: "b", company: "Babylist", followUpDate: "2026-07-25" }),
        job({ id: "c", company: "Old", followUpDate: "2026-07-01" }),
        job({ id: "d", company: "None", followUpDate: null }),
      ],
      TODAY,
    );
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260725");
    expect(ics).toContain("SUMMARY:Follow up: Babylist — Senior SRE");
    expect(ics).toContain("UID:a@job-tracker");
    expect(ics).not.toContain("Old");
  });

  it("uses CRLF line endings per RFC 5545", () => {
    const ics = buildFollowUpCalendar([job({ followUpDate: "2026-07-20" })], TODAY);
    expect(ics.includes("\r\n")).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });
});
