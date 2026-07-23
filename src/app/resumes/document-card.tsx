"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Download,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import type { DocumentMeta, Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_PREVIEW_BULLETS = 6;

export function SkillsEditor({ doc }: { doc: DocumentMeta }) {
  const qc = useQueryClient();
  const [newSkill, setNewSkill] = useState("");
  const patch = useMutation({
    mutationFn: (skills: string[]) =>
      api<DocumentMeta>(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ skills }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["documents"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        Skills <span className="font-data normal-case">{doc.skills.length}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {doc.skills.map((skill) => (
          <Badge key={skill} variant="outline" className="gap-1 pr-1 font-normal">
            {skill}
            <button
              type="button"
              aria-label={`Remove ${skill}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => patch.mutate(doc.skills.filter((s) => s !== skill))}
            >
              <X className="size-2.5" aria-hidden />
            </button>
          </Badge>
        ))}
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const skill = newSkill.trim();
            if (!skill || doc.skills.includes(skill)) return;
            patch.mutate([...doc.skills, skill], {
              onSuccess: () => setNewSkill(""),
            });
          }}
        >
          <Input
            className="h-6 w-32 text-xs"
            placeholder="Add skill…"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="h-6 px-1.5"
            disabled={!newSkill.trim() || patch.isPending}
            aria-label="Add skill"
          >
            <Plus className="size-3" aria-hidden />
          </Button>
        </form>
      </div>
    </div>
  );
}

function RenameableTitle({ doc }: { doc: DocumentMeta }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doc.name);
  const rename = useMutation({
    mutationFn: (next: string) =>
      api<DocumentMeta>(`/api/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: next }),
      }),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (editing) {
    return (
      <form
        className="flex min-w-0 flex-1 items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== doc.name) rename.mutate(name.trim());
          else setEditing(false);
        }}
      >
        <Input
          autoFocus
          className="h-6 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        />
        <Button type="submit" size="sm" variant="ghost" className="h-6 px-1.5" aria-label="Save name">
          <Check className="size-3" aria-hidden />
        </Button>
      </form>
    );
  }
  return (
    <CardTitle className="group flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm">
      <span className="truncate">{doc.name}</span>
      <button
        type="button"
        aria-label={`Rename ${doc.name}`}
        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
        onClick={() => {
          setName(doc.name);
          setEditing(true);
        }}
      >
        <Pencil className="size-3" aria-hidden />
      </button>
    </CardTitle>
  );
}

export function DocumentCard({
  doc,
  jobs,
  onOpenJob,
  bare,
}: {
  doc: DocumentMeta;
  jobs: Job[];
  onOpenJob: (id: string) => void;
  /** Renders content only, no Card chrome — for the Split view's detail
   * pane, which already sits inside its own bordered panel. */
  bare?: boolean;
}) {
  const qc = useQueryClient();
  const [showAllBullets, setShowAllBullets] = useState(false);
  const usedBy = jobs.filter(
    (j) => j.resumeId === doc.id || j.coverLetterId === doc.id,
  );

  const reparse = useMutation({
    mutationFn: () =>
      api<DocumentMeta>(`/api/documents/${doc.id}/reparse`, { method: "POST" }),
    onSuccess: (updated) => {
      toast.success(
        `Re-parsed: ${updated.bullets.length} bullets, ${updated.skills.length} skills, ${updated.experience.length} roles`,
      );
      void qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const remove = useMutation({
    mutationFn: () => api(`/api/documents/${doc.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(`${doc.name} deleted`);
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bullets = showAllBullets
    ? doc.bullets
    : doc.bullets.slice(0, MAX_PREVIEW_BULLETS);
  const isResume = doc.kind === "resume";

  const header = (
    <>
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <RenameableTitle doc={doc} />
      <Badge variant="outline" className="font-data shrink-0 text-[10px]">
        {isResume ? "resume" : "cover letter"}
      </Badge>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-1.5 text-[10px]"
        disabled={reparse.isPending}
        onClick={() => reparse.mutate()}
        title="Re-run text extraction from the stored file"
      >
        <RefreshCw
          className={cn("size-3", reparse.isPending && "animate-spin")}
          aria-hidden
        />
      </Button>
      <a
        href={`/api/documents/${doc.id}/file`}
        className="text-muted-foreground hover:text-primary"
        aria-label={`Download ${doc.fileName}`}
      >
        <Download className="size-3.5" aria-hidden />
      </a>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-1.5 text-destructive hover:text-destructive"
        aria-label={`Delete ${doc.name}`}
        onClick={() => {
          if (
            window.confirm(
              `Delete ${doc.name}?${usedBy.length ? ` ${usedBy.length} job(s) use it — they keep the label but lose the link.` : ""}`,
            )
          ) {
            remove.mutate();
          }
        }}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
    </>
  );

  const content = (
    <div className="space-y-3">
      <p className="font-data text-[10px] text-muted-foreground">
        {doc.fileName} · uploaded {new Date(doc.createdAt).toLocaleDateString()}
      </p>

      {usedBy.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Used by <span className="font-data normal-case">{usedBy.length}</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {usedBy.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => onOpenJob(job.id)}
                className="rounded-sm border px-1.5 py-px text-[11px] transition-colors hover:border-ring/50 hover:bg-accent"
              >
                {job.company}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Not assigned to any job yet — pick it in a job&apos;s{" "}
          {isResume ? "Resume version" : "Cover letter"} dropdown.
        </p>
      )}

      {isResume && doc.experience.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Job history
          </p>
          <ul className="space-y-0.5 text-xs">
            {doc.experience.map((entry, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{entry.company}</span>
                  <span className="text-muted-foreground"> — {entry.title}</span>
                </span>
                <span className="font-data shrink-0 text-[10px] text-muted-foreground">
                  {entry.period}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isResume ? (
        doc.bullets.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Parsed bullets
            </p>
            <ul className="space-y-0.5 text-xs">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-muted-foreground" aria-hidden>
                    •
                  </span>
                  <span className="min-w-0">{bullet}</span>
                </li>
              ))}
            </ul>
            {doc.bullets.length > MAX_PREVIEW_BULLETS ? (
              <button
                type="button"
                className="text-[10px] text-primary hover:underline"
                onClick={() => setShowAllBullets((s) => !s)}
              >
                {showAllBullets ? "show fewer" : `show all ${doc.bullets.length}`}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No bullet points parsed — try re-parse, or upload a .txt/.docx
            version.
          </p>
        )
      ) : null}

      {doc.textExcerpt ? (
        <details>
          <summary className="cursor-pointer text-[10px] text-primary hover:underline">
            {isResume ? "full extracted text" : "letter text"}
          </summary>
          <p className="mt-1 max-h-56 overflow-y-auto rounded-md border bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {doc.textExcerpt}
          </p>
        </details>
      ) : null}

      {isResume ? <SkillsEditor doc={doc} /> : null}
    </div>
  );

  if (bare) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b pb-2">{header}</div>
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 pb-2">
        {header}
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
