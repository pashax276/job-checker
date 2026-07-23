import { DocumentCard } from "@/app/resumes/document-card";
import type { DocumentMeta, Job } from "@/lib/types";

export function ListView({
  resumes,
  coverLetters,
  jobs,
  onOpenJob,
}: {
  resumes: DocumentMeta[];
  coverLetters: DocumentMeta[];
  jobs: Job[];
  onOpenJob: (id: string) => void;
}) {
  if (resumes.length === 0 && coverLetters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing uploaded yet. Add your current resume to start linking
        versions to jobs.
      </p>
    );
  }
  return (
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
                jobs={jobs}
                onOpenJob={onOpenJob}
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
                jobs={jobs}
                onOpenJob={onOpenJob}
              />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
