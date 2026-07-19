import { ImportDialog } from "job-checker";

const noop = () => {};

export function OpenImport() {
  return <ImportDialog open onOpenChange={noop} />;
}
