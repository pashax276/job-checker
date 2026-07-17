# Job Pipeline Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-hosted single-user job-application pipeline tracker (dashboard / kanban / table / detail drawer / import-export / ATS+RSS discovery) replacing an Excel tracker, deployable via Docker Compose (primary) and Helm+Argo CD (secondary), with GitHub Actions CI.

**Architecture:** Next.js 15 App Router monolith (UI + API routes in one artifact) over SQLite via Drizzle ORM. All business logic lives in pure, unit-testable modules under `src/lib` and `src/server`; route handlers are thin zod-validated shells. Migrations + first-run seed + optional discovery cron run once at server start via `instrumentation.ts`. Derived fields (`daysSinceApplied`, `daysInCurrentStage`, `followUpDue`) are computed, never stored.

**Tech Stack:** Next.js 15 / React 19 / TypeScript strict, Tailwind v4 + shadcn/ui, Drizzle + better-sqlite3, TanStack Query v5 + Table v8, dnd-kit, Recharts, zod, exceljs + papaparse (import/export), rss-parser + node-cron (discovery), vitest + Playwright.

**Environment notes (this machine):**
- Non-interactive zsh breaks on `nvm` lazy-load (`_lazy_nvm` recursion). Prefix every command with
  `export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:/opt/homebrew/bin:$PATH"`.
- Node v22.18.0 (nvm), docker/helm/kind/kubectl in /opt/homebrew/bin.
- `data/jobs_seed.json` was NOT provided (Drive connector unauthorized). Ship a 53-row synthetic
  placeholder in identical schema; owner swaps in real export. Document loudly in README.

---

## Locked contracts

### Enums (`src/lib/constants.ts`)
```ts
export const STATUSES = ["Evaluating","Applied","Screen","Assessment","Panel","Offer","Skipped","Rejected"] as const;
export const TIERS = ["1 - Top","2 - High","3 - Mid","4 - Queue","5 - Hold","Closed"] as const;
export type Status = (typeof STATUSES)[number];
export type Tier = (typeof TIERS)[number];
// Excel/CSV column order — export must match, import must accept:
export const TRACKER_COLUMNS = ["Company","Role","Priority Tier","Status","Date Applied","Comp Notes","Next Action","Follow-Up Date","Contact","Notes","Posting URL"] as const;
export const ACTIVE_EXCLUDED_STATUSES = ["Skipped","Rejected"] as const; // active pipeline = tier != Closed && status not in this list
```

### Drizzle schema (`src/db/schema.ts`) — sqlite
```ts
jobs: id text pk, company text notnull, role text notnull,
  priorityTier text notnull default '3 - Mid', status text notnull default 'Evaluating',
  dateApplied text (ISO yyyy-mm-dd, nullable), compNotes, nextAction, followUpDate (same), contact, notes, postingUrl — all text nullable,
  createdAt/updatedAt text notnull (ISO datetime)
status_history: id text pk, jobId text notnull references jobs.id on delete cascade,
  fromStatus text nullable (null = initial insert), toStatus text notnull, changedAt text notnull
watchlist: id text pk, displayName text notnull, atsType text notnull ('greenhouse'|'lever'|'ashby'), boardSlug text notnull, enabled integer(bool) notnull default true
leads: id text pk, url text notnull unique, title text notnull, company text nullable,
  source text notnull ('ats-poll'|'alerts-rss'), atsType text nullable, locationClass text notnull ('San Diego'|'Remote-US'|'Unverified'),
  matchedKeywords text nullable (JSON array), status text notnull default 'new' ('new'|'promoted'|'dismissed'), fetchedAt text notnull
settings: key text pk, value text notnull  // rssFeeds (JSON array), profileBlurb, lastDiscoveryRun (JSON log)
```

### Derived fields (`src/lib/dates.ts`) — pure, unit-tested, take `today: Date` param
```ts
daysSinceApplied(dateApplied: string|null, today: Date): number|null
daysInCurrentStage(lastStatusChangeAt: string, today: Date): number
isFollowUpDue(followUpDate: string|null, today: Date): boolean   // followUpDate <= today (date-only compare)
```

### API envelope (`src/lib/api-response.ts`) — per owner's global standard
`{ ok: boolean, data: T|null, error: string|null }`

### REST surface (spec-fixed)
```
GET/POST /api/jobs   GET/PATCH/DELETE /api/jobs/:id   POST /api/import
GET /api/export?format=xlsx|json   GET /api/stats   GET /healthz   GET /readyz
GET /api/export/ics                       (follow-up calendar, optional feature 8)
GET/POST /api/leads-list via /api/leads   PATCH /api/leads/:id (promote|dismiss)
GET/POST /api/watchlist  PATCH/DELETE /api/watchlist/:id
GET/PUT /api/settings    POST /api/discovery/run (idempotent)
```
PATCH /api/jobs/:id with a changed `status` writes a `status_history` row in the same transaction.

### Discovery filters (`src/server/discovery/filters.ts`)
```
titleInclude:  /(Senior|Staff|Sr\.?)/i  AND  /(Platform|DevOps|SRE|Site Reliability|Infrastructure)/i
titleExclude:  /(Junior|Intern|Entry.Level)/i
description must match /AWS/i
locationClass: 'San Diego' if location matches /san diego/i; 'Remote-US' if /remote/i AND (/(united states|US|USA|America)/i or explicit US remote flags); else 'Unverified'. Never guess.
Dedupe: exact URL against leads; case-insensitive trimmed (company+title) against leads AND jobs.
```

### File map
See repo tree after Task 1; logic modules in `src/lib` + `src/server` each < 300 lines, one responsibility, mirrored by `tests/**/*.test.ts`.

---

## Tasks

### Task 1: Scaffold, tooling, git
- [ ] `git init`, MIT LICENSE, .gitignore (node, .next, data/*.db*, .env*)
- [ ] `create-next-app@latest` (TS, ESLint, Tailwind v4, App Router, src dir, no turbopack build)
- [ ] Add deps: drizzle-orm better-sqlite3 zod @tanstack/react-query @tanstack/react-table @dnd-kit/core @dnd-kit/sortable recharts exceljs papaparse rss-parser node-cron next-themes lucide-react; dev: drizzle-kit vitest @vitest/coverage-v8 playwright @playwright/test @types/better-sqlite3 @types/papaparse tsx
- [ ] shadcn/ui init + components: button card dialog sheet input select table badge dropdown-menu label textarea sonner tabs command
- [ ] vitest.config.ts (node env, coverage v8, `tests/**`), `npm test` green (empty), commit

### Task 2: constants + zod schemas (TDD)
- [ ] tests/lib/schemas.test.ts: jobCreate requires company+role, defaults tier `3 - Mid` status `Evaluating`, rejects bad enum/date; jobPatch partial; listQuery coerces `dueOnly`; importRow maps TRACKER_COLUMNS
- [ ] RED → implement src/lib/constants.ts + src/lib/schemas.ts → GREEN → commit

### Task 3: date/derived logic (TDD)
- [ ] tests/lib/dates.test.ts: fixed `today=2026-07-17`; null handling; same-day due=true; tomorrow=false; timezone-safe date-only compare
- [ ] RED → src/lib/dates.ts → GREEN → commit

### Task 4: DB layer + jobs repository (TDD, in-memory sqlite)
- [ ] drizzle.config.ts + schema.ts + client.ts (DATABASE_PATH env, default ./data/tracker.db, `:memory:` for tests) + migrate.ts; `drizzle-kit generate` → drizzle/
- [ ] tests/server/jobs.test.ts: create writes initial history row (fromStatus null); patch w/ status change appends history; patch w/o status change doesn't; delete cascades; list filters (status, tier, q full-text company/role/notes/contact, dueOnly); get includes history
- [ ] RED → src/server/jobs.ts → GREEN → commit

### Task 5: first-run seed
- [ ] data/jobs_seed.json — 53 synthetic rows, ids job-001…job-053, all 8 statuses + 6 tiers represented, ≥6 overdue followUpDates, data/README.md marking it placeholder
- [ ] tests: seed import populates 53 + history rows; second call no-ops (non-empty DB); malformed row → fail fast with row index
- [ ] src/db/seed.ts + src/instrumentation.ts (migrate → seed) → GREEN → commit

### Task 6: API routes (integration tests via route handlers)
- [ ] tests/api/jobs.test.ts calling route handlers directly w/ Request objects: envelope shape, 400 on zod fail, 404 unknown id, status change → history, stats aggregates (counts per status, active total, overdue list oldest-first, aging per active job), healthz 200, readyz 503 pre-migrate/200 post
- [ ] Implement app/api/jobs, jobs/[id], stats, healthz, readyz, api-response.ts, src/server/stats.ts → GREEN → commit

### Task 7: UI foundation
- [ ] globals.css: Phase-0-style tokens as CSS vars (dark-first Linear-ish: bg #0e1013 layers, tier ramp warm→cool: T1 amber, T2 orange-rose, T3 blue, T4 steel, T5 slate-cool, Closed grey; status accents; light-mode overrides) + next-themes provider
- [ ] providers.tsx (QueryClient + Theme), layout.tsx w/ sidebar nav (Dashboard/Board/Table/Inbox/Settings), TierBadge/StatusBadge/DueBadge components
- [ ] hooks/use-jobs.ts: TanStack Query hooks w/ optimistic PATCH + rollback on error (toast)
- [ ] commit

### Task 8: Dashboard (`app/page.tsx`)
- [ ] status count cards, active-pipeline card, new-leads card (0 until Task 15), overdue list oldest-first, Recharts horizontal bar: days-in-stage for active jobs → commit

### Task 9: Kanban (`app/board/page.tsx`)
- [ ] dnd-kit columns per status w/ counts; card = company/role/TierBadge/DueBadge; drop → optimistic PATCH status; click → drawer → commit

### Task 10: Table (`app/table/page.tsx`)
- [ ] TanStack Table v8: all columns sortable; filters status/tier/due-only; `q` search box; column visibility dropdown; inline status Select per row; row click → drawer; postingUrl external link → commit

### Task 11: Drawer + Add modal
- [ ] components/job-drawer.tsx (Sheet): edit all fields, history timeline from GET /api/jobs/:id, delete w/ confirm dialog
- [ ] components/add-job-dialog.tsx: zod-resolver form, company+role required, defaults → commit

### Task 12: Import/Export (TDD on lib)
- [ ] tests: xlsx round-trip preserves TRACKER_COLUMNS order+values; csv parse; dedupe util case-insensitive (company+role) vs existing; ics output has VCALENDAR/VEVENT per upcoming follow-up
- [ ] src/lib/xlsx.ts (exceljs), csv.ts, dedupe.ts, ics.ts → GREEN
- [ ] POST /api/import (multipart; mode=preview returns rows + duplicate flags; mode=commit applies per-row skip/update choices), GET /api/export (xlsx|json), GET /api/export/ics
- [ ] components/import-dialog.tsx (upload → preview table → per-dup skip/update → commit) + export buttons → commit

### Task 13: Shortcuts + polish
- [ ] hooks/use-shortcuts.ts: `/` focus search, `n` new job, `1-4` nav (ignore when typing in inputs); verify optimistic rollback path; commit

### Task 14: Playwright smoke
- [ ] playwright.config.ts (webServer: build+start, fresh temp DATABASE_PATH)
- [ ] e2e/smoke.spec.ts: dashboard shows seeded counts (53), table renders rows, change status via inline select → reload → persisted → commit

### Task 15: Discovery (Phase 5)
- [ ] TDD filters.ts (title/desc/location/dedupe fixtures incl. Unverified) then ats.ts (greenhouse/lever/ashby normalizers vs fixture JSON, sequential fetch, UA header, 4xx skip counter), rss.ts (google alerts item → lead candidate, ATS/company from URL patterns)
- [ ] run.ts orchestration (per-source counts fetched/matched/deduped/created; log → settings.lastDiscoveryRun), POST /api/discovery/run idempotent
- [ ] leads/watchlist/settings routes + repositories (promote → creates Evaluating/3 - Mid job w/ postingUrl, blocks dup; dismiss)
- [ ] watchlist seed (Platform Science, Babylist, PrizePicks, Ava Labs @greenhouse; Talkiatry @ashby) on first run
- [ ] Inbox page (grouped by locationClass, Promote/Dismiss), Settings page (watchlist CRUD, RSS feeds, profile blurb, Run now + last-run log), dashboard new-leads card wired
- [ ] cron.ts: node-cron @ DISCOVERY_CRON default `0 14 * * *`, gated DISCOVERY_ENABLED, started from instrumentation.ts → commit

### Task 16: Docker (Phase 2)
- [ ] next.config output:'standalone'; Dockerfile deps→build→node:22-alpine runner, non-root `node`, HEALTHCHECK wget /healthz, <300MB; docker-compose.yml per spec + DISCOVERY_* env
- [ ] Acceptance: compose up → dashboard w/ 53 jobs; down/up → data persists → commit

### Task 17: Helm + Argo CD (Phase 3)
- [ ] charts/job-tracker: Deployment (replicas 1, Recreate, probes /healthz /readyz, resources, securityContext runAsNonRoot+drop ALL+no-priv-esc), PVC 1Gi, Service, optional Ingress, ConfigMap, Secret (basic auth), values-gated discovery CronJob (curl POST /api/discovery/run; sets DISCOVERY_ENABLED=false in-app), NOTES.txt + README noting SQLite single-replica constraint
- [ ] `helm lint` + `helm template` (incl. cronJob.enabled=true) validate; kind install if daemon available
- [ ] argocd/application.yaml → commit

### Task 18: CI (Phase 4)
- [ ] .github/workflows/ci.yml: lint → typecheck → vitest → playwright smoke → docker build+push GHCR on main; heavily commented (named skills-gap practice) → commit

### Task 19: Hygiene + acceptance
- [ ] README (quickstart compose/helm/argo, seed swap instructions, kind/k3d walkthrough, Postgres migration path doc, discovery setup), .env.example, middleware.ts basic auth (off by default)
- [ ] Run full acceptance checklist from spec; fix; final commit

## Self-review
Spec coverage checked against final acceptance checklist — every box maps to a task (53-jobs boxes depend on placeholder seed caveat). Types/enums locked in "contracts" section used by all tasks. No placeholders beyond deliberate synthetic-seed decision.
