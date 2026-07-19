"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Job, JobDetail, JobsQuery, Stats } from "@/lib/types";

export const jobKeys = {
  all: ["jobs"] as const,
  list: (qs: string) => ["jobs", "list", qs] as const,
  detail: (id: string) => ["jobs", "detail", id] as const,
  stats: ["stats"] as const,
};

export function queryString(query: JobsQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.tier) params.set("tier", query.tier);
  if (query.q) params.set("q", query.q);
  if (query.dueOnly) params.set("dueOnly", "true");
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useJobs(query: JobsQuery = {}) {
  const qs = queryString(query);
  return useQuery({
    queryKey: jobKeys.list(qs),
    queryFn: () => api<Job[]>(`/api/jobs${qs}`),
  });
}

export function useJob(id: string | null) {
  return useQuery({
    queryKey: jobKeys.detail(id ?? "none"),
    queryFn: () => api<JobDetail>(`/api/jobs/${id}`),
    enabled: id !== null,
  });
}

export function useStats() {
  return useQuery({
    queryKey: jobKeys.stats,
    queryFn: () => api<Stats>("/api/stats"),
    refetchInterval: 60_000,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Job>) =>
      api<Job>("/api/jobs", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (job) => {
      toast.success(`Added ${job.company} — ${job.role}`);
      void qc.invalidateQueries({ queryKey: jobKeys.all });
      void qc.invalidateQueries({ queryKey: jobKeys.stats });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface JobPatchArgs {
  id: string;
  patch: Partial<Job>;
}

/** PATCH with optimistic list/detail updates and rollback on API error. */
export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: JobPatchArgs) =>
      api<Job>(`/api/jobs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ id, patch }: JobPatchArgs) => {
      await qc.cancelQueries({ queryKey: jobKeys.all });
      const previous = qc.getQueriesData<Job[] | JobDetail>({
        queryKey: jobKeys.all,
      });
      qc.setQueriesData<Job[]>(
        { queryKey: ["jobs", "list"] },
        (old) =>
          old?.map((job) => (job.id === id ? { ...job, ...patch } : job)),
      );
      qc.setQueryData<JobDetail>(jobKeys.detail(id), (old) =>
        old ? { ...old, ...patch } : old,
      );
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) {
        qc.setQueryData(key, data);
      }
      toast.error(`Update failed: ${err.message}`);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: jobKeys.all });
      void qc.invalidateQueries({ queryKey: jobKeys.stats });
    },
  });
}

/** Mutations for drawer sub-resources; all refresh the job detail. */
export function useJobExtras(jobId: string | null) {
  const qc = useQueryClient();
  const refresh = () => {
    if (jobId) void qc.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    void qc.invalidateQueries({ queryKey: jobKeys.stats });
  };
  const onError = (err: Error) => toast.error(err.message);

  const addContact = useMutation({
    mutationFn: (input: {
      name: string;
      email?: string;
      role?: string;
      phone?: string;
    }) =>
      api(`/api/jobs/${jobId}/contacts`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: refresh,
    onError,
  });
  const touchContact = useMutation({
    mutationFn: ({ id, lastTouch }: { id: string; lastTouch: string }) =>
      api(`/api/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ lastTouch }),
      }),
    onSuccess: refresh,
    onError,
  });
  const removeContact = useMutation({
    mutationFn: (id: string) => api(`/api/contacts/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
    onError,
  });
  const addActivity = useMutation({
    mutationFn: (note: string) =>
      api(`/api/jobs/${jobId}/activity`, {
        method: "POST",
        body: JSON.stringify({ note }),
      }),
    onSuccess: refresh,
    onError,
  });
  const removeActivity = useMutation({
    mutationFn: (id: string) => api(`/api/activity/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
    onError,
  });
  const setSchedule = useMutation({
    mutationFn: (input: {
      stage: string;
      scheduledFor: string;
      prepNotes?: string | null;
    }) =>
      api(`/api/jobs/${jobId}/schedule`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: refresh,
    onError,
  });
  const refreshSkillMatch = useMutation({
    mutationFn: () =>
      api(`/api/jobs/${jobId}/skill-match`, { method: "POST" }),
    onSuccess: refresh,
    onError,
  });
  const clearSchedule = useMutation({
    mutationFn: (stage: string) =>
      api(`/api/jobs/${jobId}/schedule?stage=${encodeURIComponent(stage)}`, {
        method: "DELETE",
      }),
    onSuccess: refresh,
    onError,
  });

  return {
    addContact,
    touchContact,
    removeContact,
    addActivity,
    removeActivity,
    setSchedule,
    clearSchedule,
    refreshSkillMatch,
  };
}

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai-status"],
    queryFn: () =>
      api<{ enabled: boolean; model: string | null }>("/api/ai/status"),
    staleTime: Infinity,
  });
}

const UNDO_WINDOW_MS = 8_000;

/**
 * Deletion with an undo window: the row disappears immediately (optimistic),
 * the DELETE fires after 8s unless Undo is clicked.
 */
export function useDeleteJob() {
  const qc = useQueryClient();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const commit = useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: string }>(`/api/jobs/${id}`, { method: "DELETE" }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: jobKeys.all });
      void qc.invalidateQueries({ queryKey: jobKeys.stats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const request = (id: string, label = "job") => {
    qc.setQueriesData<Job[]>({ queryKey: ["jobs", "list"] }, (old) =>
      old?.filter((job) => job.id !== id),
    );
    const timer = setTimeout(() => {
      timers.current.delete(id);
      commit.mutate(id);
    }, UNDO_WINDOW_MS);
    timers.current.set(id, timer);
    toast(`Deleted ${label}`, {
      duration: UNDO_WINDOW_MS,
      action: {
        label: "Undo",
        onClick: () => {
          const pending = timers.current.get(id);
          if (pending) {
            clearTimeout(pending);
            timers.current.delete(id);
          }
          void qc.invalidateQueries({ queryKey: jobKeys.all });
          toast.success("Restored");
        },
      },
    });
  };

  return { request, isPending: commit.isPending };
}
