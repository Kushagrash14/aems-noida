import { NextRequest, NextResponse } from 'next/server';
import { deassignAssetFromEmployee, getAssetById } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canUserEdit, isEntityInUserScope } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access: asset de-assignment denied' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { assetId, returnCondition, remarks } = body;

    if (!assetId) {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    }

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

    const updatedAsset = await deassignAssetFromEmployee({
      assetId,
      deassignedBy: validation.user.id,
      returnCondition,
      remarks,
    });

    return NextResponse.json({
      success: true,
      message: 'Asset successfully returned to Available / Stock pool',
      asset: updatedAsset,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Asset de-assignment failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
