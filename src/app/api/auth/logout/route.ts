import { NextRequest, NextResponse } from 'next/server';
import { terminateSession, validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      const validation = await validateSessionToken(token);
      if (validation.valid && validation.user) {
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const userAgent = req.headers.get('user-agent') || 'Unknown';
        await logAuditEvent({
          event_category: 'session',
          user_id: validation.user.id,
          user_role: validation.user.role,
          action: 'LOGOUT',
          ip_address: ip,
          user_agent: userAgent,
          changes: { email: validation.user.email, name: validation.user.full_name },
        });
      }
    } catch (e) {
      console.error('Logout audit error:', e);
    }
    await terminateSession(token);
  }

  const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    expires: new Date(0),
  });

  return res;
}
