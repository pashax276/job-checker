# Claude Design prompt — Job Pipeline Tracker

Paste everything below the rule into Claude Design.

---

Design a visual refinement pass for **an existing, working** self-hosted job
application pipeline tracker used daily by one senior DevOps engineer. This is
an internal working tool, not a product site: information-dense but calm,
closer to Linear or a well-built internal CRM. The app is already implemented
(Next.js, Tailwind v4, shadcn/ui), so treat the system below as the baseline —
improve hierarchy, spacing, and states; propose token changes only where they
clearly improve contrast or scanability.

## Established design system (baseline — keep unless improving)

**Dark mode first** (light supported). Current dark tokens:

- Surfaces: background `#0f1115`, card `#151920`, popover `#1a1f27`,
  sidebar `#12151b`, border `#262c36`
- Text: primary `#e6e9ee`, muted `#8b94a3`
- Interactive accent (buttons, focus, links): teal `#45b3a2`
- Destructive / DUE red: `#e5534b`
- Priority-tier ramp, warmest → coolest → grey:
  T1 `#e5b04d` gold · T2 `#e08050` orange · T3 `#b08cc9` violet ·
  T4 `#6e9bd1` steel blue · T5 `#7a93a8` cool slate · Closed `#6e7681`
- Status hues (dot + label, never filled chips): Evaluating grey `#8b94a3`,
  Applied blue `#58a6ff`, Screen teal `#45b3a2`, Assessment amber `#e0b45c`,
  Panel purple `#c588dc`, Offer green `#57ab5a`, Skipped grey `#6e7681`,
  Rejected red `#e5534b`

**Typography:** Geist Sans for UI; **Geist Mono for every data value** —
dates, counts, day-counters, comp ranges, keyboard hints — with tabular
numerals. This mono-for-data treatment is the product's signature; lean into
it. 13px base on data surfaces, no oversized hero text anywhere.

**Signature accents:** overdue items carry a 2px red left rail + a small
mono `DUE` badge; tier badges are quiet outlined chips (10% tint fill);
column headers show mono counts.

## Screens to refine (all exist — improve, don't reinvent)

1. **Dashboard** — 3 summary cards (Active pipeline, Overdue follow-ups, New
   leads), 8 per-status count cards, an overdue list (oldest first, red left
   rails), and a horizontal days-in-current-stage bar chart (single teal hue,
   thin bars, mono axis). Improve: visual weight of the overdue list vs. the
   chart, and how "45 active / 3 overdue" reads at a glance.
2. **Kanban board** — 8 status columns with colored top borders, cards showing
   company, role, tier badge, DUE badge. Improve: card density, drag
   affordance, crowded columns (25 cards in Evaluating; 15 in Skipped).
3. **Table** — 11 sortable columns, filter row (status, tier, due-only,
   column visibility), inline status select per row. Improve: scanability at
   50+ rows, truncation rules for notes/next-action.
4. **Job detail drawer** (right sheet) — badges header, mono meta line
   ("applied 12d ago · 5d in Screen · posting ↗"), 2-column edit form, status
   history timeline (date → from-status → to-status). Improve: form rhythm and
   the timeline's visual language.
5. **Leads inbox** — leads grouped under San Diego / Remote-US / Unverified
   headers with promote/dismiss actions; **Unverified needs a distinct
   "verify before trusting" tone without being alarming**.

Sample data flavor (use realistic rows like): "Meridian Systems — Senior
DevOps/SRE Infrastructure Engineer, Panel, 1 - Top, follow-up 7/21" ·
"Qualcomm — Senior/Staff Platform-DevOps Engineer, Applied" · "ResMed —
Senior Platform Engineer, Evaluating". Statuses skew heavily toward
Evaluating and Skipped — design for that imbalance.

## States to cover

- Overdue-heavy dashboard (10+ overdue) vs. all-clear (zero overdue)
- Empty inbox (discovery not yet configured) and 30-lead inbox
- Light mode for every screen (paper-grey `#f4f5f7` bg, white cards, same
  hue families darkened for contrast)

## Deliverables

1. Refined mockups for the five screens + drawer, dark and light
2. An updated token sheet as CSS custom properties (only deltas from the
   baseline above, with a one-line rationale per change)
3. Micro-interaction notes: hover/focus states, drag feedback, optimistic
   update + rollback toast

Constraints: everything must be implementable with Tailwind v4 + shadcn/ui;
WCAG AA contrast on all text; keyboard focus always visible; no marketing
aesthetics, no gradients-for-decoration, no oversized display type.
