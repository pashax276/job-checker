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
