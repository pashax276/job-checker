"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ACCEPTED = ".pdf,.docx,.txt,.md";

export function UploadZone() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"resume" | "cover-letter">("resume");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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

  return (
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
  );
}
