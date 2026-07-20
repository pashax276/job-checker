"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Download,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { JobDrawer } from "@/components/job-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobs } from "@/hooks/use-jobs";
import { api } from "@/lib/api-client";
import type { DocumentMeta, Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_PREVIEW_BULLETS = 6;
const ACCEPTED = ".pdf,.docx,.txt,.md";

function SkillsEditor({ doc }: { doc: DocumentMeta }) {
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

function DocumentCard({
  doc,
  jobs,
  onOpenJob,
}: {
  doc: DocumentMeta;
  jobs: Job[];
  onOpenJob: (id: string) => void;
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

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 pb-2">
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
      </CardHeader>
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
  );
}

export default function ResumesPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"resume" | "cover-letter">("resume");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents", "all"],
    queryFn: () => api<DocumentMeta[]>("/api/documents"),
  });
  const { data: jobs } = useJobs();

  const pickFile = (picked: File | null) => {
    setFile(picked);
    if (picked && !name.trim()) {
      setName(picked.name.replace(/\.[^.]+$/, ""));
    }
    if (picked && /cover|letter/i.test(picked.name)) {
      setKind("cover-letter");
    }
  };

  const upload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("name", name.trim());
      form.set("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const body = (await res.json()) as { success: boolean; error: string | null };
      if (!res.ok || !body.success) {
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }
      toast.success(`${name.trim()} uploaded and parsed`);
      setName("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      void qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resumes = (docs ?? []).filter((d) => d.kind === "resume");
  const coverLetters = (docs ?? []).filter((d) => d.kind === "cover-letter");

  return (
    <div className="max-w-4xl space-y-4 p-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload area — drop a file or click to choose"
        className={cn(
          "rounded-lg border-2 border-dashed p-4 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border",
        )}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Upload className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              {file ? (
                <span className="font-data">{file.name}</span>
              ) : (
                <>Drop a resume or cover letter here, or click to choose</>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, docx, txt, md — bullets, skills, and job history parse
              automatically
            </p>
          </div>
          <span onClick={(e) => e.stopPropagation()}>
            <Select
              value={kind}
              onValueChange={(v) => v && setKind(v as "resume" | "cover-letter")}
            >
              <SelectTrigger size="sm" className="w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resume" className="text-xs">
                  Resume
                </SelectItem>
                <SelectItem value="cover-letter" className="text-xs">
                  Cover letter
                </SelectItem>
              </SelectContent>
            </Select>
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <Input
              className="h-8 w-44 text-sm"
              placeholder="Version name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={uploading || !file || !name.trim()}
              onClick={() => void upload()}
            >
              <Upload className="size-3.5" aria-hidden />
              {uploading ? "Parsing…" : "Upload"}
            </Button>
          </span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : (docs ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing uploaded yet. Add your current resume to start linking
          versions to jobs.
        </p>
      ) : (
        <>
          {resumes.length > 0 ? (
            <>
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Resumes <span className="font-data">{resumes.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
                {resumes.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    jobs={jobs ?? []}
                    onOpenJob={setSelectedJobId}
                  />
                ))}
              </div>
            </>
          ) : null}
          {coverLetters.length > 0 ? (
            <>
              <h2 className="pt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Cover letters <span className="font-data">{coverLetters.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
                {coverLetters.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    jobs={jobs ?? []}
                    onOpenJob={setSelectedJobId}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      <JobDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
    </div>
  );
}
