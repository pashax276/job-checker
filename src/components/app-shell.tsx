"use client";

import {
  Columns3,
  Download,
  FileText,
  FileUp,
  Inbox,
  LayoutDashboard,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Table2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { AddJobDialog } from "@/components/add-job-dialog";
import { ImportDialog } from "@/components/import-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, key: "1" },
  { href: "/board", label: "Board", icon: Columns3, key: "2" },
  { href: "/table", label: "Table", icon: Table2, key: "3" },
  { href: "/inbox", label: "Inbox", icon: Inbox, key: "4" },
  { href: "/resumes", label: "Resumes", icon: FileText, key: "5" },
  { href: "/settings", label: "Settings", icon: Settings, key: null },
] as const;

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  // Global shortcuts: "/" focus search, "n" new job, 1–4 switch views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "n") {
        e.preventDefault();
        setAddOpen(true);
        return;
      }
      const nav = NAV.find((n) => n.key === e.key);
      if (nav) {
        e.preventDefault();
        router.push(nav.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const submitSearch = () => {
    const q = search.trim();
    router.push(q ? `/table?q=${encodeURIComponent(q)}` : "/table");
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="flex w-52 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground max-md:w-14">
        <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-4 max-md:justify-center max-md:px-0">
          <span className="size-2 rounded-full bg-sidebar-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight max-md:hidden">
            Pipeline
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon, key }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors max-md:justify-center",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 max-md:hidden">{label}</span>
                {key ? (
                  <kbd className="font-data text-[10px] text-muted-foreground max-md:hidden">
                    {key}
                  </kbd>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 px-2.5 text-[13px] max-md:justify-center"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            <Sun className="hidden size-4 dark:block" aria-hidden />
            <Moon className="size-4 dark:hidden" aria-hidden />
            {/* CSS-driven text: server HTML can't know the theme (avoids
                hydration text mismatch) */}
            <span className="hidden max-md:hidden dark:inline">Light mode</span>
            <span className="inline max-md:hidden dark:hidden">Dark mode</span>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
          <div className="relative w-full max-w-sm">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              id="global-search"
              placeholder="Search company, role, notes…  ( / )"
              className="h-8 pl-8 text-[13px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSearch();
                if (e.key === "Escape") searchRef.current?.blur();
              }}
            />
          </div>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setImportOpen(true)}
          >
            <FileUp className="size-3.5" aria-hidden />
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" />
              }
            >
              <Download className="size-3.5" aria-hidden />
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-xs"
                onClick={() => (window.location.href = "/api/export?format=xlsx")}
              >
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onClick={() => (window.location.href = "/api/export?format=json")}
              >
                JSON (.json)
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onClick={() => (window.location.href = "/api/export/ics")}
              >
                Follow-up calendar (.ics)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" aria-hidden />
            New job
            <kbd className="font-data ml-1 rounded-sm bg-primary-foreground/15 px-1 text-[10px]">
              n
            </kbd>
          </Button>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>

      <AddJobDialog open={addOpen} onOpenChange={setAddOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
