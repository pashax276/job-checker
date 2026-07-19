"use client";

import { useState } from "react";
import { toast } from "sonner";
import { JobFormFields } from "@/components/job-form-fields";
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
import { Textarea } from "@/components/ui/textarea";
import { useCreateJob } from "@/hooks/use-jobs";
import { api } from "@/lib/api-client";
import {
  EMPTY_JOB_FORM,
  validateJobForm,
  type JobFormErrors,
  type JobFormValues,
} from "@/lib/job-form";
import type { Job } from "@/lib/types";

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddJobDialog({ open, onOpenChange }: AddJobDialogProps) {
  const [values, setValues] = useState<JobFormValues>(EMPTY_JOB_FORM);
  const [errors, setErrors] = useState<JobFormErrors>({});
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [firstNote, setFirstNote] = useState("");
  const createJob = useCreateJob();

  const onChange = <K extends keyof JobFormValues>(
    key: K,
    value: JobFormValues[K],
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const reset = () => {
    setValues(EMPTY_JOB_FORM);
    setErrors({});
    setContactName("");
    setContactEmail("");
    setFirstNote("");
  };

  const attachExtras = async (job: Job) => {
    try {
      if (contactName.trim()) {
        await api(`/api/jobs/${job.id}/contacts`, {
          method: "POST",
          body: JSON.stringify({
            name: contactName.trim(),
            ...(contactEmail.trim() ? { email: contactEmail.trim() } : {}),
          }),
        });
      }
      if (firstNote.trim()) {
        await api(`/api/jobs/${job.id}/activity`, {
          method: "POST",
          body: JSON.stringify({ note: firstNote.trim() }),
        });
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? `Job created, but attaching details failed: ${err.message}`
          : "Job created, but attaching details failed",
      );
    }
  };

  const submit = () => {
    const result = validateJobForm(values);
    if (!result.data) {
      setErrors(result.errors);
      return;
    }
    createJob.mutate(result.data, {
      onSuccess: (job) => {
        void attachExtras(job).then(() => {
          reset();
          onOpenChange(false);
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add job</DialogTitle>
          <DialogDescription>
            Company and role are required; paste a posting URL to prefill the
            company. ⌘⏎ saves.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        >
          <JobFormFields
            values={values}
            errors={errors}
            onChange={onChange}
            idPrefix="add"
            autoFocusCompany
          />

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-md border p-3">
            <p className="col-span-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Optional: first contact &amp; note
            </p>
            <div className="space-y-1">
              <Label htmlFor="add-contact-name">Contact name</Label>
              <Input
                id="add-contact-name"
                placeholder="Recruiter / HM"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-contact-email">Contact email</Label>
              <Input
                id="add-contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="add-first-note">First note</Label>
              <Textarea
                id="add-first-note"
                rows={2}
                placeholder="How you found it, first impressions…"
                value={firstNote}
                onChange={(e) => setFirstNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
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
