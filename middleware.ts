import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const NO_STORE =
  "private, no-store, no-cache, max-age=0, must-revalidate";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const path = request.nextUrl.pathname;

  // Keep long-cache only for hashed Next build assets
  if (path.startsWith("/_next/static/")) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
    return response;
  }

  response.headers.set("Cache-Control", NO_STORE);
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Surrogate-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export const config = {
  matcher: ["/((?!_next/image|favicon.ico).*)"],
};
