import { NextResponse, type NextRequest } from 'next/server';

const PRIMARY_HOST = 'gyopo.kr';
const LEGACY_HOSTS = new Set(['gyopo.pages.dev', 'www.gyopo.kr']);

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();
  if (!host || !LEGACY_HOSTS.has(host)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.protocol = 'https:';
  url.host = PRIMARY_HOST;
  url.port = '';
  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
