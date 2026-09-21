import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

const PUBLIC_ROUTES: string[] = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth/",
  "/_next/",
  "/favicon.ico",
  "/pay/",
  "/platform/login",
];

const PLATFORM_ADMIN_ROUTES: string[] = ["/admin", "/api/platform"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(route.endsWith("/") ? route : `${route}/`) ||
      (route.startsWith("/api/") && pathname.startsWith(route)),
  );
}

function isPlatformAdminRoute(pathname: string): boolean {
  return PLATFORM_ADMIN_ROUTES.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`),
  );
}

function isApiPlatformRoute(pathname: string): boolean {
  return pathname.startsWith("/api/platform");
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const path = request.nextUrl.pathname;

  if (isPublicRoute(path)) {
    return NextResponse.next();
  }

  if (isPlatformAdminRoute(path)) {
    const isPlatformAdmin =
      session?.user?.roles &&
      (session.user.roles["platform"] ?? []).includes("PLATFORM_ADMIN");

    if (!session) {
      if (isApiPlatformRoute(path)) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }
      const platformLoginUrl = new URL("/platform/login", request.url);
      platformLoginUrl.searchParams.set("callbackUrl", request.url);
      return NextResponse.redirect(platformLoginUrl);
    }

    if (!isPlatformAdmin) {
      if (isApiPlatformRoute(path)) {
        return NextResponse.json(
          { error: "Forbidden: platform admin role required" },
          { status: 403 },
        );
      }
      return NextResponse.rewrite(
        new URL("/platform/login", request.url),
        { status: 403 },
      );
    }
  }

  if (!session) {
    if (isApiRoute(path)) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);

  const activeTenantId = session?.user?.activeTenantId;
  if (activeTenantId) {
    requestHeaders.set("x-tenant-id", activeTenantId);
  }

  const traceId = crypto.randomUUID();
  requestHeaders.set("x-trace-id", traceId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-trace-id", traceId);

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
