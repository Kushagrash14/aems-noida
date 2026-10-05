import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/auth/otp';
import { createActiveSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit';
import { SEED_USERS } from '@/lib/mock-data';
import { db } from '@/lib/db/client';
import { env } from '@/lib/env';
import { User } from '@/types/database';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP code are required' }, { status: 400 });
    }

    const verification = await verifyOtp(email, otp);
    if (!verification.success) {
      // Log failed attempt (will automatically calculate risk level)
      await logAuditEvent({
        event_category: 'session',
        user_role: 'anonymous',
        action: 'LOGIN_FAILED_ATTEMPT',
        ip_address: ip,
        user_agent: userAgent,
        changes: { email, reason: verification.message },
      });
      return NextResponse.json({ error: verification.message || 'Invalid or expired OTP' }, { status: 401 });
    }

    // Find the user record
    let user: User | null = null;
    const normalizedEmail = email.toLowerCase().trim();

    const memory = (globalThis as unknown as { __aems_memory?: { users: User[] } }).__aems_memory;
    const memoryUser = memory?.users?.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (env.isMockMode) {
      user = memoryUser || SEED_USERS.find((u) => u.email.toLowerCase() === normalizedEmail) || null;
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized Access. Please contact your IT Admin.' }, { status: 403 });
      }
    } else {
      const { data, error } = await db
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (error) {
        console.error('[AEMS Auth] User lookup failed:', error.message);
        return NextResponse.json({ error: 'Login service is temporarily unavailable.' }, { status: 503 });
      }
      if (!data) {
        return NextResponse.json({ error: 'Unauthorized Access. Please contact your IT Admin.' }, { status: 403 });
      }
      user = data as User;
    }

    if (!user.is_active) {
      await logAuditEvent({
        event_category: 'session',
        user_id: user.id,
        user_role: user.role,
        action: 'LOGIN_BLOCKED_INACTIVE_USER',
        ip_address: ip,
        user_agent: userAgent,
      });
      return NextResponse.json({ error: 'Unauthorized Access. Please contact your IT Admin.' }, { status: 403 });
    }

    // Single active session enforcement: Terminates old sessions and issues new token
    const { rawToken, session } = await createActiveSession(user, { ip, userAgent });

    // Log successful login
    await logAuditEvent({
      event_category: 'session',
      user_id: user.id,
      user_role: user.role,
      action: 'LOGIN_SUCCESS',
      ip_address: ip,
      user_agent: userAgent,
      changes: { sessionId: session.id },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });

    // Set session cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: rawToken,
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Login verification failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
