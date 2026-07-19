# design-sync notes — job-checker

Repo-specific gotchas for re-syncs. Read before running anything.

## Shape / build
- This is a Next.js **app**, not a built library — the converter runs in
  synth-entry mode. `cfg.entry` is `./index.mjs`, a deliberately nonexistent
  placeholder: it soft-fails `resolveDistEntry` into synth mode while anchoring
  `PKG_DIR` at the repo root (walk-up finds the root `package.json`).
- `cfg.srcDir` is `src/components` so the synth entry never sweeps in
  `src/app/**` pages (they'd drag server code / route handlers into the bundle).
- **Run `sh .design-sync/build-css.sh` before every `package-build.mjs`** when
  previews changed: Tailwind v4 scans repo files for utility classes, so a
  preview using a class nothing else uses needs a fresh CSS compile or the
  class silently has no effect.
- The Tailwind input is `.design-sync/tw-input.css`: the app's globals.css
  plus an `@source inline(...)` safelist of the token vocabulary and common
  layout utilities. Rendered designs get only the compiled closure (no
  Tailwind at design time), so the safelist is what makes agent-written
  classes resolve — extend it there when the conventions header grows.
- Shell env: this machine has broken nvm shims — every bash command needs
  `unset -f node npm npx nvm` first (see global memory).

## Bundle / rendering
- `.design-sync/browser-shims.ts` must stay the FIRST `extraEntries` item:
  Next's client runtime reads `process.env.__NEXT_*` at module scope and the
  bundle IIFE dies without the shim (all exports vanish, every preview fails).
- `PreviewRouter` (`.design-sync/preview-router.tsx`) provides mock Next router
  contexts (AppRouterContext + Pathname/SearchParams/PathParams) via the
  version-specific paths `next/dist/shared/lib/*.shared-runtime` — verify these
  still exist after a Next major upgrade (checked against next 16.2.10).
- `PreviewRouter` also paints `bg-background p-4` behind every cell: the app is
  dark-primary (next-themes sets `.dark` via the app's own `Providers`) and
  outline/ghost/muted styles are illegible on the harness's white cells. It
  additionally sets `document.body.style.background` (inline style — the
  harness's own inline body background beats any class) so PORTALLED overlays
  (dialogs, menus, sheets mount on body, outside the frame div) sit on the
  dark app background too.
- Provider chain: `PreviewRouter` → app's own `Providers` (QueryClient +
  ThemeProvider defaultTheme=dark + Toaster). App dialogs using TanStack Query
  hooks render because of this.

## Fonts
- Geist/Geist Mono woff2 (latin subset only) vendored in `.design-sync/fonts/`
  from the same Google Fonts source `next/font/google` uses; OFL license.
  `--font-geist-sans`/`--font-geist-mono` vars normally injected by next/font
  are defined in `.design-sync/font-vars.css` (appended by build-css.sh).

## Components
- Shadcn subcomponents (CardHeader, DialogTrigger, …) are excluded from the
  component list via `componentSrcMap: null` — one card per family; the
  subcomponents still ship as bundle exports and appear in authored previews.
- `Toaster` (sonner) is excluded from the component list (`componentSrcMap:
  null`): toasts are imperative (`toast()` lives inside the bundled sonner
  instance, not exported), so a card can only ever be blank. The export still
  ships on `window.JobChecker` and the app's `Providers` mounts one.
- Domain enums for realistic previews: Tier = "1 - Top" | "2 - High" |
  "3 - Mid" | "4 - Queue" | "5 - Hold" | "Closed"; Status = Evaluating |
  Applied | Screen | Assessment | Panel | Offer | Skipped | Rejected.

## Preview authoring (folded wave learnings)
- These primitives are **Base UI, not Radix**: state attrs are `data-checked`
  (not `data-state=checked`), separators use `data-horizontal:`/`data-vertical:`
  variants, `defaultChecked` renders statically, Tooltip accepts controlled
  `open` for a statically-open bubble, `TableRow` accepts
  `data-state="selected"` for a highlighted row.
- **tailwind-merge trap**: a utility class missing from the compiled CSS is
  not a no-op when it CONFLICTS with a component's built-in class — `cn`
  (tailwind-merge) strips the built-in (e.g. `text-right` stripped TableHead's
  `text-left`, giving browser-default centering). Previews use inline `style`
  for layout-only needs (heights, text-align); that stays robust regardless of
  CSS compile order.
- Classes first introduced by previews only enter the compiled CSS at the next
  `build-css.sh` run — mid-run authoring sees a stale CSS. Prompts for
  authoring agents must carry the class-vocabulary caution.
- Tooltip portal bubbles paint outside the dark preview frame unless the
  wrapper reserves inline height and sets align-items explicitly.
- Label's `peer-disabled:` can't fire in label-above-input DOM order; use a
  `group` wrapper with `data-disabled="true"` instead.
- First `package-capture.mjs` in a session may hit a permission prompt
  (Playwright + local HTTP server); identical retry succeeds.

## Known render warns
- Badge `ghost`/`link` variants have no resting fill by design (hover-only
  styles) — plain/teal text at rest is correct, not unstyled.
- Checkbox `disabled:opacity-50` is subtle at size-4 on dark bg — real.
- ScrollArea thumb is low-contrast by design (`bg-border` on `bg-card`).

## Deliberate scope choices
- `JobDrawer` ships the floor card: it fetches via `useJob()` and only ever
  shows "Loading…" outside the app. The conventions header tells the design
  agent to compose `Sheet` parts for drawer designs instead.
- `DropdownMenuLabel` throws outside `DropdownMenuGroup` (Base UI
  GroupContext) — reflected in the conventions header and the preview.
- Geist fonts: latin subset only, vendored (see Fonts above).

## Re-sync risks
- `.design-sync/tw-input.css` (`@source inline` safelist) is **load-bearing
  for designs**: agent-written utility classes resolve only if compiled into
  `styles.css`. If the conventions header ever names new classes/tokens,
  extend the safelist AND re-validate the header names against the fresh
  build (the base skill's conventions validation pass).
- `next/dist/shared/lib/*.shared-runtime` context paths are Next-internal;
  a Next upgrade can move them (PreviewRouter breaks → every preview blank).
- Vendored Geist woff2 is a point-in-time copy of the latin subset; if the app
  ever renders non-latin text the fallback font shows.
- `.design-sync/.cache/preview-styles.css` is generated; a stale copy hides
  new utility classes — always re-run build-css.sh (cfg.buildCmd) first.
