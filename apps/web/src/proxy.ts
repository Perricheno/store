import { NextRequest, NextResponse } from 'next/server';
import { indexingEnabled, isLocalHost, shopOrigin, staffOrigin } from './lib/config';

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const shop = new URL(shopOrigin()).host;
  const staff = new URL(staffOrigin()).host;
  const local = process.env.APP_ENV !== 'production' && isLocalHost(host);
  const staffHost = host === staff && staff !== shop;
  const pathname = request.nextUrl.pathname;
  if (!local && host !== shop && !staffHost) return new NextResponse('Unknown host', { status: 421 });
  const staffPath = pathname.startsWith('/staff') || pathname.startsWith('/api/staff');
  if (!local && !staffHost && staffPath) return new NextResponse('Not found', { status: 404 });
  if (staffHost && pathname === '/') return NextResponse.redirect(new URL('/staff', request.url));
  if (staffHost && !staffPath && !pathname.startsWith('/api/') && !pathname.startsWith('/_next/') && pathname !== '/favicon.ico') return new NextResponse('Not found', { status: 404 });
  const headers = new Headers(request.headers);
  headers.set('x-urbanmag-zone', staffHost || (local && staffPath) ? 'staff' : 'shop');
  headers.set('x-urbanmag-locale', pathname.match(/^\/(ru|kk|en)(?:\/|$)/)?.[1] || 'ru');
  const response = NextResponse.next({ request: { headers } });
  const privatePage = staffHost || staffPath || /\/(cart|checkout|account|favorites|reset)(?:\/|$)/.test(pathname) || request.nextUrl.searchParams.size > 0;
  if (!indexingEnabled() || privatePage) response.headers.set('X-Robots-Tag', 'noindex, follow');
  if (pathname.startsWith('/api/') || privatePage) response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
