import { Textarea } from "job-checker";

export function Default() {
  return (
    <div className="w-80">
      <Textarea
        aria-label="Notes"
        defaultValue="Panel loop confirmed for Jul 24: system design, values, and hiring manager rounds. Recruiter said timeline is about a week after the loop."
      />
    </div>
  );
}

export function Placeholder() {
  return (
    <div className="w-80">
      <Textarea
        aria-label="Notes"
        placeholder="Add notes about this application…"
      />
    </div>
  );
}

export function States() {
  return (
    <div className="flex w-80 flex-col gap-3">
      <Textarea
        disabled
        aria-label="Synced notes"
        defaultValue="Read-only: synced from tracker export."
      />
      <Textarea
        aria-invalid
        aria-label="Notes"
        defaultValue="Notes exceed the 2,000 character limit."
      />
    </div>
  );
}
