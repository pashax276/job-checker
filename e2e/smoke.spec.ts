import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("health endpoints respond", async ({ request }) => {
    expect((await request.get("/healthz")).status()).toBe(200);
    expect((await request.get("/readyz")).status()).toBe(200);
  });

  test("dashboard renders seeded stats", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Active pipeline")).toBeVisible();
    await expect(page.getByText("Overdue follow-ups").first()).toBeVisible();
    // all eight status count cards render
    for (const status of ["Evaluating", "Applied", "Screen", "Offer"]) {
      await expect(
        page.getByText(status, { exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("table lists all 53 seeded jobs with a DUE badge present", async ({
    page,
  }) => {
    await page.goto("/table");
    await expect(page.getByText("53 jobs")).toBeVisible();
    await expect(page.getByText("DUE").first()).toBeVisible();
  });

  test("filter changes never hang the page (regression: unstable table data identity)", async ({
    page,
  }) => {
    await page.goto("/table");
    await expect(page.getByText(/\d+ jobs/)).toBeVisible();
    // due-only checkbox: was a synchronous livelock before the EMPTY_JOBS fix
    await page.getByRole("checkbox").first().click();
    await expect(page.getByText(/\d+ jobs/)).toBeVisible();
    await page.getByRole("checkbox").first().click();
    // status filter select swaps the query key the same way
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Applied", exact: true }).click();
    await expect(page.getByText(/\d+ jobs/)).toBeVisible();
  });

  test("row click opens the job drawer with history", async ({ page }) => {
    await page.goto("/table");
    await page.locator("tbody tr").first().click();
    await expect(page.getByText("Status history")).toBeVisible();
  });

  test("inline status change persists across reload", async ({ page }) => {
    await page.goto("/table");
    const row = page.getByRole("row").filter({ hasText: "Platform Science" });
    await expect(row).toHaveCount(1);

    const patched = page.waitForResponse(
      (res) =>
        res.url().includes("/api/jobs/") &&
        res.request().method() === "PATCH" &&
        res.ok(),
    );
    await row.getByRole("combobox").click();
    await page.getByRole("option", { name: "Panel" }).click();
    await patched;

    await page.reload();
    const rowAfter = page
      .getByRole("row")
      .filter({ hasText: "Platform Science" });
    await expect(rowAfter.getByRole("combobox")).toContainText("Panel");
  });
});
