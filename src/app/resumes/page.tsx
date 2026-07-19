"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
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
import { api } from "@/lib/api-client";
import type { DocumentMeta } from "@/lib/types";

const MAX_PREVIEW_BULLETS = 6;

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
        Skills{" "}
        <span className="font-data normal-case">
          {doc.skills.length} parsed + manual
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {doc.skills.map((skill) => (
          <Badge
            key={skill}
            variant="outline"
            className="gap-1 pr-1 font-normal"
          >
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

function DocumentCard({ doc }: { doc: DocumentMeta }) {
  const qc = useQueryClient();
  const [showAllBullets, setShowAllBullets] = useState(false);
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

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 pb-2">
        <FileText className="size-4 text-muted-foreground" aria-hidden />
        <CardTitle className="min-w-0 flex-1 truncate text-sm">
          {doc.name}
        </CardTitle>
        <Badge variant="outline" className="font-data text-[10px]">
          {doc.kind === "resume" ? "resume" : "cover letter"}
        </Badge>
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
            if (window.confirm(`Delete ${doc.name}? Jobs using it keep the label but lose the link.`)) {
              remove.mutate();
            }
          }}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-data text-[10px] text-muted-foreground">
          {doc.fileName} · uploaded{" "}
          {new Date(doc.createdAt).toLocaleDateString()}
        </p>
        {doc.bullets.length > 0 ? (
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
                {showAllBullets
                  ? "show fewer"
                  : `show all ${doc.bullets.length}`}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No bullet points parsed from this file.
          </p>
        )}
        <SkillsEditor doc={doc} />
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

  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents", "all"],
    queryFn: () => api<DocumentMeta[]>("/api/documents"),
  });

  const upload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("name", name.trim());
      form.set("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const body = (await res.json()) as {
        success: boolean;
        error: string | null;
      };
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

  return (
    <div className="max-w-4xl space-y-4 p-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Upload a version</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void upload();
            }}
          >
            <div className="space-y-1">
              <Select
                value={kind}
                onValueChange={(v) =>
                  v && setKind(v as "resume" | "cover-letter")
                }
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
            </div>
            <Input
              className="h-8 w-44 text-sm"
              placeholder="Version name — v3-platform"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="text-xs file:mr-2 file:rounded-md file:border file:bg-transparent file:px-2 file:py-1 file:text-xs"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="submit"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={uploading || !file || !name.trim()}
            >
              <Upload className="size-3.5" aria-hidden />
              {uploading ? "Parsing…" : "Upload"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            PDF, docx, txt, or md. Bullets and skills are parsed automatically;
            assign versions to jobs from the job form — tailored versions per
            application are the point.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : (docs ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing uploaded yet. Add your current resume to start linking
          versions to jobs.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
          {(docs ?? []).map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
