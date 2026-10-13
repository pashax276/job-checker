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

    // a week out, not a fixed day: Checklist only lists steps still ahead, so
    // a hardcoded date turned this test red the morning after it passed
    const nextWeek = new Date(Date.now() + 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await request.put(`/api/jobs/${target.id}/schedule`, {
      data: { stage: "Screen", scheduledFor: nextWeek },
    });
    await request.post(`/api/jobs/${target.id}/schedule/questions`, {
      data: { stage: "Screen", text: "Is this remote?" },
    });
    await request.post(`/api/jobs/${target.id}/schedule/questions`, {
      data: {
        stage: "Screen",
        text: "How do you handle prod incidents?",
        askedBy: "interviewer",
      },
    });

    await page.goto("/prep");
    await page.getByRole("button", { name: "Agenda" }).click();
    await expect(
      page.getByText("Platform Science", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Is this remote?")).toBeVisible();
    await expect(page.getByText("How do you handle prod incidents?")).toBeVisible();
    // my own question tagged "You", the interviewer's tagged "Them"
    const questionsList = page.locator("ol").filter({ hasText: "Is this remote?" });
    await expect(questionsList.getByText("You", { exact: true })).toBeVisible();
    await expect(questionsList.getByText("Them", { exact: true })).toBeVisible();

    // clicking the tag toggles direction and persists
    await questionsList.getByText("You", { exact: true }).click();
    await expect(questionsList.getByText("You", { exact: true })).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: "Agenda" }).click();
    const questionsListAfterReload = page
      .locator("ol")
      .filter({ hasText: "Is this remote?" });
    await expect(
      questionsListAfterReload.getByText("You", { exact: true }),
    ).toHaveCount(0);

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

  test("calendar legend lists exactly the event kinds plotted (regression: hardcoded legend omitted Applied, advertised unused Panel)", async ({
    page,
    request,
  }) => {
    const jobsRes = await request.get("/api/jobs");
    const jobs = (await jobsRes.json()).data as Array<{
      id: string;
      company: string;
    }>;
    const target = jobs.find((j) => j.company === "Platform Science")!;
    // book an Applied step — the kind the old hardcoded legend never listed
    await request.put(`/api/jobs/${target.id}/schedule`, {
      data: { stage: "Applied", scheduledFor: "2026-08-03" },
    });

    await page.goto("/");
    const legend = page.getByRole("list", { name: "Calendar legend" });
    await expect(legend.getByText("Applied", { exact: true })).toBeVisible();
    // Panel has nothing booked, so it must not be advertised
    await expect(legend.getByText("Panel", { exact: true })).toHaveCount(0);
  });

  test("every job row shows how it was added, manual included", async ({
    page,
  }) => {
    await page.goto("/table");
    const row = page.getByRole("row").filter({ hasText: "Platform Science" });
    // seeded jobs are imports; the indicator must be present and specific
    await expect(
      row.getByRole("img", { name: /imported from a tracker file/i }),
    ).toBeVisible();

    // a hand-added job gets its own icon rather than a blank space
    await page.getByRole("button", { name: /New job/ }).click();
    await page.getByLabel("Company *").fill("Manual Source Co");
    await page.getByLabel("Role *").fill("Platform Engineer");
    await page.getByRole("button", { name: "Add job", exact: true }).click();
    const manualRow = page
      .getByRole("row")
      .filter({ hasText: "Manual Source Co" });
    await expect(
      manualRow.getByRole("img", { name: /added manually/i }),
    ).toBeVisible();
  });

  test("board filters by tier, follow-up due, and skill match", async ({
    page,
  }) => {
    await page.goto("/board");
    const cards = page.locator("section[aria-label$='column'] li");
    // count() doesn't auto-wait — let the board finish loading first
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    expect(total).toBeGreaterThan(0);

    // tier — server-side, same filter the table uses
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "2 - High", exact: true }).click();
    await expect(page.getByText(/\d+ shown/)).toBeVisible();
    const tierFiltered = await cards.count();
    expect(tierFiltered).toBeLessThan(total);

    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(cards).toHaveCount(total);

    // skill match — client-side, since it's JSON on the row
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Not checked yet" }).click();
    const uncheckedOnly = await cards.count();
    expect(uncheckedOnly).toBeLessThanOrEqual(total);
    // seeded jobs have no skill match, so none should show a % badge
    await expect(
      page.locator("section[aria-label$='column'] li").getByText(/^\d+%$/),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Clear", exact: true }).click();

    // follow-up due
    await page.getByRole("checkbox", { name: "Follow-up due" }).check();
    await expect(page.getByText(/\d+ shown/)).toBeVisible();
    expect(await cards.count()).toBeLessThan(total);
  });

  test("filter selects never leak the __all__ sentinel as visible text", async ({
    page,
  }) => {
    for (const path of ["/table", "/board"]) {
      await page.goto(path);
      // Base UI renders the raw value when no formatter is given, so the
      // "no filter" sentinel used to show up literally as "__all__"
      await expect(page.getByText("__all__")).toHaveCount(0);
      const labels = await page.getByRole("combobox").allTextContents();
      for (const label of labels) {
        expect(label, `${path} combobox label`).not.toContain("__all__");
      }
    }
  });

  test("job drawer never clips its right column (regression: bare `5fr` grid columns won't shrink below min-content, hiding Add/Re-check/Copy/Log off-edge)", async ({
    page,
  }) => {
    await page.goto("/table");
    await page.locator("tbody tr").first().click();
    const sheet = page.locator("[data-slot=sheet-content]");
    await expect(sheet).toBeVisible();

    // the sheet clips overflow, so a too-wide column fails silently — assert
    // on scroll geometry rather than on anything being visibly wrong
    const geo = await sheet.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(geo.scrollWidth).toBeLessThanOrEqual(geo.clientWidth + 1);

    const past = await sheet.evaluate((el) => {
      const right = el.getBoundingClientRect().right;
      return [...el.querySelectorAll("*")].filter(
        (n) => n.getBoundingClientRect().right > right + 1,
      ).length;
    });
    expect(past).toBe(0);

    // the right column's actions must actually be reachable
    await expect(
      page.getByRole("button", { name: "Log", exact: true }),
    ).toBeVisible();
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

  test.describe("EDD reports", () => {
    // West of UTC on purpose: a report date is a bare YYYY-MM-DD, and reading
    // one as UTC midnight shows the previous day there. CI's own zone is UTC,
    // where that slip can't be seen.
    test.use({ timezoneId: "America/Los_Angeles", locale: "en-US" });

    test("mark a stage in the drawer, see it in the timeline and on the table row", async ({
    page,
    request,
  }) => {
    // its own job, so the status other tests move around can't change which
    // stage this one reports
    const created = await request.post("/api/jobs", {
      data: { company: "EDD Report Co", role: "Senior SRE", status: "Applied" },
    });
    expect(created.ok()).toBe(true);

    await page.goto("/table");
    const row = page.getByRole("row").filter({ hasText: "EDD Report Co" });
    await expect(row).toHaveCount(1);
    await expect(row.getByText("EDD", { exact: true })).toHaveCount(0);

    await row.getByText("Senior SRE").click();
    await expect(page.getByText("EDD reports", { exact: true })).toBeVisible();
    // the stage on offer is the one the job is in right now
    await expect(page.getByRole("combobox", { name: "EDD stage" })).toContainText(
      "Applied",
    );
    const removeApplied = page.getByRole("button", {
      name: "Remove EDD report for Applied",
    });
    await expect(removeApplied).toHaveCount(0);

    // backfill: reported a week ago, marked today
    await page.getByLabel("Date reported to EDD").fill("2026-10-05");
    const saved = page.waitForResponse(
      (res) =>
        res.url().includes("/edd") && res.request().method() === "PUT" && res.ok(),
    );
    await page.getByRole("button", { name: "Mark reported" }).click();
    await saved;

    await expect(removeApplied).toBeVisible();
    const timelineRow = page
      .getByRole("listitem")
      .filter({ hasText: "Reported to EDD" });
    await expect(timelineRow).toHaveCount(1);
    await expect(timelineRow).toContainText("Applied");
    await expect(timelineRow).toContainText("Oct 5, 2026");

    // the list badge appears without a reload, and survives one
    await page.keyboard.press("Escape");
    await expect(row.getByText("EDD", { exact: true })).toBeVisible();
    await page.reload();
    await expect(row.getByText("EDD", { exact: true })).toBeVisible();

    // removing the report takes it out of the timeline and off the row
    await row.getByText("Senior SRE").click();
    await expect(removeApplied).toBeVisible();
    await removeApplied.click();
    await expect(removeApplied).toHaveCount(0);
    await expect(timelineRow).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(row.getByText("EDD", { exact: true })).toHaveCount(0);
    });
  });
});
