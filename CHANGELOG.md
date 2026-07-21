# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/); versions follow
[SemVer](https://semver.org/).

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
