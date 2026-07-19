"use client";

import { useState } from "react";
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
import { useCreateJob } from "@/hooks/use-jobs";
import {
  EMPTY_JOB_FORM,
  validateJobForm,
  type JobFormErrors,
  type JobFormValues,
} from "@/lib/job-form";

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddJobDialog({ open, onOpenChange }: AddJobDialogProps) {
  const [values, setValues] = useState<JobFormValues>(EMPTY_JOB_FORM);
  const [errors, setErrors] = useState<JobFormErrors>({});
  const createJob = useCreateJob();

  const onChange = <K extends keyof JobFormValues>(
    key: K,
    value: JobFormValues[K],
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const submit = () => {
    const result = validateJobForm(values);
    if (!result.data) {
      setErrors(result.errors);
      return;
    }
    createJob.mutate(result.data, {
      onSuccess: () => {
        setValues(EMPTY_JOB_FORM);
        setErrors({});
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
