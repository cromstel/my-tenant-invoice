import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/better-auth";

const PUBLIC_ROUTES: readonly string[] = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/error",
  "/auth/admin/login",
  "/api/auth/",
  "/_next/",
  "/favicon.ico",
  "/pay/",
] as const;

const PLATFORM_ADMIN_ROUTES: readonly string[] = ["/admin", "/api/platform"] as const;

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
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isApiPlatformRoute(pathname: string): boolean {
  return pathname.startsWith("/api/platform");
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  if (isPublicRoute(path)) {
    const response = NextResponse.next();
    if (process.env.NODE_ENV !== "test") {
      response.headers.set("x-trace-id", crypto.randomUUID());
    }
    return response;
  }

  let authenticated = false;
  let activeTenantId: string | null = null;
  let isPlatformAdminUser = false;

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user) {
      authenticated = true;
      const u = session.user as { activeTenantId?: string; roles?: Record<string, string[]> };
      activeTenantId = u.activeTenantId ?? null;
      // Check platform admin
      if (u.roles) {
        for (const orgId of Object.keys(u.roles)) {
          if (u.roles[orgId]?.includes("PLATFORM_ADMIN")) {
            isPlatformAdminUser = true;
            break;
          }
        }
      }
    }
  } catch {
    authenticated = false;
  }

  if (isPlatformAdminRoute(path)) {
    if (!authenticated) {
      if (isApiPlatformRoute(path)) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      const platformLoginUrl = new URL("/auth/admin/login", request.url);
      platformLoginUrl.searchParams.set("callbackUrl", request.url);
      return NextResponse.redirect(platformLoginUrl);
    }

    if (!isPlatformAdminUser) {
      if (isApiPlatformRoute(path)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (!authenticated) {
    if (isApiRoute(path)) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  const traceId = crypto.randomUUID();
  requestHeaders.set("x-trace-id", traceId);

  if (activeTenantId) {
    requestHeaders.set("x-tenant-id", activeTenantId);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-trace-id", traceId);

  return response;
}
