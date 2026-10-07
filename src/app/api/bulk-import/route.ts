import { NextRequest, NextResponse } from 'next/server';
import { getCategories, getLocations, getPlants, getDepartments, createAsset } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canPerformBulkImport, isEntityInUserScope } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canPerformBulkImport(validation.user)) {
    return NextResponse.json({ error: 'Permission denied: Bulk Import is strictly restricted to IT Admins' }, { status: 403 });
  }

  try {
    const { rows } = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data rows provided for import' }, { status: 400 });
    }

    const categories = await getCategories();
    const locations = await getLocations();
    const plants = await getPlants();
    const departments = await getDepartments();

    const results = {
      imported: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      if (!row.asset_tag || !row.name) {
        results.errors.push({ row: rowNumber, error: 'Missing Asset Tag or Asset Name' });
        continue;
      }

      // Match Category
      const cat = categories.find(
        (c) =>
          c.code.toLowerCase() === String(row.category || '').toLowerCase() ||
          c.name.toLowerCase() === String(row.category || '').toLowerCase()
      ) || categories[0];

      // Match Location
      const loc = locations.find(
        (l) =>
          l.code.toLowerCase() === String(row.location || '').toLowerCase() ||
          l.name.toLowerCase() === String(row.location || '').toLowerCase()
      ) || locations[0];

      // Match Plant
      const plt = plants.find(
        (p) =>
          p.code.toLowerCase() === String(row.plant || '').toLowerCase() ||
          p.name.toLowerCase() === String(row.plant || '').toLowerCase()
      ) || plants[0];

      // Match Department
      const dept = departments.find(
        (d) =>
          d.code.toLowerCase() === String(row.department || '').toLowerCase() ||
          d.name.toLowerCase() === String(row.department || '').toLowerCase()
      ) || departments[0];

      // Enforce user scope on category, location, and plant
      if (!isEntityInUserScope(validation.user, validation.scope, {
        category_id: cat?.id,
        location_id: loc?.id,
        plant_id: plt?.id,
      })) {
        results.errors.push({
          row: rowNumber,
          error: `Permission denied: Plant (${plt?.name || 'Unknown'}), Location (${loc?.name || 'Unknown'}), or Category (${cat?.name || 'Unknown'}) is outside your assigned scope`,
        });
        continue;
      }

      try {
        await createAsset(
          {
            asset_tag: String(row.asset_tag).trim(),
            sap_asset_code: row.sap_asset_code ? String(row.sap_asset_code).trim().toUpperCase() : null,
            serial_number: row.serial_number ? String(row.serial_number).trim() : null,
            name: String(row.name).trim(),
            model: row.model ? String(row.model).trim() : null,
            manufacturer: row.manufacturer ? String(row.manufacturer).trim() : null,
            category_id: cat.id,
            purchase_date: row.purchase_date || null,
            purchase_cost: row.purchase_cost ? Number(row.purchase_cost) : null,
            po_number: row.po_number ? String(row.po_number).trim() : null,
            invoice_number: row.invoice_number ? String(row.invoice_number).trim().toUpperCase() : null,
            invoice_date: row.invoice_date || null,
            vendor_name: row.vendor_name ? String(row.vendor_name).trim() : null,
            warranty_expiry: row.warranty_expiry || null,
            current_location_id: loc.id,
            current_plant_id: plt.id,
            current_department_id: dept.id,
            status: 'in_service',
            created_by: validation.user.id,
          },
          [],
          undefined,
          validation.user.id
        );
        results.imported++;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Row insertion failed';
        results.errors.push({ row: rowNumber, error: errorMsg });
      }
    }

    // Record bulk import audit event
    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'BULK_ASSET_IMPORT',
      target_table: 'assets',
      changes: { totalRows: rows.length, importedCount: results.imported, errorsCount: results.errors.length },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Bulk import failed';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
