"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
interface PreviewRow {
  index: number;
  raw: Record<string, unknown>;
  duplicateOfId: string | null;
  error: string | null;
}

type Decision = "create" | "skip" | "update";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const reset = () => {
    setFile(null);
    setRows(null);
    setDecisions({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const upload = async (mode: "preview" | "commit") => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("mode", mode);
      form.set("decisions", JSON.stringify(decisions));
      const res = await fetch("/api/import", { method: "POST", body: form });
      const body = (await res.json()) as {
        success: boolean;
        data: {
          rows?: PreviewRow[];
          created?: number;
          updated?: number;
          skipped?: number;
          errors?: Array<{ index: number; error: string }>;
        } | null;
        error: string | null;
      };
      if (!res.ok || !body.success || !body.data) {
        throw new Error(body.error ?? `Import failed (${res.status})`);
      }
      if (mode === "preview") {
        setRows(body.data.rows ?? []);
      } else {
        const { created = 0, updated = 0, skipped = 0, errors = [] } = body.data;
        toast.success(
          `Import complete: ${created} created, ${updated} updated, ${skipped} skipped` +
            (errors.length ? `, ${errors.length} failed` : ""),
        );
        await qc.invalidateQueries();
        close(false);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const duplicates = rows?.filter((r) => r.duplicateOfId !== null) ?? [];
  const invalid = rows?.filter((r) => r.error !== null) ?? [];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import jobs</DialogTitle>
          <DialogDescription>
            Upload an .xlsx or .csv in the original tracker column layout, or
            a .json export (bare array or a &quot;jobs&quot; envelope).
            Duplicates match on company + role (case-insensitive), regardless
            of format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv,.json"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setRows(null);
                setDecisions({});
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="size-3.5" aria-hidden />
              Choose file
            </Button>
            <span className="truncate text-sm text-muted-foreground">
              {file?.name ?? "No file selected"}
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              disabled={!file || busy}
              onClick={() => void upload("preview")}
            >
              Preview
            </Button>
          </div>

          {rows ? (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-data">{rows.length}</span> rows parsed ·{" "}
                <span className="font-data">{duplicates.length}</span> duplicates
                {invalid.length > 0 ? (
                  <span className="text-destructive">
                    {" "}
                    · <span className="font-data">{invalid.length}</span> invalid
                  </span>
                ) : null}
              </p>
              <div className="max-h-72 overflow-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
                      <th>Company</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.index} className="border-t">
                        <td className="px-2 py-1.5">
                          {String(row.raw.company ?? "")}
                        </td>
                        <td className="px-2 py-1.5">
                          {String(row.raw.role ?? "")}
                        </td>
                        <td className="px-2 py-1.5">
                          {String(row.raw.status ?? "Evaluating")}
                        </td>
                        <td className="px-2 py-1.5">
                          {row.error !== null ? (
                            <span className="text-destructive">{row.error}</span>
                          ) : row.duplicateOfId !== null ? (
                            <Select
                              value={decisions[row.index] ?? "skip"}
                              onValueChange={(v) =>
                                setDecisions((d) => ({
                                  ...d,
                                  [row.index]: v as Decision,
                                }))
                              }
                            >
                              <SelectTrigger
                                size="sm"
                                className="h-6 w-40 text-xs"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skip" className="text-xs">
                                  Duplicate — skip
                                </SelectItem>
                                <SelectItem value="update" className="text-xs">
                                  Duplicate — update
                                </SelectItem>
                                <SelectItem value="create" className="text-xs">
                                  Create anyway
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">
                              will create
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            disabled={!rows || busy}
            onClick={() => void upload("commit")}
            className="gap-1.5"
          >
            <Upload className="size-3.5" aria-hidden />
            {busy ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
