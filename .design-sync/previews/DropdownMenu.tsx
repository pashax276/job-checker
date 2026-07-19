import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "job-checker";

const noop = () => {};

export function RowActionsMenu() {
  return (
    <div style={{ height: 300 }}>
      <DropdownMenu open onOpenChange={noop}>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" />}
        >
          Actions
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Linear — Staff Frontend</DropdownMenuLabel>
            <DropdownMenuItem>Advance stage</DropdownMenuItem>
            <DropdownMenuItem>Edit details</DropdownMenuItem>
            <DropdownMenuItem>Open posting</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete job</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
