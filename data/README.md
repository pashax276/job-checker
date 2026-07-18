# Seed data

`jobs_seed.json` is imported automatically on first run **only when the
database is empty**. As of 2026-07-17 it contains the real 53-job export from
the Excel tracker (envelope format: `{ exportedAt, source, jobs: [...] }`;
a bare JSON array also works).

To re-seed after changing this file, wipe the database first:
`docker compose down -v && docker compose up -d --build` (the image bakes the
seed at build time), or delete `data/tracker.db*` for local dev. Existing
databases are never overwritten — use **Import** in the UI to merge updates
instead, with per-row duplicate skip/update choices.

Database files (`tracker.db*`) also live here in local dev and are
git-ignored.
