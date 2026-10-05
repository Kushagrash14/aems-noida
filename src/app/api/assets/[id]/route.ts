import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, getAssetHistory, softDeleteAsset, updateAsset, resolveCategoryIdByName } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canDeleteAsset, canUserEdit, isEntityInUserScope } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized: active login session required' }, { status: 401 });
  }

  const asset = await getAssetById(id);
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // Enforce administrative scope visibility
  if (!isEntityInUserScope(validation.user, validation.scope, {
    category_id: asset.category_id,
    location_id: asset.current_location_id,
    plant_id: asset.current_plant_id,
    department_id: asset.current_department_id,
  })) {
    return NextResponse.json({ error: 'Access Denied: asset is outside your assigned administrative scope' }, { status: 403 });
  }

  const history = await getAssetHistory(id);
  return NextResponse.json({ asset, history });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access: modifications not permitted' }, { status: 403 });
  }

  const asset = await getAssetById(id);
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  if (!isEntityInUserScope(validation.user, validation.scope, {
    category_id: asset.category_id,
    location_id: asset.current_location_id,
    plant_id: asset.current_plant_id,
    department_id: asset.current_department_id,
  })) {
    return NextResponse.json({ error: 'Permission denied: asset is outside your assigned scope' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { asset: assetUpdates, peripherals, customValues, categoryName } = body;

    if (categoryName && assetUpdates) {
      const resolvedCatId = await resolveCategoryIdByName(categoryName);
      if (resolvedCatId) assetUpdates.category_id = resolvedCatId;
    }

    // Validate scope for updated location/plant/dept/category if changing
    const nextCat = assetUpdates?.category_id || asset.category_id;
    const nextLoc = assetUpdates?.current_location_id || asset.current_location_id;
    const nextPlt = assetUpdates?.current_plant_id || asset.current_plant_id;
    const nextDept = assetUpdates?.current_department_id || asset.current_department_id;

    if (!isEntityInUserScope(validation.user, validation.scope, {
      category_id: nextCat,
      location_id: nextLoc,
      plant_id: nextPlt,
      department_id: nextDept,
    })) {
      return NextResponse.json({ error: 'Target placement is outside your assigned administrative scope' }, { status: 403 });
    }

    const updated = await updateAsset(id, assetUpdates || {}, peripherals, customValues, validation.user.id);

    // Sanitize updates for audit log to prevent multi-megabyte payloads from freezing the DB
    const sanitizedAuditUpdates = { ...(assetUpdates || {}) };
    if (sanitizedAuditUpdates.invoice_document_path) {
      try {
        const parsed = JSON.parse(sanitizedAuditUpdates.invoice_document_path);
        sanitizedAuditUpdates.invoice_document_path = `[Metadata: photos=${parsed.photos?.length || 0}, docs=${parsed.documents?.length || 0}, condition=${parsed.condition || 'N/A'}]`;
      } catch {
        sanitizedAuditUpdates.invoice_document_path = '[Document metadata updated]';
      }
    }

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'ASSET_UPDATE',
      target_table: 'assets',
      record_id: id,
      changes: { updates: sanitizedAuditUpdates },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, asset: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update asset';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canDeleteAsset(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'Permission denied: only Admin and IT Admin can delete assets' }, { status: 403 });
  }

  const asset = await getAssetById(id);
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  if (!isEntityInUserScope(validation.user, validation.scope, {
    category_id: asset.category_id,
    location_id: asset.current_location_id,
    plant_id: asset.current_plant_id,
    department_id: asset.current_department_id,
  })) {
    return NextResponse.json({ error: 'Permission denied: asset is outside your assigned administrative scope' }, { status: 403 });
  }

  try {
    await softDeleteAsset(id, validation.user.id);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to delete asset';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }

  await logAuditEvent({
    event_category: 'data_change',
    user_id: validation.user.id,
    user_role: validation.user.role,
    action: 'ASSET_SOFT_DELETE',
    target_table: 'assets',
    record_id: id,
    changes: { asset_tag: asset.asset_tag, name: asset.name },
    ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
    user_agent: req.headers.get('user-agent') || 'Unknown',
  });

  return NextResponse.json({ success: true, message: 'Asset soft-deleted successfully' });
}
