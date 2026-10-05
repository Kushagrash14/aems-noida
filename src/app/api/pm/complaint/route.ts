import { NextRequest, NextResponse } from 'next/server';
import { submitPublicComplaint, getPMComplaints, resolvePMComplaint } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canUserEdit } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const complaints = await getPMComplaints();
  return NextResponse.json({ complaints });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { machineId, reporterName, reporterContact, description, priority } = body;

    if (!machineId || !reporterName || !description) {
      return NextResponse.json({ error: 'Machine ID, reporter name and issue description are required' }, { status: 400 });
    }

    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    const result = await submitPublicComplaint({
      machineId,
      reporterName,
      reporterContact,
      description,
      priority: priority || 'medium',
      clientIp,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 429 });
    }

    await logAuditEvent({
      event_category: 'data_change',
      user_role: 'public_reporter',
      action: 'PM_COMPLAINT_SUBMITTED',
      target_table: 'pm_complaints',
      record_id: result.complaint?.id,
      changes: { machineId, reporterName, reporterContact, priority: priority || 'medium', description },
      ip_address: clientIp,
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, complaint: result.complaint });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to submit complaint';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access' }, { status: 403 });
  }

  try {
    const { complaintId, resolutionNotes, technicianCost, replacementParts } = await req.json();

    if (!complaintId || !resolutionNotes) {
      return NextResponse.json({ error: 'Complaint ID and resolution notes are required' }, { status: 400 });
    }

    await resolvePMComplaint({
      complaintId,
      resolutionNotes,
      technicianCost: technicianCost ? Number(technicianCost) : undefined,
      replacementParts,
      resolvedBy: validation.user.id,
    });

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'PM_COMPLAINT_RESOLVED',
      target_table: 'pm_complaints',
      record_id: complaintId,
      changes: { resolutionNotes, technicianCost, replacementParts },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, message: 'Complaint marked resolved' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Resolution failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
