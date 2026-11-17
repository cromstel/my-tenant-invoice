import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/better-auth';
import { ACTIVE_TENANT_COOKIE, loadAuthContext } from '@/server/auth-context';

const PUBLIC_ROUTES: readonly string[] = [
  '/',
  '/features',
  '/services',
  '/pricing',
  '/solutions',
  '/security',
  '/blog',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/error',
  '/auth/admin/login',
  '/api/auth/',
  // No trailing slash, so the bare POST path matches as well as subpaths.
  '/api/contact',
  '/_next/',
  '/favicon.ico',
  '/logo.svg',
  '/apple-touch-icon.png',
  '/illustrations/',
  // Team portraits. No trailing slash, so the bare path matches as well as
  // everything beneath it.
  '/team',
  '/robots.txt',
  '/sitemap.xml',
  '/og.png',
  '/pay/',
] as const;

const PLATFORM_ADMIN_ROUTES: readonly string[] = ['/platform', '/admin', '/api/platform'] as const;

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) =>
    route === '/'
      ? pathname === route
      : pathname === route ||
        pathname.startsWith(route.endsWith('/') ? route : `${route}/`) ||
        (route.startsWith('/api/') && pathname.startsWith(route)),
  );
}

function isPlatformAdminRoute(pathname: string): boolean {
  return PLATFORM_ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isApiPlatformRoute(pathname: string): boolean {
  return pathname.startsWith('/api/platform');
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  if (isPublicRoute(path)) {
    const response = NextResponse.next();
    if (process.env.NODE_ENV !== 'test') {
      response.headers.set('x-trace-id', crypto.randomUUID());
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
      const u = session.user as { id: string; email: string; name?: string | null };
      const context = await loadAuthContext(
        { id: u.id, email: u.email, name: u.name ?? null },
        request.cookies.get(ACTIVE_TENANT_COOKIE)?.value,
      );
      activeTenantId = context.activeTenantId;
      isPlatformAdminUser = context.isPlatformAdmin;
    }
  } catch {
    authenticated = false;
  }

  if (isPlatformAdminRoute(path)) {
    if (!authenticated) {
      if (isApiPlatformRoute(path)) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      const platformLoginUrl = new URL('/auth/admin/login', request.url);
      platformLoginUrl.searchParams.set('callbackUrl', request.url);
      return NextResponse.redirect(platformLoginUrl);
    }

    if (!isPlatformAdminUser) {
      if (isApiPlatformRoute(path)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // `/admin` is the legacy alias for the platform dashboard; no page lives
    // at /admin, so point operators at /platform instead of a 404. A 308
    // keeps the alias permanent and preserves the query string.
    if (path === '/admin') {
      return NextResponse.redirect(new URL(`/platform${request.nextUrl.search}`, request.url), 308);
    }
  }

  if (!authenticated) {
    if (isApiRoute(path)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  const traceId = crypto.randomUUID();
  requestHeaders.set('x-trace-id', traceId);

  if (activeTenantId) {
    requestHeaders.set('x-tenant-id', activeTenantId);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('x-trace-id', traceId);

  return response;
}
