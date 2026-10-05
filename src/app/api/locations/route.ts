import { NextRequest, NextResponse } from 'next/server';
import { getLocations, createLocation } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized: active login session required' }, { status: 401 });
  }

  let locations = await getLocations();

  const currentUser = validation.user;
  if (currentUser.role !== 'it_admin') {
    if (currentUser.location_id) {
      locations = locations.filter((l) => l.id === currentUser.location_id);
    } else if (validation.scope?.location_ids && validation.scope.location_ids.length > 0) {
      locations = locations.filter((l) => validation.scope!.location_ids!.includes(l.id));
    }
  }

  return NextResponse.json({ locations });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only IT Admin can create locations
  if (validation.user.role !== 'it_admin') {
    return NextResponse.json({ error: 'Access Denied: Only IT Administrators can create locations' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, code, address } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Location name is required' }, { status: 400 });
    }

    const locCode = (code || `LOC-${name.slice(0, 3)}`).toUpperCase().trim();
    const location = await createLocation({
      name: name.trim(),
      code: locCode,
      address: address ? address.trim() : null,
    });

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'LOCATION_CREATED',
      target_table: 'locations',
      record_id: location.id,
      changes: { name: location.name, code: location.code, address: location.address },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, location });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create location';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
