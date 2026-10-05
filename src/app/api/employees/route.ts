import { NextRequest, NextResponse } from 'next/server';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canUserEdit } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized: active login session required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('locationId') || searchParams.get('location_id') || undefined;
  let plantId = searchParams.get('plantId') || searchParams.get('plant_id') || undefined;
  let deptId = searchParams.get('deptId') || searchParams.get('department_id') || undefined;
  const search = searchParams.get('search') || undefined;

  // Enforce facility & department scoping for non-IT Admin
  if (validation.user.role !== 'it_admin') {
    if (validation.user.location_id) locationId = validation.user.location_id;
    if (validation.user.plant_id) plantId = validation.user.plant_id;
    if (validation.user.department_id) deptId = validation.user.department_id;
  }

  const employees = await getEmployees({ locationId, plantId, deptId, search });
  return NextResponse.json({ employees });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (validation.user.role === 'user') {
    return NextResponse.json({ error: 'Permission denied: HR or Admin access required' }, { status: 403 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { emp_code, full_name, email, phone, designation, department_id, plant_id, location_id } = body;

    if (!emp_code || !full_name || !department_id || !plant_id || !location_id) {
      return NextResponse.json({ error: 'Missing mandatory employee fields' }, { status: 400 });
    }

    const employee = await createEmployee({
      emp_code,
      full_name,
      email: email || null,
      phone: phone || null,
      designation: designation || null,
      department_id,
      plant_id,
      location_id,
      status: body.status || 'active',
    });

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'EMPLOYEE_CREATED',
      target_table: 'employees',
      record_id: employee.id,
      changes: { emp_code, full_name, email, designation },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, employee });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create employee';
    const isConflict = errorMsg.includes('already exists') || errorMsg.includes('duplicate') || errorMsg.includes('unique');
    return NextResponse.json({ error: errorMsg }, { status: isConflict ? 409 : 500 });
  }
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (validation.user.role === 'user') {
    return NextResponse.json({ error: 'Permission denied: HR or Admin access required' }, { status: 403 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, emp_code, full_name, email, phone, designation, department_id, plant_id, location_id, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (emp_code !== undefined) updates.emp_code = emp_code.trim();
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (email !== undefined) updates.email = email ? email.trim() : null;
    if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
    if (designation !== undefined) updates.designation = designation ? designation.trim() : null;
    if (department_id !== undefined) updates.department_id = department_id;
    if (plant_id !== undefined) updates.plant_id = plant_id;
    if (location_id !== undefined) updates.location_id = location_id;
    if (status !== undefined) updates.status = status;

    const updated = await updateEmployee(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'EMPLOYEE_UPDATED',
      target_table: 'employees',
      record_id: id,
      changes: updates,
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, employee: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update employee';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (validation.user.role === 'user') {
    return NextResponse.json({ error: 'Permission denied: HR or Admin access required' }, { status: 403 });
  }

  if (!canUserEdit(validation.user, validation.scope)) {
    return NextResponse.json({ error: 'View-only access' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    const success = await deleteEmployee(id);
    if (!success) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'EMPLOYEE_DELETED',
      target_table: 'employees',
      record_id: id,
      changes: { deleted_employee_id: id },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, message: 'Employee deleted successfully' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to delete employee';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
