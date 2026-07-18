# Job Pipeline Tracker

Self-hosted replacement for an Excel job-application tracker. Single user,
SQLite, one container. Dashboard / kanban / table views, full status history,
xlsx round-trip with the original tracker layout, and automated job discovery
from public ATS APIs and Google Alerts RSS.

Built with Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4 +
shadcn/ui, Drizzle ORM + better-sqlite3, TanStack Query/Table, dnd-kit,
Recharts, zod everywhere the outside world touches the app.

## Quickstart (Docker Compose — primary path)

```bash
docker compose up -d
open http://localhost:3000
```

First boot applies migrations and imports `data/jobs_seed.json` (53 jobs) into
the empty database, plus five watchlist companies for discovery. Data lives in
the `tracker-data` volume and survives `docker compose down && up`.

> **⚠️ The bundled seed is synthetic placeholder data** (the real export was
> not available at build time — see `data/README.md`). To load your real
> tracker: either replace `data/jobs_seed.json` **before first boot** (or
> `docker compose down -v` to reset), or just boot and use **Import** to
> upload your original `Job_Application_Tracker.xlsx` — 53 duplicates will be
> flagged with per-row skip/update choices.

## Everyday use

- **Views:** Dashboard (status counts, overdue follow-ups oldest-first,
  days-in-stage aging chart), Board (drag between status columns — every move
  writes `status_history`), Table (sort/filter/search, column visibility,
  inline status change), Inbox (discovery leads), Settings.
- **Keyboard:** `/` focus search · `n` new job · `1–4` switch views.
- **DUE badges** appear everywhere a job's follow-up date is today or earlier.
- **Export:** topbar → Excel (original column order), JSON, or an `.ics`
  calendar of upcoming follow-ups.
- **Optimistic updates:** board/table mutations apply instantly and roll back
  with a toast if the API rejects them.

## Job discovery (Phase 5)

Two legitimate sources — no scraping:

1. **ATS watchlist polling** — public JSON endpoints for Greenhouse, Lever,
   and Ashby boards. Seeded with Platform Science, Babylist, PrizePicks,
   Ava Labs (Greenhouse) and Talkiatry (Ashby); manage the list in Settings.
   Filters: title must match `(Senior|Staff|Sr.)` **and**
   `(Platform|DevOps|SRE|Site Reliability|Infrastructure)`, description must
   mention AWS, exclusions for Junior/Intern/Entry-Level. Location is
   classified `San Diego` / `Remote-US` / `Unverified` — never guessed.
   Boards are polled sequentially with an honest User-Agent; a board that
   keeps failing 4xx is skipped until it recovers. (Coinbase's custom careers
   site and Workday tenants have no stable public API — cover those via
   Alerts.)
2. **Google Alerts RSS** — create Alerts for your saved `site:` queries with
   “Deliver to: RSS feed”, paste feed URLs into Settings. This is the only
   channel that discovers companies not already on the watchlist. Alert items
   carry no posting body or location, so they land as `Unverified` and skip
   the AWS gate.

Leads dedupe on exact URL and case-insensitive company+role against both
existing leads and pipeline jobs — re-running discovery never duplicates.
**Promote** creates a pipeline job (Evaluating, tier `3 - Mid`, posting URL
set); promoting the same lead twice is blocked.

### Scheduling

| Deployment | Mechanism |
|---|---|
| Docker | in-process `node-cron`: set `DISCOVERY_ENABLED=true` (and optionally `DISCOVERY_CRON`, default `0 14 * * *` UTC = 7:00 AM Pacific) |
| Kubernetes | Helm-gated **CronJob** (`discovery.cronJob.enabled=true`) POSTs the idempotent `/api/discovery/run`; the chart forces the in-process cron off |

Settings also has **Run discovery now** plus a per-source last-run log
(fetched / matched / deduped / created).

The optional AI fit-summary enrichment (`ANTHROPIC_API_KEY`) is scaffolded in
Settings (profile blurb) but intentionally not wired up yet — the app is fully
functional without it.

## Development

```bash
npm ci
npm run dev          # http://localhost:3000, DB at ./data/tracker.db
npm test             # vitest unit + API integration (in-memory / tmp sqlite)
npm run test:coverage
npm run lint && npm run typecheck
npm run build && npm run e2e   # Playwright smoke (boots its own server)
npm run db:generate  # regenerate drizzle/ SQL after editing src/db/schema.ts
```

Copy `.env.example` to `.env.local` to override defaults.

## API

JSON envelope everywhere: `{ success, data, error }`; zod validates every
boundary.

```
GET/POST      /api/jobs           list (status, tier, q, dueOnly) / create
GET/PATCH/DEL /api/jobs/:id       detail incl. statusHistory / partial update / delete
POST          /api/import         multipart xlsx|csv, mode=preview|commit + per-row decisions
GET           /api/export         ?format=xlsx|json      GET /api/export/ics
GET           /api/stats          dashboard aggregates
GET/POST      /api/watchlist      PATCH/DELETE /api/watchlist/:id
GET           /api/leads          ?status=new|promoted|dismissed
PATCH         /api/leads/:id      {action: promote|dismiss}
GET/PUT       /api/settings       rssFeeds, profileBlurb (+ lastDiscoveryRun)
POST          /api/discovery/run  idempotent discovery pass
GET           /healthz            liveness — 200 whenever the process is up
GET           /readyz             readiness — DB open + migrated
```

## Kubernetes (secondary path, CKA/GitOps practice)

Helm chart in [charts/job-tracker/](charts/job-tracker/) — Deployment
(1 replica, `Recreate`; SQLite cannot multi-replica, see the chart README),
PVC, ClusterIP Service, optional Ingress, ConfigMap/Secret, values-gated
discovery CronJob, hardened securityContext (non-root, no privilege
escalation, all capabilities dropped).

```bash
kind create cluster --name tracker
docker build -t job-checker-tracker:latest .
kind load docker-image job-checker-tracker:latest --name tracker
helm install tracker charts/job-tracker \
  --set image.repository=docker.io/library/job-checker-tracker \
  --set image.tag=latest --set image.pullPolicy=Never
kubectl port-forward svc/tracker-job-tracker 3000:3000
```

### GitOps with Argo CD

[argocd/application.yaml](argocd/application.yaml) points Argo CD at the chart
path with automated sync + prune + self-heal. On a practice cluster (kind/k3d):

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
# edit argocd/application.yaml: set repoURL to your fork and image.repository
kubectl apply -f argocd/application.yaml
```

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml): lint → typecheck →
vitest → Playwright smoke → build & push to GHCR on `main`. Heavily commented
on purpose — it doubles as a GitHub Actions learning artifact.

## Security posture

- No auth by default (designed for localhost / cluster-internal use). Optional
  HTTP basic auth: set `BASIC_AUTH_USER` + `BASIC_AUTH_PASS` (compose env or
  the chart's `basicAuth.*`). Health probes are always exempt.
- Container runs as the non-root `node` user, capabilities dropped in k8s,
  no secrets in the image; secrets arrive via env/Secret only.

## Postgres migration path (documented, not built)

SQLite is right for one user. If this ever needs multi-replica or a managed
DB: swap `drizzle-orm/better-sqlite3` for `drizzle-orm/node-postgres` and the
driver in [src/db/client.ts](src/db/client.ts), change `drizzle.config.ts`
dialect to `postgresql`, regenerate migrations (`npm run db:generate` against
a scratch database), port the three `text`-date columns unchanged (ISO strings
sort identically), and replace `DATABASE_PATH` with `DATABASE_URL`. The
repository layer touches drizzle only through the query builder, so no
call-site changes are expected; the Helm chart then loses the single-replica
constraint.

## License

MIT — see [LICENSE](LICENSE).
