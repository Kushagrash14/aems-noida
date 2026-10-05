import { NextRequest, NextResponse } from 'next/server';
import { getPlants, createPlant } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized: active login session required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('locationId');
  let plants = await getPlants();

  if (locationId) {
    plants = plants.filter((p) => p.location_id === locationId);
  }

  // Non-IT Admins are strictly scoped to their assigned plant(s)
  const currentUser = validation.user;
  if (currentUser.role !== 'it_admin') {
    if (currentUser.plant_id) {
      plants = plants.filter((p) => p.id === currentUser.plant_id);
    } else if (validation.scope?.plant_ids && validation.scope.plant_ids.length > 0) {
      plants = plants.filter((p) => validation.scope!.plant_ids!.includes(p.id));
    } else if (currentUser.location_id) {
      plants = plants.filter((p) => p.location_id === currentUser.location_id);
    }
  }

  return NextResponse.json({ plants });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only IT Admin can create plants
  if (validation.user.role !== 'it_admin') {
    return NextResponse.json({ error: 'Access Denied: Only IT Administrators can create plants' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { location_id, name, code } = body;

    if (!location_id) {
      return NextResponse.json({ error: 'Location selection is required' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Plant name is required' }, { status: 400 });
    }

    const plantCode = (code || `PLANT-${name.slice(0, 3)}`).toUpperCase().trim();
    const plant = await createPlant({
      location_id,
      name: name.trim(),
      code: plantCode,
    });

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'PLANT_CREATED',
      target_table: 'plants',
      record_id: plant.id,
      changes: { location_id, name: plant.name, code: plant.code },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, plant });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create plant';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
