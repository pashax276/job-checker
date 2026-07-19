import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "job-checker";

export function FollowUpTooltip() {
  return (
    <TooltipProvider>
      <div
        className="flex items-end justify-center"
        style={{ height: 140, paddingBottom: 8 }}
      >
        <Tooltip open>
          <TooltipTrigger className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium">
            2 follow-ups due
          </TooltipTrigger>
          <TooltipContent>
            Stripe screen follow-up · due today
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export function BottomSide() {
  return (
    <TooltipProvider>
      <div
        className="flex justify-center"
        style={{ height: 140, paddingTop: 8, alignItems: "flex-start" }}
      >
        <Tooltip open>
          <TooltipTrigger className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium">
            Anthropic · Panel
          </TooltipTrigger>
          <TooltipContent side="bottom">
            12 days in stage — longest in your pipeline
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
