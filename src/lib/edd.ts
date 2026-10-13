import { EDD_STAGES, type EddStage } from "@/lib/constants";

/** True for a status that counts as a work-search contact on EDD. */
export function isEddStage(status: string): status is EddStage {
  return (EDD_STAGES as readonly string[]).includes(status);
}

/**
 * The stage the "mark reported" control offers first: the job's current
 * status when it can be reported (even if it already is — re-marking corrects
 * the date), otherwise the earliest stage still unreported.
 */
export function defaultEddStage(
  status: string,
  reported: readonly string[],
): EddStage {
  if (isEddStage(status)) return status;
  return EDD_STAGES.find((stage) => !reported.includes(stage)) ?? EDD_STAGES[0];
}

/** Whether the stage a job is in right now is already on EDD. */
export function isCurrentStageReported(
  status: string,
  reported: readonly string[] | undefined,
): boolean {
  return isEddStage(status) && (reported ?? []).includes(status);
}
