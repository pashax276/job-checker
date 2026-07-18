import path from "node:path";
import { defineConfig } from "@playwright/test";

const E2E_DB = path.join(__dirname, "e2e", ".tmp", "e2e.db");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3199",
    trace: "retain-on-failure",
  },
  webServer: {
    // Requires a prior `npm run build` (CI builds in an earlier step).
    command: "npm run start -- -p 3199",
    url: "http://localhost:3199/readyz",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_PATH: E2E_DB,
    },
  },
});
