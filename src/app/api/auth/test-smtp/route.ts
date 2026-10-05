import { NextRequest, NextResponse } from 'next/server';
import { verifySmtp, sendEmail } from '@/lib/mailer';
import { env } from '@/lib/env';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

async function requireItAdmin(req: NextRequest): Promise<NextResponse | null> {
  const validation = await validateSessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (validation.user.role !== 'it_admin') {
    return NextResponse.json({ error: 'Only IT Admin can test SMTP settings' }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireItAdmin(req);
  if (denied) return denied;

  try {
    const verification = await verifySmtp();
    if (!verification.connected) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error || 'Failed to connect to SMTP server',
          config: {
            host: env.smtpHost || 'smtp.office365.com',
            port: env.smtpPort || 587,
            user: env.smtpEmail || null,
            from: env.otpFromEmail || null,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Office 365 SMTP connection verified successfully!',
      config: {
        host: env.smtpHost || 'smtp.office365.com',
        port: env.smtpPort || 587,
        user: env.smtpEmail || null,
        from: env.otpFromEmail || null,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error testing SMTP';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireItAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const targetEmail = body.email || env.smtpEmail;
    if (!targetEmail) {
      return NextResponse.json({ success: false, error: 'Target email is required' }, { status: 400 });
    }

    const verification = await verifySmtp();
    if (!verification.connected) {
      return NextResponse.json(
        {
          success: false,
          error: `SMTP Connection check failed: ${verification.error}`,
        },
        { status: 500 }
      );
    }

    const sendResult = await sendEmail({
      to: targetEmail,
      subject: '[AEMS v2] SMTP Authentication Test',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #2563eb;">PG Groups — AEMS v2 SMTP Active</h2>
          <p>Your Office 365 SMTP authentication is working properly.</p>
          <ul>
            <li><strong>Host:</strong> ${env.smtpHost || 'smtp.office365.com'}</li>
            <li><strong>Port:</strong> ${env.smtpPort || 587}</li>
            <li><strong>From:</strong> ${env.otpFromEmail || ''}</li>
            <li><strong>Authenticated Account:</strong> ${env.smtpEmail || ''}</li>
            <li><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
          </ul>
        </div>
      `,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to dispatch email: ${sendResult.error}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email dispatched successfully to ${targetEmail}`,
      messageId: sendResult.messageId,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error during test email';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
