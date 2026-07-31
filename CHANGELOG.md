# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/); versions follow
[SemVer](https://semver.org/).

## [1.9.0] - 2026-07-31

### Changed
- **Discovery now enforces the location constraint it was only describing.**
  `classifyLocation` was computed and stored, but nothing ever filtered on
  it — every posting became a lead regardless of where it was, so an
  onsite-in-London role sat in the Inbox next to a remote-US one. Two
  changes: the classifier gained `Onsite-elsewhere` and `Remote-other` so a
  location it can positively place (a named city, a US state, a non-US
  country) is no longer lumped in with genuinely unreadable ones; and
  discovery drops those two classes. San Diego and US-remote pass.
  `Unverified` deliberately still passes — a location we can't read is
  worth eyeballing, whereas one we can place elsewhere isn't. Verified
  against the live boards: 35 postings correctly cut, including every
  Anthropic role (SF/NYC/Seattle), Databricks' Bay Area and Costa Rica
  listings, and remote-but-Canada/UK/Spain roles.
- **The title gate now requires the role to actually be platform work.**
  It matched the domain word anywhere in the title, so "Senior Software
  Engineer, GenAI Platform" and "Staff Android Engineer (Clients
  Platform)" qualified on the word "Platform" alone — the team name, not
  the job. A title now passes if the discipline names the role
  ("Infrastructure Engineer", "Site Reliability Engineer", a bare "SRE"),
  or if it's a software-engineering role on a core-infra team
  (Infrastructure / Kubernetes / Cloud / Compute / Storage / Data
  Platform) — but not when the qualifier is ML/AI or product-shaped
  (GenAI, Machine Learning, Full Stack, Frontend, Mobile, Backend, Ads).
  Cut 77 false positives across the watched boards, while keeping
  "Software Engineer, Kubernetes Platform"-style roles that are genuinely
  infrastructure work.

## [1.8.0] - 2026-07-31

### Fixed
- **Calendar legend didn't match the calendar.** The legend was a hardcoded
  four (Screen / HM Interview / Panel / Follow-up) while the grid plots any
  of six schedulable stages plus follow-ups. So **Applied** — by far the
  most common booked stage (19 of 39 events in real data) — was plotted in
  blue with nothing in the legend to decode it, while **Panel** was
  advertised with a colour despite nothing being booked at that stage. The
  dot colours themselves were always correct; only the legend lied. It is
  now derived from the events actually present, in pipeline order, so it
  can't drift from the grid again. The legend is also a labelled list now,
  so screen readers (and tests) can address it.

### Added
- **Two more ATS board types for the watchlist: Workable and Recruitee.**
  Both expose a public, unauthenticated JSON endpoint that returns each
  posting's full description in the list response — the same one-request
  shape Greenhouse/Lever/Ashby use, so they drop straight into the existing
  poll-and-filter pipeline. Verified against live boards before shipping
  (Workable returned 29 postings, all with descriptions and locations).
  Workable splits location across city/state/country with a separate
  `telecommuting` flag, so it's composed into one string the location
  classifier can actually read; Recruitee keeps requirements in their own
  field, folded into the description so the AWS gate can see them.
  Pasted Workable/Recruitee posting URLs are now recognised too.
  - Deliberately *not* added, having tested them: **SmartRecruiters** and
    **Rippling** (their list responses carry no description, and the
    description gate rejects anything without one — they'd contribute zero
    leads without an extra detail fetch per posting, 769 of them for
    Rippling's board alone), **BambooHR** (serves HTML, no JSON board API),
    and **Workday** (no public per-tenant board API). SmartRecruiters and
    Workday are covered by the Google Alerts RSS path instead, which now
    ships a default query for each.
- **A consistent "how did this job get here" icon** across table, board,
  and drawer: radar for Run-discovery finds, download for tracker imports,
  pen for hand-added. Previously the board had icons, the table had a text
  badge tucked into the aging column, and the drawer showed nothing —
  and **manual had no indicator anywhere**, which made "added by hand"
  indistinguishable from "this view forgot to render it". One shared
  component now, so the three views can't drift apart.

## [1.7.0] - 2026-07-24

### Added
- **Questions the interviewer asked you**: the structured Q&A list in Prep
  (Stack/Agenda/Checklist, all sharing the same rail) now tracks who asked
  each question, not just questions you plan to ask them. Every question
  gets a "You"/"Them" tag — click it to switch direction — and the
  response field's placeholder adapts ("Their response, your read on it…"
  vs. "Your answer, how it landed…"). Legacy questions (recorded before
  this field existed) default to "You", preserving their original meaning.
  The "Add a question" form has the same tag to pick direction before
  typing, defaulting to "You".
- **JSON export is now a real backup, not just the spreadsheet columns**:
  `GET /api/export?format=json` previously only ever serialized the flat
  `jobs` table (same shape as xlsx/csv), so `resumeId`/`coverLetterId`
  exported as bare, dangling IDs and all prep work (notes, booked stages,
  structured questions) was silently absent from every export format.
  JSON export now embeds each job's full resume/cover letter content
  (extracted text, not the 2,500-char excerpt used elsewhere, plus parsed
  skills/bullets/experience) and its complete prep history per stage
  (notes, outcome, and the structured question list with each one's
  You/Them tag). xlsx/csv are unchanged — they stay the flat original
  tracker column layout by design. The extra fields are additive and
  ignored by re-import, so JSON export/import continues to round-trip
  exactly as before.

## [1.6.3] - 2026-07-23

### Fixed
- The Import dialog's preview table was still visibly cut off after 1.6.2 —
  that fix (correct `overflow-x-hidden` clipping) was working exactly as
  intended, but it exposed a second, separate bug: `ImportDialog` passed an
  unprefixed `max-w-2xl` override, while the shared `DialogContent` base
  sets `sm:max-w-sm`. Tailwind always emits responsive-variant rules after
  base rules in the generated stylesheet, so at any viewport ≥ 640px the
  base `sm:max-w-sm` won the cascade regardless of the override — the
  dialog silently stayed at 384px instead of the intended 672px, so its
  4-column table and description text got correctly clipped at the
  (wrong, too-narrow) border. `AddJobDialog` and the job drawer's `Sheet`
  already used variant-scoped overrides (`sm:max-w-2xl`,
  `data-[side=right]:sm:max-w-xl`) and were unaffected; `ImportDialog` now
  matches that pattern. Added an e2e regression test that round-trips a
  real export through Import and asserts the preview table's bounding box
  never exceeds the dialog's.

## [1.6.2] - 2026-07-23

### Fixed
- The shared `Dialog` and `Sheet` primitives had no horizontal overflow
  clipping — any content wider than the dialog (the Import preview
  table, and anything similar in Add job or the job drawer) visually
  bled out past the rounded border while the border itself stayed put.
  Root-caused to `src/components/ui/dialog.tsx` and `sheet.tsx` having
  no `overflow` set at all; fixed once at the shared-component level
  (`overflow-x-hidden overflow-y-auto`) rather than patching each
  dialog individually, since the same gap affected Import, Add job, and
  the job drawer alike.

## [1.6.1] - 2026-07-22

### Fixed
- Prep Agenda's sidebar repeated the company name for every booked
  stage — a job with a Screen and a later HM Interview showed "Pano AI"
  twice as two full entries. Grouped by company: one header, with each
  stage listed underneath as "Stage · Date".

## [1.6.0] - 2026-07-22

### Added
- **Structured interview questions**: "Questions to ask" is no longer
  free-text markdown — each question is its own record with an editable
  response field, so you can log what the interviewer actually said
  next to the question you asked. Add/edit/remove questions inline; a
  one-click "Import N from notes" seeds structured questions from an
  AI-generated or pasted-in markdown brief the first time (`stageSchedule`
  gained a `questions` JSON column).
- **Prep page view modes** — Stack (unchanged card-per-step list),
  **Agenda** (sidebar of booked steps + a detail pane for the selected
  one, both sharing the same rail/questions UI as Stack), and
  **Checklist** (per-interview prep-readiness: resume assigned, JD
  snapshot saved, skill match checked, questions prepared — click any
  unmet item to jump to the job).
- **Resumes page view modes** — List (unchanged card grid), **Split
  view** (compact sidebar + detail pane, each resume tagged with a
  "N jobs · M/T skills" coverage badge), and **Coverage matrix** (every
  skill that's shown up as matched-or-missing across your checked
  jobs, as columns; resumes as rows; checkmarks where a resume lists
  that skill).

### Fixed
- A JSX whitespace-collapsing edge case (multi-line text with an
  expression splitting a sentence mid-line) silently dropped a space
  in the Coverage matrix's caption ("9total." instead of "9 total.") —
  caught by extracting rendered `textContent` in verification rather
  than trusting a screenshot at a glance. Fixed by using a single
  template-literal expression instead of mixed JSX text/expression.

## [1.5.0] - 2026-07-22

### Added
- Board tiles show the skill-match percentage (same color thresholds as
  the drawer: green ≥ 70%, amber ≥ 40%, red below) — but only once a
  check has actually run, so untested jobs don't clutter every tile
  with a placeholder.

### Fixed
- Skill extraction matched "Go" the language case-insensitively, so the
  extremely common English verb "go" (as in "You go look") registered
  as a JD skill mention — reproduced against Incode Technologies' real
  posting, where "Go" showed up as "missing" purely from ordinary
  prose, not an actual language requirement. "Go" now matches
  case-sensitively; real usage ("Go", "Golang") is capitalized, the
  false-positive verb is almost always lowercase mid-sentence. Not a
  complete fix — a sentence starting "Go build..." would still
  collide — but it removes the common case.

## [1.4.2] - 2026-07-22

### Fixed
- Skill match scored 0% for every Ashby posting (and likely other
  client-rendered ATS pages) — jobs.ashbyhq.com job pages are a React
  SPA, so a plain HTTP fetch returned the "You need to enable
  JavaScript to run this app." shell instead of the description,
  reproduced live against a real Pano AI posting. Greenhouse, Lever,
  and Ashby all expose a public JSON board API with the real
  description text (the same one discovery already polls) — skill
  match now tries that first, matching the posting by its stable
  per-URL id, and only falls back to scraping the HTML page for
  postings on platforms with no structured API (company career sites,
  Workday).

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
