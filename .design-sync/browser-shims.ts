// Runs before every other bundle module (must stay the FIRST extraEntry): the
// Next.js client runtime reads process.env.__NEXT_* at module scope, which
// throws in a plain browser page without this shim.
if (typeof (globalThis as { process?: unknown }).process === "undefined") {
  (globalThis as { process?: { env: Record<string, string> } }).process = {
    env: {},
  };
}
export {};
