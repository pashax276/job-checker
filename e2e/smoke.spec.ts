import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("health endpoints respond", async ({ request }) => {
    expect((await request.get("/healthz")).status()).toBe(200);
    expect((await request.get("/readyz")).status()).toBe(200);
  });

  test("dashboard renders seeded stats", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Active pipeline", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Follow-up queue")).toBeVisible();
    // stage mix legend renders statuses present in the seed
    for (const status of ["Evaluating", "Applied", "Screen"]) {
      await expect(
        page.getByText(status, { exact: true }).first(),
      ).toBeVisible();
    }
    await expect(page.getByText("Offers open")).toBeVisible();
    await expect(page.getByText("In interview loops")).toBeVisible();
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

  test("row click opens the job drawer with timeline and contacts", async ({
    page,
  }) => {
    await page.goto("/table");
    await page.locator("tbody tr").first().click();
    await expect(page.getByText("Timeline", { exact: true })).toBeVisible();
    await expect(page.getByText("Contacts", { exact: true })).toBeVisible();
  });

  test("add-job form validates inline and creates a job", async ({ page }) => {
    await page.goto("/table");
    await page.getByRole("button", { name: /New job/ }).click();
    // submit empty -> inline field errors, dialog stays open
    await page.getByRole("button", { name: "Add job", exact: true }).click();
    await expect(page.getByText(/company is required/i)).toBeVisible();
    // fill required fields and submit
    await page.getByLabel("Company *").fill("E2E Test Co");
    await page.getByLabel("Role *").fill("Senior SRE");
    await page.getByRole("button", { name: "Add job", exact: true }).click();
    await expect(page.getByText(/Added E2E Test Co/)).toBeVisible();
    // row exists after the optimistic refresh
    await expect(
      page.getByRole("row").filter({ hasText: "E2E Test Co" }),
    ).toHaveCount(1);
  });

  test("table row's prep link deep-links into the Prep page", async ({
    page,
  }) => {
    await page.goto("/table");
    const row = page.getByRole("row").filter({ hasText: "Platform Science" });
    await row.getByRole("link", { name: /interview prep/i }).click();
    await expect(page).toHaveURL(/\/prep\?job=/);
    // seed data books no stage schedules, so the deep link lands on the
    // "nothing booked yet" banner rather than a prep card
    await expect(page.getByText(/Nothing booked yet for/)).toBeVisible();
    await expect(page.getByText("Platform Science")).toBeVisible();
    // regression: every empty-notes card defaulting to an autofocused
    // textarea used to fight for focus on mount, auto-scrolling the page
    // away from the top and burying this banner off-screen
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50);
    await page.getByRole("button", { name: "Open job" }).click();
    await expect(page.getByText("Timeline", { exact: true })).toBeVisible();
  });

  test("board card's prep icon deep-links into the Prep page", async ({
    page,
  }) => {
    await page.goto("/board");
    await page
      .getByRole("button", {
        name: "Interview prep for Platform Science",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/prep\?job=/);
    await expect(page.getByText(/Nothing booked yet for/)).toBeVisible();
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

  test("Prep Agenda and Checklist views render a booked step with structured questions", async ({
    page,
    request,
  }) => {
    const jobsRes = await request.get("/api/jobs");
    const jobs = (await jobsRes.json()).data as Array<{
      id: string;
      company: string;
    }>;
    const target = jobs.find((j) => j.company === "Platform Science")!;

    await request.put(`/api/jobs/${target.id}/schedule`, {
      data: { stage: "Screen", scheduledFor: "2026-08-01" },
    });
    await request.post(`/api/jobs/${target.id}/schedule/questions`, {
      data: { stage: "Screen", text: "Is this remote?" },
    });

    await page.goto("/prep");
    await page.getByRole("button", { name: "Agenda" }).click();
    await expect(
      page.getByText("Platform Science", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Is this remote?")).toBeVisible();

    await page.getByRole("button", { name: "Checklist" }).click();
    await expect(page.getByText("Questions prepared")).toBeVisible();
  });

  test("Resumes Split view and Coverage matrix render an uploaded resume", async ({
    page,
    request,
  }) => {
    await request.post("/api/documents", {
      multipart: {
        kind: "resume",
        name: "E2E Resume",
        file: {
          name: "resume.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("AWS Kubernetes Terraform"),
        },
      },
    });

    await page.goto("/resumes");
    await page.getByRole("button", { name: "Split view" }).click();
    await expect(page.getByText("E2E Resume").first()).toBeVisible();

    await page.getByRole("button", { name: "Coverage matrix" }).click();
    await expect(page.getByText(/no skill signal yet/i)).toBeVisible();
  });

  test("Import dialog preview table stays within the dialog's bounds (regression: sm:max-w-sm cascade beat an unprefixed max-w-2xl override, clipping the preview table)", async ({
    page,
    request,
  }) => {
    const exportRes = await request.get("/api/export?format=json");
    const jsonPath = join(tmpdir(), `job-tracker-export-${Date.now()}.json`);
    writeFileSync(jsonPath, await exportRes.body());

    try {
      await page.goto("/table");
      await page.getByRole("button", { name: "Import" }).click();
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByRole("button", { name: "Choose file" }).click(),
      ]);
      await fileChooser.setFiles(jsonPath);
      await page.getByRole("button", { name: "Preview" }).click();
      await expect(page.getByText(/rows parsed/)).toBeVisible();

      const dialogBox = await page
        .locator("[data-slot=dialog-content]")
        .boundingBox();
      const tableBox = await page
        .locator("[data-slot=dialog-content] table")
        .boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(tableBox).not.toBeNull();
      // the wide preview table (Company/Role/Status/Result) must fit within
      // (or scroll inside) the dialog, not extend past its right edge
      expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(
        dialogBox!.x + dialogBox!.width + 1,
      );
      // dialog should render at its intended sm:max-w-2xl width, not fall
      // back to the base component's sm:max-w-sm
      expect(dialogBox!.width).toBeGreaterThan(500);
    } finally {
      unlinkSync(jsonPath);
    }
  });
});
