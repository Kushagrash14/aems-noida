import type { AuditLog, User } from '@/types/database';
import { getAssets, getEmployees, getUsersWithScopes } from '@/lib/store';
import { getAuditedRecordKeys } from '@/lib/audit';

export interface HistoryFilter {
  event_category?: string;
  risk_level?: string;
  locationId?: string;
  plantId?: string;
  departmentId?: string;
  userId?: string;
  search?: string;
  from?: string;
  to?: string;
}

const PRE_AUDIT_NOTE =
  'Reconstructed from the record itself — this entry was created before audit logging existed, by bulk import, or is seed/demo data.';

/**
 * Builds audit-style events for records that exist in the database but have
 * no matching audit log (older entries), so the audit trail covers everything.
 */
export async function buildHistoricalEvents(filter: HistoryFilter = {}): Promise<AuditLog[]> {
  if (filter.event_category && filter.event_category !== 'data_change') return [];
  if (filter.risk_level && filter.risk_level !== 'normal') return [];

  const [logged, assets, employees, users] = await Promise.all([
    getAuditedRecordKeys(),
    getAssets({ includeDeleted: true }),
    getEmployees(),
    getUsersWithScopes().catch(() => [] as User[]),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));

  const events: AuditLog[] = [];
  const base = (
    id: string,
    action: string,
    table: string,
    recordId: string,
    createdAt: string,
    actorId: string | null | undefined,
    changes: Record<string, unknown>
  ): AuditLog => {
    const actor = actorId ? userById.get(actorId) : undefined;
    return {
      id,
      event_category: 'data_change',
      user_id: actor?.id ?? null,
      user_role: actor?.role ?? 'unknown',
      action,
      target_table: table,
      record_id: recordId,
      changes: { ...changes, historical: true, note: PRE_AUDIT_NOTE },
      risk_level: 'normal',
      ip_address: null,
      user_agent: null,
      emp_code: actor?.emp_code ?? null,
      created_at: createdAt,
      user: actor,
    };
  };

  for (const a of assets) {
    if (logged.has(`assets:${a.id}`)) continue;
    const ev = base(`hist-asset-${a.id}`, 'ASSET_REGISTERED', 'assets', a.id, a.created_at, a.created_by, {
      asset_tag: a.asset_tag,
      name: a.name,
      asset_type: a.category?.name ?? null,
      status: a.status,
      assigned_to: a.assigned_employee ? `${a.assigned_employee.full_name} (${a.assigned_employee.emp_code})` : null,
    });
    ev.location_id = a.current_location_id;
    ev.plant_id = a.current_plant_id;
    ev.department_id = a.current_department_id;
    ev.location_name = a.location?.name ?? null;
    ev.plant_name = a.plant?.name ?? null;
    ev.department_name = a.department?.name ?? null;
    events.push(ev);

    if (a.is_deleted && a.deleted_at) {
      events.push(
        base(`hist-asset-del-${a.id}`, 'ASSET_SOFT_DELETE', 'assets', a.id, a.deleted_at, a.deleted_by, {
          asset_tag: a.asset_tag,
          name: a.name,
        })
      );
    }
  }

  for (const e of employees) {
    if (logged.has(`employees:${e.id}`)) continue;
    const ev = base(`hist-emp-${e.id}`, 'EMPLOYEE_CREATED', 'employees', e.id, e.created_at, null, {
      emp_code: e.emp_code,
      full_name: e.full_name,
      email: e.email ?? null,
    });
    ev.location_id = e.location_id;
    ev.plant_id = e.plant_id;
    ev.department_id = e.department_id;
    events.push(ev);
  }

  for (const u of users) {
    if (logged.has(`users:${u.id}`)) continue;
    events.push(
      base(`hist-user-${u.id}`, 'USER_REGISTERED', 'users', u.id, u.created_at, null, {
        email: u.email,
        full_name: u.full_name,
        role: u.role,
      })
    );
  }

  const q = filter.search?.toLowerCase().trim();
  return events.filter((ev) => {
    if (filter.userId && ev.user_id !== filter.userId) return false;
    if (filter.locationId && ev.location_id !== filter.locationId) return false;
    if (filter.plantId && ev.plant_id !== filter.plantId) return false;
    if (filter.departmentId && ev.department_id !== filter.departmentId) return false;
    if (filter.from && ev.created_at < filter.from) return false;
    if (filter.to && ev.created_at > filter.to) return false;
    if (q) {
      const hay = [ev.action, ev.target_table, ev.user?.full_name, ev.user?.email, ev.emp_code, JSON.stringify(ev.changes)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
