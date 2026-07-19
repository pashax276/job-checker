import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "job-checker";

const STATUSES = [
  "Evaluating",
  "Applied",
  "Screen",
  "Assessment",
  "Panel",
  "Offer",
  "Skipped",
  "Rejected",
];

const noop = () => {};

export function StatusSelect() {
  return (
    <div style={{ height: 360 }} className="flex flex-col gap-2">
      <Select value="Applied" open onOpenChange={noop} onValueChange={noop}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
