"use client";

import {
  Columns3,
  FileText,
  FileUp,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Moon,
  Plus,
  Settings,
  Table2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { StatusBadge, TierBadge } from "@/components/badges";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useJobs } from "@/hooks/use-jobs";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewJob: () => void;
  onImport: () => void;
  onOpenJob: (id: string) => void;
}

const PAGES = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/table", label: "Table", icon: Table2 },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/prep", label: "Prep", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function CommandPalette({
  open,
  onOpenChange,
  onNewJob,
  onImport,
  onOpenJob,
}: CommandPaletteProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  // Only fetch when open — the palette shouldn't cost anything while closed.
  const { data: jobs } = useJobs();

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search jobs, pages, actions…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(onNewJob)}>
            <Plus className="size-4" aria-hidden />
            New job
          </CommandItem>
          <CommandItem onSelect={() => run(onImport)}>
            <FileUp className="size-4" aria-hidden />
            Import…
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))
            }
          >
            <Moon className="size-4" aria-hidden />
            Toggle theme
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {PAGES.map(({ href, label, icon: Icon }) => (
            <CommandItem
              key={href}
              onSelect={() => run(() => router.push(href))}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Jobs">
          {(jobs ?? []).map((job) => (
            <CommandItem
              key={job.id}
              value={`${job.company} ${job.role}`}
              onSelect={() => run(() => onOpenJob(job.id))}
            >
              <span className="min-w-0 flex-1 truncate">
                {job.company}
                <span className="ml-1.5 text-muted-foreground">{job.role}</span>
              </span>
              <TierBadge tier={job.priorityTier} />
              <StatusBadge status={job.status} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
