import { AddJobDialog } from "job-checker";

const noop = () => {};

export function OpenForm() {
  return <AddJobDialog open onOpenChange={noop} />;
}
