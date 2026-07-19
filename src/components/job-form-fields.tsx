"use client";

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
}: JobFormFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`;

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

      <div className="space-y-1">
        <Label htmlFor={id("comp")}>Comp notes</Label>
        <Input
          id={id("comp")}
          placeholder="$170–195k"
          value={values.compNotes}
          onChange={(e) => onChange("compNotes", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={id("contact")}>Contact</Label>
        <Input
          id={id("contact")}
          value={values.contact}
          onChange={(e) => onChange("contact", e.target.value)}
        />
      </div>

      <div className="col-span-2 space-y-1">
        <Label htmlFor={id("next-action")}>Next action</Label>
        <Input
          id={id("next-action")}
          value={values.nextAction}
          onChange={(e) => onChange("nextAction", e.target.value)}
        />
      </div>

      <div className="space-y-1">
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
      <div className="space-y-1">
        <Label htmlFor={id("resume")}>Resume version</Label>
        <Input
          id={id("resume")}
          placeholder="e.g. v3-platform"
          value={values.resumeVersion}
          onChange={(e) => onChange("resumeVersion", e.target.value)}
        />
      </div>

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
