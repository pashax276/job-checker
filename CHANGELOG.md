# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/); versions follow
[SemVer](https://semver.org/).

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
