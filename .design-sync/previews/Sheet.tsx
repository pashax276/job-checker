import {
  Button,
  DueBadge,
  Input,
  Label,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  StatusBadge,
  TierBadge,
} from "job-checker";

const noop = () => {};

export function JobDetailSheet() {
  return (
    <Sheet open onOpenChange={noop}>
      <SheetContent side="right">
        <SheetHeader>
          <div className="flex items-center gap-2 pb-1">
            <TierBadge tier="1 - Top" />
            <StatusBadge status="Panel" />
            <DueBadge />
          </div>
          <SheetTitle>Anthropic — Senior Platform Engineer</SheetTitle>
          <SheetDescription>
            <span className="font-data text-xs">
              applied 21d ago · 12d in Panel
            </span>
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="space-y-1">
            <Label htmlFor="sh-next">Next action</Label>
            <Input id="sh-next" defaultValue="Prep system design round" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sh-contact">Contact</Label>
            <Input id="sh-contact" defaultValue="recruiting@anthropic.com" />
          </div>
        </div>
        <SheetFooter>
          <Button>Save changes</Button>
          <Button variant="ghost">Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
