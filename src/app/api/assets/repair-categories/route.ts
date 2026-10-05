import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { repairMisfiledItAssets } from '@/lib/store';
import { logAuditEvent } from '@/lib/audit';

async function requireItAdmin(req: NextRequest) {
  const validation = await validateSessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!validation.valid || !validation.user) {
    return { error: NextResponse.json({ error: 'Unauthorized: active login session required' }, { status: 401 }) };
  }
  if (validation.user.role !== 'it_admin') {
    return { error: NextResponse.json({ error: 'Forbidden: IT Admin only' }, { status: 403 }) };
  }
  return { user: validation.user };
}

/** Preview: lists Laptop/Desktop assets stored under a wrong category. */
export async function GET(req: NextRequest) {
  const auth = await requireItAdmin(req);
  if (auth.error) return auth.error;
  const result = await repairMisfiledItAssets(true);
  return NextResponse.json(result);
}

/** Apply: moves those assets into the LAPTOP / DESKTOP asset types. */
export async function POST(req: NextRequest) {
  const auth = await requireItAdmin(req);
  if (auth.error) return auth.error;

  const result = await repairMisfiledItAssets(false);

  if (result.fixed.length > 0) {
    await logAuditEvent({
      event_category: 'data_change',
      user_id: auth.user.id,
      user_role: auth.user.role,
      action: 'ASSET_CATEGORY_REPAIR',
      target_table: 'assets',
      record_id: result.fixed[0].id,
      changes: { count: result.fixed.length, assets: result.fixed.slice(0, 200) },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });
  }

  return NextResponse.json(result);
}
