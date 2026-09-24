import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicRoutes = [
    "/login",
    "/register",
  ];

  const isPublicRoute = publicRoutes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`),
  );

  /*
   * Authentication is ultimately enforced by the
   * backend session/authorization layer.
   *
   * This proxy only prevents obviously unauthenticated
   * navigation from entering dashboard routes when the
   * session cookie is absent.
   */
  const sessionCookie = request.cookies.get(
    "data_manage_session",
  );

  const isDashboardRoute =
    pathname.startsWith("/dashboard");

  if (
    isDashboardRoute &&
    !sessionCookie &&
    !isPublicRoute
  ) {
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "next",
      pathname,
    );

    return NextResponse.redirect(loginUrl);
  }

  if (
    isPublicRoute &&
    sessionCookie &&
    pathname !== "/"
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
  ],
};