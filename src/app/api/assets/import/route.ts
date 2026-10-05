import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { batchImportAssets, BatchImportPayload } from '@/lib/store';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized: active login session required' }, { status: 401 });
  }

  // Strict Role-Based Access Control: IT Admin & Admin
  if (validation.user.role !== 'it_admin' && validation.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Only IT Administrators and Admins have authorization to batch import assets.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { location_id, plant_id, department_id, items } = body as BatchImportPayload;

    if (!location_id || !plant_id || !department_id) {
      return NextResponse.json(
        { error: 'Location, Plant, and Department selections are required.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No asset records found in import payload.' },
        { status: 400 }
      );
    }

    // Execute atomic batch import with automatic employee auto-provisioning
    const result = await batchImportAssets(
      { location_id, plant_id, department_id, items },
      validation.user.id
    );

    // Record immutable security audit log
    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'ASSET_BATCH_IMPORT',
      target_table: 'assets',
      record_id: result.imported_tags[0] || 'BATCH_IMPORT',
      changes: {
        total_items: result.total_processed,
        assets_created: result.assets_created,
        employees_created: result.employees_created,
        assets_assigned: result.assets_assigned,
        assets_in_stock: result.assets_in_stock,
        location_id,
        plant_id,
        department_id,
      },
      location_id,
      plant_id,
      department_id,
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Error during batch import:', err);
    const message = err instanceof Error ? err.message : 'Batch import processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
