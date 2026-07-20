# Seed data

`jobs_seed.json` is imported automatically on first run **only when the
database is empty**. The tracked file is a **synthetic** 53-job dataset
(personal data stays out of git). A real export lives locally as
`jobs_seed.local.json` (gitignored) — copy it over `jobs_seed.json` before a
fresh first boot to seed real data. Both a bare JSON array and the exporter
envelope (`{ exportedAt, source, jobs: [...] }`) are accepted.

To re-seed after changing this file, wipe the database first:
`docker compose down -v && docker compose up -d --build` (the image bakes the
seed at build time), or delete `data/tracker.db*` for local dev. Existing
databases are never overwritten — use **Import** in the UI to merge updates
instead, with per-row duplicate skip/update choices.

Database files (`tracker.db*`) also live here in local dev and are
git-ignored.
