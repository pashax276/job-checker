import { CalendarPlus, ExternalLink, Newspaper, Users } from "lucide-react";
import { buildTrackerCalendar } from "@/lib/ics";
import type { BookedStep } from "@/app/prep/types";

export function downloadStepIcs(step: BookedStep) {
  const ics = buildTrackerCalendar(
    [],
    [
      {
        jobId: step.jobId,
        company: step.company,
        role: step.role,
        stage: step.stage,
        scheduledFor: step.scheduledFor,
      },
    ],
  );
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${step.company.replace(/\W+/g, "-")}-${step.stage.replace(/\W+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResearchLinks({ company }: { company: string }) {
  const q = encodeURIComponent(company);
  const links = [
    {
      label: "News",
      icon: Newspaper,
      href: `https://news.google.com/search?q=${q}`,
    },
    {
      label: "People",
      icon: Users,
      href: `https://www.linkedin.com/search/results/people/?keywords=${q}`,
    },
    {
      label: "Reviews",
      icon: ExternalLink,
      href: `https://www.glassdoor.com/Search/results.htm?keyword=${q}`,
    },
  ];
  return (
    <span className="flex items-center gap-1">
      {links.map(({ label, icon: Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[10px] text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground"
        >
          <Icon className="size-2.5" aria-hidden />
          {label}
        </a>
      ))}
    </span>
  );
}

export function IcsButton({ step }: { step: BookedStep }) {
  return (
    <button
      type="button"
      onClick={() => downloadStepIcs(step)}
      className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[10px] text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground"
    >
      <CalendarPlus className="size-2.5" aria-hidden />
      .ics
    </button>
  );
}
