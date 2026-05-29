import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Substack/X-style profile URLs: /@handle. Next reserves `app/@folder` for
// parallel routes, so we can't have an `app/@[username]` route — instead we
// rewrite /@handle → /u/[username] internally. The address bar keeps /@handle;
// the existing profile page renders. Rewrite (not redirect) so /u/ also still
// works as a canonical-aliased path. Composed inside clerkMiddleware so the
// session/auth context is untouched.
const HANDLE = /^\/@([^/]+)$/;

export const proxy = clerkMiddleware((_auth, req) => {
  const match = req.nextUrl.pathname.match(HANDLE);
  if (match) {
    const url = req.nextUrl.clone();
    url.pathname = `/u/${match[1]}`;
    return NextResponse.rewrite(url);
  }
});

export const proxyConfig = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)$).*)",
    "/(api|trpc)(.*)",
  ],
};
