import { Input } from "job-checker";

export function Default() {
  return (
    <div className="flex w-72 flex-col gap-3">
      <Input defaultValue="Anthropic" aria-label="Company" />
      <Input placeholder="https://jobs.ashbyhq.com/…" aria-label="Posting URL" />
    </div>
  );
}

export function Disabled() {
  return (
    <div className="w-72">
      <Input
        disabled
        defaultValue="Stripe — imported from export"
        aria-label="Company"
      />
    </div>
  );
}

export function Invalid() {
  return (
    <div className="w-72">
      <Input aria-invalid defaultValue="not-a-url" aria-label="Posting URL" />
    </div>
  );
}
