# job-tracker Helm chart

Deploys the self-hosted job pipeline tracker: single-replica Next.js app with
SQLite on a PVC.

## Why replicas is not configurable

SQLite is a single-writer embedded database on the `/data` PVC. The Deployment
pins `replicas: 1` and uses a `Recreate` strategy so two pods never open the
database concurrently. Need horizontal scale? Migrate to Postgres first (the
repo README documents the path) — then this constraint disappears.

## Quickstart (kind)

```bash
kind create cluster --name tracker
docker build -t job-checker-tracker:latest .
kind load docker-image job-checker-tracker:latest --name tracker

helm install tracker charts/job-tracker \
  --set image.repository=docker.io/library/job-checker-tracker \
  --set image.tag=latest \
  --set image.pullPolicy=Never

kubectl rollout status deploy/tracker-job-tracker
kubectl port-forward svc/tracker-job-tracker 3000:3000
```

## Discovery scheduling

Two mutually exclusive modes:

| Mode | How | When |
|---|---|---|
| CronJob (preferred) | `--set discovery.cronJob.enabled=true` — a CronJob POSTs the idempotent `/api/discovery/run` against the Service | Kubernetes |
| In-process | `--set discovery.inProcess=true` — node-cron inside the app | Docker/compose parity |

When `cronJob.enabled=true` the chart forces `DISCOVERY_ENABLED=false` in the
app so both schedulers never run at once.

## Basic auth

```bash
helm install tracker charts/job-tracker \
  --set basicAuth.enabled=true \
  --set basicAuth.username=me \
  --set basicAuth.password=s3cret
# or bring your own Secret with keys BASIC_AUTH_USER / BASIC_AUTH_PASS:
#   --set basicAuth.enabled=true --set basicAuth.existingSecret=my-secret
```

Health probes (`/healthz`, `/readyz`) are always exempt from auth.

See `values.yaml` for the full documented surface.
