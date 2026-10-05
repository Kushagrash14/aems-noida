import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const serial = searchParams.get('serial')?.trim();
  const excludeId = searchParams.get('excludeId')?.trim() || searchParams.get('assetId')?.trim();

  if (!serial) {
    return NextResponse.json({ exists: false });
  }

  // Check matching assets across system (excluding the current asset if in edit mode)
  const allAssets = await getAssets({ includeDeleted: false });
  const found = allAssets.find(
    (a) =>
      a.serial_number &&
      a.serial_number.trim().toLowerCase() === serial.toLowerCase() &&
      (!excludeId || a.id !== excludeId)
  );

  if (found) {
    return NextResponse.json({
      exists: true,
      asset: {
        id: found.id,
        asset_tag: found.asset_tag,
        name: found.name,
        model: found.model,
        serial_number: found.serial_number,
      },
    });
  }

  return NextResponse.json({ exists: false });
}
