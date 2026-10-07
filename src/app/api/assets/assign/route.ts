import { NextRequest, NextResponse } from 'next/server';
import { assignAssetToEmployee, deployAssetInHouse, getAssetById } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canUserEdit, isEntityInUserScope } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';
import { approvalForAudit, describeApproval, findSameTypeConflict, parseDuplicateApproval, parseHod, type DuplicateApproval } from '@/lib/assetRules';
import { sendInHouseHodEmail } from '@/lib/mailer';
import { consumeDuplicateApproval, notifyEmployeeOfAssignment, releaseDuplicateApproval } from '@/lib/approvalAssignment';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access: asset assignment denied' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { mode = 'employee', assetId, employeeId, departmentId, exactLocation, remarks, handoverItems, hostname } = body;

    if (!assetId) {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    }

    // Verify asset exists and check scope
    const asset = await getAssetById(assetId);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (!isEntityInUserScope(validation.user, validation.scope, {
      category_id: asset.category_id,
      location_id: asset.current_location_id,
      plant_id: asset.current_plant_id,
    })) {
      return NextResponse.json({ error: 'Permission denied: asset is outside your assigned scope' }, { status: 403 });
    }

    if (mode === 'in_house') {
      const updatedAsset = await deployAssetInHouse({
        assetId,
        departmentId,
        exactLocation,
        assignedBy: validation.user.id,
        remarks,
        hostname: hostname ? String(hostname).trim().toUpperCase() : undefined,
      });

      let hodMail: { sent: boolean; error?: string } | undefined;
      const hod = parseHod(body.hodNotification);
      if (hod) {
        const full = (await getAssetById(assetId)) || updatedAsset;
        const result = await sendInHouseHodEmail({
          to: hod.email,
          hodName: hod.name,
          hodEmpCode: hod.empCode,
          departmentName: hod.departmentName || full.department?.name || 'Department',
          assetTag: full.asset_tag,
          sapAssetCode: full.sap_asset_code,
          assetName: full.name,
          assetType: full.category?.name,
          serialNumber: full.serial_number,
          model: full.model,
          plantName: full.plant?.name,
          locationName: full.location?.name,
          exactLocation: exactLocation ? String(exactLocation).toUpperCase() : null,
          registeredBy: validation.user.full_name && validation.user.email
          ? `${validation.user.full_name} (${validation.user.email})`
          : validation.user.full_name || validation.user.email,
          registeredAt: new Date().toISOString(),
        });
        hodMail = { sent: result.success, error: result.error };
      }

      return NextResponse.json({
        success: true,
        message: 'Asset deployed for In-House usage successfully',
        asset: updatedAsset,
        hodMail,
      });
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required for employee assignment' }, { status: 400 });
    }

    let approval: DuplicateApproval | null = null;
    const conflict = await findSameTypeConflict({ employeeId, categoryId: asset.category_id, excludeAssetId: assetId });
    if (conflict) {
      approval = parseDuplicateApproval(body.duplicateApproval);
      if (!approval) {
        return NextResponse.json(
          { error: `Employee already holds a ${conflict.categoryName} asset`, conflict },
          { status: 409 }
        );
      }
      const approvalError = await consumeDuplicateApproval(approval, {
        employeeId,
        categoryId: asset.category_id,
        assetId,
      });
      if (approvalError) {
        return NextResponse.json({ error: approvalError }, { status: 403 });
      }
    }

    let updatedAsset;
    try {
      updatedAsset = await assignAssetToEmployee({
        assetId,
        employeeId,
        assignedBy: validation.user.id,
        remarks: approval ? [remarks, describeApproval(approval)].filter(Boolean).join(' • ') : remarks,
        handoverItems,
        hostname: hostname ? String(hostname).trim().toUpperCase() : undefined,
      });
    } catch (assignErr) {
      await releaseDuplicateApproval(approval);
      throw assignErr;
    }

    const employeeMail = await notifyEmployeeOfAssignment({
      assetId,
      employeeId,
      assignedBy: validation.user,
      approval,
      fallbackAsset: updatedAsset,
    }).catch(() => undefined);

    if (approval) {
      await logAuditEvent({
        event_category: 'data_change',
        user_id: validation.user.id,
        user_role: validation.user.role,
        action: 'ASSET_DUPLICATE_TYPE_APPROVED',
        target_table: 'assets',
        record_id: assetId,
        changes: { asset_tag: asset.asset_tag, employee_id: employeeId, ...approvalForAudit(approval) },
        ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
        user_agent: req.headers.get('user-agent') || 'Unknown',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Asset assigned successfully',
      asset: updatedAsset,
      employeeMail,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Asset assignment failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

