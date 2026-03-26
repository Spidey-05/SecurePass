import { NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/vault',
  '/tools',
  '/history',
  '/settings',
];

// Routes only for unauthenticated users (redirect to dashboard if already logged in)
const AUTH_ONLY_ROUTES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route
  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  const isAuthOnly = AUTH_ONLY_ROUTES.some(route => pathname.startsWith(route));

  // We check for the refresh token cookie — if it exists, user is likely authenticated
  // The actual JWT verification happens in the backend
  // We use refreshToken because accessToken is short-lived (15min)
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const isLoggedIn = Boolean(refreshToken);

  // Unauthenticated user trying to access protected page
  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    // Save the intended destination so we can redirect after login
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in user trying to access login/register
  if (isAuthOnly && isLoggedIn) {
    // If the frontend specifically flagged the session as expired/invalid,
    // intercept the request, delete the ghost cookie, and let them login.
    if (request.nextUrl.searchParams.has('expired')) {
      const response = NextResponse.next();
      response.cookies.delete('refreshToken');
      return response;
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on these paths only — exclude static files, API routes, etc.
  matcher: [
    '/dashboard/:path*',
    '/vault/:path*',
    '/tools/:path*',
    '/history/:path*',
    '/settings/:path*',
    '/login',
    '/register',
  ],
};
