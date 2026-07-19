import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type DB } from "@/db/client";
import { watchlist } from "@/db/schema";
import { jobCreateSchema, listQuerySchema } from "@/lib/schemas";
import { runDiscovery } from "@/server/discovery/run";
import { dismissLead, listLeads, promoteLead } from "@/server/leads";
import { createJob, listJobs } from "@/server/jobs";

let db: DB;

const GH_PAYLOAD = {
  jobs: [
    {
      absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
      title: "Senior Platform Engineer",
      location: { name: "San Diego, CA" },
      content: "Kubernetes on AWS",
    },
    {
      absolute_url: "https://boards.greenhouse.io/acme/jobs/2",
      title: "Junior Platform Engineer",
      location: { name: "San Diego, CA" },
      content: "AWS",
    },
    {
      absolute_url: "https://boards.greenhouse.io/acme/jobs/3",
      title: "Senior DevOps Engineer",
      location: { name: "Berlin" },
      content: "GCP only",
    },
    {
      absolute_url: "https://boards.greenhouse.io/acme/jobs/4",
      title: "Staff SRE",
      location: { name: "Remote" },
      content: "AWS everywhere",
    },
  ],
};

const fakeFetch = (payload: unknown, status = 200) =>
  (async () =>
    new Response(JSON.stringify(payload), { status })) as unknown as typeof fetch;

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  db.insert(watchlist)
    .values({
      id: "w1",
      displayName: "Acme",
      atsType: "greenhouse",
      boardSlug: "acme",
      enabled: true,
    })
    .run();
});

describe("runDiscovery — ATS polling", () => {
  it("creates leads only for title+description matches, classifying location", async () => {
    const result = await runDiscovery(db, { fetchFn: fakeFetch(GH_PAYLOAD) });
    expect(result.atsPoll.fetched).toBe(4);
    expect(result.atsPoll.created).toBe(2);
    const rows = listLeads(db, "new");
    const byUrl = new Map(rows.map((l) => [l.url, l]));
    expect(byUrl.get("https://boards.greenhouse.io/acme/jobs/1")?.locationClass).toBe("San Diego");
    expect(byUrl.get("https://boards.greenhouse.io/acme/jobs/4")?.locationClass).toBe("Unverified");
    expect(byUrl.has("https://boards.greenhouse.io/acme/jobs/2")).toBe(false);
  });

  it("re-running immediately creates zero duplicate leads", async () => {
    await runDiscovery(db, { fetchFn: fakeFetch(GH_PAYLOAD) });
    const second = await runDiscovery(db, { fetchFn: fakeFetch(GH_PAYLOAD) });
    expect(second.atsPoll.created).toBe(0);
    expect(second.atsPoll.deduped).toBe(2);
    expect(listLeads(db, "new")).toHaveLength(2);
  });

  it("dedupes against existing pipeline jobs on company+title", async () => {
    createJob(
      db,
      jobCreateSchema.parse({ company: "Acme", role: "Senior Platform Engineer" }),
    );
    const result = await runDiscovery(db, { fetchFn: fakeFetch(GH_PAYLOAD) });
    expect(result.atsPoll.created).toBe(1); // only the Staff SRE survives
  });

  it("counts a failed board without aborting the run", async () => {
    const result = await runDiscovery(db, { fetchFn: fakeFetch({}, 404) });
    expect(result.atsPoll.created).toBe(0);
    expect(result.boardErrors).toHaveLength(1);
    expect(result.boardErrors[0]).toMatchObject({ board: "acme", status: 404 });
  });
});

describe("lead promotion", () => {
  it("promote creates exactly one Evaluating/3-Mid job with postingUrl", async () => {
    await runDiscovery(db, { fetchFn: fakeFetch(GH_PAYLOAD) });
    const lead = listLeads(db, "new").find((l) => l.locationClass === "San Diego")!;
    const job = promoteLead(db, lead.id);
    expect(job.status).toBe("Evaluating");
    expect(job.priorityTier).toBe("3 - Mid");
    expect(job.postingUrl).toBe(lead.url);
    expect(listJobs(db, listQuerySchema.parse({}))).toHaveLength(1);
    const after = listLeads(db, "promoted");
    expect(after.map((l) => l.id)).toContain(lead.id);
  });

  it("promoting the same lead again is blocked as a duplicate", async () => {
    await runDiscovery(db, { fetchFn: fakeFetch(GH_PAYLOAD) });
    const lead = listLeads(db, "new")[0];
    promoteLead(db, lead.id);
    expect(() => promoteLead(db, lead.id)).toThrow(/duplicate|already/i);
    expect(listJobs(db, listQuerySchema.parse({}))).toHaveLength(1);
  });

  it("dismiss moves a lead out of the inbox", async () => {
    await runDiscovery(db, { fetchFn: fakeFetch(GH_PAYLOAD) });
    const lead = listLeads(db, "new")[0];
    dismissLead(db, lead.id);
    expect(listLeads(db, "new")).toHaveLength(1);
    expect(listLeads(db, "dismissed")).toHaveLength(1);
  });
});

describe("runDiscovery — alerts RSS", () => {
  it("ingests feed items as leads, deduping against ATS leads by url", async () => {
    await runDiscovery(db, { fetchFn: fakeFetch(GH_PAYLOAD) });
    db.$client
      .prepare("INSERT INTO settings (key, value) VALUES ('rssFeeds', ?)")
      .run(JSON.stringify(["https://www.google.com/alerts/feeds/x/y"]));
    const result = await runDiscovery(db, {
      fetchFn: fakeFetch(GH_PAYLOAD),
      parseFeed: async () => ({
        items: [
          {
            title: "<b>Senior SRE</b> - NewCo",
            link: "https://www.google.com/url?url=https://jobs.lever.co/newco/uuid",
          },
          {
            // same URL as an existing ATS lead -> dedupe
            title: "Senior Platform Engineer - Acme",
            link: "https://www.google.com/url?url=https://boards.greenhouse.io/acme/jobs/1",
          },
        ],
      }),
    });
    expect(result.alertsRss.fetched).toBe(2);
    expect(result.alertsRss.created).toBe(1);
    const rssLeads = listLeads(db, "new").filter((l) => l.source === "alerts-rss");
    expect(rssLeads).toHaveLength(1);
    expect(rssLeads[0].url).toBe("https://jobs.lever.co/newco/uuid");
    expect(rssLeads[0].locationClass).toBe("Unverified");
  });

  it("stores a last-run log in settings", async () => {
    await runDiscovery(db, { fetchFn: fakeFetch(GH_PAYLOAD) });
    const row = db.$client
      .prepare("SELECT value FROM settings WHERE key='lastDiscoveryRun'")
      .get() as { value: string } | undefined;
    expect(row).toBeDefined();
    const log = JSON.parse(row!.value) as { atsPoll: { created: number } };
    expect(log.atsPoll.created).toBe(2);
  });
});
