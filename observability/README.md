# Observability stack

Standalone Prometheus + Grafana for the tracker's `/metrics` endpoint —
deliberately not the `kube-prometheus-stack` operator bundle (no Alertmanager,
no node-exporter, no kube-state-metrics): this cluster has exactly one thing
worth scraping, and the operator bundle costs several GB of images for
capabilities this app doesn't use.

Managed via GitOps by [argocd/application-monitoring.yaml](../argocd/application-monitoring.yaml)
(automated sync + prune + self-heal), same pattern as the app itself.

## One manual step: the Grafana admin credential

Argo CD never manages real secrets in git. Before (or after) this Application
syncs, create the Secret it expects by hand:

```bash
kubectl -n monitoring create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl -n monitoring create secret generic grafana-admin \
  --from-literal=admin-user=admin \
  --from-literal=admin-password="$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9')"
# Grafana reads env at container start, so if the Deployment already existed:
kubectl -n monitoring rollout restart deploy/grafana
```

Fetch the password back out any time with:

```bash
kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
```

## What's provisioned automatically

- Prometheus scrapes `job-tracker-job-tracker.job-tracker.svc.cluster.local:3000/metrics`
  on a static target (see `10-prometheus-configmap.yaml`) — single-service
  demo, so no `kubernetes_sd_config`/RBAC needed.
- Grafana auto-provisions a Prometheus datasource and the dashboard from
  [grafana/dashboard.json](../grafana/dashboard.json) (mirrored into
  `22-grafana-dashboard-job-tracker-configmap.yaml` — regenerate that file if
  you edit the source dashboard; see the comment at its top).

## Access

```bash
kubectl -n monitoring port-forward svc/grafana 3003:3000     # http://localhost:3003
kubectl -n monitoring port-forward svc/prometheus 9090:9090  # http://localhost:9090
```
