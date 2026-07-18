import os from "node:os";
import path from "node:path";

// Point the process-wide DB singleton at a unique throwaway file per worker
// BEFORE any app module is imported. Unit tests that want full isolation still
// use createDb(":memory:") explicitly.
process.env.DATABASE_PATH = path.join(
  os.tmpdir(),
  `job-tracker-test-${process.pid}-${Math.random().toString(36).slice(2)}.db`,
);
