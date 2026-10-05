import { NextRequest, NextResponse } from 'next/server';
import { getCategoryFields, addCategoryField, deleteCategoryField, updateCategoryField } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canUserEdit } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fields = await getCategoryFields(id);
  return NextResponse.json({ fields });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: categoryId } = await params;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access: modifications not permitted' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { field_name, field_label, field_type, options, is_required, placeholder, display_order } = body;

    if (!field_name || !field_label) {
      return NextResponse.json({ error: 'Field name and label are required' }, { status: 400 });
    }

    const field = await addCategoryField({
      category_id: categoryId,
      field_name: field_name.toLowerCase().trim().replace(/\s+/g, '_'),
      field_label: field_label.trim(),
      field_type: field_type || 'text',
      options: options || null,
      is_required: Boolean(is_required),
      placeholder: placeholder || null,
      display_order: Number(display_order) || 0,
    });

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'CUSTOM_FIELD_CREATE',
      target_table: 'category_form_fields',
      record_id: field.id,
      changes: { field_label: field.field_label, field_name: field.field_name, is_required: field.is_required },
      ip_address: ip,
      user_agent: userAgent,
    });

    return NextResponse.json({ success: true, field });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to add custom field';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: categoryId } = await params;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (validation.user.role !== 'it_admin') {
    return NextResponse.json({ error: 'Access Denied: Only IT Administrators (it_admin) can modify custom form fields' }, { status: 403 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access: modifications not permitted' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { fieldId, field_label, field_type, options, is_required, placeholder, display_order } = body;

    if (!fieldId) {
      return NextResponse.json({ error: 'Field ID is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (field_label !== undefined) updates.field_label = field_label.trim();
    if (field_type !== undefined) updates.field_type = field_type;
    if (options !== undefined) updates.options = options;
    if (is_required !== undefined) updates.is_required = Boolean(is_required);
    if (placeholder !== undefined) updates.placeholder = placeholder;
    if (display_order !== undefined) updates.display_order = Number(display_order);

    const updatedField = await updateCategoryField(fieldId, updates);
    if (!updatedField) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'CUSTOM_FIELD_UPDATE',
      target_table: 'category_form_fields',
      record_id: fieldId,
      changes: updates,
      ip_address: ip,
      user_agent: userAgent,
    });

    return NextResponse.json({ success: true, field: updatedField });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update custom field';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(req.url);
  const fieldId = searchParams.get('fieldId');
  if (!fieldId) {
    return NextResponse.json({ error: 'Field ID is required' }, { status: 400 });
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access: modifications not permitted' }, { status: 403 });
  }

  await deleteCategoryField(fieldId);

  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Unknown';
  await logAuditEvent({
    event_category: 'data_change',
    user_id: validation.user.id,
    user_role: validation.user.role,
    action: 'CUSTOM_FIELD_DELETE',
    target_table: 'category_form_fields',
    record_id: fieldId,
    ip_address: ip,
    user_agent: userAgent,
  });

  return NextResponse.json({ success: true });
}
