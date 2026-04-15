import NextAuth from "next-auth";

import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const path = req.nextUrl.pathname;
  if (
    path.startsWith("/login") ||
    path.startsWith("/r/") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/inngest") ||
    path === "/favicon.ico" ||
    path === "/havyn-theme-boot.js"
  ) {
    return;
  }

  // Local dev: skip OAuth redirect. Identity still comes from `DEV_ORGANIZATION_ID` + `DEV_USER_ID` in `.env.local` (run `npm run db:seed`).
  if (process.env.NODE_ENV === "development") {
    return;
  }

  if (!req.auth) {
    const url = new URL("/login", req.url);
    if (path !== "/") url.searchParams.set("callbackUrl", path);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
