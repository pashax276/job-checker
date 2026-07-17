# Seed data

`jobs_seed.json` is imported automatically on first run **only when the database
is empty**.

> **⚠️ PLACEHOLDER DATA.** The file currently in this directory is a synthetic
> 53-job dataset generated at build time because the real export
> (`jobs_seed.json` from the Excel tracker) was not available when the app was
> built. The companies are real, but every application, date, contact, and note
> is fabricated.
>
> **To load your real data:** replace `data/jobs_seed.json` with your actual
> export *before first boot*, or wipe the database
> (`docker compose down -v`, or delete `data/tracker.db*`) and restart so the
> importer runs again. Alternatively, use **Import** in the UI to upload your
> original `Job_Application_Tracker.xlsx` at any time.

Database files (`tracker.db*`) also live here in local dev and are
git-ignored.
