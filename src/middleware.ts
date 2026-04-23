import { NextRequest, NextResponse } from "next/server";

export default function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (
    path.startsWith("/login") ||
    path.startsWith("/r/") ||
    path.startsWith("/api/inngest") ||
    path === "/favicon.ico" ||
    path === "/havyn-theme-boot.js"
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
