import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const validation = await validateSessionToken(token);

    if (!validation.valid) {
      return NextResponse.json(
        {
          valid: false,
          reason: validation.reason,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      lastActivity: validation.session?.last_activity_at,
      expiresAt: validation.session?.expires_at,
    });
  } catch (error) {
    return NextResponse.json(
      { valid: false, reason: 'Session validation error' },
      { status: 401 }
    );
  }
}
