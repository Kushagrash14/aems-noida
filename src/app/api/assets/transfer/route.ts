import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, transferAsset } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canUserEdit, isEntityInUserScope } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access: transfer denied' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { assetId, toDepartmentId, toLocationId, toPlantId, reason } = body;

    if (!assetId || !toDepartmentId || !toLocationId || !toPlantId) {
      return NextResponse.json({ error: 'Missing required transfer parameters' }, { status: 400 });
    }

    const asset = await getAssetById(assetId);
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Verify source asset is in user scope
    if (!isEntityInUserScope(validation.user, validation.scope, {
      category_id: asset.category_id,
      location_id: asset.current_location_id,
      plant_id: asset.current_plant_id,
    })) {
      return NextResponse.json({ error: 'Permission denied: asset is outside your assigned scope' }, { status: 403 });
    }

    // Verify target destination location and plant are in user scope
    if (!isEntityInUserScope(validation.user, validation.scope, {
      category_id: asset.category_id,
      location_id: toLocationId,
      plant_id: toPlantId,
    })) {
      return NextResponse.json({ error: 'Permission denied: destination is outside your assigned scope' }, { status: 403 });
    }

    await transferAsset({
      assetId,
      toDepartmentId,
      toLocationId,
      toPlantId,
      reason,
      transferredBy: validation.user.id,
    });

    return NextResponse.json({ success: true, message: 'Asset transferred successfully' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Transfer failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
