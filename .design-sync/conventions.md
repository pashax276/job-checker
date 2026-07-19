# job-checker design system — build conventions

Dark-first Tailwind v4 + shadcn (Base UI primitives) system for a job-application pipeline tracker. Geist Sans everywhere; Geist Mono for data values.

## Setup — do this in every app

Wrap the app once in `Providers` (TanStack QueryClient + theme provider that applies the dark theme + toast outlet). Without it components render in the light theme and anything using a query hook throws.

```tsx
import { Providers, Card, CardHeader, CardTitle, CardDescription, CardContent, TierBadge, StatusBadge, DueBadge } from "job-checker";

export default function App() {
  return (
    <Providers>
      <div className="min-h-screen bg-background p-6 text-foreground">
        <Card className="w-80">
          <CardHeader>
            <CardTitle>Senior Platform Engineer</CardTitle>
            <CardDescription>Anthropic · Remote (EU)</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <TierBadge tier="1 - Top" />
            <StatusBadge status="Panel" />
            <span className="font-data text-xs text-muted-foreground">12d in stage</span>
            <DueBadge />
          </CardContent>
        </Card>
      </div>
    </Providers>
  );
}
```

`AppShell` (the sidebar+topbar chrome) needs a Next.js router; wrap it in the exported `PreviewRouter` when composing it outside the real app. `JobDrawer` fetches from the app's API and only shows "Loading…" without it — compose `Sheet` parts instead for drawer designs.

## Styling idiom

Tailwind utilities with the token vocabulary below — never hex colors, never invented class names. The stylesheet is precompiled: **only classes already in `styles.css` resolve** (there is no Tailwind compiler at design time). The token vocabulary below plus common layout utilities (flex/grid, gap, p/m spacing, w/h sizes, text sizes, rounded) are all shipped; if a class seems to have no effect, check `styles.css` and use an inline style for one-off layout values.

- Surfaces: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-accent`, `bg-secondary`
- Text: `text-foreground`, `text-muted-foreground`, `text-card-foreground`, `text-popover-foreground`, `text-accent-foreground`, `text-destructive`, `text-primary`
- Action color: `bg-primary text-primary-foreground` (teal); destructive: `bg-destructive/10 text-destructive`
- Borders/rings: `border-border`, `border-input`, `ring-ring`, hairlines via `ring-1 ring-foreground/10`
- App domain tokens — priority tiers: `text-tier-1`…`text-tier-5`, `text-tier-closed` (badge pattern: `text-tier-N bg-tier-N/10 border-tier-N/30`); pipeline statuses: `bg-status-evaluating`, `bg-status-applied`, `bg-status-screen`, `bg-status-assessment`, `bg-status-panel`, `bg-status-offer`, `bg-status-skipped`, `bg-status-rejected` (dot pattern from StatusBadge); follow-up due: `text-due bg-due/15 border-due/40`
- Charts: `--chart-1`…`--chart-5` CSS vars
- Type: `font-heading` for headings; the `font-data` class for dates/counts/day counters (mono, tabular numerals); body text is `text-sm` by default
- Radius: `rounded-lg` controls, `rounded-xl` cards/dialogs

Prefer the domain components over rebuilding their look: `TierBadge tier="1 - Top"|"2 - High"|"3 - Mid"|"4 - Queue"|"5 - Hold"|"Closed"`, `StatusBadge status="Evaluating"|"Applied"|"Screen"|"Assessment"|"Panel"|"Offer"|"Skipped"|"Rejected"`, `DueBadge`.

## Component API notes (Base UI, not Radix)

- Compound families ship as separate exports: `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardAction`/`CardContent`/`CardFooter`, same pattern for `Dialog*`, `AlertDialog*`, `Sheet*`, `Select*`, `DropdownMenu*`, `Table*`, `Tabs*`, `Tooltip*`.
- Overlays open statically with controlled `open` on the root (`Dialog open`, `Sheet open`, `Select open`, `DropdownMenu open`, `Tooltip open`).
- `DropdownMenuLabel` must sit inside `DropdownMenuGroup` or the menu throws.
- Buttons: `variant` = default | outline | secondary | ghost | destructive | link; `size` = xs | sm | default | lg | icon variants.
- State attributes are Base UI style: `data-checked`, `data-open`, `data-disabled`; `TableRow data-state="selected"` highlights a row.

## Where the truth lives

Read `styles.css` (tokens + component CSS closure) and `fonts/fonts.css` before styling. Each component's API contract is `components/general/<Name>/<Name>.d.ts`; usage examples are in its `<Name>.prompt.md`.
