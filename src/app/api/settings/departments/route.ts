import { NextRequest, NextResponse } from 'next/server';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized: active login session required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const plantId = searchParams.get('plantId');

  let departments = await getDepartments();

  if (plantId) {
    departments = departments.filter((d) => !d.plant_id || d.plant_id === plantId);
  }

  // Non-IT Admins are strictly scoped to their assigned department(s)
  const currentUser = validation.user;
  if (currentUser.role !== 'it_admin') {
    if (currentUser.department_id) {
      departments = departments.filter((d) => d.id === currentUser.department_id);
    } else if (validation.scope?.department_ids && validation.scope.department_ids.length > 0) {
      departments = departments.filter((d) => validation.scope!.department_ids!.includes(d.id));
    } else if (currentUser.plant_id) {
      departments = departments.filter((d) => !d.plant_id || d.plant_id === currentUser.plant_id);
    }
  }

  return NextResponse.json({ departments });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only IT Admin can create master departments
  if (validation.user.role !== 'it_admin') {
    return NextResponse.json({ error: 'Access Denied: Only IT Administrators can create master departments' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, code, plant_id, sub_department, admin_user_id } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const deptCode = (code || `DEPT-${name.slice(0, 3)}`).toUpperCase().trim();
    const department = await createDepartment({
      name: name.trim(),
      code: deptCode,
      plant_id: plant_id || null,
      sub_department: sub_department ? sub_department.trim() : null,
      admin_user_id: admin_user_id || null,
    });

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'DEPARTMENT_CREATED',
      target_table: 'departments',
      record_id: department.id,
      changes: { name: department.name, code: department.code, plant_id, sub_department },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, department });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create department';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only IT Admin can modify departments
  if (validation.user.role !== 'it_admin') {
    return NextResponse.json({ error: 'Access Denied: Only IT Administrators can modify departments' }, { status: 403 });
  }

  try {
    const { departmentId, name, code, plant_id, sub_department, adminUserId } = await req.json();
    if (!departmentId) {
      return NextResponse.json({ error: 'Department ID required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (code !== undefined) updates.code = code.toUpperCase().trim();
    if (plant_id !== undefined) updates.plant_id = plant_id || null;
    if (sub_department !== undefined) updates.sub_department = sub_department ? sub_department.trim() : null;
    if (adminUserId !== undefined) updates.admin_user_id = adminUserId || null;

    const updated = await updateDepartment(departmentId, updates);

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'DEPARTMENT_UPDATED',
      target_table: 'departments',
      record_id: departmentId,
      changes: updates,
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, department: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update department';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only IT Admin can delete departments
  if (validation.user.role !== 'it_admin') {
    return NextResponse.json({ error: 'Access Denied: Only IT Administrators can delete departments' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId') || searchParams.get('id');

  if (!departmentId) {
    return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
  }

  try {
    const success = await deleteDepartment(departmentId);
    if (!success) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'DEPARTMENT_DELETED',
      target_table: 'departments',
      record_id: departmentId,
      changes: { deleted_id: departmentId },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, message: 'Department deleted successfully' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to delete department';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
