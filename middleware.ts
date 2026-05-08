import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (/^\/tv\/song\.(webm|mp3)$/.test(pathname)) {
    const referer = request.headers.get("referer") ?? "";
    const host    = request.headers.get("host") ?? "";
    if (!host || !referer.includes(host)) {
      return new NextResponse(null, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/tv/:path*" };
