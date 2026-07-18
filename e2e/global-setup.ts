import fs from "node:fs";
import path from "node:path";

/** Start every e2e run from an empty DB so the first-run seed import fires. */
export default function globalSetup(): void {
  const dir = path.join(__dirname, ".tmp");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
