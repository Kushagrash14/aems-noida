import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canUserEdit } from '@/lib/permissions';
import { getAssetById, getEmployees } from '@/lib/store';
import { findSameTypeConflict } from '@/lib/assetRules';
import { createApprovalRequest, MAX_APPROVAL_RECIPIENTS, parseEmailList } from '@/lib/assetApprovals';
import { sendDuplicateApprovalRequestEmail } from '@/lib/mailer';
import { logAuditEvent } from '@/lib/audit';
import { getPublicBaseUrl } from '@/lib/publicUrl';
import { env } from '@/lib/env';

/** Raises a Plant Head approval request for issuing a second asset of the same type. */
export async function POST(req: NextRequest) {
  const validation = await validateSessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access: approval requests are not allowed' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : '';
    const assetId = typeof body.assetId === 'string' && body.assetId ? body.assetId : null;
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim().slice(0, 1000) : '';

    if (!employeeId || !categoryId) {
      return NextResponse.json({ error: 'employeeId and categoryId are required' }, { status: 400 });
    }

    const to = parseEmailList(body.toEmails);
    const cc = parseEmailList(body.ccEmails);
    if (to.invalid.length || cc.invalid.length) {
      return NextResponse.json({ error: `Invalid email address: ${[...to.invalid, ...cc.invalid].join(', ')}` }, { status: 400 });
    }
    if (to.valid.length === 0) {
      return NextResponse.json({ error: 'Enter at least one Plant Head email address' }, { status: 400 });
    }
    if (to.valid.length + cc.valid.length > MAX_APPROVAL_RECIPIENTS) {
      return NextResponse.json({ error: `A maximum of ${MAX_APPROVAL_RECIPIENTS} recipients is allowed` }, { status: 400 });
    }
    const ccList = cc.valid.filter((e) => !to.valid.includes(e));

    const employee = (await getEmployees()).find((e) => e.id === employeeId);
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const conflict = await findSameTypeConflict({ employeeId, categoryId, excludeAssetId: assetId || undefined });
    if (!conflict) {
      return NextResponse.json({ error: 'This employee does not hold an asset of this type; no approval is needed' }, { status: 400 });
    }

    let assetLabel: string | null = null;
    if (assetId) {
      const asset = await getAssetById(assetId);
      if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      assetLabel = [asset.asset_tag, asset.name, asset.serial_number ? `S/N ${asset.serial_number}` : null].filter(Boolean).join(' • ');
    } else if (body.assetSummary && typeof body.assetSummary === 'string') {
      assetLabel = body.assetSummary.trim().slice(0, 400) || null;
    }

    const employeeLabel = `${employee.full_name}${employee.emp_code ? ` (${employee.emp_code})` : ''}`;
    const existingAssets = conflict.existing.map((a) =>
      [a.asset_tag, a.name, a.serial_number ? `S/N ${a.serial_number}` : null].filter(Boolean).join(' • ')
    );
    const requestedByLabel = validation.user.full_name && validation.user.email
      ? `${validation.user.full_name} (${validation.user.email})`
      : validation.user.full_name || validation.user.email;

    const request = await createApprovalRequest({
      asset_id: assetId,
      asset_label: assetLabel,
      employee_id: employeeId,
      employee_label: employeeLabel,
      category_id: categoryId,
      category_name: conflict.categoryName,
      existing_assets: existingAssets.join('\n'),
      to_emails: to.valid.join(', '),
      cc_emails: ccList.join(', ') || null,
      request_remarks: remarks || null,
      requested_by: validation.user.id,
      requested_by_label: requestedByLabel,
      requested_by_email: validation.user.email || null,
    });

    const reviewUrl = `${getPublicBaseUrl(req)}/approval/${request.token}`;
    if (env.isMockMode) {
      console.log(`\x1b[33m[AEMS APPROVAL LINK]\x1b[0m ${reviewUrl}`);
    }

    const mail = await sendDuplicateApprovalRequestEmail({
      to: to.valid,
      cc: ccList,
      employeeLabel,
      employeeDepartment: employee.department?.name || null,
      categoryName: conflict.categoryName,
      existingAssets,
      requestedAsset: assetLabel,
      requestedBy: requestedByLabel,
      requestRemarks: remarks || null,
      requestedAt: request.created_at,
      approveUrl: `${reviewUrl}?action=approve`,
      rejectUrl: `${reviewUrl}?action=reject`,
    });

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'ASSET_APPROVAL_REQUESTED',
      target_table: 'asset_approval_requests',
      record_id: request.id,
      changes: {
        employee: employeeLabel,
        asset_type: conflict.categoryName,
        asset: assetLabel,
        to: request.to_emails,
        cc: request.cc_emails,
        mail_sent: mail.success,
      },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({
      success: true,
      request: { id: request.id, status: request.status, to_emails: request.to_emails, cc_emails: request.cc_emails },
      mail: { sent: mail.success, error: mail.error },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create approval request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
