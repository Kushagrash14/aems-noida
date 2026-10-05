import type { AuditLog } from '@/types/database';

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Logged in',
  LOGIN_FAILED_ATTEMPT: 'Failed login attempt',
  LOGIN_FAILED_ATTEMPT_SPIKE: 'Repeated failed logins',
  LOGIN_BLOCKED_INACTIVE_USER: 'Login blocked (inactive user)',
  LOGIN_UNAUTHORIZED_EMAIL: 'Login attempt with unregistered email',
  OTP_REQUESTED: 'OTP requested',
  OTP_REQUEST_FAILED: 'OTP sending failed',
  LOGOUT: 'Logged out',
  ASSET_CREATE: 'Asset registered',
  ASSET_REGISTERED: 'Asset registered',
  ASSET_UPDATE: 'Asset edited',
  ASSET_SOFT_DELETE: 'Asset deleted',
  ASSET_ASSIGNMENT: 'Asset assigned to employee',
  ASSET_INHOUSE_DEPLOYMENT: 'Asset deployed in-house',
  ASSET_DEASSIGNMENT: 'Asset de-assigned',
  ASSET_DEPARTMENT_TRANSFER: 'Asset transferred',
  ASSET_DUPLICATE_TYPE_APPROVED: 'Duplicate asset type approved',
  ASSET_BATCH_IMPORT: 'Assets imported (Smart Excel)',
  BULK_ASSET_IMPORT: 'Assets bulk imported',
  ASSET_CATEGORY_REPAIR: 'Asset types repaired',
  EMPLOYEE_CREATED: 'Employee added',
  EMPLOYEE_UPDATED: 'Employee edited',
  EMPLOYEE_DELETED: 'Employee deleted',
  USER_REGISTERED: 'System user created',
  USER_UPDATED: 'System user edited',
  USER_DELETED: 'System user deleted',
  DEPARTMENT_CREATED: 'Department created',
  DEPARTMENT_UPDATED: 'Department edited',
  DEPARTMENT_DELETED: 'Department deleted',
  LOCATION_CREATED: 'Location created',
  LOCATION_UPDATED: 'Location edited',
  LOCATION_DELETED: 'Location deleted',
  PLANT_CREATED: 'Plant created',
  PLANT_UPDATED: 'Plant edited',
  PLANT_DELETED: 'Plant deleted',
  CATEGORY_CREATED: 'Asset type created',
  CATEGORY_UPDATED: 'Asset type edited',
  CATEGORY_DELETED: 'Asset type deleted',
  CUSTOM_FIELD_CREATE: 'Entry form field added',
  CUSTOM_FIELD_UPDATE: 'Entry form field edited',
  CUSTOM_FIELD_DELETE: 'Entry form field deleted',
  PM_COMPLAINT_SUBMITTED: 'Machine complaint submitted (QR)',
  PM_COMPLAINT_RESOLVED: 'Machine complaint resolved',
  SMART_MAIL_CREATED: 'Smart mail drafted',
  SMART_MAIL_UPDATED: 'Smart mail edited',
  SMART_MAIL_SCHEDULED: 'Automail scheduled',
  SMART_MAIL_STOPPED: 'Automail stopped',
  SMART_MAIL_DELETED: 'Smart mail deleted',
  SMART_MAIL_TEST_SENT: 'Smart mail sent',
  ASSET_APPROVAL_REQUESTED: 'Plant Head approval requested',
  ASSET_APPROVAL_GRANTED: 'Plant Head approved request',
  ASSET_APPROVAL_REJECTED: 'Plant Head rejected request',
};

export function isHistoricalLog(log: AuditLog): boolean {
  return Boolean(log.changes && (log.changes as Record<string, unknown>).historical);
}

/** Who did it, in plain words. */
export function auditActorLabel(log: AuditLog): string {
  if (log.user?.full_name) return log.user.full_name;
  if (log.user_role === 'public_reporter') return 'Public (QR complaint)';
  if (log.user_role === 'plant_head') {
    const name = (log.changes as Record<string, unknown> | null)?.decided_by;
    return `${typeof name === 'string' && name ? name : 'Plant Head'} (Plant Head, via email)`;
  }
  if (log.user_role === 'anonymous') return 'Not logged in';
  if (isHistoricalLog(log)) return 'Unknown (before audit logging / demo data)';
  return 'System';
}

/** Human-readable one-line description, e.g. "Asset registered: PGEL-LPT-1001 – Dell Latitude". */
export function describeAuditLog(log: AuditLog): string {
  const label = ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  const c = (log.changes || {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
  const subject = [
    str(c.asset_tag) || str(c.tag),
    str(c.name) || str(c.full_name) || str(c.title),
    str(c.emp_code),
    str(c.email),
  ]
    .filter(Boolean)
    .join(' – ');
  return subject ? `${label}: ${subject}` : label;
}
