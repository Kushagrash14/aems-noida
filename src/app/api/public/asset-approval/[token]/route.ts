import { NextRequest, NextResponse } from 'next/server';
import { decideApprovalRequest, getApprovalRequestByToken, type AssetApprovalRequest } from '@/lib/assetApprovals';
import { sendApprovalDecisionEmail } from '@/lib/mailer';
import { logAuditEvent } from '@/lib/audit';

function publicView(r: AssetApprovalRequest) {
  return {
    status: r.status,
    employee_label: r.employee_label,
    category_name: r.category_name,
    existing_assets: (r.existing_assets || '').split('\n').filter(Boolean),
    asset_label: r.asset_label,
    request_remarks: r.request_remarks,
    requested_by_label: r.requested_by_label,
    to_emails: r.to_emails,
    created_at: r.created_at,
    decided_by_name: r.decided_by_name,
    decision_remarks: r.decision_remarks,
    decided_at: r.decided_at,
  };
}

/** Public (token-protected) details for the Plant Head review page. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await getApprovalRequestByToken(token);
  if (!request) return NextResponse.json({ error: 'This approval link is invalid or has expired.' }, { status: 404 });
  return NextResponse.json({ request: publicView(request) });
}

/** Records the Plant Head's approve / reject decision. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const body = await req.json();
    const decision = body.decision === 'approved' || body.decision === 'rejected' ? body.decision : null;
    const deciderName = typeof body.approverName === 'string' ? body.approverName.trim().slice(0, 200) : '';
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim().slice(0, 1000) : '';

    if (!decision) return NextResponse.json({ error: 'Choose Approve or Reject.' }, { status: 400 });
    if (!deciderName) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
    if (decision === 'rejected' && !remarks) {
      return NextResponse.json({ error: 'Please enter a reason for rejection.' }, { status: 400 });
    }

    const existing = await getApprovalRequestByToken(token);
    if (!existing) return NextResponse.json({ error: 'This approval link is invalid or has expired.' }, { status: 404 });
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'A decision has already been recorded for this request.', request: publicView(existing) }, { status: 409 });
    }

    const updated = await decideApprovalRequest(token, decision, deciderName, remarks || null);
    if (!updated) {
      const latest = await getApprovalRequestByToken(token);
      return NextResponse.json(
        { error: 'A decision has already been recorded for this request.', request: latest ? publicView(latest) : null },
        { status: 409 }
      );
    }

    await logAuditEvent({
      event_category: 'data_change',
      user_role: 'plant_head',
      action: decision === 'approved' ? 'ASSET_APPROVAL_GRANTED' : 'ASSET_APPROVAL_REJECTED',
      target_table: 'asset_approval_requests',
      record_id: updated.id,
      changes: {
        decided_by: deciderName,
        remarks: remarks || null,
        employee: updated.employee_label,
        asset_type: updated.category_name,
      },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    if (updated.requested_by_email) {
      const cc = [updated.to_emails, updated.cc_emails || '']
        .join(',')
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e && e !== updated.requested_by_email);
      await sendApprovalDecisionEmail({
        to: updated.requested_by_email,
        cc,
        decision,
        decidedBy: deciderName,
        decisionRemarks: remarks || null,
        employeeLabel: updated.employee_label || 'Employee',
        categoryName: updated.category_name,
        decidedAt: updated.decided_at || new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, request: publicView(updated) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record decision';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
