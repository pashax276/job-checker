import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional HTTP basic auth, off unless BASIC_AUTH_USER and BASIC_AUTH_PASS are
 * both set. Health probes stay open so liveness/readiness never need
 * credentials. Single-user tool behind localhost/ingress; see README.
 */
export function middleware(request: NextRequest): NextResponse {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  const expected = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  if (header === expected) return NextResponse.next();

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="job-tracker"' },
  });
}

export const config = {
  // Everything except health probes and Next's static assets.
  matcher: ["/((?!healthz|readyz|_next/static|_next/image|favicon.ico).*)"],
};
