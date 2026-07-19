import { ScrollArea, StatusBadge } from "job-checker";

const PIPELINE = [
  { company: "Anthropic", status: "Panel" },
  { company: "Vercel", status: "Screen" },
  { company: "Linear", status: "Applied" },
  { company: "Stripe", status: "Evaluating" },
  { company: "Figma", status: "Assessment" },
  { company: "Datadog", status: "Applied" },
  { company: "Cloudflare", status: "Screen" },
  { company: "Notion", status: "Evaluating" },
  { company: "Ramp", status: "Applied" },
  { company: "Supabase", status: "Skipped" },
] as const;

export function JobList() {
  return (
    <ScrollArea
      className="w-72 rounded-lg border border-border bg-card"
      style={{ height: 192 }}
    >
      <div className="divide-y divide-border text-sm">
        {PIPELINE.map((job) => (
          <div
            key={job.company}
            className="flex items-center justify-between px-3 py-2"
          >
            <span className="font-medium">{job.company}</span>
            <StatusBadge status={job.status} />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export function InterviewNotes() {
  return (
    <ScrollArea
      className="w-72 rounded-lg border border-border bg-card"
      style={{ height: 192 }}
    >
      <div className="flex flex-col gap-2 px-3 py-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          Anthropic · Panel debrief
        </p>
        <p>
          System design round went deep on multi-region failover; interviewer
          pushed on cost trade-offs between active-active and pilot-light.
        </p>
        <p>
          Coding round was a rate limiter with burst allowance. Finished with
          time to spare and discussed token bucket vs sliding window.
        </p>
        <p>
          Values conversation covered incident ownership and writing culture.
          Panel seemed positive; recruiter said feedback lands Friday.
        </p>
        <p>
          Follow-up: send thank-you note, re-read the RSU refresh policy, and
          confirm the team match call for next week.
        </p>
      </div>
    </ScrollArea>
  );
}
