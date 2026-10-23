import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isAuthed = Boolean(req.auth);
  const needsAuth =
    path.startsWith("/dashboard") || path.startsWith("/admin") || path.startsWith("/onboarding");

  if (needsAuth && !isAuthed) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding"],
};
