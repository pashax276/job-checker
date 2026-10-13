# EDD Work-Search Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record which stages of a job were already reported to California EDD, and show those reports in the job drawer, its timeline, the board and the table.

**Architecture:** A new `edd_reports` table holds one row per job and stage. A server module owns reads and writes, one route exposes them, and JSON export/restore carry the rows. On the client, a drawer section marks and clears reports, and a pure `buildTimeline` merges them with status changes and notes.

**Tech Stack:** Next.js 16 route handlers, drizzle-orm on better-sqlite3, zod, TanStack Query, vitest, Playwright.

Spec: `docs/superpowers/specs/2026-10-12-edd-reports-design.md`.

Run tools on Node 22 (CI's version). `node` in the login shell is a lazy-nvm
shim that fails non-interactively, so call the binary by path:
`N=$HOME/.nvm/versions/node/v22.18.0/bin/node; $N node_modules/vitest/vitest.mjs run`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/db/schema.ts` (modify) | `eddReports` table, `EddReportRecord` |
| `drizzle/0010_edd-reports.sql` (generate) | migration |
| `src/lib/constants.ts` (modify) | `EDD_STAGES`, `EddStage` |
| `src/lib/schemas.ts` (modify) | `eddReportSetSchema`, `eddReportClearSchema` |
| `src/server/edd.ts` (create) | list / set / clear / stages-by-job |
| `src/server/jobs.ts` (modify) | `eddReports` on the job detail |
| `src/app/api/jobs/[id]/edd/route.ts` (create) | `PUT`, `DELETE` |
| `src/app/api/jobs/route.ts` (modify) | `eddStages` on list rows |
| `src/lib/edd.ts` (create) | `isEddStage`, `defaultEddStage`, `isCurrentStageReported` |
| `src/lib/dates.ts` (modify) | `localDayOf`, `formatStamp` |
| `src/lib/timeline.ts` (create) | `TimelineItem`, `buildTimeline` |
| `src/server/export.ts`, `src/lib/import-extras.ts`, `src/server/restore.ts`, `src/app/api/import/route.ts` (modify) | backup round-trip |
| `src/lib/types.ts`, `src/hooks/use-jobs.ts` (modify) | client types and mutations |
| `src/components/edd-section.tsx` (create) | drawer section |
| `src/components/job-drawer.tsx`, `src/components/badges.tsx`, `src/app/board/page.tsx`, `src/app/table/page.tsx`, `src/components/import-dialog.tsx` (modify) | timeline row, badge, import summary |

## Task 1: Table and server module

**Files:** `src/db/schema.ts`, `drizzle/0010_*`, `src/lib/constants.ts`, `src/lib/schemas.ts`, `src/server/edd.ts`, `src/server/jobs.ts`, test `tests/server/edd.test.ts`.

- [ ] Write `tests/server/edd.test.ts` against an in-memory DB: marks a stage; re-marking the same stage moves the date and keeps one row; two stages on one job list in `reportedOn` order; clear returns `true` then `false`; deleting the job cascades; `getJob` includes `eddReports`; `listEddStagesByJob` groups stages per job; the set schema rejects `Evaluating`, `Rejected` and a non-ISO date.
- [ ] Run it: `$N node_modules/vitest/vitest.mjs run tests/server/edd.test.ts`. Expected: fails to resolve `@/server/edd`.
- [ ] Add the table, then `$N node_modules/drizzle-kit/bin.cjs generate --name edd-reports`.
- [ ] Add `EDD_STAGES`, the two schemas, `src/server/edd.ts` (`listEddReports`, `setEddReport`, `clearEddReport`, `listEddStagesByJob`) and `eddReports` in `getJob`.
- [ ] Re-run the test. Expected: pass. Commit.

## Task 2: API

**Files:** `src/app/api/jobs/[id]/edd/route.ts`, `src/app/api/jobs/route.ts`, test `tests/api/edd.test.ts`.

- [ ] Write the route test: `PUT` 200 and the detail shows the report; `PUT` 404 for an unknown job; `PUT` 400 for stage `Evaluating`, for `reportedOn` `10/12/2026`, and for invalid JSON; `DELETE ?stage=Applied` 200 then 404; `GET /api/jobs` rows carry `eddStages`.
- [ ] Run it. Expected: fails to resolve the route module.
- [ ] Implement the route (wrapped in `withRouteErrors`) and decorate the list response.
- [ ] Re-run. Expected: pass. Commit.

## Task 3: Pure client helpers

**Files:** `src/lib/edd.ts`, `src/lib/dates.ts`, `src/lib/timeline.ts`, tests `tests/lib/edd.test.ts`, `tests/lib/timeline.test.ts`, `tests/lib/dates.test.ts`.

- [ ] Write the tests: `defaultEddStage` returns the current status when reportable, else the first unreported stage, else the first stage; `isCurrentStageReported` is false for `Evaluating` and for an unreported stage; `localDayOf` keeps a date-only stamp and converts a datetime to its local day; `formatStamp` renders a date-only stamp as that calendar day; `buildTimeline` returns newest-first, places a backfilled report on its `reportedOn` day, and puts a same-day report above the status change it followed.
- [ ] Run them. Expected: fail on missing modules/exports.
- [ ] Implement. Re-run. Expected: pass. Commit.

## Task 4: Backups

**Files:** `src/server/export.ts`, `src/lib/import-extras.ts`, `src/server/restore.ts`, `src/app/api/import/route.ts`, tests `tests/server/export.test.ts`, `tests/lib/import-extras.test.ts`, `tests/server/restore.test.ts`, `tests/api/import-export.test.ts`.

- [ ] Extend the tests: export embeds `eddReports` (`stage`, `reportedOn`, `createdAt`); `readJobExtras` parses them and counts malformed entries; `applyJobExtras` restores them, is idempotent, and leaves existing reports alone when the backup has none; export → wipe → import returns the reports and reports the count.
- [ ] Run them. Expected: fail on the missing fields.
- [ ] Implement. Re-run. Expected: pass. Commit.

## Task 5: UI

**Files:** `src/lib/types.ts`, `src/hooks/use-jobs.ts`, `src/components/edd-section.tsx`, `src/components/job-drawer.tsx`, `src/components/badges.tsx`, `src/app/board/page.tsx`, `src/app/table/page.tsx`, `src/components/import-dialog.tsx`, test `e2e/smoke.spec.ts`.

- [ ] Add the e2e test: open a job's drawer, mark a stage reported, expect the chip and a "Reported to EDD" timeline row, reload, expect both again, and expect the EDD badge on the table row once the current status is reported.
- [ ] Add client types and `setEddReport` / `clearEddReport` mutations (they invalidate `jobKeys.all`, since the list rows carry `eddStages`).
- [ ] Build `EddSection`, switch the drawer's Timeline to `buildTimeline` with the `edd` row, add `EddBadge` to the board card and table status cell, and name restored EDD reports in the import toast.
- [ ] `npm run build`, then `playwright test`. Expected: pass. Commit.

## Task 6: Release

- [ ] `package.json` to 1.12.0, CHANGELOG entry, README endpoint line.
- [ ] `npm run lint && npm run typecheck && npm run test:coverage`. Expected: clean, coverage at or above the configured 80% thresholds. Commit.
