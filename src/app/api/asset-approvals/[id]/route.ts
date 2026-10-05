import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { getApprovalRequestById } from '@/lib/assetApprovals';

/** Status of an approval request, polled by the assignment popup. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const validation = await validateSessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const request = await getApprovalRequestById(id);
  if (!request) return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });

  return NextResponse.json({
    request: {
      id: request.id,
      status: request.status,
      employee_id: request.employee_id,
      category_id: request.category_id,
      asset_id: request.asset_id,
      to_emails: request.to_emails,
      cc_emails: request.cc_emails,
      decided_by_name: request.decided_by_name,
      decision_remarks: request.decision_remarks,
      decided_at: request.decided_at,
      created_at: request.created_at,
    },
  });
}
