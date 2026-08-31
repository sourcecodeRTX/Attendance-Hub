import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const AUTH_ROUTES = new Set(['/login', '/register', '/forgot-password']);
const ALWAYS_PUBLIC = new Set(['/']);

export const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-[a-z0-9_-]+-auth-token(\.\d+)?$/i;

export function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => SUPABASE_AUTH_COOKIE_PATTERN.test(cookie.name) && cookie.value.trim().length > 0);
}

export function isProtectedPath(pathname: string): boolean {
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/.well-known')
  ) {
    return false;
  }

  if (pathname === '/favicon.ico' || pathname === '/manifest.json') {
    return false;
  }

  if (ALWAYS_PUBLIC.has(pathname) || AUTH_ROUTES.has(pathname)) {
    return false;
  }

  return true;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const onAuthRoute = AUTH_ROUTES.has(pathname);
  const protectedPath = isProtectedPath(pathname);
  const hasAuthCookie = hasSupabaseAuthCookie(request);

  // Fast path: skip Supabase session resolution for clearly public, unsigned requests.
  if (!protectedPath && !onAuthRoute && !hasAuthCookie) {
    const publicResponse = NextResponse.next({ request });
    publicResponse.headers.set('X-Content-Type-Options', 'nosniff');
    publicResponse.headers.set('X-Frame-Options', 'DENY');
    publicResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    publicResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return publicResponse;
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthenticated = !!session?.user;

  if (!isAuthenticated && protectedPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.search = '';
    redirectUrl.searchParams.set('next', pathname);
    response = NextResponse.redirect(redirectUrl);
  }

  if (isAuthenticated && onAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    redirectUrl.search = '';
    response = NextResponse.redirect(redirectUrl);
  }

  // Baseline hardening headers for all app responses.
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)'],
};
