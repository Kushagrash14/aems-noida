// =============================================================================
// AEMS v2 — Role & Scoped Access Control Subsystem
// Enforces industrial role hierarchies (IT Admin, Admin, User) and
// strict Location -> Plant -> Department scoping.
// =============================================================================

import { User, UserScope, UserRole } from '@/types/database';

export interface ScopeCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if the user is authorized to perform edit/mutation operations
 * - IT Admin, Admin, and User can edit/manage records within their assigned department
 */
export function canUserEdit(user: User, scope?: UserScope | null): boolean {
  if (user.role === 'it_admin') return true;
  if (!user.is_active) return false;
  return scope ? scope.can_edit : true;
}

/**
 * Check if an asset or record falls within a user's assigned scope
 * - IT Admin: Global enterprise visibility (all locations, plants, departments)
 * - Admin & User: Strictly confined to their assigned Location, Plant, and Department
 */
export function isEntityInUserScope(
  user: User,
  scope: UserScope | null | undefined,
  entity: {
    category_id?: string | null;
    location_id?: string | null;
    plant_id?: string | null;
    department_id?: string | null;
    current_location_id?: string | null;
    current_plant_id?: string | null;
    current_department_id?: string | null;
  }
): boolean {
  // IT Admin has global visibility across all locations, plants, and departments
  if (user.role === 'it_admin') return true;

  const locId = entity.current_location_id || entity.location_id;
  const pltId = entity.current_plant_id || entity.plant_id;
  const deptId = entity.current_department_id || entity.department_id;
  const catId = entity.category_id;

  // Check direct user location_id, plant_id, department_id
  if (user.location_id && locId && user.location_id !== locId) {
    return false;
  }
  if (user.plant_id && pltId && user.plant_id !== pltId) {
    return false;
  }
  if (user.department_id && deptId && user.department_id !== deptId) {
    return false;
  }

  // Check UserScope arrays if assigned
  if (scope) {
    if (scope.location_ids && scope.location_ids.length > 0 && locId) {
      if (!scope.location_ids.includes(locId)) return false;
    }
    if (scope.plant_ids && scope.plant_ids.length > 0 && pltId) {
      if (!scope.plant_ids.includes(pltId)) return false;
    }
    if (scope.department_ids && scope.department_ids.length > 0 && deptId) {
      if (!scope.department_ids.includes(deptId)) return false;
    }
    if (scope.category_ids && scope.category_ids.length > 0 && catId) {
      if (!scope.category_ids.includes(catId)) return false;
    }
  }

  return true;
}

/**
 * Check if a user is allowed to perform soft-delete on an asset or entry
 * Rule: IT Admin and Admin only. Users CANNOT delete entries.
 */
export function canDeleteAsset(user: User, scope?: UserScope | null): boolean {
  if (user.role === 'it_admin') return true;
  if (user.role === 'admin' && canUserEdit(user, scope)) return true;
  return false;
}

/**
 * Check if a user is allowed to create other users
 * Rule: IT Admin (can create all roles) and Admin (can create 'user' role for their department only).
 * Standard Users CANNOT create users.
 */
export function canCreateUsers(user: User): boolean {
  return user.role === 'it_admin' || user.role === 'admin';
}

/**
 * Check if a user is allowed to run Bulk Excel Import
 * Rule: Strictly IT Admin. Admins and Users cannot see or run Bulk Import.
 */
export function canPerformBulkImport(user: User): boolean {
  return user.role === 'it_admin';
}

/**
 * Check if a user can access the Settings area
 * Rule: IT Admin (all tabs) and Admin (User Management tab only).
 * Standard Users CANNOT access Settings.
 */
export function canAccessSettings(user: User): boolean {
  return user.role === 'it_admin' || user.role === 'admin';
}

/**
 * Check if a user can access advanced configuration settings tabs (Master setup, Entry forms, Security Audit)
 * Rule: Strictly IT Admin.
 */
export function canAccessAdvancedSettings(user: User): boolean {
  return user.role === 'it_admin';
}

/**
 * Check if a user can approve/reject Damaged or Scrap reports
 * Rule: Admin or IT Admin with can_edit = true.
 */
export function canReviewDamageScrap(user: User, scope?: UserScope | null): boolean {
  if (user.role === 'it_admin') return true;
  if (user.role === 'admin' && canUserEdit(user, scope)) return true;
  return false;
}

/**
 * Check if an Admin can assign a particular role to a new/existing user
 * - IT Admin can assign any role (it_admin, admin, user, hr)
 * - Admin can assign User role ('user') only
 */
export function canAssignRole(
  actor: User,
  actorScope: UserScope | null | undefined,
  targetRole: UserRole
): boolean {
  if (actor.role === 'it_admin') return true;
  if (actor.role !== 'admin') return false;

  // Admin can ONLY assign standard User role
  return targetRole === 'user';
}

/**
 * Determine inactivity timeout based on role
 * Set to 24 hours (86,400 seconds) to ensure uninterrupted workspace access
 */
export function getInactivityTimeoutSeconds(role: UserRole): number {
  return 24 * 60 * 60; // 24 hours
}
