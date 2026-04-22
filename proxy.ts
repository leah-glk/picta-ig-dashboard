import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

export const config = {
  matcher: [
    // Everything except the login page, auth API, public assets, and webhooks.
    "/((?!login|api/auth|api/cron|api/backfill|api/import|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};

export async function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password || !secret) {
    // Fail closed if misconfigured.
    return new NextResponse("Server misconfigured: DASHBOARD_PASSWORD/SESSION_SECRET unset", {
      status: 500,
    });
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const ok = await verifyToken(token, password, secret);
  if (ok) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}
