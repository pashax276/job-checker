# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/); versions follow
[SemVer](https://semver.org/).

## [1.4.1] - 2026-07-22

### Fixed
- Skill match's "Check match" button was silently disabled whenever a job
  had no posting URL — no tooltip, no hint, nothing to explain why
  clicking it did nothing. Added a `title` and an inline note pointing
  at the posting URL field.
- A posting site blocking automated fetches (Coinbase returns 403; this
  is expected, not a bug) surfaced as a bare "Posting fetch failed
  (403)" toast. 401/403 now explain what's actually happening and
  suggest pasting the JD into notes instead.

Found investigating a report that skill match "does not work" after
adding a resume — reproduced against real data: it actually worked
correctly for jobs with a reachable posting URL (Babylist scored 55%
live), the failure was specific to jobs missing a posting URL or whose
posting page blocks scraping.

## [1.4.0] - 2026-07-21

### Added
- Import now accepts `.json` alongside `.xlsx`/`.csv` — a bare array (the
  shape `GET /api/export?format=json` produces) or a `{ jobs: [...] }`
  envelope (the seed file's shape). Each entry maps through the same
  `jobToTrackerRow()` column mapping xlsx/csv export uses, so duplicate
  detection (company + role, case-insensitive) behaves identically
  across all three formats — no separate ID-based matching path.

## [1.3.1] - 2026-07-21

### Fixed
- Every Prep card with empty notes defaulted to an autofocused textarea.
  With multiple such cards on one page, they fought for focus on mount
  and the browser auto-scrolled to whichever mounted last — silently
  burying the new "nothing booked yet" banner (and anything else) off
  the visible viewport. Autofocus now only fires on a genuine
  user-triggered edit (clicking Edit), never on the initial page-load
  mount.

## [1.3.0] - 2026-07-21

### Added
- Table rows and Board cards now have a "prep" link/icon that deep-links
  into `/prep?job=<id>`, scrolling to and highlighting that job's booked
  step if one exists. If nothing's booked yet, the Prep page shows an
  inline banner ("Nothing booked yet for X — Y") with a button straight
  to that job's drawer instead of a dead end.

## [1.2.1] - 2026-07-21

### Fixed
- The Prep rail's "Questions to ask" section had no visible way to edit
  it — the only Edit button lived on the main notes block, and it wasn't
  obvious that editing it also covers the rail content (same underlying
  text, split for display only). Lifted the edit state up to the card
  level so the rail gets its own Edit affordance that opens the same
  shared editor; while editing, the rail shows a pointer back to the
  notes field instead of stale rendered content.
- That new rail Edit button initially overlapped the wrapped "Questions
  to ask" heading text (absolute positioning collided with a two-line
  heading) — moved it into its own in-flow row above the content.

## [1.2.0] - 2026-07-21

### Changed
- Prep cards now always show a right-hand rail (research links, JD
  snapshot, skill gaps, and the AI-generated "Questions to ask" section
  when present) instead of only splitting into two columns when a brief
  happened to include that heading — every card gets a purposeful right
  column, not just ones with AI output.
- Widened the Prep and Resumes pages from `max-w-4xl` to `max-w-6xl`.
  Resumes already had a 2-column document grid; it was just starved for
  room in a narrow container, squeezing each card to ~440px.

## [1.1.0] - 2026-07-21

### Fixed
- Dashboard funnel copy still described the old "furthest stage ever
  reached" semantics after the underlying logic had already been
  corrected to last-occupied-stage — the numbers were right, the label
  was lying about what they meant.
- Funnel math let a stray `dateApplied` value override a job's real
  current status (e.g. a card moved back to Evaluating/Skipped without
  clearing a `dateApplied` set from briefly touching "Applied" in the
  status dropdown), inflating the Applied count. `dateApplied` is now
  only consulted when neither current status nor history resolves to
  anything.

### Added
- Prep notes render as formatted markdown (headings, bold, blockquotes,
  lists) in a read-by-default view instead of raw text in a plain
  textarea, with a hover-to-reveal Edit toggle. A `## Questions to ask`
  heading, if present, splits into a right-hand sidebar next to the main
  narrative instead of burying it mid-document.

## [1.0.0] - 2026-07-20

First versioned release. Self-hosted job pipeline tracker: dashboard/
board/table/drawer views, xlsx/csv/json import-export, ATS discovery
(Greenhouse/Lever/Ashby + Google Alerts RSS), resumes with parsed
skills/bullets/job history, interview prep workspace, skill-match
scoring, AI-assisted drafts, calendar/ICS subscription, nightly backups,
Prometheus metrics + Grafana dashboard, Docker Compose (primary) and
Helm + Argo CD GitOps (secondary) deployment paths, 229 unit tests + 7
Playwright e2e.
