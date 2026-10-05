import { NextRequest, NextResponse } from 'next/server';
import { getUsersWithScopes, updateUserScope, createUser, updateUser, deleteUser, getCategories } from '@/lib/store';
import { validateSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { canAssignRole } from '@/lib/permissions';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (validation.user.role !== 'it_admin' && validation.user.role !== 'admin') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  let users = await getUsersWithScopes();

  // If Admin, only return users within their assigned department, plant, and location
  if (validation.user.role === 'admin') {
    users = users.filter((u) => {
      if (validation.user!.department_id && u.department_id !== validation.user!.department_id) return false;
      if (validation.user!.plant_id && u.plant_id !== validation.user!.plant_id) return false;
      if (validation.user!.location_id && u.location_id !== validation.user!.location_id) return false;
      return true;
    });
  }

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // IT Admin and Admin are allowed to register users
  if (validation.user.role !== 'it_admin' && validation.user.role !== 'admin') {
    return NextResponse.json({ error: 'Access Denied: You do not have permission to register users' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      email,
      full_name,
      phone,
      emp_code,
      role = 'user',
      location_id,
      plant_id,
      department_id,
      sub_department,
      can_edit = true,
      category_ids = null,
      location_ids = null,
      plant_ids = null,
      department_ids = null,
    } = body;

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Valid Mail ID is required' }, { status: 400 });
    }
    if (!full_name || !full_name.trim()) {
      return NextResponse.json({ error: 'User full name is required' }, { status: 400 });
    }

    if (!['it_admin', 'admin', 'user'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Allowed roles are IT ADMIN (it_admin), ADMIN (admin), or USER (user).' },
        { status: 400 }
      );
    }

    // Role and Scope enforcement:
    // If Admin is registering, they can ONLY create role 'user' within their own Location, Plant, Department
    let resolvedRole: 'it_admin' | 'admin' | 'user' = role as 'it_admin' | 'admin' | 'user';
    let resolvedLocId = location_id || null;
    let resolvedPltId = plant_id || null;
    let resolvedDeptId = department_id || null;

    if (validation.user.role === 'admin') {
      if (role !== 'user') {
        return NextResponse.json(
          { error: 'Access Denied: Admins can only register standard Users within their assigned department' },
          { status: 403 }
        );
      }
      resolvedRole = 'user';
      resolvedLocId = validation.user.location_id || resolvedLocId;
      resolvedPltId = validation.user.plant_id || resolvedPltId;
      resolvedDeptId = validation.user.department_id || resolvedDeptId;
    }

    const isItAdmin = resolvedRole === 'it_admin';
    const createdUser = await createUser(
      {
        email: email.trim(),
        full_name: full_name.trim(),
        phone: phone || null,
        emp_code: emp_code ? emp_code.trim() : null,
        role: resolvedRole,
        location_id: isItAdmin ? null : resolvedLocId,
        plant_id: isItAdmin ? null : resolvedPltId,
        department_id: isItAdmin ? null : resolvedDeptId,
        sub_department: isItAdmin ? null : (sub_department && sub_department.toLowerCase() !== 'none' ? sub_department.trim() : null),
      },
      {
        can_edit: isItAdmin ? true : Boolean(can_edit),
        category_ids: isItAdmin ? null : (Array.isArray(category_ids) && category_ids.length > 0 ? category_ids : null),
        location_ids: isItAdmin ? null : (Array.isArray(location_ids) && location_ids.length > 0 ? location_ids : (resolvedLocId ? [resolvedLocId] : null)),
        plant_ids: isItAdmin ? null : (Array.isArray(plant_ids) && plant_ids.length > 0 ? plant_ids : (resolvedPltId ? [resolvedPltId] : null)),
        department_ids: isItAdmin ? null : (Array.isArray(department_ids) && department_ids.length > 0 ? department_ids : (resolvedDeptId ? [resolvedDeptId] : null)),
        sub_department: isItAdmin ? null : (sub_department && sub_department.toLowerCase() !== 'none' ? sub_department.trim() : null),
      }
    );

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'USER_REGISTERED',
      target_table: 'users',
      record_id: createdUser.id,
      changes: {
        email: createdUser.email,
        full_name: createdUser.full_name,
        emp_code: createdUser.emp_code,
        role: createdUser.role,
        location_id,
        plant_id,
        department_id,
        sub_department,
      },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, user: createdUser });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to register user';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // IT Admin and Admin are allowed to modify users
  if (validation.user.role !== 'it_admin' && validation.user.role !== 'admin') {
    return NextResponse.json({ error: 'Access Denied: You do not have permission to modify user accounts' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      userId,
      full_name,
      email,
      phone,
      emp_code,
      targetRole,
      can_edit,
      category_ids,
      location_ids,
      plant_ids,
      department_ids,
      location_id,
      plant_id,
      department_id,
      sub_department,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Role assignment verification
    if (targetRole) {
      const isAllowed = canAssignRole(validation.user, validation.scope, targetRole);
      if (!isAllowed) {
        return NextResponse.json({ error: 'Access Denied: You are not authorized to assign this role' }, { status: 403 });
      }
    }

    // User profile updates
    const isItAdmin = targetRole === 'it_admin';
    const userUpdates: Record<string, unknown> = {};
    if (full_name !== undefined) userUpdates.full_name = full_name.trim();
    if (email !== undefined) userUpdates.email = email.toLowerCase().trim();
    if (phone !== undefined) userUpdates.phone = phone || null;
    if (emp_code !== undefined) userUpdates.emp_code = emp_code ? emp_code.trim() : null;
    if (targetRole !== undefined) userUpdates.role = targetRole;
    if (isItAdmin) {
      userUpdates.location_id = null;
      userUpdates.plant_id = null;
      userUpdates.department_id = null;
      userUpdates.sub_department = null;
    } else {
      if (location_id !== undefined) userUpdates.location_id = location_id || null;
      if (plant_id !== undefined) userUpdates.plant_id = plant_id || null;
      if (department_id !== undefined) userUpdates.department_id = department_id || null;
      if (sub_department !== undefined) {
        userUpdates.sub_department = sub_department && sub_department.toLowerCase() !== 'none' ? sub_department.trim() : null;
      }
    }

    if (Object.keys(userUpdates).length > 0) {
      await updateUser(userId, userUpdates);
    }

    // User scopes updates
    const resolvedLocationIds = isItAdmin ? null : (location_ids && location_ids.length > 0 ? location_ids : (location_id ? [location_id] : null));
    const resolvedPlantIds = isItAdmin ? null : (plant_ids && plant_ids.length > 0 ? plant_ids : (plant_id ? [plant_id] : null));
    const resolvedDeptIds = isItAdmin ? null : (department_ids && department_ids.length > 0 ? department_ids : (department_id ? [department_id] : null));

    await updateUserScope(userId, {
      can_edit: isItAdmin ? true : Boolean(can_edit ?? true),
      category_ids: isItAdmin ? null : (category_ids && category_ids.length > 0 ? category_ids : null),
      location_ids: resolvedLocationIds,
      plant_ids: resolvedPlantIds,
      department_ids: resolvedDeptIds,
      sub_department: isItAdmin ? null : (sub_department && sub_department.toLowerCase() !== 'none' ? sub_department.trim() : null),
    });

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'USER_UPDATED',
      target_table: 'users',
      record_id: userId,
      changes: { userUpdates, can_edit, category_ids, resolvedLocationIds, resolvedPlantIds, resolvedDeptIds },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, message: 'User updated successfully' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update user';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const validation = await validateSessionToken(token);

  if (!validation.valid || !validation.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Strictly IT Admin
  if (validation.user.role !== 'it_admin') {
    return NextResponse.json({ error: 'Access Denied: Only IT Administrators can delete users' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || searchParams.get('id');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  // Prevent self-deletion
  if (userId === validation.user.id) {
    return NextResponse.json({ error: 'You cannot delete your own administrative account' }, { status: 400 });
  }

  try {
    const success = await deleteUser(userId);
    if (!success) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await logAuditEvent({
      event_category: 'data_change',
      user_id: validation.user.id,
      user_role: validation.user.role,
      action: 'USER_DELETED',
      target_table: 'users',
      record_id: userId,
      changes: { deleted_user_id: userId },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to delete user';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
