import { clerkMiddleware } from "@clerk/nextjs/server";

export const proxy = clerkMiddleware();

export const proxyConfig = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)$).*)",
    "/(api|trpc)(.*)",
  ],
};
