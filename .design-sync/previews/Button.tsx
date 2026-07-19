import { Button } from "job-checker";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button>Add job</Button>
      <Button variant="outline">Export CSV</Button>
      <Button variant="secondary">Import</Button>
      <Button variant="ghost">Dismiss</Button>
      <Button variant="destructive">Delete job</Button>
      <Button variant="link">View posting</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="xs" variant="outline">
        xs
      </Button>
      <Button size="sm" variant="outline">
        Small
      </Button>
      <Button variant="outline">Default</Button>
      <Button size="lg" variant="outline">
        Large
      </Button>
    </div>
  );
}

export function States() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled>Saving…</Button>
      <Button variant="outline" disabled>
        Disabled
      </Button>
      <Button variant="destructive" disabled>
        Delete job
      </Button>
    </div>
  );
}
