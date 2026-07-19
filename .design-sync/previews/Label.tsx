import { Input, Label } from "job-checker";

export function WithInput() {
  return (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor="company">Company</Label>
      <Input id="company" placeholder="e.g. Linear" />
    </div>
  );
}

export function DisabledField() {
  return (
    <div className="group flex w-72 flex-col gap-2" data-disabled="true">
      <Label htmlFor="source">Source</Label>
      <Input id="source" disabled defaultValue="Imported from tracker export" />
    </div>
  );
}
