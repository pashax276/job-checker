import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "job-checker";

const noop = () => {};

export function EditNoteDialog() {
  return (
    <Dialog open onOpenChange={noop}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add interview note</DialogTitle>
          <DialogDescription>
            Attached to Anthropic — Senior Platform Engineer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="dlg-topic">Topic</Label>
          <Input id="dlg-topic" defaultValue="Panel round debrief" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dlg-note">Note</Label>
          <Textarea
            id="dlg-note"
            rows={3}
            defaultValue="Strong signal on systems design. Follow up on comp band before Friday."
          />
        </div>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button>Save note</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
