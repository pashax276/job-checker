"use client";

import { useQuery } from "@tanstack/react-query";
import { StatusBadge, TierBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATUSES, TIERS, type Status, type Tier } from "@/lib/constants";
import {
  addDaysIso,
  companyNameFromSlug,
  type JobFormErrors,
  type JobFormValues,
} from "@/lib/job-form";
import { api } from "@/lib/api-client";
import type { DocumentMeta } from "@/lib/types";
import { companySlugFromUrl, detectAtsType } from "@/server/discovery/rss";
import { cn } from "@/lib/utils";

interface JobFormFieldsProps {
  values: JobFormValues;
  errors: JobFormErrors;
  onChange: <K extends keyof JobFormValues>(
    key: K,
    value: JobFormValues[K],
  ) => void;
  idPrefix: string;
  autoFocusCompany?: boolean;
  /** Fields rendered elsewhere in the host UI (e.g. drawer's schedule pane). */
  hiddenFields?: ReadonlyArray<keyof JobFormValues>;
}

const NONE = "__none__";

function DocumentSelect({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: "resume" | "cover-letter";
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: docs } = useQuery({
    queryKey: ["documents", kind],
    queryFn: () => api<DocumentMeta[]>(`/api/documents?kind=${kind}`),
  });
  // The value is a document id — resolve the display label ourselves so the
  // trigger never falls back to showing the raw UUID.
  const selectedName = value
    ? (docs?.find((d) => d.id === value)?.name ?? "…")
    : "None";
  return (
    <div className="min-w-0 space-y-1">
      <Label>{label}</Label>
      <Select
        value={value || NONE}
        onValueChange={(v) => onChange(v === NONE || !v ? "" : v)}
      >
        <SelectTrigger className="w-full min-w-0">
          <SelectValue>
            <span className="block truncate">{selectedName}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE} className="text-muted-foreground">
            None
          </SelectItem>
          {(docs ?? []).map((doc) => (
            <SelectItem key={doc.id} value={doc.id}>
              {doc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(docs ?? []).length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Upload versions on the Resumes page.
        </p>
      ) : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[11px] leading-tight text-destructive">
      {message}
    </p>
  );
}

const FOLLOW_UP_CHIPS = [
  { label: "today", days: 0 },
  { label: "+3d", days: 3 },
  { label: "+1w", days: 7 },
  { label: "+2w", days: 14 },
] as const;

export function JobFormFields({
  values,
  errors,
  onChange,
  idPrefix,
  autoFocusCompany,
  hiddenFields = [],
}: JobFormFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const show = (field: keyof JobFormValues) => !hiddenFields.includes(field);

  const atsType = values.postingUrl ? detectAtsType(values.postingUrl) : null;
  const slug = values.postingUrl ? companySlugFromUrl(values.postingUrl) : null;

  const setStatus = (status: Status) => {
    onChange("status", status);
    // Leaving Evaluating implies an application happened — prefill today once.
    if (status !== "Evaluating" && status !== "Skipped" && !values.dateApplied) {
      onChange("dateApplied", addDaysIso(new Date(), 0));
    }
  };

  const autofillCompany = () => {
    if (!values.company.trim() && slug) {
      const name = companyNameFromSlug(slug);
      if (name) onChange("company", name);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor={id("company")}>Company *</Label>
        <Input
          id={id("company")}
          autoFocus={autoFocusCompany}
          aria-invalid={!!errors.company}
          value={values.company}
          onChange={(e) => onChange("company", e.target.value)}
        />
        <FieldError message={errors.company} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={id("role")}>Role *</Label>
        <Input
          id={id("role")}
          aria-invalid={!!errors.role}
          value={values.role}
          onChange={(e) => onChange("role", e.target.value)}
        />
        <FieldError message={errors.role} />
      </div>

      <div className="space-y-1">
        <Label>Priority tier</Label>
        <Select
          value={values.priorityTier}
          onValueChange={(v) => v && onChange("priorityTier", v as Tier)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIERS.map((tier) => (
              <SelectItem key={tier} value={tier}>
                <TierBadge tier={tier} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Status</Label>
        <Select
          value={values.status}
          onValueChange={(v) => v && setStatus(v as Status)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                <StatusBadge status={status} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {show("dateApplied") ? (
        <div className="space-y-1">
          <Label htmlFor={id("date-applied")}>Date applied</Label>
          <Input
            id={id("date-applied")}
            type="date"
            aria-invalid={!!errors.dateApplied}
            value={values.dateApplied}
            onChange={(e) => onChange("dateApplied", e.target.value)}
          />
          <FieldError message={errors.dateApplied} />
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor={id("follow-up")}>Follow-up date</Label>
        <Input
          id={id("follow-up")}
          type="date"
          aria-invalid={!!errors.followUpDate}
          value={values.followUpDate}
          onChange={(e) => onChange("followUpDate", e.target.value)}
        />
        <span className="flex gap-1">
          {FOLLOW_UP_CHIPS.map((chip) => (
            <Button
              key={chip.label}
              type="button"
              variant="outline"
              size="sm"
              className="font-data h-5 px-1.5 text-[10px]"
              onClick={() =>
                onChange("followUpDate", addDaysIso(new Date(), chip.days))
              }
            >
              {chip.label}
            </Button>
          ))}
        </span>
        <FieldError message={errors.followUpDate} />
      </div>

      <div className="col-span-2 space-y-1">
        <Label>Compensation</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input
            aria-label="Base salary"
            placeholder="base $170k"
            value={values.compBase}
            onChange={(e) => onChange("compBase", e.target.value)}
          />
          <Input
            aria-label="Bonus"
            placeholder="bonus 10%"
            value={values.compBonus}
            onChange={(e) => onChange("compBonus", e.target.value)}
          />
          <Input
            aria-label="Equity"
            placeholder="equity 0.05%"
            value={values.compEquity}
            onChange={(e) => onChange("compEquity", e.target.value)}
          />
        </div>
        <Input
          id={id("comp")}
          aria-label="Other comp notes"
          placeholder="other comp notes — on-call, refreshers…"
          value={values.compNotes}
          onChange={(e) => onChange("compNotes", e.target.value)}
        />
      </div>

      <div className="col-span-2 space-y-1">
        <Label htmlFor={id("next-action")}>Next action</Label>
        <Textarea
          id={id("next-action")}
          rows={1}
          className="field-sizing-content min-h-9 resize-y"
          value={values.nextAction}
          onChange={(e) => onChange("nextAction", e.target.value)}
        />
      </div>

      <div className="col-span-2 space-y-1">
        <Label htmlFor={id("url")}>Posting URL</Label>
        <Input
          id={id("url")}
          type="url"
          placeholder="https://…"
          aria-invalid={!!errors.postingUrl}
          value={values.postingUrl}
          onChange={(e) => onChange("postingUrl", e.target.value)}
          onBlur={autofillCompany}
        />
        {atsType ? (
          <p className={cn("font-data text-[10px] text-muted-foreground")}>
            detected {atsType}
            {slug ? ` · ${slug}` : ""}
          </p>
        ) : null}
        <FieldError message={errors.postingUrl} />
      </div>
      <DocumentSelect
        label="Resume version"
        kind="resume"
        value={values.resumeId}
        onChange={(v) => onChange("resumeId", v)}
      />
      <DocumentSelect
        label="Cover letter"
        kind="cover-letter"
        value={values.coverLetterId}
        onChange={(v) => onChange("coverLetterId", v)}
      />

      <div className="col-span-2 space-y-1">
        <Label htmlFor={id("notes")}>Notes</Label>
        <Textarea
          id={id("notes")}
          rows={3}
          value={values.notes}
          onChange={(e) => onChange("notes", e.target.value)}
        />
      </div>
    </div>
  );
}
