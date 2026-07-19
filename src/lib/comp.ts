export interface CompParts {
  compBase: string | null;
  compBonus: string | null;
  compEquity: string | null;
  compNotes: string | null;
}

/**
 * One display/export string from the structured comp fields. Legacy rows that
 * only carry compNotes render unchanged; the xlsx "Comp Notes" column uses
 * this so the original tracker layout keeps round-tripping.
 */
export function composeComp(parts: CompParts): string | null {
  const pieces: string[] = [];
  if (parts.compBase) pieces.push(`base ${parts.compBase}`);
  if (parts.compBonus) pieces.push(`bonus ${parts.compBonus}`);
  if (parts.compEquity) pieces.push(`equity ${parts.compEquity}`);
  if (parts.compNotes) pieces.push(parts.compNotes);
  return pieces.length > 0 ? pieces.join(" · ") : null;
}
