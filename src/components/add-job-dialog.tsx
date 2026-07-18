"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useCreateJob } from "@/hooks/use-jobs";
import {
  DEFAULT_STATUS,
  DEFAULT_TIER,
  STATUSES,
  TIERS,
  type Status,
  type Tier,
} from "@/lib/constants";
import { jobCreateSchema } from "@/lib/schemas";

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  company: string;
  role: string;
  priorityTier: Tier;
  status: Status;
  dateApplied: string;
  followUpDate: string;
  compNotes: string;
  nextAction: string;
  contact: string;
  postingUrl: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  company: "",
  role: "",
  priorityTier: DEFAULT_TIER,
  status: DEFAULT_STATUS,
  dateApplied: "",
  followUpDate: "",
  compNotes: "",
  nextAction: "",
  contact: "",
  postingUrl: "",
  notes: "",
};

export function AddJobDialog({ open, onOpenChange }: AddJobDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const createJob = useCreateJob();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    const parsed = jobCreateSchema.safeParse(form);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
          .join("; "),
      );
      return;
    }
    createJob.mutate(parsed.data, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setError(null);
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add job</DialogTitle>
          <DialogDescription>
            Company and role are required; everything else can wait.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="add-company">Company *</Label>
            <Input
              id="add-company"
              autoFocus
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-role">Role *</Label>
            <Input
              id="add-role"
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Priority tier</Label>
            <Select
              value={form.priorityTier}
              onValueChange={(v) => set("priorityTier", v as Tier)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as Status)}
            >
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
          <div className="space-y-1">
            <Label htmlFor="add-date-applied">Date applied</Label>
            <Input
              id="add-date-applied"
              type="date"
              value={form.dateApplied}
              onChange={(e) => set("dateApplied", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-follow-up">Follow-up date</Label>
            <Input
              id="add-follow-up"
              type="date"
              value={form.followUpDate}
              onChange={(e) => set("followUpDate", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-comp">Comp notes</Label>
            <Input
              id="add-comp"
              placeholder="$170–195k"
              value={form.compNotes}
              onChange={(e) => set("compNotes", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-contact">Contact</Label>
            <Input
              id="add-contact"
              value={form.contact}
              onChange={(e) => set("contact", e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="add-next-action">Next action</Label>
            <Input
              id="add-next-action"
              value={form.nextAction}
              onChange={(e) => set("nextAction", e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="add-url">Posting URL</Label>
            <Input
              id="add-url"
              type="url"
              placeholder="https://…"
              value={form.postingUrl}
              onChange={(e) => set("postingUrl", e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="add-notes">Notes</Label>
            <Textarea
              id="add-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="col-span-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter className="col-span-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createJob.isPending}>
              {createJob.isPending ? "Adding…" : "Add job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
