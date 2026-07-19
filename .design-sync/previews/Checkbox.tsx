import { Checkbox, Label } from "job-checker";

export function States() {
  return (
    <div className="flex items-center gap-4">
      <Checkbox aria-label="Unchecked" />
      <Checkbox defaultChecked aria-label="Checked" />
      <Checkbox disabled aria-label="Disabled" />
      <Checkbox disabled defaultChecked aria-label="Disabled checked" />
    </div>
  );
}

export function LabeledRow() {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id="follow-up" defaultChecked />
      <Label htmlFor="follow-up">Follow up with Stripe recruiter</Label>
    </div>
  );
}

export function Checklist() {
  return (
    <div className="w-72 divide-y divide-border rounded-lg border border-border bg-card text-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <Checkbox id="prep-1" defaultChecked />
        <Label htmlFor="prep-1">Tailor resume for Vercel</Label>
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <Checkbox id="prep-2" defaultChecked />
        <Label htmlFor="prep-2">Complete Linear assessment</Label>
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <Checkbox id="prep-3" />
        <Label htmlFor="prep-3">Send thank-you note after panel</Label>
      </div>
    </div>
  );
}
