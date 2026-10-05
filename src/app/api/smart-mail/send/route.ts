import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit';
import { getCampaign, recordSendResult, resolveRecipients, sendCampaign } from '@/lib/smartMail';

export async function POST(req: NextRequest) {
  const validation = await validateSessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (validation.user.role !== 'it_admin') {
    return NextResponse.json({ error: 'Only IT Admin can send Smart Mail' }, { status: 403 });
  }

  try {
    const { id, previewOnly } = await req.json();
    const campaign = id ? await getCampaign(String(id)) : null;
    if (!campaign) return NextResponse.json({ error: 'Mail not found' }, { status: 404 });

    if (previewOnly) {
      const recipients = await resolveRecipients(campaign);
      return NextResponse.json({ recipients });
    }

    const result = await sendCampaign(campaign);
    await recordSendResult(campaign, result, false);

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'SMART_MAIL_TEST_SENT',
      target_table: 'smart_mail_campaigns',
      record_id: campaign.id,
      changes: { title: campaign.title, sent: result.sent, total: result.total },
    });

    if (result.total === 0) {
      return NextResponse.json({ error: 'No valid recipients. Add email addresses or enable plant/location employees.' }, { status: 400 });
    }
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 });
  }
}
