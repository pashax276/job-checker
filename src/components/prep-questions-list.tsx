"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePrepQuestions } from "@/hooks/use-jobs";
import type { Status } from "@/lib/constants";
import { extractQuestionsFromMarkdown, type PrepQuestion } from "@/lib/prep-notes";
import { cn } from "@/lib/utils";

function AskedByTag({
  askedBy,
  onToggle,
}: {
  askedBy: "me" | "interviewer";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Click to switch who asked this"
      className={cn(
        "shrink-0 rounded-sm px-1 py-0.5 text-[9px] font-medium tracking-wide uppercase",
        askedBy === "me"
          ? "bg-primary/10 text-primary"
          : "bg-status-assessment/10 text-status-assessment",
      )}
    >
      {askedBy === "me" ? "You" : "Them"}
    </button>
  );
}

function QuestionRow({
  index,
  question,
  onUpdate,
  onRemove,
}: {
  index: number;
  question: PrepQuestion;
  onUpdate: (patch: {
    text?: string;
    response?: string | null;
    askedBy?: "me" | "interviewer";
  }) => void;
  onRemove: () => void;
}) {
  const [editingText, setEditingText] = useState(false);
  const [draftText, setDraftText] = useState(question.text);

  return (
    <li className="group/q space-y-1">
      <div className="flex items-start gap-1.5">
        <span className="font-data pt-0.5 text-[10px] text-muted-foreground">
          {index + 1}.
        </span>
        <AskedByTag
          askedBy={question.askedBy}
          onToggle={() =>
            onUpdate({
              askedBy: question.askedBy === "me" ? "interviewer" : "me",
            })
          }
        />
        {editingText ? (
          <form
            className="flex min-w-0 flex-1 gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (draftText.trim()) onUpdate({ text: draftText.trim() });
              setEditingText(false);
            }}
          >
            <Input
              autoFocus
              className="h-6 text-[11px]"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditingText(false)}
            />
          </form>
        ) : (
          <span className="min-w-0 flex-1 text-[11px] leading-relaxed">
            {question.text}
          </span>
        )}
        <button
          type="button"
          aria-label="Edit question"
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/q:opacity-100 hover:text-primary"
          onClick={() => {
            setDraftText(question.text);
            setEditingText((v) => !v);
          }}
        >
          <Pencil className="size-2.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Remove question"
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/q:opacity-100 hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-2.5" aria-hidden />
        </button>
      </div>
      <Textarea
        rows={1}
        className="field-sizing-content min-h-7 py-1 pl-5 text-[11px]"
        placeholder={
          question.askedBy === "me"
            ? "Their response, your read on it…"
            : "Your answer, how it landed…"
        }
        defaultValue={question.response ?? ""}
        onBlur={(e) => {
          const next = e.target.value.trim() || null;
          if (next !== question.response) onUpdate({ response: next });
        }}
      />
    </li>
  );
}

export function PrepQuestionsList({
  jobId,
  stage,
  questions,
  markdownFallback,
  heading,
}: {
  jobId: string;
  stage: Status;
  questions: PrepQuestion[];
  markdownFallback: string | null;
  heading?: string;
}) {
  const { addQuestion, updateQuestion, removeQuestion, importQuestions } =
    usePrepQuestions(jobId, stage);
  const [newText, setNewText] = useState("");
  const [newAskedBy, setNewAskedBy] = useState<"me" | "interviewer">("me");
  const importable =
    questions.length === 0 && markdownFallback
      ? extractQuestionsFromMarkdown(markdownFallback)
      : [];

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {heading ?? "Questions to ask"}
      </p>
      {importable.length > 0 ? (
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px]"
          disabled={importQuestions.isPending}
          onClick={() => importQuestions.mutate(importable)}
        >
          Import {importable.length} from notes
        </Button>
      ) : null}
      {questions.length > 0 ? (
        <ol className="space-y-2">
          {questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              index={i}
              question={q}
              onUpdate={(patch) =>
                updateQuestion.mutate({ questionId: q.id, ...patch })
              }
              onRemove={() => removeQuestion.mutate(q.id)}
            />
          ))}
        </ol>
      ) : null}
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newText.trim()) return;
          addQuestion.mutate({ text: newText.trim(), askedBy: newAskedBy });
          setNewText("");
        }}
      >
        <button
          type="button"
          aria-label={`Asked by: ${newAskedBy === "me" ? "you" : "the interviewer"} — click to switch`}
          onClick={() =>
            setNewAskedBy((v) => (v === "me" ? "interviewer" : "me"))
          }
          className={cn(
            "h-6 shrink-0 rounded-sm px-1.5 text-[9px] font-medium tracking-wide uppercase",
            newAskedBy === "me"
              ? "bg-primary/10 text-primary"
              : "bg-status-assessment/10 text-status-assessment",
          )}
        >
          {newAskedBy === "me" ? "You" : "Them"}
        </button>
        <Input
          className="h-6 text-[10px]"
          placeholder={
            newAskedBy === "me"
              ? "Add a question to ask…"
              : "Add a question they asked…"
          }
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-6 gap-1 px-1.5 text-[10px]"
          disabled={!newText.trim() || addQuestion.isPending}
        >
          <Plus className="size-2.5" aria-hidden />
          Add
        </Button>
      </form>
    </div>
  );
}
