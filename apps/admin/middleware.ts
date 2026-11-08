import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAuthToken, UserRole } from '@kandy-cabs/shared';

// Public paths that do not require ADMIN authentication (driver routes handle their own driver Bearer authentication)
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/driver', '/api/fleets', '/api/health', '/_next', '/favicon.ico', '/static', '/images'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 0. Handle CORS preflight for all /api routes
  if (pathname.startsWith('/api')) {
    const origin = req.headers.get('origin') || '*';
    if (req.method === 'OPTIONS') {
      const res = new NextResponse(null, { status: 200 });
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version'
      );
      res.headers.set('Access-Control-Allow-Credentials', 'true');
      return res;
    }
  }

  // Allow public static assets, health check, and auth endpoints
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 1. Resolve token from cookie or Authorization header
  let token = req.cookies.get('kandy_session')?.value;
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  const isApiRoute = pathname.startsWith('/api/');

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required for admin access' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Verify token
  const payload = await verifyAuthToken(token);
  if (!payload || !payload.userId) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired session token' },
        { status: 401 }
      );
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Verify ADMIN role
  const isAdmin = payload.roles && payload.roles.includes(UserRole.ADMIN);
  if (!isAdmin) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied: ADMIN role required' },
        { status: 403 }
      );
    }
    // Non-admin trying to access admin panel -> Show 403 / redirect with error
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'unauthorized_role');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
