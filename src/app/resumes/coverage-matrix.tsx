import { Check } from "lucide-react";
import { computeSkillUniverse, resumeCoverage } from "@/app/resumes/skill-universe";
import type { DocumentMeta, Job } from "@/lib/types";

export function CoverageMatrix({
  resumes,
  jobs,
}: {
  resumes: DocumentMeta[];
  jobs: Job[];
}) {
  const universe = computeSkillUniverse(jobs);

  if (resumes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Upload a resume to see its skill coverage here.
      </p>
    );
  }
  if (universe.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No skill signal yet — run a skill match check on a job (its posting
        vs. your resume) to start building the coverage picture.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {`Every skill that's shown up as matched or missing across jobs you've checked — ${universe.length} total. A resume's coverage counts how many of those it lists.`}
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
              <th className="sticky left-0 bg-card">Resume</th>
              <th>Coverage</th>
              {universe.map((skill) => (
                <th key={skill} className="font-data font-normal whitespace-nowrap">
                  {skill}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumes.map((doc) => {
              const resumeSet = new Set(
                doc.skills.map((s) => s.toLowerCase()),
              );
              const { covered, total } = resumeCoverage(doc.skills, universe);
              return (
                <tr key={doc.id} className="border-t">
                  <td className="sticky left-0 max-w-40 truncate bg-card px-2 py-1.5 font-medium">
                    {doc.name}
                  </td>
                  <td className="font-data px-2 py-1.5 text-muted-foreground">
                    {covered}/{total}
                  </td>
                  {universe.map((skill) => (
                    <td key={skill} className="px-2 py-1.5 text-center">
                      {resumeSet.has(skill.toLowerCase()) ? (
                        <Check
                          className="mx-auto size-3 text-status-offer"
                          aria-label={`${doc.name} covers ${skill}`}
                        />
                      ) : (
                        <span
                          className="text-muted-foreground/40"
                          aria-label={`${doc.name} does not cover ${skill}`}
                        >
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
