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
  const mac = searchParams.get('mac')?.trim().toUpperCase();
  const excludeId = searchParams.get('excludeId')?.trim() || searchParams.get('assetId')?.trim();

  if (!mac || mac.length < 5) {
    return NextResponse.json({ exists: false });
  }

  // Check matching assets across system (excluding current asset if in edit mode)
  const allAssets = await getAssets({ includeDeleted: false });

  const found = allAssets.find((a) => {
    if (excludeId && a.id === excludeId) return false;
    // Check direct mac_address or custom_values
    if (a.custom_values) {
      if (Array.isArray(a.custom_values)) {
        return a.custom_values.some(
          (cv) => cv.field_value && cv.field_value.trim().toUpperCase() === mac
        );
      } else if (typeof a.custom_values === 'object') {
        return Object.values(a.custom_values).some(
          (val) => typeof val === 'string' && val.trim().toUpperCase() === mac
        );
      }
    }
    return false;
  });

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
