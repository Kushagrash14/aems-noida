import { NextRequest, NextResponse } from 'next/server';
import { createAndStoreOtp } from '@/lib/auth/otp';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { env } from '@/lib/env';
import { SEED_USERS } from '@/lib/mock-data';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid corporate email address required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Verify that the user exists and is active in the database
    let isRegistered = false;
    let isActive = false;

    const memory = (globalThis as unknown as { __aems_memory?: { users: { email: string; is_active: boolean }[] } }).__aems_memory;
    const memoryUser = memory?.users?.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (env.isMockMode) {
      const mockUser = memoryUser || SEED_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (mockUser) {
        isRegistered = true;
        isActive = Boolean(mockUser.is_active);
      }
    } else {
      const { data: dbUser, error: dbError } = await db
        .from('users')
        .select('id, email, is_active')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (dbError) {
        console.error('[AEMS Auth] User lookup failed:', dbError.message);
        return NextResponse.json({ error: 'Login service is temporarily unavailable.' }, { status: 503 });
      }
      if (dbUser) {
        isRegistered = true;
        isActive = Boolean(dbUser.is_active);
      }
    }

    // Reject unregistered or inactive accounts
    if (!isRegistered || !isActive) {
      await logAuditEvent({
        event_category: 'session',
        user_role: 'anonymous',
        action: 'LOGIN_UNAUTHORIZED_EMAIL',
        ip_address: ip,
        user_agent: userAgent,
        changes: { email: normalizedEmail, isRegistered, isActive },
      });
      return NextResponse.json(
        { error: 'Unauthorized Access. Please contact your IT Admin.' },
        { status: 403 }
      );
    }

    const result = await createAndStoreOtp(normalizedEmail);
    if (!result.success) {
      await logAuditEvent({
        event_category: 'session',
        user_role: 'anonymous',
        action: 'OTP_REQUEST_FAILED',
        ip_address: ip,
        user_agent: userAgent,
        changes: { email: normalizedEmail, error: result.message },
      });
      return NextResponse.json({ error: result.message || 'Failed to dispatch OTP' }, { status: 500 });
    }

    await logAuditEvent({
      event_category: 'session',
      user_role: 'anonymous',
      action: 'OTP_REQUESTED',
      ip_address: ip,
      user_agent: userAgent,
      changes: { email: normalizedEmail },
    });

    return NextResponse.json({
      success: true,
      message: 'OTP dispatched successfully',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
