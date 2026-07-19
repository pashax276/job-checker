import { Separator } from "job-checker";

export function Horizontal() {
  return (
    <div className="w-72">
      <p className="text-sm font-medium">Interview notes</p>
      <p className="text-xs text-muted-foreground">Panel scheduled for Jul 24</p>
      <Separator className="my-3" />
      <p className="text-sm font-medium">Compensation</p>
      <p className="text-xs text-muted-foreground">$210k base + equity</p>
    </div>
  );
}

export function Vertical() {
  return (
    <div className="flex h-5 items-center gap-3 text-sm">
      <span className="font-medium">Anthropic</span>
      <Separator orientation="vertical" />
      <span className="text-muted-foreground">Senior Platform Engineer</span>
      <Separator orientation="vertical" />
      <span className="text-muted-foreground">Applied Jul 2</span>
    </div>
  );
}
