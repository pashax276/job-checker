// Liveness: 200 whenever the process is up. No DB dependency by design.
export async function GET(): Promise<Response> {
  return Response.json({ status: "ok" });
}
