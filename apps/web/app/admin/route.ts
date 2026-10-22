import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001';
  try {
    return NextResponse.redirect(new URL(adminUrl, request.url));
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }
}
