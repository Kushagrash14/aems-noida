import { NextRequest, NextResponse } from 'next/server';
import { getAssets, getAssetById, createAsset, resolveCategoryIdByName, inferItCategoryName } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canUserEdit, isEntityInUserScope } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';
import { approvalForAudit, findSameTypeConflict, parseDuplicateApproval, parseHod, type DuplicateApproval } from '@/lib/assetRules';
import { sendInHouseHodEmail } from '@/lib/mailer';
import { consumeDuplicateApproval, notifyEmployeeOfAssignment, releaseDuplicateApproval } from '@/lib/approvalAssignment';
import { linkApprovalToAsset } from '@/lib/assetApprovals';

function readDocMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function mergeDocMeta(raw: unknown, extra: Record<string, unknown>): string {
  return JSON.stringify({ ...readDocMeta(raw), ...extra });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized: active login session required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('categoryId') || undefined;
  const locationId = searchParams.get('locationId') || undefined;
  const plantId = searchParams.get('plantId') || undefined;
  const departmentId = searchParams.get('departmentId') || undefined;
  const search = searchParams.get('search') || undefined;
  const includeDeleted = searchParams.get('includeDeleted') === 'true';

  let assets = await getAssets({
    categoryId,
    locationId,
    plantId,
    departmentId,
    search,
    includeDeleted,
  });

  // Apply user scoping if authenticated as non-IT admin
  if (validation.valid && validation.user && validation.user.role !== 'it_admin') {
    assets = assets.filter((a) =>
      isEntityInUserScope(validation.user!, validation.scope || null, {
        category_id: a.category_id,
        location_id: a.current_location_id,
        plant_id: a.current_plant_id,
        department_id: a.current_department_id,
      })
    );
  }

  return NextResponse.json({ assets });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access: modifications are not permitted for this account' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { asset, peripherals, customValues, itAssetType, categoryName } = body;

    const effectiveCategoryName =
      categoryName || inferItCategoryName(itAssetType, asset?.name, asset?.model);
    if (effectiveCategoryName) {
      const resolvedCatId = await resolveCategoryIdByName(effectiveCategoryName);
      if (resolvedCatId) asset.category_id = resolvedCatId;
    }

    // For Facility Admin or User, enforce their assigned location, plant, and department
    if (validation.user.role !== 'it_admin') {
      if (validation.user.location_id) asset.current_location_id = validation.user.location_id;
      if (validation.scope?.plant_ids && validation.scope.plant_ids.length > 0) {
        if (!asset.current_plant_id || !validation.scope.plant_ids.includes(asset.current_plant_id)) {
          asset.current_plant_id = validation.scope.plant_ids[0];
        }
      } else if (validation.user.plant_id) {
        asset.current_plant_id = validation.user.plant_id;
      }
      if (validation.user.department_id) asset.current_department_id = validation.user.department_id;
    }

    if (!asset.name || !asset.category_id || !asset.current_location_id || !asset.current_plant_id || !asset.current_department_id) {
      return NextResponse.json({ error: 'Missing required asset fields (name, category/department, location, plant)' }, { status: 400 });
    }

    // Check scope containment
    if (!isEntityInUserScope(validation.user, validation.scope, {
      category_id: asset.category_id,
      location_id: asset.current_location_id,
      plant_id: asset.current_plant_id,
      department_id: asset.current_department_id,
    })) {
      return NextResponse.json({ error: 'Asset placement is outside your assigned administrative scope' }, { status: 403 });
    }

    let approval: DuplicateApproval | null = null;
    if (asset.assigned_employee_id) {
      const conflict = await findSameTypeConflict({
        employeeId: asset.assigned_employee_id,
        categoryId: asset.category_id,
      });
      if (conflict) {
        approval = parseDuplicateApproval(body.duplicateApproval);
        if (!approval) {
          return NextResponse.json(
            { error: `Employee already holds a ${conflict.categoryName} asset`, conflict },
            { status: 409 }
          );
        }
        const approvalError = await consumeDuplicateApproval(approval, {
          employeeId: asset.assigned_employee_id,
          categoryId: asset.category_id,
        });
        if (approvalError) {
          return NextResponse.json({ error: approvalError }, { status: 403 });
        }
        asset.invoice_document_path = mergeDocMeta(asset.invoice_document_path, { duplicate_approval: approval });
      }
    }

    const hod = parseHod(body.hodNotification);
    if (hod) {
      asset.invoice_document_path = mergeDocMeta(asset.invoice_document_path, {
        hod_name: hod.name || null,
        hod_emp_code: hod.empCode || null,
        hod_email: hod.email,
        inhouse_department_name: hod.departmentName || null,
      });
    }

    let created;
    try {
      created = await createAsset(
        {
          ...asset,
          created_by: validation.user.id,
        },
        peripherals,
        customValues,
        validation.user.id,
        itAssetType
      );
    } catch (createErr) {
      await releaseDuplicateApproval(approval);
      throw createErr;
    }
    if (approval) await linkApprovalToAsset(approval.approvalRequestId, created.id).catch(() => undefined);

    const employeeMail = created.assigned_employee_id
      ? await notifyEmployeeOfAssignment({
          assetId: created.id,
          employeeId: created.assigned_employee_id,
          assignedBy: validation.user,
          approval,
          fallbackAsset: created,
        }).catch(() => undefined)
      : undefined;

    // Audit log
    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'ASSET_CREATE',
      target_table: 'assets',
      record_id: created.id,
      changes: { asset_tag: created.asset_tag, name: created.name, category_id: created.category_id },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    if (approval) {
      await logAuditEvent({
        event_category: 'data_change',
        user_id: validation.user.id,
        user_role: validation.user.role,
        action: 'ASSET_DUPLICATE_TYPE_APPROVED',
        target_table: 'assets',
        record_id: created.id,
        changes: { asset_tag: created.asset_tag, employee_id: asset.assigned_employee_id, ...approvalForAudit(approval) },
        ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
        user_agent: req.headers.get('user-agent') || 'Unknown',
      });
    }

    let hodMail: { sent: boolean; error?: string } | undefined;
    if (hod) {
      const full = (await getAssetById(created.id)) || created;
      const docMeta = readDocMeta(full.invoice_document_path);
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
        exactLocation: typeof docMeta.exact_location === 'string' ? docMeta.exact_location : null,
        registeredBy: validation.user.full_name && validation.user.email
          ? `${validation.user.full_name} (${validation.user.email})`
          : validation.user.full_name || validation.user.email,
        registeredAt: full.created_at || new Date().toISOString(),
      });
      hodMail = { sent: result.success, error: result.error };
    }

    return NextResponse.json({ success: true, asset: created, hodMail, employeeMail });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Asset creation failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
