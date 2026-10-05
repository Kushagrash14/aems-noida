import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit';
import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaigns,
  sanitizeInput,
  updateCampaign,
  type SmartMailStatus,
} from '@/lib/smartMail';

async function requireItAdmin(req: NextRequest) {
  const validation = await validateSessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!validation.valid || !validation.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (validation.user.role !== 'it_admin') {
    return { error: NextResponse.json({ error: 'Only IT Admin can manage Smart Mail' }, { status: 403 }) };
  }
  return { user: validation.user };
}

export async function GET(req: NextRequest) {
  const auth = await requireItAdmin(req);
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ campaigns: await listCampaigns() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load mails' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireItAdmin(req);
  if (auth.error) return auth.error;
  try {
    const input = sanitizeInput(await req.json());
    if (!input.subject || !input.body_html) {
      return NextResponse.json({ error: 'Subject and mail content are required' }, { status: 400 });
    }
    const campaign = await createCampaign(input, auth.user.id);
    await logAuditEvent({
      event_category: 'data_change',
      user_id: auth.user.id,
      user_role: auth.user.role,
      action: 'SMART_MAIL_CREATED',
      target_table: 'smart_mail_campaigns',
      record_id: campaign.id,
      changes: { title: input.title, subject: input.subject },
    });
    return NextResponse.json({ campaign });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to save mail' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireItAdmin(req);
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const existing = id ? await getCampaign(id) : null;
    if (!existing) return NextResponse.json({ error: 'Mail not found' }, { status: 404 });

    const input = sanitizeInput({ ...existing, ...body });
    const status = body.status as SmartMailStatus | undefined;

    if (status === 'scheduled') {
      if (!input.schedule_at || isNaN(new Date(input.schedule_at).getTime())) {
        return NextResponse.json({ error: 'Select a date & time before enabling Automail' }, { status: 400 });
      }
      if (new Date(input.schedule_at).getTime() < Date.now() - 60_000 && input.repeat_mode === 'once') {
        return NextResponse.json({ error: 'Scheduled time is in the past' }, { status: 400 });
      }
    }

    const campaign = await updateCampaign(id, {
      ...input,
      ...(status === 'scheduled' || status === 'draft' ? { status } : {}),
    });

    if (status === 'scheduled') {
      await logAuditEvent({
        event_category: 'data_change',
        user_id: auth.user.id,
        user_role: auth.user.role,
        action: 'SMART_MAIL_SCHEDULED',
        target_table: 'smart_mail_campaigns',
        record_id: id,
        changes: { title: input.title, schedule_at: input.schedule_at, repeat_mode: input.repeat_mode },
      });
    } else {
      await logAuditEvent({
        event_category: 'data_change',
        user_id: auth.user.id,
        user_role: auth.user.role,
        action: status === 'draft' ? 'SMART_MAIL_STOPPED' : 'SMART_MAIL_UPDATED',
        target_table: 'smart_mail_campaigns',
        record_id: id,
        changes: { title: input.title, subject: input.subject },
      });
    }
    return NextResponse.json({ campaign });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update mail' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireItAdmin(req);
  if (auth.error) return auth.error;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    const existing = await getCampaign(id);
    await deleteCampaign(id);
    await logAuditEvent({
      event_category: 'data_change',
      user_id: auth.user.id,
      user_role: auth.user.role,
      action: 'SMART_MAIL_DELETED',
      target_table: 'smart_mail_campaigns',
      record_id: id,
      changes: existing ? { title: existing.title, subject: existing.subject } : null,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete mail' }, { status: 500 });
  }
}
