import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route protection at the edge. The API's httpOnly `hj_session` cookie holds
 * only the role and tells us a session exists; the API still enforces every
 * permission. This just keeps people out of screens they cannot use.
 */

const SESSION_COOKIE = 'hj_session';
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];
const OPEN_PAGES = ['/reset-password', '/verify-email', '/accept-invite'];

const ROLE_GATES: { prefix: string; roles: string[] }[] = [
  { prefix: '/employees', roles: ['HR', 'ADMIN'] },
  { prefix: '/admin', roles: ['HR', 'ADMIN'] },
  { prefix: '/audit-logs', roles: ['HR', 'ADMIN'] },
  { prefix: '/approvals', roles: ['MANAGER', 'HR', 'ADMIN'] },
  { prefix: '/team', roles: ['MANAGER', 'HR', 'ADMIN'] },
  { prefix: '/reports', roles: ['MANAGER', 'HR', 'ADMIN'] },
];

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const role = req.cookies.get(SESSION_COOKIE)?.value;

  if (OPEN_PAGES.some((p) => matches(pathname, p))) return NextResponse.next();

  if (AUTH_PAGES.some((p) => matches(pathname, p))) {
    return role ? NextResponse.redirect(new URL('/dashboard', req.url)) : NextResponse.next();
  }

  if (!role) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname === '/') return NextResponse.redirect(new URL('/dashboard', req.url));

  const gate = ROLE_GATES.find((g) => matches(pathname, g.prefix));
  if (gate && !gate.roles.includes(role)) {
    const url = new URL('/dashboard', req.url);
    url.searchParams.set('denied', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except API proxying, uploads, Next internals and static files.
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp|ico)$).*)'],
};
