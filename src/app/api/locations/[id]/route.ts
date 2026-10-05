import { NextRequest, NextResponse } from 'next/server';
import { updateLocation, deleteLocation } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // IT Admin or Admin
  if (validation.user.role !== 'it_admin' && validation.user.role !== 'admin') {
    return NextResponse.json({ error: 'Access Denied: Only Administrators can modify locations' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const updated = await updateLocation(id, body);

    if (!updated) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'LOCATION_UPDATED',
      target_table: 'locations',
      record_id: id,
      changes: body,
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, location: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update location';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // IT Admin or Admin
  if (validation.user.role !== 'it_admin' && validation.user.role !== 'admin') {
    return NextResponse.json({ error: 'Access Denied: Only IT Administrators can delete locations' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const success = await deleteLocation(id);
    if (!success) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'LOCATION_DELETED',
      target_table: 'locations',
      record_id: id,
      changes: { deleted_id: id },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, message: 'Location deleted successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete location';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
