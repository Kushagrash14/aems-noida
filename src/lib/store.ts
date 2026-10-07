// =============================================================================
// AEMS v2 — Normalized Data Store & Service Layer
// Bridges application APIs with MySQL (Amazon RDS) and local mock engine.
// =============================================================================

import {
  Asset,
  AssetPeripheral,
  AssetStatus,
  Category,
  CategoryFormField,
  Department,
  Employee,
  Location,
  Plant,
  PMMachine,
  PMSchedule,
  PMComplaint,
  DamageScrapReport,
  User,
  UserScope,
  UserRole,
} from '@/types/database';
import {
  SEED_CATEGORIES,
  SEED_CATEGORY_FIELDS,
  SEED_DEPARTMENTS,
  SEED_LOCATIONS,
  SEED_PLANTS,
  SEED_USERS,
  SEED_SCOPES,
} from '@/lib/mock-data';
import { env } from '@/lib/env';
import { db } from '@/lib/db/client';
import { getLockPool } from '@/lib/db/mysql';
import { persistDemoState } from '@/lib/demoPersistence';
import { logAuditEvent } from '@/lib/audit';
import { createHash } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { inferItCategoryName } from '@/lib/assetType';

// In-Memory state for mock demo mode
class MemoryStore {
  locations: Location[] = [...SEED_LOCATIONS];
  plants: Plant[] = [...SEED_PLANTS];
  departments: Department[] = [...SEED_DEPARTMENTS];
  categories: Category[] = [...SEED_CATEGORIES];
  categoryFields: CategoryFormField[] = [...SEED_CATEGORY_FIELDS];
  // Demo mode starts empty: only login users and master data (locations, plants, departments, asset types) are seeded.
  employees: Employee[] = [];
  assets: Asset[] = [];
  pmMachines: PMMachine[] = [];
  pmComplaints: PMComplaint[] = [];
  damageReports: DamageScrapReport[] = [];
  assetAssignments: AssetAssignmentRow[] = [];
  assetTransfers: AssetTransferRow[] = [];
  users: User[] = [...SEED_USERS];
  userScopes: UserScope[] = [...SEED_SCOPES];

  // Rate limiter tracker: IP -> timestamps
  complaintIpRates: Map<string, number[]> = new Map();
}

const memory: MemoryStore = ((globalThis as unknown as { __aems_memory?: MemoryStore }).__aems_memory ??= new MemoryStore());

const PERSISTED_MEMORY_KEYS = [
  'locations', 'plants', 'departments', 'categories', 'categoryFields', 'employees', 'assets', 'pmMachines',
  'pmComplaints', 'damageReports', 'assetAssignments', 'assetTransfers', 'users', 'userScopes',
] as const;

if (env.isMockMode) {
  persistDemoState(
    'store',
    () => Object.fromEntries(PERSISTED_MEMORY_KEYS.map((key) => [key, memory[key]])),
    (saved) => {
      const data = (saved || {}) as Record<string, unknown>;
      for (const key of PERSISTED_MEMORY_KEYS) {
        if (Array.isArray(data[key])) (memory as unknown as Record<string, unknown>)[key] = data[key];
      }
    }
  );
}

// -----------------------------------------------------------------------------
// High-Speed In-Memory Cache (Eliminates repeated 7s Supabase round-trips)
// -----------------------------------------------------------------------------
interface StoreCache {
  locations?: { data: Location[]; expiresAt: number };
  plants?: { data: Plant[]; expiresAt: number };
  departments?: { data: Department[]; expiresAt: number };
  categories?: { data: Category[]; expiresAt: number };
  employees?: { data: Employee[]; expiresAt: number };
  assets?: Map<string, { data: Asset[]; expiresAt: number }>;
  complaints?: { data: PMComplaint[]; expiresAt: number };
  damageReports?: { data: DamageScrapReport[]; expiresAt: number };
}

const storeCache: StoreCache = ((globalThis as unknown as { __aems_store_cache?: StoreCache }).__aems_store_cache ??= {
  assets: new Map(),
});

export function invalidateMasterDataCache(): void {
  delete storeCache.locations;
  delete storeCache.plants;
  delete storeCache.departments;
  delete storeCache.categories;
  delete storeCache.employees;
}

export function invalidateAssetCache(): void {
  if (storeCache.assets) {
    storeCache.assets.clear();
  }
  delete storeCache.complaints;
  delete storeCache.damageReports;
}

// -----------------------------------------------------------------------------
// Lookups & Enterprise Structure CRUD
// -----------------------------------------------------------------------------
export async function getLocations(): Promise<Location[]> {
  if (env.isMockMode) return memory.locations;
  const now = Date.now();
  if (storeCache.locations && storeCache.locations.expiresAt > now) {
    return storeCache.locations.data;
  }
  const { data } = await db.from('locations').select('*').order('name');
  const locs = (data as Location[]) || [];
  storeCache.locations = { data: locs, expiresAt: now + 120_000 };
  return locs;
}

export async function createLocation(loc: { name: string; code: string; address?: string | null }): Promise<Location> {
  const newLoc: Location = {
    id: crypto.randomUUID(),
    name: loc.name.trim(),
    code: loc.code.toUpperCase().trim(),
    address: loc.address ? loc.address.trim() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (env.isMockMode) {
    memory.locations.push(newLoc);
    return newLoc;
  }
  const { data, error } = await db.from('locations').insert(newLoc).select().single();
  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return data as Location;
}

export async function updateLocation(id: string, updates: Partial<Location>): Promise<Location | null> {
  if (env.isMockMode) {
    const loc = memory.locations.find((l) => l.id === id);
    if (!loc) return null;
    Object.assign(loc, updates, { updated_at: new Date().toISOString() });
    return loc;
  }
  const { data, error } = await db.from('locations').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return data as Location;
}

interface ReferenceCheck {
  table: 'plants' | 'assets' | 'employees' | 'pm_machines' | 'asset_transfers';
  columns: string[];
  label: string;
}

function mockRowsFor(table: ReferenceCheck['table']): Record<string, unknown>[] {
  switch (table) {
    case 'plants': return memory.plants as unknown as Record<string, unknown>[];
    case 'assets': return memory.assets as unknown as Record<string, unknown>[];
    case 'employees': return memory.employees as unknown as Record<string, unknown>[];
    case 'pm_machines': return memory.pmMachines as unknown as Record<string, unknown>[];
    case 'asset_transfers': return mockTransfers() as unknown as Record<string, unknown>[];
  }
}

// Returns human-readable descriptions of records that still point at `id`.
async function findReferences(id: string, checks: ReferenceCheck[]): Promise<string[]> {
  const found: string[] = [];
  for (const check of checks) {
    let count = 0;
    if (env.isMockMode) {
      count = mockRowsFor(check.table).filter((row) => check.columns.some((c) => row[c] === id)).length;
    } else {
      let query = db.from(check.table).select('id', { count: 'exact', head: true });
      query = check.columns.length === 1
        ? query.eq(check.columns[0], id)
        : query.or(check.columns.map((c) => `${c}.eq.${id}`).join(','));
      const { count: dbCount, error } = await query;
      if (error) throw new Error(`Failed to check linked ${check.label}: ${error.message}`);
      count = dbCount || 0;
    }
    if (count > 0) found.push(`${count} ${check.label}`);
  }
  return found;
}

function assertNotReferenced(entity: string, references: string[]): void {
  if (references.length > 0) {
    throw new Error(
      `This ${entity} cannot be deleted because it is still linked to ${references.join(', ')}. ` +
      `Move or remove those records first.`
    );
  }
}

type ScopeArrayColumn = 'location_ids' | 'plant_ids' | 'department_ids';

async function removeIdFromUserScopes(column: ScopeArrayColumn, id: string): Promise<void> {
  if (env.isMockMode) {
    memory.userScopes.forEach((s) => {
      const list = s[column];
      if (list?.includes(id)) {
        const next = list.filter((v) => v !== id);
        s[column] = next.length ? next : null;
      }
    });
    return;
  }
  const { data: scopes, error } = await db.from('user_scopes').select(`id, ${column}`);
  if (error) throw new Error(`Failed to update user scopes: ${error.message}`);
  for (const s of scopes || []) {
    const list = s[column] as string[] | null;
    if (list?.includes(id)) {
      const next = list.filter((v) => v !== id);
      const { error: updErr } = await db.from('user_scopes').update({ [column]: next.length ? next : null }).eq('id', s.id);
      if (updErr) throw new Error(`Failed to update user scopes: ${updErr.message}`);
    }
  }
}

async function clearUserColumn(column: 'location_id' | 'plant_id' | 'department_id', id: string): Promise<void> {
  if (env.isMockMode) {
    memory.users.forEach((u) => {
      if (u[column] === id) u[column] = null;
    });
    return;
  }
  const { error } = await db.from('users').update({ [column]: null }).eq(column, id);
  if (error) throw new Error(`Failed to unlink users: ${error.message}`);
}

export async function deleteLocation(id: string): Promise<boolean> {
  if (env.isMockMode && !memory.locations.some((l) => l.id === id)) return false;

  const references = await findReferences(id, [
    { table: 'plants', columns: ['location_id'], label: 'plant(s)' },
    { table: 'assets', columns: ['current_location_id'], label: 'asset record(s)' },
    { table: 'employees', columns: ['location_id'], label: 'employee(s)' },
    { table: 'pm_machines', columns: ['location_id'], label: 'PM machine(s)' },
    { table: 'asset_transfers', columns: ['from_location_id', 'to_location_id'], label: 'transfer history record(s)' },
  ]);
  assertNotReferenced('location', references);

  await clearUserColumn('location_id', id);
  await removeIdFromUserScopes('location_ids', id);

  if (env.isMockMode) {
    memory.locations = memory.locations.filter((l) => l.id !== id);
    return true;
  }

  const { error } = await db.from('locations').delete().eq('id', id);
  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return true;
}

export async function deletePlant(id: string): Promise<boolean> {
  if (env.isMockMode && !memory.plants.some((p) => p.id === id)) return false;

  const references = await findReferences(id, [
    { table: 'assets', columns: ['current_plant_id'], label: 'asset record(s)' },
    { table: 'employees', columns: ['plant_id'], label: 'employee(s)' },
    { table: 'pm_machines', columns: ['plant_id'], label: 'PM machine(s)' },
    { table: 'asset_transfers', columns: ['from_plant_id', 'to_plant_id'], label: 'transfer history record(s)' },
  ]);
  assertNotReferenced('plant', references);

  await clearUserColumn('plant_id', id);
  await removeIdFromUserScopes('plant_ids', id);

  if (env.isMockMode) {
    memory.departments.forEach((d) => {
      if (d.plant_id === id) d.plant_id = null;
    });
    memory.plants = memory.plants.filter((p) => p.id !== id);
    return true;
  }

  const { error: deptErr } = await db.from('departments').update({ plant_id: null }).eq('plant_id', id);
  if (deptErr) throw new Error(`Failed to unlink departments: ${deptErr.message}`);

  const { error } = await db.from('plants').delete().eq('id', id);
  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return true;
}

export async function getPlants(): Promise<Plant[]> {
  if (env.isMockMode) {
    return memory.plants.map((p) => ({
      ...p,
      location: memory.locations.find((l) => l.id === p.location_id),
      departments: memory.departments.filter((d) => d.plant_id === p.id),
      sub_departments: p.sub_departments || [],
    }));
  }
  const now = Date.now();
  if (storeCache.plants && storeCache.plants.expiresAt > now) {
    return storeCache.plants.data;
  }
  const { data: plantRows, error } = await db.from('plants').select('*').order('name');
  if (error) {
    console.error('Supabase fetch plants error:', error);
  }

  const plantsList = (plantRows as Plant[]) || [];
  const { data: locRows } = await db.from('locations').select('*');
  const { data: deptRows } = await db.from('departments').select('*');

  const locMap = new Map((locRows || []).map((l: Location) => [l.id, l]));
  const deptList = (deptRows as Department[]) || [];

  const result = plantsList.map((p) => ({
    ...p,
    location: locMap.get(p.location_id) || memory.locations.find((l) => l.id === p.location_id),
    departments: deptList.filter((d) => d.plant_id === p.id),
    sub_departments: p.sub_departments || [],
  }));
  storeCache.plants = { data: result, expiresAt: now + 120_000 };
  return result;
}

export async function createPlant(plant: {
  location_id: string;
  name: string;
  code: string;
  sub_departments?: string[];
}): Promise<Plant> {
  const newPlant: Plant = {
    id: crypto.randomUUID(),
    location_id: plant.location_id,
    name: plant.name.trim(),
    code: plant.code.toUpperCase().trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (env.isMockMode) {
    memory.plants.push(newPlant);
    return newPlant;
  }

  // Upsert check for unique constraint plants_location_id_code_key
  const { data: existingByCode } = await db
    .from('plants')
    .select('*')
    .eq('location_id', newPlant.location_id)
    .eq('code', newPlant.code)
    .maybeSingle();

  if (existingByCode) {
    const { data: updated } = await db
      .from('plants')
      .update({ name: newPlant.name, updated_at: newPlant.updated_at })
      .eq('id', existingByCode.id)
      .select()
      .single();
    invalidateMasterDataCache();
    return (updated as Plant) || (existingByCode as Plant);
  }

  const { data, error } = await db
    .from('plants')
    .insert({
      id: newPlant.id,
      location_id: newPlant.location_id,
      name: newPlant.name,
      code: newPlant.code,
      created_at: newPlant.created_at,
      updated_at: newPlant.updated_at,
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase plant insert error:', error);
    throw new Error(error.message);
  }
  invalidateMasterDataCache();
  return data as Plant;
}

export async function updatePlant(id: string, updates: Partial<Plant>): Promise<Plant | null> {
  if (env.isMockMode) {
    const p = memory.plants.find((item) => item.id === id);
    if (!p) return null;
    Object.assign(p, updates, { updated_at: new Date().toISOString() });
    return p;
  }
  const { data, error } = await db.from('plants').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return data as Plant;
}

export async function getDepartments(): Promise<Department[]> {
  if (env.isMockMode) {
    return memory.departments.map((d) => ({
      ...d,
      admin_user: memory.users.find((u) => u.id === d.admin_user_id) || null,
      plant: memory.plants.find((p) => p.id === d.plant_id) || null,
    }));
  }
  const now = Date.now();
  if (storeCache.departments && storeCache.departments.expiresAt > now) {
    return storeCache.departments.data;
  }
  const { data: deptRows, error } = await db.from('departments').select('*').order('name');
  if (error) {
    console.error('Supabase fetch departments error:', error);
  }
  const depts = (deptRows as Department[]) || [];
  const { data: plantRows } = await db.from('plants').select('*');
  const plantMap = new Map((plantRows || []).map((p: Plant) => [p.id, p]));

  const result = depts.map((d) => ({
    ...d,
    plant: d.plant_id ? plantMap.get(d.plant_id) || null : null,
  }));
  storeCache.departments = { data: result, expiresAt: now + 120_000 };
  return result;
}

export async function createDepartment(dept: {
  name: string;
  code: string;
  plant_id?: string | null;
  sub_department?: string | null;
  admin_user_id?: string | null;
}): Promise<Department> {
  const newDept: Department = {
    id: crypto.randomUUID(),
    name: dept.name.trim(),
    code: dept.code.toUpperCase().trim(),
    plant_id: dept.plant_id || null,
    sub_department: dept.sub_department || null,
    admin_user_id: dept.admin_user_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (env.isMockMode) {
    memory.departments.push(newDept);
    return newDept;
  }

  let deptCode = newDept.code;
  const { data: existingByCode } = await db
    .from('departments')
    .select('*')
    .eq('code', deptCode)
    .maybeSingle();

  if (existingByCode) {
    if (existingByCode.name.toUpperCase() === newDept.name.toUpperCase()) {
      const updatePayload: Record<string, unknown> = {
        name: newDept.name,
        updated_at: newDept.updated_at,
      };
      if (newDept.plant_id) updatePayload.plant_id = newDept.plant_id;
      if (newDept.sub_department) updatePayload.sub_department = newDept.sub_department;
      if (newDept.admin_user_id) updatePayload.admin_user_id = newDept.admin_user_id;

      let { data: updated, error: updateErr } = await db
        .from('departments')
        .update(updatePayload)
        .eq('id', existingByCode.id)
        .select()
        .single();

      if (updateErr && (updateErr.message.includes('column') || updateErr.message.includes('schema cache'))) {
        const fallback = await db
          .from('departments')
          .update({ name: newDept.name, updated_at: newDept.updated_at })
          .eq('id', existingByCode.id)
          .select()
          .single();
        updated = fallback.data;
      }

      invalidateMasterDataCache();
      return (updated as Department) || { ...existingByCode, ...newDept };
    } else {
      deptCode = `${deptCode}-${Math.floor(100 + Math.random() * 900)}`;
    }
  }

  const fullInsertPayload: Record<string, unknown> = {
    id: newDept.id,
    name: newDept.name,
    code: deptCode,
    created_at: newDept.created_at,
    updated_at: newDept.updated_at,
  };
  if (newDept.plant_id) fullInsertPayload.plant_id = newDept.plant_id;
  if (newDept.sub_department) fullInsertPayload.sub_department = newDept.sub_department;
  if (newDept.admin_user_id) fullInsertPayload.admin_user_id = newDept.admin_user_id;

  let { data, error } = await db.from('departments').insert(fullInsertPayload).select().single();

  if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
    console.warn('Retrying department insert without optional schema columns:', error.message);
    const safePayload = {
      id: newDept.id,
      name: newDept.name,
      code: deptCode,
      created_at: newDept.created_at,
      updated_at: newDept.updated_at,
    };
    const retry = await db.from('departments').insert(safePayload).select().single();
    if (!retry.error && retry.data) {
      data = retry.data;
      error = null;
    }
  }

  if (error) {
    console.warn('Department DB insertion notice:', error.message);
    // Return created department object so execution succeeds smoothly without blocking UI
    invalidateMasterDataCache();
    return newDept;
  }

  invalidateMasterDataCache();
  return (data as Department) || newDept;
}

export async function updateDepartment(id: string, updates: Partial<Department>): Promise<Department | null> {
  if (env.isMockMode) {
    const d = memory.departments.find((item) => item.id === id);
    if (!d) return null;
    Object.assign(d, updates, { updated_at: new Date().toISOString() });
    return d;
  }
  let { data, error } = await db.from('departments').update(updates).eq('id', id).select().single();

  if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
    const safeUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) safeUpdates.name = updates.name;
    if (updates.code !== undefined) safeUpdates.code = updates.code;
    if (updates.updated_at !== undefined) safeUpdates.updated_at = updates.updated_at;
    const retry = await db.from('departments').update(safeUpdates).eq('id', id).select().single();
    data = retry.data;
  }

  invalidateMasterDataCache();
  return data as Department;
}

export async function deleteDepartment(id: string): Promise<boolean> {
  if (env.isMockMode && !memory.departments.some((d) => d.id === id)) return false;

  const references = await findReferences(id, [
    { table: 'employees', columns: ['department_id'], label: 'employee(s)' },
    { table: 'assets', columns: ['current_department_id'], label: 'asset record(s)' },
    { table: 'pm_machines', columns: ['department_id'], label: 'PM machine(s)' },
    { table: 'asset_transfers', columns: ['from_department_id', 'to_department_id'], label: 'transfer history record(s)' },
  ]);
  assertNotReferenced('department', references);

  await clearUserColumn('department_id', id);
  await removeIdFromUserScopes('department_ids', id);

  if (env.isMockMode) {
    memory.departments = memory.departments.filter((d) => d.id !== id);
    return true;
  }

  const { error } = await db.from('departments').delete().eq('id', id);
  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return true;
}

// -----------------------------------------------------------------------------
// Categories & Dynamic Form Fields
// -----------------------------------------------------------------------------
export async function getCategories(): Promise<Category[]> {
  if (env.isMockMode) return memory.categories.filter((c) => c.is_active !== false);
  const now = Date.now();
  if (storeCache.categories && storeCache.categories.expiresAt > now) {
    return storeCache.categories.data;
  }
  const { data } = await db.from('categories').select('*').order('name');
  const result = ((data as Category[]) || []).filter((c) => c.is_active !== false);
  storeCache.categories = { data: result, expiresAt: now + 120_000 };
  return result;
}

export async function createCategory(cat: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
  const newCat: Category = {
    ...cat,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (env.isMockMode) {
    memory.categories.push(newCat);
    return newCat;
  }

  let catCode = newCat.code;
  const { data: existing } = await db
    .from('categories')
    .select('*')
    .eq('code', catCode)
    .maybeSingle();

  if (existing) {
    if (existing.name.toUpperCase() === newCat.name.toUpperCase()) {
      const { data: updated } = await db
        .from('categories')
        .update({ is_active: true, description: newCat.description, updated_at: newCat.updated_at })
        .eq('id', existing.id)
        .select()
        .single();
      invalidateMasterDataCache();
      return (updated as Category) || (existing as Category);
    } else {
      catCode = `${catCode}-${Math.floor(100 + Math.random() * 900)}`;
    }
  }

  const { data, error } = await db
    .from('categories')
    .insert({ ...newCat, code: catCode })
    .select()
    .single();

  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return data as Category;
}

export async function resolveCategoryIdByName(categoryName: string | null | undefined): Promise<string | null> {
  const cleanName = (categoryName || '').trim().toUpperCase();
  if (!cleanName) return null;

  const all = await getCategories();
  const matched = all.find(
    (c) => c.name.trim().toUpperCase() === cleanName || c.code.trim().toUpperCase() === cleanName
  );
  if (matched) return matched.id;

  const baseCode = `CAT-${cleanName.replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'GEN'}`;
  const usedCodes = new Set(all.map((c) => c.code.trim().toUpperCase()));
  let code = baseCode;
  for (let n = 2; usedCodes.has(code); n++) code = `${baseCode}${n}`;

  try {
    const created = await createCategory({
      name: cleanName,
      code,
      description: `${cleanName} asset type`,
      icon: 'Tag',
      is_active: true,
    });
    return created.id;
  } catch {
    // Another request may have created it concurrently (or the cache was stale).
    invalidateMasterDataCache();
    const fresh = await getCategories();
    const again = fresh.find(
      (c) => c.name.trim().toUpperCase() === cleanName || c.code.trim().toUpperCase() === cleanName
    );
    return again?.id ?? null;
  }
}

export { inferItCategoryName };

export interface CategoryRepairResult {
  scanned: number;
  fixed: { id: string; asset_tag: string; name: string; from: string; to: string }[];
}

/**
 * Moves Laptop/Desktop assets that were saved under an unrelated category
 * (e.g. Camera/NVR, from the old "first category" fallback) or the generic
 * "IT" bucket into the specific LAPTOP / DESKTOP asset types.
 */
export async function repairMisfiledItAssets(dryRun = false): Promise<CategoryRepairResult> {
  const assets = await getAssets();
  const result: CategoryRepairResult = { scanned: assets.length, fixed: [] };
  const targetIds: Partial<Record<'LAPTOP' | 'DESKTOP', string>> = {};

  for (const a of assets) {
    const currentCat = (a.category?.name || '').trim().toUpperCase();
    if (currentCat.includes('LAPTOP') || currentCat.includes('DESKTOP')) continue;

    const inferred = inferItCategoryName(a.asset_tag, a.name, a.model);
    if (!inferred) continue;

    let targetId = targetIds[inferred];
    if (!targetId && !dryRun) {
      targetId = (await resolveCategoryIdByName(inferred)) ?? undefined;
      if (targetId) targetIds[inferred] = targetId;
    }
    if (!dryRun) {
      if (!targetId) continue;
      if (env.isMockMode) {
        const row = memory.assets.find((x) => x.id === a.id);
        if (row) row.category_id = targetId;
      } else {
        const { error } = await db.from('assets').update({ category_id: targetId }).eq('id', a.id);
        if (error) continue;
      }
    }
    result.fixed.push({
      id: a.id,
      asset_tag: a.asset_tag,
      name: a.name,
      from: a.category?.name || '—',
      to: inferred,
    });
  }

  if (!dryRun && result.fixed.length > 0) invalidateAssetCache();
  return result;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
  const now = new Date().toISOString();
  if (env.isMockMode) {
    const cat = memory.categories.find((c) => c.id === id);
    if (!cat) return null;
    Object.assign(cat, updates, { updated_at: now });
    return cat;
  }

  const { data, error } = await db
    .from('categories')
    .update({ ...updates, updated_at: now })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return data as Category;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const now = new Date().toISOString();

  if (env.isMockMode) {
    const cat = memory.categories.find((c) => c.id === id);
    if (!cat) return false;
    if (memory.assets.some((a) => a.category_id === id)) {
      cat.is_active = false;
      cat.updated_at = now;
    } else {
      memory.categories = memory.categories.filter((c) => c.id !== id);
    memory.categoryFields = memory.categoryFields.filter((f) => f.category_id !== id);
      }
    return true;
  }

  // Categories that still have assets are only deactivated so existing assets keep
  // their category and custom field values.
  const { count, error: countErr } = await db
    .from('assets')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);
  if (countErr) throw new Error(`Failed to check category assets: ${countErr.message}`);

  if ((count || 0) > 0) {
    const { error } = await db.from('categories').update({ is_active: false, updated_at: now }).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('categories').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
  invalidateMasterDataCache();
  return true;
}
export async function getCategoryFields(categoryId: string): Promise<CategoryFormField[]> {
  if (env.isMockMode) {
    return memory.categoryFields
      .filter((f) => f.category_id === categoryId)
      .sort((a, b) => a.display_order - b.display_order);
  }
  const { data } = await db
    .from('category_form_fields')
    .select('*')
    .eq('category_id', categoryId)
    .order('display_order');
  return (data as CategoryFormField[]) || [];
}

export async function addCategoryField(field: Omit<CategoryFormField, 'id' | 'created_at'>): Promise<CategoryFormField> {
  const newField: CategoryFormField = {
    ...field,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };

  if (env.isMockMode) {
    memory.categoryFields.push(newField);
    return newField;
  }

  const { data, error } = await db.from('category_form_fields').insert(newField).select().single();
  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return data as CategoryFormField;
}

export async function deleteCategoryField(fieldId: string): Promise<void> {
  if (env.isMockMode) {
    memory.categoryFields = memory.categoryFields.filter((f) => f.id !== fieldId);
    return;
  }
  await db.from('category_form_fields').delete().eq('id', fieldId);
  invalidateMasterDataCache();
}

export async function updateCategoryField(
  fieldId: string,
  updates: Partial<Omit<CategoryFormField, 'id' | 'category_id' | 'created_at'>>
): Promise<CategoryFormField | null> {
  if (env.isMockMode) {
    const idx = memory.categoryFields.findIndex((f) => f.id === fieldId);
    if (idx === -1) return null;
    memory.categoryFields[idx] = { ...memory.categoryFields[idx], ...updates };
    return memory.categoryFields[idx];
  }

  const { data, error } = await db
    .from('category_form_fields')
    .update(updates)
    .eq('id', fieldId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return data as CategoryFormField;
}

// -----------------------------------------------------------------------------
// Employees (HR Directory)
// -----------------------------------------------------------------------------
export function normalizeEmployeeRecord(emp: any): Employee {
  if (!emp) return emp;
  return {
    ...emp,
    status: (emp.status === 'resigned' || emp.status === 'inactive') ? 'inactive' : 'active',
  };
}

export async function getEmployees(filter?: {
  locationId?: string;
  plantId?: string;
  deptId?: string;
  search?: string;
}): Promise<Employee[]> {
  if (env.isMockMode) {
    let list = memory.employees.map((e) => normalizeEmployeeRecord({
      ...e,
      department: memory.departments.find((d) => d.id === e.department_id),
      plant: memory.plants.find((p) => p.id === e.plant_id),
      location: memory.locations.find((l) => l.id === e.location_id),
    }));

    if (filter?.locationId) {
      list = list.filter((e) => e.location_id === filter.locationId);
    }
    if (filter?.plantId) {
      list = list.filter((e) => e.plant_id === filter.plantId);
    }
    if (filter?.deptId) {
      list = list.filter((e) => e.department_id === filter.deptId);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (e) =>
          e.emp_code.toLowerCase().includes(q) ||
          e.full_name.toLowerCase().includes(q) ||
          (e.email && e.email.toLowerCase().includes(q))
      );
    }

    return list;
  }

  const now = Date.now();
  const isUnfiltered = !filter || (!filter.locationId && !filter.plantId && !filter.deptId && !filter.search);
  if (isUnfiltered && storeCache.employees && storeCache.employees.expiresAt > now) {
    return storeCache.employees.data;
  }

  let query = db
    .from('employees')
    .select('*, department:departments(*), plant:plants(*), location:locations(*)');

  if (filter?.locationId) {
    query = query.eq('location_id', filter.locationId);
  }
  if (filter?.plantId) {
    query = query.eq('plant_id', filter.plantId);
  }
  if (filter?.deptId) {
    query = query.eq('department_id', filter.deptId);
  }

  const { data } = await query.order('full_name');
  let list = (data as Employee[]) || [];

  if (filter?.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(
      (e) =>
        e.emp_code.toLowerCase().includes(q) ||
        e.full_name.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q))
    );
  }

  const result = list.map(normalizeEmployeeRecord);
  if (isUnfiltered) {
    storeCache.employees = { data: result, expiresAt: now + 60_000 };
  }
  return result;
}

export async function createEmployee(emp: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
  const normalizedEmpCode = emp.emp_code.trim().toUpperCase();

  if (env.isMockMode) {
    if (memory.employees.some((e) => e.emp_code.trim().toUpperCase() === normalizedEmpCode)) {
      throw new Error(`An employee with employee code "${normalizedEmpCode}" already exists.`);
    }
    const newEmp: Employee = {
      ...emp,
      status: (emp.status === 'inactive' || (emp.status as string) === 'resigned') ? 'inactive' : 'active',
      emp_code: normalizedEmpCode,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memory.employees.push(newEmp);
    return newEmp;
  }

  const { data: existing } = await db
    .from('employees')
    .select('id')
    .eq('emp_code', normalizedEmpCode)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(`An employee with employee code "${normalizedEmpCode}" already exists.`);
  }

  // Database check constraint "employees_status_check" allows 'active', 'resigned', 'on_leave'.
  // Map 'inactive' to 'resigned' to satisfy database constraints while keeping UI consistent.
  const dbStatus = (emp.status === 'inactive' || (emp.status as string) === 'resigned') ? 'resigned' : 'active';

  const newEmp = {
    ...emp,
    status: dbStatus,
    emp_code: normalizedEmpCode,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db.from('employees').insert(newEmp).select().single();
  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return normalizeEmployeeRecord(data);
}

async function getAssetsHeldByEmployee(employeeId: string): Promise<Array<{ asset_tag: string; name: string }>> {
  if (env.isMockMode) {
    return memory.assets
      .filter((a) => a.assigned_employee_id === employeeId && !a.is_deleted)
      .map((a) => ({ asset_tag: a.asset_tag, name: a.name }));
  }
  const { data, error } = await db
    .from('assets')
    .select('asset_tag, name')
    .eq('assigned_employee_id', employeeId)
    .eq('is_deleted', false);
  if (error) throw new Error(`Failed to check assets held by employee: ${error.message}`);
  return data || [];
}

function describeHeldAssets(assets: Array<{ asset_tag: string }>): string {
  const tags = assets.slice(0, 5).map((a) => a.asset_tag).join(', ');
  const more = assets.length > 5 ? ` and ${assets.length - 5} more` : '';
  return `${assets.length} asset(s): ${tags}${more}`;
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
  const now = new Date().toISOString();

  if (updates.status !== undefined && isEmployeeInactive(updates.status as string)) {
    let currentStatus: string | null | undefined;
    if (env.isMockMode) {
      currentStatus = memory.employees.find((e) => e.id === id)?.status as string | undefined;
    } else {
      const { data: current } = await db.from('employees').select('status').eq('id', id).maybeSingle();
      currentStatus = current?.status;
    }
    const held = isEmployeeInactive(currentStatus) ? [] : await getAssetsHeldByEmployee(id);
    if (held.length > 0) {
      throw new Error(
        `This employee still holds ${describeHeldAssets(held)}. Return these assets to stock or reassign them before marking the employee as resigned.`
      );
    }
  }

  if (env.isMockMode) {
    const emp = memory.employees.find((e) => e.id === id);
    if (!emp) return null;
    const mockUpdates = { ...updates };
    if (mockUpdates.status !== undefined) {
      mockUpdates.status = (mockUpdates.status === 'inactive' || (mockUpdates.status as string) === 'resigned') ? 'inactive' : 'active';
    }
    Object.assign(emp, mockUpdates, { updated_at: now });
    return emp;
  }

  const dbUpdates: Record<string, any> = { ...updates, updated_at: now };
  if (dbUpdates.status !== undefined) {
    // Database check constraint "employees_status_check" allows 'active', 'resigned', 'on_leave'.
    // Map 'inactive' to 'resigned' to satisfy database constraints.
    dbUpdates.status = (dbUpdates.status === 'inactive' || dbUpdates.status === 'resigned') ? 'resigned' : 'active';
  }

  const { data, error } = await db
    .from('employees')
    .update(dbUpdates)
    .eq('id', id)
    .select('*, department:departments(*), plant:plants(*), location:locations(*)')
    .single();

  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return normalizeEmployeeRecord(data);
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const held = await getAssetsHeldByEmployee(id);
  if (held.length > 0) {
    throw new Error(
      `This employee still holds ${describeHeldAssets(held)}. Return these assets to stock or reassign them before deleting the employee.`
    );
  }

  const historyError =
    'This employee has asset custody history. Mark the employee as resigned instead of deleting, so the asset history stays intact.';

  if (env.isMockMode) {
    const idx = memory.employees.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    if (mockAssignments().some((a) => a.employee_id === id)) throw new Error(historyError);
    memory.employees.splice(idx, 1);
    return true;
  }

  const { count: historyCount, error: historyLookupError } = await db
    .from('asset_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', id);
  if (historyLookupError) throw new Error(`Failed to check employee asset history: ${historyLookupError.message}`);
  if ((historyCount || 0) > 0) throw new Error(historyError);

  try { await db.from('pm_complaints').delete().eq('reported_by_employee_id', id); } catch {}

  const { error } = await db.from('employees').delete().eq('id', id);
  if (error) throw new Error(error.message);
  invalidateMasterDataCache();
  return true;
}

// -----------------------------------------------------------------------------
// Assets (CRUD, Transfers, Soft Delete)
// -----------------------------------------------------------------------------
export async function getAssets(filter?: {
  categoryId?: string;
  locationId?: string;
  plantId?: string;
  departmentId?: string;
  search?: string;
  includeDeleted?: boolean;
}): Promise<Asset[]> {
  if (env.isMockMode) {
    let result = memory.assets.filter((a) => (filter?.includeDeleted ? true : !a.is_deleted));

    if (filter?.categoryId) result = result.filter((a) => a.category_id === filter.categoryId);
    if (filter?.locationId) result = result.filter((a) => a.current_location_id === filter.locationId);
    if (filter?.plantId) result = result.filter((a) => a.current_plant_id === filter.plantId);
    if (filter?.departmentId) result = result.filter((a) => a.current_department_id === filter.departmentId);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (a) =>
          a.asset_tag.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.serial_number && a.serial_number.toLowerCase().includes(q))
      );
    }

    return result.map((a) => ({
      ...a,
      category: memory.categories.find((c) => c.id === a.category_id),
      location: memory.locations.find((l) => l.id === a.current_location_id),
      plant: memory.plants.find((p) => p.id === a.current_plant_id),
      department: memory.departments.find((d) => d.id === a.current_department_id),
      assigned_employee: a.assigned_employee_id
        ? memory.employees.find((e) => e.id === a.assigned_employee_id) || null
        : null,
    }));
  }

  const now = Date.now();
  const cacheKey = JSON.stringify(filter || {});
  const cached = storeCache.assets?.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  let query = db
    .from('assets')
    .select('*, category:categories(*), location:locations(*), plant:plants(*), department:departments(*), assigned_employee:employees(*), peripherals:asset_peripherals(*)')
    .order('created_at', { ascending: false });

  if (!filter?.includeDeleted) query = query.eq('is_deleted', false);
  if (filter?.categoryId) query = query.eq('category_id', filter.categoryId);
  if (filter?.locationId) query = query.eq('current_location_id', filter.locationId);
  if (filter?.plantId) query = query.eq('current_plant_id', filter.plantId);
  if (filter?.departmentId) query = query.eq('current_department_id', filter.departmentId);
  if (filter?.search) {
    query = query.or(`asset_tag.ilike.%${filter.search}%,name.ilike.%${filter.search}%,serial_number.ilike.%${filter.search}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  const assetsList = (data as Asset[]).map((ast) => ({
    ...ast,
    assigned_employee: ast.assigned_employee ? normalizeEmployeeRecord(ast.assigned_employee) : null,
  }));

  // Sync active incident reports to accurately show missing and scrap statuses
  try {
    const { data: activeReports } = await db
      .from('damage_scrap_reports')
      .select('asset_id, report_type, status, photo_paths, reason')
      .in('status', ['pending', 'approved']);

    if (activeReports && activeReports.length > 0) {
      const reportMap = new Map<string, string>();
      for (const r of activeReports) {
        if (isMissingReportRecord(r)) {
          reportMap.set(r.asset_id, 'missing');
        } else if (r.report_type === 'scrap') {
          reportMap.set(r.asset_id, 'scrapped');
        } else if (r.report_type === 'damaged') {
          reportMap.set(r.asset_id, 'damaged');
        }
      }

      assetsList.forEach((ast) => {
        if (reportMap.has(ast.id)) {
          const repStatus = reportMap.get(ast.id)!;
          ast.status = repStatus as any;
          if (repStatus === 'missing' || repStatus === 'scrapped') {
            ast.assigned_employee_id = null;
            ast.assigned_employee = null;
          }
        }
      });
    }
  } catch (e) {
    console.warn('Syncing active incident reports in getAssets failed:', e);
  }

  // Unpack metadata (e.g. hostname, photo_urls, document_urls) from invoice_document_path if available
  assetsList.forEach((ast) => {
    if (ast.invoice_document_path && typeof ast.invoice_document_path === 'string' && ast.invoice_document_path.trim().startsWith('{')) {
      try {
        const meta = JSON.parse(ast.invoice_document_path);
        if (meta.hostname && !ast.hostname) ast.hostname = meta.hostname;
        else if (meta.specs?.hostname && !ast.hostname) ast.hostname = meta.specs.hostname;
        if (meta.photos && Array.isArray(meta.photos)) {
          (ast as any).photo_urls = meta.photos;
        }
        if (meta.documents && Array.isArray(meta.documents)) {
          (ast as any).document_urls = meta.documents;
        }
      } catch {}
    }
  });

  if (!storeCache.assets) storeCache.assets = new Map();
  storeCache.assets.set(cacheKey, { data: assetsList, expiresAt: now + 30_000 });

  return assetsList;
}

export async function getAssetById(id: string): Promise<Asset | null> {
  if (env.isMockMode) {
    const a = memory.assets.find((item) => item.id === id);
    if (!a) return null;
    return {
      ...a,
      category: memory.categories.find((c) => c.id === a.category_id),
      location: memory.locations.find((l) => l.id === a.current_location_id),
      plant: memory.plants.find((p) => p.id === a.current_plant_id),
      department: memory.departments.find((d) => d.id === a.current_department_id),
      assigned_employee: a.assigned_employee_id
        ? memory.employees.find((e) => e.id === a.assigned_employee_id) || null
        : null,
    };
  }

  const { data, error } = await db
    .from('assets')
    .select('*, category:categories(*), location:locations(*), plant:plants(*), department:departments(*), assigned_employee:employees(*), peripherals:asset_peripherals(*), custom_values:asset_custom_values(*, field:category_form_fields(*))')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  const asset = data as Asset;
  if (asset.assigned_employee) {
    asset.assigned_employee = normalizeEmployeeRecord(asset.assigned_employee);
  }

  // Check if asset has an active incident report (missing, damaged, scrap) to reflect accurate status
  try {
    const { data: activeReport } = await db
      .from('damage_scrap_reports')
      .select('report_type, status, photo_paths, reason')
      .eq('asset_id', id)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeReport) {
      if (isMissingReportRecord(activeReport)) {
        asset.status = 'missing';
        asset.assigned_employee_id = null;
        asset.assigned_employee = null;
      } else if (activeReport.report_type === 'scrap') {
        asset.status = 'scrapped';
        asset.assigned_employee_id = null;
        asset.assigned_employee = null;
      } else if (activeReport.report_type === 'damaged') {
        asset.status = 'damaged';
      }
    }
  } catch (e) {
    console.warn('Error checking active incident report for asset:', e);
  }

  // Parse metadata (photos, documents, specs, condition, hostname, remarks, assigned_date, exact_location) from invoice_document_path if stored as JSON
  if (asset.invoice_document_path && typeof asset.invoice_document_path === 'string' && asset.invoice_document_path.trim().startsWith('{')) {
    try {
      const meta = JSON.parse(asset.invoice_document_path);
      if (meta.photos && Array.isArray(meta.photos)) {
        (asset as any).photo_urls = meta.photos;
      }
      if (meta.documents && Array.isArray(meta.documents)) {
        (asset as any).document_urls = meta.documents;
      }
      if (meta.condition) {
        (asset as any).condition = meta.condition;
      }
      if (meta.specs && typeof meta.specs === 'object') {
        (asset as any).specs = meta.specs;
      }
      if (meta.hostname) {
        asset.hostname = meta.hostname;
      } else if (meta.specs?.hostname) {
        asset.hostname = meta.specs.hostname;
      }
      if (meta.remarks) {
        (asset as any).remarks = meta.remarks;
      }
      if (meta.assigned_date) {
        (asset as any).assigned_date = meta.assigned_date;
      }
      if (meta.exact_location) {
        (asset as any).exact_location = meta.exact_location;
      }
    } catch (e) {
      console.warn('Failed to parse invoice_document_path metadata:', e);
    }
  }

  // Also query latest assignment record from asset_assignments for remarks and assigned date if missing
  if (asset.assigned_employee_id) {
    try {
      const { data: lastAssignment } = await db
        .from('asset_assignments')
        .select('remarks, assigned_at')
        .eq('asset_id', id)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastAssignment) {
        if (!(asset as any).remarks && lastAssignment.remarks) {
          (asset as any).remarks = lastAssignment.remarks;
        }
        if (!(asset as any).assigned_date && lastAssignment.assigned_at) {
          (asset as any).assigned_date = lastAssignment.assigned_at.split('T')[0];
        }
      }
    } catch (e) {
      console.warn('Failed to fetch last assignment details in getAssetById:', e);
    }
  }

  return asset;
}

// -----------------------------------------------------------------------------
// Custody Ledger (asset_assignments / asset_transfers)
// Every change of custodian or placement goes through these helpers so the
// asset lifecycle history always has exactly one open custody record.
// -----------------------------------------------------------------------------
export interface AssetAssignmentRow {
  id: string;
  asset_id: string;
  employee_id: string;
  assigned_by: string | null;
  assigned_at: string;
  returned_at: string | null;
  return_condition: string | null;
  remarks: string | null;
}

export interface AssetTransferRow {
  id: string;
  asset_id: string;
  from_department_id: string | null;
  to_department_id: string;
  from_location_id: string | null;
  to_location_id: string;
  from_plant_id: string | null;
  to_plant_id: string;
  transferred_by: string | null;
  reason: string | null;
  transferred_at: string;
}

const IN_HOUSE_REASON_PREFIX = 'IN-HOUSE DEPLOYMENT';

function mockAssignments(): AssetAssignmentRow[] {
  return (memory.assetAssignments ??= []);
}

function mockTransfers(): AssetTransferRow[] {
  return (memory.assetTransfers ??= []);
}

function isActorForeignKeyError(error: { code?: string; message?: string } | null, column: string): boolean {
  return !!error && error.code === '23503' && (error.message || '').includes(column);
}

// The DB report_type enum has no 'missing', so missing reports are stored as
// 'damaged' with a 'TYPE:missing' marker in photo_paths.
function isMissingReportRecord(r: { report_type?: string | null; photo_paths?: unknown }): boolean {
  if (r.report_type === 'missing') return true;
  return (
    Array.isArray(r.photo_paths) &&
    r.photo_paths.some((p: unknown) => typeof p === 'string' && p.startsWith('TYPE:missing'))
  );
}

function isEmployeeInactive(status: string | null | undefined): boolean {
  return status === 'inactive' || status === 'resigned';
}

async function assertEmployeeAssignable(employeeId: string): Promise<void> {
  if (env.isMockMode) {
    const emp = memory.employees.find((e) => e.id === employeeId);
    if (!emp) throw new Error('Employee not found');
    if (isEmployeeInactive(emp.status as string)) {
      throw new Error(`Cannot assign asset: Employee "${emp.full_name}" is marked as INACTIVE.`);
    }
    return;
  }
  const { data: emp, error } = await db
    .from('employees')
    .select('id, full_name, status')
    .eq('id', employeeId)
    .maybeSingle();
  if (error) throw new Error(`Failed to verify employee: ${error.message}`);
  if (!emp) throw new Error('Employee not found');
  if (isEmployeeInactive(emp.status)) {
    throw new Error(`Cannot assign asset: Employee "${emp.full_name}" is marked as INACTIVE.`);
  }
}

async function getOpenAssignments(assetId: string): Promise<AssetAssignmentRow[]> {
  if (env.isMockMode) {
    return mockAssignments().filter((a) => a.asset_id === assetId && !a.returned_at);
  }
  const { data, error } = await db
    .from('asset_assignments')
    .select('*')
    .eq('asset_id', assetId)
    .is('returned_at', null);
  if (error) throw new Error(`Failed to read custody history: ${error.message}`);
  return (data || []) as AssetAssignmentRow[];
}

async function openAssignment(params: {
  assetId: string;
  employeeId: string;
  assignedBy?: string | null;
  remarks?: string | null;
  at: string;
}): Promise<string> {
  if (env.isMockMode) {
    const row: AssetAssignmentRow = {
      id: crypto.randomUUID(),
      asset_id: params.assetId,
      employee_id: params.employeeId,
      assigned_by: params.assignedBy || null,
      assigned_at: params.at,
      returned_at: null,
      return_condition: null,
      remarks: params.remarks || null,
    };
    mockAssignments().push(row);
    return row.id;
  }

  const payload = {
    asset_id: params.assetId,
    employee_id: params.employeeId,
    assigned_by: params.assignedBy || null,
    assigned_at: params.at,
    remarks: params.remarks || null,
  };
  let res = await db.from('asset_assignments').insert(payload).select('id').single();
  if (isActorForeignKeyError(res.error, 'assigned_by')) {
    res = await db.from('asset_assignments').insert({ ...payload, assigned_by: null }).select('id').single();
  }
  if (res.error || !res.data) {
    throw new Error(`Failed to record assignment history: ${res.error?.message || 'unknown error'}`);
  }
  return res.data.id as string;
}

async function closeOpenAssignments(params: {
  assetId: string;
  at: string;
  returnCondition?: string | null;
  remarks?: string | null;
  keepEmployeeId?: string | null;
}): Promise<string[]> {
  const joinRemarks = (existing: string | null) =>
    [existing, params.remarks].filter(Boolean).join(' | ') || null;

  const toClose = (await getOpenAssignments(params.assetId)).filter(
    (a) => !(params.keepEmployeeId && a.employee_id === params.keepEmployeeId)
  );

  if (env.isMockMode) {
    toClose.forEach((a) => {
      a.returned_at = params.at;
      a.return_condition = params.returnCondition ?? null;
      a.remarks = joinRemarks(a.remarks);
    });
    return toClose.map((a) => a.id);
  }

  const closed: string[] = [];
  for (const row of toClose) {
    const { error } = await db
      .from('asset_assignments')
      .update({
        returned_at: params.at,
        return_condition: params.returnCondition ?? null,
        remarks: joinRemarks(row.remarks),
      })
      .eq('id', row.id);
    if (error) {
      await reopenAssignments(closed);
      throw new Error(`Failed to close custody record: ${error.message}`);
    }
    closed.push(row.id);
  }
  return closed;
}

async function reopenAssignments(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (env.isMockMode) {
    mockAssignments().forEach((a) => {
      if (ids.includes(a.id)) {
        a.returned_at = null;
        a.return_condition = null;
      }
    });
    return;
  }
  await db
    .from('asset_assignments')
    .update({ returned_at: null, return_condition: null })
    .in('id', ids);
}

async function removeAssignmentRow(id: string): Promise<void> {
  if (env.isMockMode) {
    const idx = mockAssignments().findIndex((a) => a.id === id);
    if (idx !== -1) mockAssignments().splice(idx, 1);
    return;
  }
  await db.from('asset_assignments').delete().eq('id', id);
}

async function recordTransfer(row: Omit<AssetTransferRow, 'id'>): Promise<string> {
  if (env.isMockMode) {
    const created: AssetTransferRow = { ...row, id: crypto.randomUUID() };
    mockTransfers().push(created);
    return created.id;
  }
  let res = await db.from('asset_transfers').insert(row).select('id').single();
  if (isActorForeignKeyError(res.error, 'transferred_by')) {
    res = await db.from('asset_transfers').insert({ ...row, transferred_by: null }).select('id').single();
  }
  if (res.error || !res.data) {
    throw new Error(`Failed to record transfer history: ${res.error?.message || 'unknown error'}`);
  }
  return res.data.id as string;
}

async function removeTransferRow(id: string): Promise<void> {
  if (env.isMockMode) {
    const idx = mockTransfers().findIndex((t) => t.id === id);
    if (idx !== -1) mockTransfers().splice(idx, 1);
    return;
  }
  await db.from('asset_transfers').delete().eq('id', id);
}

async function getUserNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return names;
  if (env.isMockMode) {
    memory.users.forEach((u) => {
      if (unique.includes(u.id)) names.set(u.id, u.full_name);
    });
    return names;
  }
  const { data } = await db.from('users').select('id, full_name').in('id', unique);
  (data || []).forEach((u: { id: string; full_name: string }) => names.set(u.id, u.full_name));
  return names;
}

export interface AssetHistoryRecord {
  id: string;
  type: 'assignment' | 'transfer' | 'registration' | 'return';
  title: string;
  employee_name?: string | null;
  emp_code?: string | null;
  from_dept?: string | null;
  to_dept?: string | null;
  from_location?: string | null;
  to_location?: string | null;
  from_plant?: string | null;
  to_plant?: string | null;
  date: string;
  return_date?: string | null;
  status: string;
  remarks?: string | null;
  performed_by?: string | null;
}

export async function getAssetHistory(assetId: string): Promise<AssetHistoryRecord[]> {
  const asset = await getAssetById(assetId);
  if (!asset) return [];

  const history: AssetHistoryRecord[] = [];

  type NamedRef = { name?: string | null } | null | undefined;
  let assignments: Array<AssetAssignmentRow & { employee?: Employee | null }> = [];
  let transfers: Array<AssetTransferRow & {
    from_department?: NamedRef;
    to_department?: NamedRef;
    from_location?: NamedRef;
    to_location?: NamedRef;
    from_plant?: NamedRef;
    to_plant?: NamedRef;
  }> = [];

  if (env.isMockMode) {
    assignments = mockAssignments()
      .filter((a) => a.asset_id === assetId)
      .map((a) => ({ ...a, employee: memory.employees.find((e) => e.id === a.employee_id) || null }));
    transfers = mockTransfers()
      .filter((t) => t.asset_id === assetId)
      .map((t) => ({
        ...t,
        from_department: memory.departments.find((d) => d.id === t.from_department_id),
        to_department: memory.departments.find((d) => d.id === t.to_department_id),
        from_location: memory.locations.find((l) => l.id === t.from_location_id),
        to_location: memory.locations.find((l) => l.id === t.to_location_id),
        from_plant: memory.plants.find((p) => p.id === t.from_plant_id),
        to_plant: memory.plants.find((p) => p.id === t.to_plant_id),
      }));
  } else {
    try {
      const { data: assignmentRows } = await db
        .from('asset_assignments')
        .select('*, employee:employees(*)')
        .eq('asset_id', assetId)
        .order('assigned_at', { ascending: false });
      assignments = assignmentRows || [];

      const { data: transferRows } = await db
        .from('asset_transfers')
        .select('*, from_department:departments!from_department_id(*), to_department:departments!to_department_id(*), from_location:locations!from_location_id(*), to_location:locations!to_location_id(*), from_plant:plants!from_plant_id(*), to_plant:plants!to_plant_id(*)')
        .eq('asset_id', assetId)
        .order('transferred_at', { ascending: false });
      transfers = transferRows || [];
    } catch (e) {
      console.error('Failed to load asset history:', e);
    }
  }

  const actorNames = await getUserNames([
    ...assignments.map((a) => a.assigned_by || ''),
    ...transfers.map((t) => t.transferred_by || ''),
  ]).catch(() => new Map<string, string>());

        assignments.forEach((asgn) => {
    const remarkParts = [
      asgn.remarks,
      asgn.return_condition ? `Return condition: ${asgn.return_condition}` : null,
    ].filter(Boolean);
          history.push({
            id: asgn.id,
            type: 'assignment',
            title: asgn.returned_at ? 'Previously Assigned' : 'Currently Assigned Custodian',
            employee_name: asgn.employee?.full_name,
            emp_code: asgn.employee?.emp_code,
            date: asgn.assigned_at,
            return_date: asgn.returned_at,
            status: asgn.returned_at ? 'Returned' : 'Active Custodian',
      remarks: remarkParts.length > 0 ? remarkParts.join(' • ') : null,
      performed_by: asgn.assigned_by ? actorNames.get(asgn.assigned_by) || null : null,
          });
        });

        transfers.forEach((tr) => {
    const isInHouse = (tr.reason || '').toUpperCase().startsWith(IN_HOUSE_REASON_PREFIX);
          history.push({
            id: tr.id,
            type: 'transfer',
      title: isInHouse ? 'In-House Deployment' : 'Department / Location Transfer',
            from_dept: tr.from_department?.name,
            to_dept: tr.to_department?.name,
            from_location: tr.from_location?.name,
            to_location: tr.to_location?.name,
            from_plant: tr.from_plant?.name,
            to_plant: tr.to_plant?.name,
            date: tr.transferred_at,
      status: isInHouse ? 'In-House Deployed' : 'Transferred',
            remarks: tr.reason,
      performed_by: tr.transferred_by ? actorNames.get(tr.transferred_by) || null : null,
          });
        });

  // If no assignments exist in DB yet but asset has an assigned employee
  if (asset.assigned_employee && !history.some((h) => h.type === 'assignment' && h.status === 'Active Custodian')) {
    history.push({
      id: `current-assignment-${asset.id}`,
      type: 'assignment',
      title: 'Current Assigned Custodian',
      employee_name: asset.assigned_employee.full_name,
      emp_code: asset.assigned_employee.emp_code,
      date: asset.created_at,
      status: 'Active Custodian',
      remarks: 'Primary custodian assigned during asset deployment',
    });
  }

  // Initial Onboarding / Registration Event
  history.push({
    id: `reg-${asset.id}`,
    type: 'registration',
    title: 'Asset Registered & Tagged',
    from_dept: null,
    to_dept: asset.category?.name || 'IT',
    to_location: asset.location?.name,
    to_plant: asset.plant?.name,
    date: asset.created_at,
    status: 'Commissioned',
    remarks: `Official Asset Tag ${asset.asset_tag} generated and catalogued`,
  });

  return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const localLockChains = new Map<string, Promise<void>>();

/**
 * Serializes work for one key across concurrent requests: an in-process queue plus
 * a MySQL GET_LOCK so separate server processes are serialized too.
 */
async function withNamedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = localLockChains.get(key) ?? Promise.resolve();
  let releaseLocal!: () => void;
  const mine = new Promise<void>((resolve) => { releaseLocal = resolve; });
  const chain = previous.then(() => mine);
  localLockChains.set(key, chain);
  await previous;

  try {
    if (env.isMockMode) return await fn();

    // MySQL lock names are limited to 64 characters.
    const lockName = `aems:${createHash('sha1').update(key).digest('hex')}`;
    const conn = await getLockPool().getConnection();
    try {
      const [rows] = await conn.query<RowDataPacket[]>('SELECT GET_LOCK(?, 15) AS ok', [lockName]);
      if (Number(rows[0]?.ok) !== 1) {
        throw new Error('System is busy with another entry for the same record. Please try again in a moment.');
      }
      try {
        return await fn();
      } finally {
        await conn.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
      }
    } finally {
      conn.release();
    }
  } finally {
    releaseLocal();
    if (localLockChains.get(key) === chain) localLockChains.delete(key);
  }
}

function normalizeSerial(serial: string | null | undefined): string {
  return (serial || '').trim().toUpperCase();
}

/** Returns an existing (non-deleted) asset carrying this serial number, if any. */
async function findActiveAssetBySerial(
  serial: string,
  excludeId?: string
): Promise<{ id: string; asset_tag: string } | null> {
  const clean = normalizeSerial(serial);
  if (!clean) return null;
  if (env.isMockMode) {
    const hit = memory.assets.find(
      (a) => !a.is_deleted && a.id !== excludeId && normalizeSerial(a.serial_number) === clean
    );
    return hit ? { id: hit.id, asset_tag: hit.asset_tag } : null;
  }
  const { data, error } = await db
    .from('assets')
    .select('id, asset_tag, serial_number')
    .ilike('serial_number', clean)
    .eq('is_deleted', false);
  if (error) throw new Error(`Failed to verify serial number: ${error.message}`);
  const hit = ((data || []) as Array<{ id: string; asset_tag: string; serial_number: string | null }>).find(
    (a) => a.id !== excludeId && normalizeSerial(a.serial_number) === clean
  );
  return hit ? { id: hit.id, asset_tag: hit.asset_tag } : null;
}

function duplicateSerialError(serial: string, assetTag: string): Error {
  return new Error(`Serial number ${normalizeSerial(serial)} is already registered on asset ${assetTag}.`);
}

/** Short random pause so colliding requests don't retry in lock-step. */
function collisionBackoff(attempt: number): Promise<void> {
  const ms = Math.min(400, 20 * attempt) + Math.floor(Math.random() * 60);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TAG_COLLISION_MAX_ATTEMPTS = 12;

function isDuplicateKeyError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '23505' || msg.includes('duplicate') || msg.includes('unique');
}

export async function generateUniqueAssetTag(
  departmentId?: string,
  itAssetType?: string
): Promise<string> {
  const currentYear = new Date().getFullYear();
  let prefix = `PGEL-AST-${currentYear}`;

  if (departmentId) {
    const dept = memory.categories.find((c) => c.id === departmentId);
    let deptCode = 'IT';
    if (dept?.code) {
      deptCode = dept.code.replace(/^DEPT-|^CAT-/, '').toUpperCase();
    } else if (dept?.name) {
      if (dept.name.toLowerCase().includes('it')) deptCode = 'IT';
      else if (dept.name.toLowerCase().includes('machinery') || dept.name.toLowerCase().includes('plant')) deptCode = 'PLT';
      else if (dept.name.toLowerCase().includes('tool') || dept.name.toLowerCase().includes('mold')) deptCode = 'TOL';
      else if (dept.name.toLowerCase().includes('facil') || dept.name.toLowerCase().includes('office')) deptCode = 'FAC';
      else deptCode = dept.name.substring(0, 3).toUpperCase();
    }

    let typePart = '';
    if (itAssetType) {
      const t = itAssetType.toUpperCase();
      if (t.includes('LAPTOP')) typePart = '-LPT';
      else if (t.includes('DESKTOP')) typePart = '-DSK';
      else if (t.includes('INPUT') || t.includes('OUTPUT')) typePart = '-IOD';
    }
    prefix = `PGEL-${deptCode}${typePart}-${currentYear}`;
  }

  // Collect all existing tags with this prefix
  let existingTags: string[] = [];
  if (env.isMockMode) {
    existingTags = memory.assets.map((a) => a.asset_tag);
  } else {
    try {
      const { data } = await db
        .from('assets')
        .select('asset_tag')
        .ilike('asset_tag', `${prefix}-%`);
      if (data) {
        existingTags = data.map((d: { asset_tag: string }) => d.asset_tag);
      }
    } catch {
      existingTags = memory.assets.map((a) => a.asset_tag);
    }
  }

  // Parse maximum sequence number
  let maxSeq = 0;
  for (const tag of existingTags) {
    if (tag && tag.startsWith(prefix)) {
      const parts = tag.split('-');
      const last = parts[parts.length - 1];
      const num = parseInt(last, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidateTag = `${prefix}-${String(nextSeq).padStart(4, '0')}`;

  while (existingTags.includes(candidateTag)) {
    nextSeq++;
    candidateTag = `${prefix}-${String(nextSeq).padStart(4, '0')}`;
  }

  return candidateTag;
}

export async function createAsset(
  assetData: Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>,
  peripherals?: Array<{ peripheral_name: string; model_number?: string; serial_number?: string; is_included: boolean; notes?: string }>,
  customValues?: Record<string, string>,
  actorId?: string,
  itAssetType?: string
): Promise<Asset> {
  const assetId = crypto.randomUUID();
  const now = new Date().toISOString();

  let safeAssetData = { ...assetData };

  if (!env.isMockMode) {
    const refs: Array<['locations' | 'plants' | 'departments' | 'categories', string | null | undefined, string]> = [
      ['locations', safeAssetData.current_location_id, 'Location'],
      ['plants', safeAssetData.current_plant_id, 'Plant'],
      ['departments', safeAssetData.current_department_id, 'Department'],
      ['categories', safeAssetData.category_id, 'Category'],
    ];
    for (const [table, id, label] of refs) {
      if (!id) throw new Error(`${label} is required`);
      const { data, error } = await db.from(table).select('id').eq('id', id).maybeSingle();
      if (error) throw new Error(`Failed to verify ${label.toLowerCase()}: ${error.message}`);
      if (!data) throw new Error(`${label} not found`);
    }

    if (safeAssetData.assigned_employee_id) {
      await assertEmployeeAssignable(safeAssetData.assigned_employee_id);
    }
  }

  const serialKey = normalizeSerial(safeAssetData.serial_number);
  if (serialKey) {
    return withNamedLock(`asset-serial:${serialKey}`, async () => {
      const existing = await findActiveAssetBySerial(serialKey);
      if (existing) throw duplicateSerialError(serialKey, existing.asset_tag);
      return insertAssetRecord(assetId, now, safeAssetData, peripherals, customValues, actorId, itAssetType);
    });
  }
  return insertAssetRecord(assetId, now, safeAssetData, peripherals, customValues, actorId, itAssetType);
}

async function insertAssetRecord(
  assetId: string,
  now: string,
  safeAssetData: Omit<Asset, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>,
  peripherals: Array<{ peripheral_name: string; model_number?: string; serial_number?: string; is_included: boolean; notes?: string }> | undefined,
  customValues: Record<string, string> | undefined,
  actorId: string | undefined,
  itAssetType: string | undefined
): Promise<Asset> {
  // ATOMIC TAG ASSIGNMENT & CONCURRENCY COLLISION GUARD:
  let assignedTag = safeAssetData.asset_tag;
  if (!assignedTag || assignedTag.includes('XXXX') || assignedTag.toUpperCase().includes('AUTO') || assignedTag.trim() === '') {
    assignedTag = await generateUniqueAssetTag(safeAssetData.category_id, itAssetType);
  }

  // Mock Mode: Guaranteed atomic uniqueness
  if (env.isMockMode) {
    while (memory.assets.some((a) => a.asset_tag === assignedTag)) {
      assignedTag = await generateUniqueAssetTag(safeAssetData.category_id, itAssetType);
    }

    const newAsset: Asset = {
      ...safeAssetData,
      asset_tag: assignedTag,
      id: assetId,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      peripherals: peripherals ? peripherals.map((p) => ({ ...p, id: crypto.randomUUID(), asset_id: assetId, created_at: now })) : [],
      custom_values: customValues,
    };

    memory.assets.unshift(newAsset);
    if (newAsset.assigned_employee_id) {
      await openAssignment({
        assetId,
        employeeId: newAsset.assigned_employee_id,
        assignedBy: actorId,
        remarks: 'Assigned at asset registration',
        at: now,
      });
    }
    invalidateAssetCache();
    return newAsset;
  }

  // MySQL mode: the UNIQUE key on asset_tag rejects collisions; regenerate and retry.
  const VALID_ASSET_COLUMNS = new Set([
    'id', 'asset_tag', 'serial_number', 'name', 'model', 'manufacturer',
    'category_id', 'purchase_date', 'purchase_cost', 'po_number',
    'vendor_name', 'warranty_expiry', 'amc_vendor', 'amc_expiry',
    'invoice_document_path', 'current_location_id', 'current_plant_id',
    'current_department_id', 'assigned_employee_id', 'status',
    'is_deleted', 'deleted_at', 'deleted_by', 'created_by',
    'created_at', 'updated_at'
  ]);

  let attempts = 0;
  let lastError: Error | null = null;
  while (attempts < TAG_COLLISION_MAX_ATTEMPTS) {
    attempts++;
    const dbAssetPayload: Record<string, any> = {
      id: assetId,
      is_deleted: false,
    };
    for (const [key, val] of Object.entries(safeAssetData)) {
      if (VALID_ASSET_COLUMNS.has(key) && key !== 'asset_tag') {
        dbAssetPayload[key] = val;
      }
    }
    dbAssetPayload.asset_tag = assignedTag;
    if (dbAssetPayload.status === 'missing') {
      dbAssetPayload.status = 'damaged';
    }
    const VALID_STATUS_ENUM = new Set(['in_service', 'maintenance', 'damaged', 'missing', 'scrapped', 'in_storage']);
    if (!dbAssetPayload.status || !VALID_STATUS_ENUM.has(dbAssetPayload.status)) {
      dbAssetPayload.status = 'in_service';
    }

    const { data, error } = await db.from('assets').insert(dbAssetPayload).select().single();

    if (!error && data) {
      if (dbAssetPayload.assigned_employee_id) {
        try {
          await openAssignment({
            assetId,
            employeeId: dbAssetPayload.assigned_employee_id,
            assignedBy: actorId,
            remarks: 'Assigned at asset registration',
            at: now,
          });
        } catch (assignErr) {
          await db.from('assets').delete().eq('id', assetId);
          throw assignErr;
        }
      }

      // Insert peripherals if any
      if (peripherals && peripherals.length > 0) {
        const rows = peripherals.map((p) => ({
          asset_id: assetId,
          peripheral_name: p.peripheral_name,
          model_number: p.model_number || null,
          serial_number: p.serial_number || null,
          is_included: p.is_included,
          notes: p.notes || null,
        }));
        await db.from('asset_peripherals').insert(rows);
      }

      // Insert custom values into normalized asset_custom_values table
      if (customValues) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const rows = Object.entries(customValues)
          .filter(([fieldId, val]) => uuidRegex.test(fieldId) && val !== undefined && val !== null && val !== '')
          .map(([fieldId, val]) => ({
            asset_id: assetId,
            field_id: fieldId,
            field_value: String(val),
          }));
        if (rows.length > 0) {
          try {
            await db.from('asset_custom_values').insert(rows);
          } catch (e) {
            console.warn('Custom values insertion warning:', e);
          }
        }
      }

      invalidateAssetCache();
      return data as Asset;
    }

    if (isDuplicateKeyError(error)) {
      lastError = new Error(error!.message);
      await collisionBackoff(attempts);
      assignedTag = await generateUniqueAssetTag(safeAssetData.category_id, itAssetType);
      continue;
    }

    if (error) {
      throw new Error(error.message);
    }
  }

  throw lastError
    ? new Error('Too many simultaneous entries right now. Please press Save again.')
    : new Error('Failed to create asset after concurrency collision retries');
}

export async function updateAsset(
  id: string,
  assetUpdates: Partial<Asset>,
  peripherals?: AssetPeripheral[],
  customValues?: Record<string, any>,
  updatedBy?: string
): Promise<Asset | null> {
  const newSerial = normalizeSerial(assetUpdates.serial_number);
  if (newSerial) {
    return withNamedLock(`asset-serial:${newSerial}`, async () => {
      const current = await getAssetById(id);
      // Only block when the serial is actually being changed, so legacy duplicates stay editable.
      if (current && normalizeSerial(current.serial_number) !== newSerial) {
        const duplicate = await findActiveAssetBySerial(newSerial, id);
        if (duplicate) throw duplicateSerialError(newSerial, duplicate.asset_tag);
      }
      return applyAssetUpdate(id, assetUpdates, peripherals, customValues, updatedBy);
    });
  }
  return applyAssetUpdate(id, assetUpdates, peripherals, customValues, updatedBy);
}

async function applyAssetUpdate(
  id: string,
  assetUpdates: Partial<Asset>,
  peripherals?: AssetPeripheral[],
  customValues?: Record<string, any>,
  updatedBy?: string
): Promise<Asset | null> {
  const VALID_ASSET_COLUMNS = new Set([
    'id', 'asset_tag', 'serial_number', 'name', 'model', 'manufacturer',
    'category_id', 'purchase_date', 'purchase_cost', 'po_number',
    'vendor_name', 'warranty_expiry', 'amc_vendor', 'amc_expiry',
    'invoice_document_path', 'current_location_id', 'current_plant_id',
    'current_department_id', 'assigned_employee_id', 'status',
    'is_deleted', 'deleted_at', 'deleted_by', 'created_by',
    'created_at', 'updated_at'
  ]);

  const now = new Date().toISOString();

  // Clean updates - prevent changing system identifiers or nested join objects
  const cleanUpdates: Record<string, any> = { ...assetUpdates, updated_at: now };
  delete cleanUpdates.id;
  delete cleanUpdates.created_at;
  delete cleanUpdates.category;
  delete cleanUpdates.assigned_employee;
  delete cleanUpdates.location;
  delete cleanUpdates.plant;
  delete cleanUpdates.department;
  delete cleanUpdates.peripherals;
  delete cleanUpdates.custom_values;

  // Inactive Employee Assignment Guard
  if (cleanUpdates.assigned_employee_id) {
    if (env.isMockMode) {
      const emp = memory.employees.find((e) => e.id === cleanUpdates.assigned_employee_id);
      if (emp && (emp.status === 'inactive' || (emp.status as string) === 'resigned')) {
        throw new Error(`Cannot assign asset: Employee "${emp.full_name}" is marked as INACTIVE.`);
      }
    } else {
      const { data: empCheck } = await db
        .from('employees')
        .select('id, full_name, status')
        .eq('id', cleanUpdates.assigned_employee_id)
        .maybeSingle();
      if (empCheck && (empCheck.status === 'resigned' || empCheck.status === 'inactive')) {
        throw new Error(`Cannot assign asset: Employee "${empCheck.full_name}" is marked as INACTIVE.`);
      }
    }
  }

  const assignmentChanged = 'assigned_employee_id' in cleanUpdates;
  let assignmentRemarks: string | null = null;
  if (assignmentChanged && typeof cleanUpdates.invoice_document_path === 'string') {
    try {
      assignmentRemarks = JSON.parse(cleanUpdates.invoice_document_path).remarks || null;
    } catch {}
  }

  if (env.isMockMode) {
    const asset = memory.assets.find((a) => a.id === id);
    if (!asset) return null;
    if (asset.is_deleted) throw new Error('This asset has been deleted and cannot be edited.');
    if (cleanUpdates.assigned_employee_id && asset.status === 'in_storage' && !cleanUpdates.status) {
      cleanUpdates.status = 'in_service';
    }
    Object.assign(asset, cleanUpdates);
    if (peripherals !== undefined) {
      asset.peripherals = peripherals.map((p) => ({ ...p, id: p.id || crypto.randomUUID(), asset_id: id }));
    }
    if (customValues !== undefined) {
      asset.custom_values = customValues;
    }
    if (assignmentChanged) {
      await syncAssignmentAfterEdit(id, cleanUpdates.assigned_employee_id || null, updatedBy, assignmentRemarks, now);
    }
    invalidateAssetCache();
    return asset;
  }

  const { data: currentRow } = await db
    .from('assets')
    .select('status, is_deleted')
    .eq('id', id)
    .maybeSingle();
  if (currentRow?.is_deleted) throw new Error('This asset has been deleted and cannot be edited.');
  if (cleanUpdates.assigned_employee_id && currentRow?.status === 'in_storage' && !cleanUpdates.status) {
    cleanUpdates.status = 'in_service';
  }

  // Supabase PostgreSQL mode: filter to valid table columns only
  const dbUpdates: Record<string, any> = {};
  for (const [key, val] of Object.entries(cleanUpdates)) {
    if (VALID_ASSET_COLUMNS.has(key)) {
      dbUpdates[key] = val;
    }
  }
  if (dbUpdates.status === 'missing') {
    dbUpdates.status = 'damaged';
  }

  const { error } = await db
    .from('assets')
    .update(dbUpdates)
    .eq('id', id);

  if (error) throw new Error(error.message);

  // Update peripherals if provided
  if (peripherals !== undefined) {
    try {
      await db.from('asset_peripherals').delete().eq('asset_id', id);
      if (peripherals.length > 0) {
        const rows = peripherals.map((p) => ({
          asset_id: id,
          peripheral_name: p.peripheral_name,
          model_number: p.model_number || null,
          serial_number: p.serial_number || null,
          is_included: p.is_included,
          notes: p.notes || null,
        }));
        await db.from('asset_peripherals').insert(rows);
      }
    } catch {}
  }

  // Update custom values if provided
  if (customValues !== undefined) {
    try {
      await db.from('asset_custom_values').delete().eq('asset_id', id);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const rows = Object.entries(customValues)
        .filter(([fieldId, val]) => uuidRegex.test(fieldId) && val !== undefined && val !== null && val !== '')
        .map(([fieldId, val]) => ({
          asset_id: id,
          field_id: fieldId,
          field_value: String(val),
        }));
      if (rows.length > 0) {
        await db.from('asset_custom_values').insert(rows);
      }
    } catch (e) {
      console.warn('Update custom values warning:', e);
    }
  }

  if (assignmentChanged) {
    try {
      await syncAssignmentAfterEdit(id, cleanUpdates.assigned_employee_id || null, updatedBy, assignmentRemarks, now);
    } catch (e) {
      invalidateAssetCache();
      const msg = e instanceof Error ? e.message : 'unknown error';
      throw new Error(`Asset details were saved, but the custody history could not be updated: ${msg}`);
    }
  }

  invalidateAssetCache();
  return await getAssetById(id);
}

async function syncAssignmentAfterEdit(
  assetId: string,
  targetEmployeeId: string | null,
  actorId: string | undefined,
  remarks: string | null,
  at: string
): Promise<void> {
  if (!targetEmployeeId) {
    await closeOpenAssignments({ assetId, at, remarks: 'Unassigned via asset edit' });
    return;
  }

  const open = await getOpenAssignments(assetId);
  const current = open.find((a) => a.employee_id === targetEmployeeId);

  await closeOpenAssignments({
    assetId,
    at,
    remarks: 'Reassigned via asset edit',
    keepEmployeeId: targetEmployeeId,
  });

  if (current) {
    if (remarks !== null && remarks !== current.remarks) {
      if (env.isMockMode) {
        current.remarks = remarks;
      } else {
        await db.from('asset_assignments').update({ remarks }).eq('id', current.id);
      }
    }
    return;
  }

  await openAssignment({
    assetId,
    employeeId: targetEmployeeId,
    assignedBy: actorId,
    remarks: remarks || 'Assigned via asset edit',
    at,
  });
}

export async function transferAsset(params: {
  assetId: string;
  toDepartmentId: string;
  toLocationId: string;
  toPlantId: string;
  reason?: string;
  transferredBy: string;
}): Promise<void> {
  const asset = await getAssetById(params.assetId);
  if (!asset) throw new Error('Asset not found');
  if (asset.is_deleted) throw new Error('This asset has been deleted and cannot be transferred.');

  const now = new Date().toISOString();
  const placement = {
    current_department_id: params.toDepartmentId,
    current_location_id: params.toLocationId,
    current_plant_id: params.toPlantId,
    updated_at: now,
  };

  const transferId = await recordTransfer({
    asset_id: params.assetId,
    from_department_id: asset.current_department_id,
    to_department_id: params.toDepartmentId,
    from_location_id: asset.current_location_id,
    to_location_id: params.toLocationId,
    from_plant_id: asset.current_plant_id,
    to_plant_id: params.toPlantId,
    transferred_by: params.transferredBy,
    reason: params.reason || null,
    transferred_at: now,
  });

  try {
    if (env.isMockMode) {
      Object.assign(getStoredMockAsset(params.assetId), placement);
    } else {
      await updateAssetRow(params.assetId, placement);
    }
  } catch (e) {
    await removeTransferRow(transferId);
    throw e;
  }

    await logAuditEvent({
      event_category: 'data_change',
      user_id: params.transferredBy,
      user_role: 'admin',
      action: 'ASSET_DEPARTMENT_TRANSFER',
      target_table: 'assets',
      record_id: params.assetId,
      changes: {
      fromDepartment: asset.current_department_id,
        toDepartment: params.toDepartmentId,
        reason: params.reason,
      },
    });

    invalidateAssetCache();
}

const ASSET_WITH_RELATIONS_SELECT =
  '*, category:categories(*), location:locations(*), plant:plants(*), department:departments(*), assigned_employee:employees(*), peripherals:asset_peripherals(*)';

function getStoredMockAsset(assetId: string): Asset {
  const stored = memory.assets.find((a) => a.id === assetId);
  if (!stored) throw new Error('Asset not found');
  return stored;
}

// Merges keys into the JSON metadata blob kept in invoice_document_path.
// Returns null when the column holds a non-JSON value that must not be overwritten.
function mergeAssetMeta(raw: string | null | undefined, patch: Record<string, unknown>): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return JSON.stringify(patch);
  if (!trimmed.startsWith('{')) return null;
  try {
    return JSON.stringify({ ...JSON.parse(trimmed), ...patch });
  } catch {
    return null;
  }
}

async function updateAssetRow(assetId: string, payload: Record<string, unknown>): Promise<Asset> {
  let res = await db.from('assets').update(payload).eq('id', assetId).select(ASSET_WITH_RELATIONS_SELECT).single();
  if (res.error && 'hostname' in payload && (res.error.message || '').includes('hostname')) {
    const { hostname: _hostname, ...withoutHostname } = payload;
    res = await db.from('assets').update(withoutHostname).eq('id', assetId).select(ASSET_WITH_RELATIONS_SELECT).single();
  }
  if (res.error || !res.data) {
    throw new Error(res.error?.message || 'Failed to update asset');
  }
  return res.data as Asset;
}

const ASSET_JUST_ASSIGNED_MESSAGE =
  'This asset was just assigned by another user a moment ago. Please refresh the page to see its current custodian.';

export async function assignAssetToEmployee(params: {
  assetId: string;
  employeeId: string;
  assignedBy: string;
  remarks?: string;
  handoverItems?: string[];
  hostname?: string | null;
}): Promise<Asset> {
  const asset = await getAssetById(params.assetId);
  if (!asset) throw new Error('Asset not found');
  if (asset.is_deleted) throw new Error('This asset has been deleted. It cannot be assigned.');

  // Rule 1: Cannot assign an asset that is missing, damaged, or scrapped
  if (asset.status === 'missing') {
    throw new Error('This asset is reported as MISSING. It cannot be assigned to an employee.');
  }
  if (asset.status === 'damaged') {
    throw new Error('This asset is reported as DAMAGED. It must be repaired/resolved before assignment.');
  }
  if (asset.status === 'scrapped') {
    throw new Error('This asset is SCRAPPED. It cannot be assigned.');
  }

  // Rule 2: Cannot assign an asset that is ALREADY assigned to an employee!
  if (asset.assigned_employee_id || asset.assigned_employee) {
    const currentEmp = asset.assigned_employee?.full_name || 'another employee';
    const currentCode = asset.assigned_employee?.emp_code ? ` (${asset.assigned_employee.emp_code})` : '';
    throw new Error(`Asset is already assigned to ${currentEmp}${currentCode}. Please de-assign it first before assigning to a new employee.`);
  }

  await assertEmployeeAssignable(params.employeeId);

  const now = new Date().toISOString();

  // Atomically claim the asset: only succeeds while nobody holds it, so two
  // people assigning the same asset at the same moment cannot both win.
  const claim = { assigned_employee_id: params.employeeId, status: 'in_service', updated_at: now };
  const releaseClaim = async () => {
    const revert = { assigned_employee_id: null, status: asset.status, updated_at: new Date().toISOString() };
    if (env.isMockMode) {
      Object.assign(getStoredMockAsset(params.assetId), revert);
    } else {
      await db.from('assets').update(revert).eq('id', params.assetId).eq('assigned_employee_id', params.employeeId);
    }
    invalidateAssetCache();
  };

  if (env.isMockMode) {
    const stored = getStoredMockAsset(params.assetId);
    if (stored.assigned_employee_id) throw new Error(ASSET_JUST_ASSIGNED_MESSAGE);
    Object.assign(stored, claim);
  } else {
    const { count, error } = await db
      .from('assets')
      .update(claim)
      .eq('id', params.assetId)
      .is('assigned_employee_id', null)
      .eq('is_deleted', false);
    if (error) throw new Error(error.message);
    if (!count) throw new Error(ASSET_JUST_ASSIGNED_MESSAGE);
  }
  invalidateAssetCache();

  let strayClosed: Awaited<ReturnType<typeof closeOpenAssignments>>;
  try {
    // Close any custody record left open by older data (e.g. in-house moves)
    strayClosed = await closeOpenAssignments({
      assetId: params.assetId,
      at: now,
      remarks: 'Custody closed before new assignment',
    });
  } catch (e) {
    await releaseClaim();
    throw e;
  }

  let assignmentId: string;
  try {
    assignmentId = await openAssignment({
      assetId: params.assetId,
      employeeId: params.employeeId,
      assignedBy: params.assignedBy,
      remarks: params.remarks,
      at: now,
    });
  } catch (e) {
    await reopenAssignments(strayClosed);
    await releaseClaim();
    throw e;
  }

  const updateData: Record<string, any> = { ...claim };
  if (params.hostname !== undefined) {
    updateData.hostname = params.hostname;
    const meta = mergeAssetMeta(asset.invoice_document_path, { hostname: params.hostname });
    if (meta !== null) updateData.invoice_document_path = meta;
  }

  let data: Asset;
  try {
    if (env.isMockMode) {
      Object.assign(getStoredMockAsset(params.assetId), updateData);
      data = (await getAssetById(params.assetId))!;
    } else {
      data = await updateAssetRow(params.assetId, updateData);
    }
  } catch (e) {
    await removeAssignmentRow(assignmentId);
    await reopenAssignments(strayClosed);
    await releaseClaim();
    throw e;
  }

  await logAuditEvent({
    event_category: 'data_change',
    user_id: params.assignedBy,
    user_role: 'admin',
    action: 'ASSET_ASSIGNMENT',
    target_table: 'assets',
    record_id: params.assetId,
    changes: {
      assigned_employee_id: params.employeeId,
      hostname: params.hostname,
      remarks: params.remarks,
      handoverItems: params.handoverItems,
    },
  });

  invalidateAssetCache();
  return data as Asset;
}

export async function deployAssetInHouse(params: {
  assetId: string;
  departmentId?: string;
  exactLocation?: string;
  assignedBy: string;
  remarks?: string;
  hostname?: string | null;
}): Promise<Asset> {
  const asset = await getAssetById(params.assetId);
  if (!asset) throw new Error('Asset not found');

  if (asset.status === 'missing') {
    throw new Error('This asset is reported as MISSING. It cannot be deployed.');
  }
  if (asset.status === 'damaged') {
    throw new Error('This asset is reported as DAMAGED. It must be repaired/resolved before deployment.');
  }
  if (asset.status === 'scrapped') {
    throw new Error('This asset is SCRAPPED. It cannot be deployed.');
  }
  if (asset.is_deleted) {
    throw new Error('This asset has been deleted. It cannot be deployed.');
  }

  const now = new Date().toISOString();
  const targetDepartmentId = params.departmentId || asset.current_department_id;
  const exactLocation = params.exactLocation?.trim().toUpperCase() || null;

  const closedIds = await closeOpenAssignments({
    assetId: params.assetId,
    at: now,
    remarks: 'Moved to in-house use',
  });

  let transferId: string;
  try {
    transferId = await recordTransfer({
      asset_id: params.assetId,
      from_department_id: asset.current_department_id,
      to_department_id: targetDepartmentId,
      from_location_id: asset.current_location_id,
      to_location_id: asset.current_location_id,
      from_plant_id: asset.current_plant_id,
      to_plant_id: asset.current_plant_id,
      transferred_by: params.assignedBy,
      reason: [IN_HOUSE_REASON_PREFIX, exactLocation ? `Spot: ${exactLocation}` : null, params.remarks || null]
        .filter(Boolean)
        .join(' • '),
      transferred_at: now,
    });
  } catch (e) {
    await reopenAssignments(closedIds);
    throw e;
  }

  const updatePayload: Record<string, any> = {
    assigned_employee_id: null,
    status: 'in_service',
    current_department_id: targetDepartmentId,
    updated_at: now,
  };
  if (params.hostname !== undefined) updatePayload.hostname = params.hostname;

  const metaPatch: Record<string, unknown> = {};
  if (exactLocation) metaPatch.exact_location = exactLocation;
  if (params.hostname !== undefined) metaPatch.hostname = params.hostname;
  if (Object.keys(metaPatch).length > 0) {
    const meta = mergeAssetMeta(asset.invoice_document_path, metaPatch);
    if (meta !== null) updatePayload.invoice_document_path = meta;
  }

  let data: Asset;
  try {
    if (env.isMockMode) {
      Object.assign(getStoredMockAsset(params.assetId), updatePayload);
      data = (await getAssetById(params.assetId))!;
    } else {
      data = await updateAssetRow(params.assetId, updatePayload);
    }
  } catch (e) {
    await removeTransferRow(transferId);
    await reopenAssignments(closedIds);
    throw e;
  }

  await logAuditEvent({
    event_category: 'data_change',
    user_id: params.assignedBy,
    user_role: 'admin',
    action: 'ASSET_INHOUSE_DEPLOYMENT',
    target_table: 'assets',
    record_id: params.assetId,
    changes: {
      departmentId: params.departmentId,
      exactLocation: params.exactLocation,
      remarks: params.remarks,
    },
  });

  invalidateAssetCache();
  const updatedAsset = await getAssetById(params.assetId);
  return updatedAsset || (data as Asset);
}

export async function deassignAssetFromEmployee(params: {
  assetId: string;
  deassignedBy: string;
  returnCondition?: string;
  remarks?: string;
}): Promise<Asset> {
  const asset = await getAssetById(params.assetId);
  if (!asset) throw new Error('Asset not found');

  if (asset.is_deleted) {
    throw new Error('This asset has been deleted. It cannot be returned to stock.');
  }
  if (asset.status === 'missing' || asset.status === 'damaged' || asset.status === 'scrapped') {
    throw new Error(
      `This asset has an open ${asset.status.toUpperCase()} report. Resolve it from the Damaged / Scrap page instead of returning it to stock.`
    );
  }
  if (asset.status === 'in_storage' && !asset.assigned_employee_id) {
    throw new Error('This asset is already in the Available / Stock pool.');
  }

  const now = new Date().toISOString();
  const previousEmpName = asset.assigned_employee?.full_name || 'Previous Employee';
  const previousEmpCode = asset.assigned_employee?.emp_code || '';

  const closedIds = await closeOpenAssignments({
    assetId: params.assetId,
    at: now,
    returnCondition: params.returnCondition || 'Good / Working',
    remarks: params.remarks || 'Returned to stock pool',
  });

  const stockUpdate = {
      assigned_employee_id: null,
    status: 'in_storage' as const,
      updated_at: now,
  };

  let data: Asset;
  try {
    if (env.isMockMode) {
      Object.assign(getStoredMockAsset(params.assetId), stockUpdate);
      data = (await getAssetById(params.assetId))!;
    } else {
      data = await updateAssetRow(params.assetId, stockUpdate);
    }
  } catch (e) {
    await reopenAssignments(closedIds);
    throw e;
  }

  await logAuditEvent({
    event_category: 'data_change',
    user_id: params.deassignedBy,
    user_role: 'admin',
    action: 'ASSET_DEASSIGNMENT',
    target_table: 'assets',
    record_id: params.assetId,
    changes: {
      returned_from: previousEmpName,
      emp_code: previousEmpCode,
      return_condition: params.returnCondition,
      remarks: params.remarks,
    },
  });

  invalidateAssetCache();
  return data as Asset;
}

// Keeps the row and its assignment/transfer/report history; the asset is only
// hidden from listings via is_deleted.
export async function softDeleteAsset(assetId: string, deletedBy: string): Promise<void> {
  const now = new Date().toISOString();

  await closeOpenAssignments({ assetId, at: now, remarks: 'Asset deleted from register' });

  const deletion = {
    is_deleted: true,
    deleted_at: now,
    deleted_by: deletedBy,
    assigned_employee_id: null,
    updated_at: now,
  };

  if (env.isMockMode) {
    Object.assign(getStoredMockAsset(assetId), deletion);
    invalidateAssetCache();
    return;
  }

  let { error } = await db.from('assets').update(deletion).eq('id', assetId);
  if (isActorForeignKeyError(error, 'deleted_by')) {
    ({ error } = await db.from('assets').update({ ...deletion, deleted_by: null }).eq('id', assetId));
  }
  if (error) throw new Error(`Failed to delete asset: ${error.message}`);

  invalidateAssetCache();
}

// -----------------------------------------------------------------------------
// Preventive Maintenance & Public QR Complaints
// -----------------------------------------------------------------------------
export async function getPMMachines(): Promise<PMMachine[]> {
  if (env.isMockMode) {
    return memory.pmMachines.map((m) => ({
      ...m,
      plant: memory.plants.find((p) => p.id === m.plant_id),
      location: memory.locations.find((l) => l.id === m.location_id),
      department: memory.departments.find((d) => d.id === m.department_id),
    }));
  }

  const { data } = await db
    .from('pm_machines')
    .select('*, plant:plants(*), location:locations(*), department:departments(*)')
    .order('next_pm_date');
  return (data as PMMachine[]) || [];
}

export async function getMachineByQrToken(token: string): Promise<PMMachine | null> {
  if (env.isMockMode) {
    const m = memory.pmMachines.find((item) => item.qr_code_token === token);
    if (!m) return null;
    return {
      ...m,
      plant: memory.plants.find((p) => p.id === m.plant_id),
      location: memory.locations.find((l) => l.id === m.location_id),
      department: memory.departments.find((d) => d.id === m.department_id),
    };
  }

  const { data, error } = await db
    .from('pm_machines')
    .select('*, plant:plants(*), location:locations(*), department:departments(*)')
    .eq('qr_code_token', token)
    .single();

  if (error || !data) return null;
  return data as PMMachine;
}

export async function submitPublicComplaint(params: {
  machineId: string;
  reporterName: string;
  reporterContact?: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  clientIp: string;
}): Promise<{ success: boolean; message?: string; complaint?: PMComplaint }> {
  // Rate limiting check: Max 5 complaints per IP per 10 minutes
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;

  if (env.isMockMode) {
    const history = memory.complaintIpRates.get(params.clientIp) || [];
    const recent = history.filter((t) => t > tenMinutesAgo);

    if (recent.length >= 5) {
      return {
        success: false,
        message: 'Rate limit exceeded. You can only submit up to 5 complaints per 10 minutes from this device.',
      };
    }

    recent.push(now);
    memory.complaintIpRates.set(params.clientIp, recent);

    const complaint: PMComplaint = {
      id: crypto.randomUUID(),
      machine_id: params.machineId,
      reporter_name: params.reporterName,
      reporter_contact: params.reporterContact || null,
      description: params.description,
      priority: params.priority,
      status: 'open',
      ip_address: params.clientIp,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memory.pmComplaints.unshift(complaint);
    return { success: true, complaint };
  }

  // Live Postgres with IP rate check
  const { count } = await db
    .from('pm_complaints')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', params.clientIp)
    .gte('created_at', new Date(tenMinutesAgo).toISOString());

  if (count && count >= 5) {
    return {
      success: false,
      message: 'Rate limit exceeded. Maximum 5 complaints allowed per 10 minutes.',
    };
  }

  const { data, error } = await db
    .from('pm_complaints')
    .insert({
      machine_id: params.machineId,
      reporter_name: params.reporterName,
      reporter_contact: params.reporterContact || null,
      description: params.description,
      priority: params.priority,
      status: 'open',
      ip_address: params.clientIp,
    })
    .select()
    .single();

  if (error) return { success: false, message: error.message };
  delete storeCache.complaints;
  return { success: true, complaint: data as PMComplaint };
}

export async function getPMComplaints(): Promise<PMComplaint[]> {
  if (env.isMockMode) {
    return memory.pmComplaints.map((c) => ({
      ...c,
      machine: memory.pmMachines.find((m) => m.id === c.machine_id),
    }));
  }

  const now = Date.now();
  if (storeCache.complaints && storeCache.complaints.expiresAt > now) {
    return storeCache.complaints.data;
  }

  const { data } = await db
    .from('pm_complaints')
    .select('*, machine:pm_machines(*)')
    .order('created_at', { ascending: false });
  const result = (data as PMComplaint[]) || [];
  storeCache.complaints = { data: result, expiresAt: now + 30_000 };
  return result;
}

export async function resolvePMComplaint(params: {
  complaintId: string;
  resolutionNotes: string;
  technicianCost?: number;
  replacementParts?: string;
  resolvedBy: string;
}): Promise<void> {
  const now = new Date().toISOString();

  if (env.isMockMode) {
    const c = memory.pmComplaints.find((item) => item.id === params.complaintId);
    if (c) {
      c.status = 'resolved';
      c.resolution_notes = params.resolutionNotes;
      c.technician_cost = params.technicianCost || null;
      c.replacement_parts = params.replacementParts || null;
      c.resolved_by = params.resolvedBy;
      c.resolved_at = now;
      c.updated_at = now;
    }
    invalidateAssetCache();
    return;
  }

  await db
    .from('pm_complaints')
    .update({
      status: 'resolved',
      resolution_notes: params.resolutionNotes,
      technician_cost: params.technicianCost || null,
      replacement_parts: params.replacementParts || null,
      resolved_by: params.resolvedBy,
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', params.complaintId);

  invalidateAssetCache();
}

// -----------------------------------------------------------------------------
// Damaged / Scrap Module
// -----------------------------------------------------------------------------
export function normalizeDamageScrapReport(r: any): DamageScrapReport {
  if (!r) return r;
  let docUrl = r.document_url || null;
  let cleanPhotos = Array.isArray(r.photo_paths) ? [...r.photo_paths] : [];

  let actualReportType = r.report_type;
  // Check if report_type is encoded in photo_paths with 'TYPE:' prefix
  const typeEntryIndex = cleanPhotos.findIndex((p) => typeof p === 'string' && p.startsWith('TYPE:'));
  if (typeEntryIndex !== -1) {
    actualReportType = cleanPhotos[typeEntryIndex].substring(5);
    cleanPhotos.splice(typeEntryIndex, 1);
  }

  // Check if a document is encoded in photo_paths with 'DOC:' prefix
  const docEntryIndex = cleanPhotos.findIndex((p) => typeof p === 'string' && p.startsWith('DOC:'));
  if (docEntryIndex !== -1) {
    if (!docUrl) {
      docUrl = cleanPhotos[docEntryIndex].substring(4);
    }
    cleanPhotos.splice(docEntryIndex, 1);
  }

  let empName = r.employee_name || r.asset?.assigned_employee?.full_name || null;
  let empId = r.employee_id || r.asset?.assigned_employee?.emp_code || r.asset?.assigned_employee?.id || null;
  let empEmail = r.employee_email || r.asset?.assigned_employee?.email || null;
  let contactPhone = (r as any).contact_phone || r.asset?.assigned_employee?.phone || null;

  // Check if contact phone is encoded in photo_paths with 'CONTACT:' prefix
  const contactEntryIndex = cleanPhotos.findIndex((p) => typeof p === 'string' && p.startsWith('CONTACT:'));
  if (contactEntryIndex !== -1) {
    if (!contactPhone) contactPhone = cleanPhotos[contactEntryIndex].substring(8);
    cleanPhotos.splice(contactEntryIndex, 1);
  }

  // Check if employee metadata is encoded in photo_paths with 'EMP:' prefix
  const empEntryIndex = cleanPhotos.findIndex((p) => typeof p === 'string' && p.startsWith('EMP:'));
  if (empEntryIndex !== -1) {
    const parts = cleanPhotos[empEntryIndex].substring(4).split('|');
    if (!empId) empId = parts[0] || null;
    if (!empName) empName = parts[1] || null;
    if (!empEmail) empEmail = parts[2] || null;
    if (!contactPhone && parts[3]) contactPhone = parts[3];
    cleanPhotos.splice(empEntryIndex, 1);
  }

  return {
    ...r,
    report_type: actualReportType,
    document_url: docUrl,
    photo_paths: cleanPhotos,
    employee_name: empName,
    employee_id: empId,
    employee_email: empEmail,
    contact_phone: contactPhone,
  } as DamageScrapReport;
}

export async function getDamageScrapReports(): Promise<DamageScrapReport[]> {
  if (env.isMockMode) {
    const liveReports = memory.damageReports.filter(
      (r) => !memory.assets.find((a) => a.id === r.asset_id)?.is_deleted
    );
    return liveReports.map((r) => {
      const rawAsset = memory.assets.find((a) => a.id === r.asset_id);
      const joinedAsset = rawAsset
        ? {
            ...rawAsset,
            category: memory.categories.find((c) => c.id === rawAsset.category_id),
            location: memory.locations.find((l) => l.id === rawAsset.current_location_id),
            plant: memory.plants.find((p) => p.id === rawAsset.current_plant_id),
            department: memory.departments.find((d) => d.id === rawAsset.current_department_id),
            assigned_employee: rawAsset.assigned_employee_id
              ? memory.employees.find((e) => e.id === rawAsset.assigned_employee_id) || null
              : null,
          }
        : null;

      return normalizeDamageScrapReport({
        ...r,
        asset: joinedAsset,
        employee_name: r.employee_name || joinedAsset?.assigned_employee?.full_name || null,
        employee_id: r.employee_id || joinedAsset?.assigned_employee?.emp_code || null,
        employee_email: r.employee_email || joinedAsset?.assigned_employee?.email || null,
        reporter: memory.users.find((u) => u.id === r.reported_by),
        reviewer: r.reviewer_id ? memory.users.find((u) => u.id === r.reviewer_id) || null : null,
      });
    });
  }

  const now = Date.now();
  if (storeCache.damageReports && storeCache.damageReports.expiresAt > now) {
    return storeCache.damageReports.data;
  }

  const { data } = await db
    .from('damage_scrap_reports')
    .select('*, asset:assets(*, category:categories(*), assigned_employee:employees(*), location:locations(*), plant:plants(*), department:departments(*)), reporter:users!reported_by(*), reviewer:users!reviewer_id(*)')
    .order('created_at', { ascending: false });

  const rows = ((data as any[]) || []).filter((r) => !r.asset?.is_deleted);
  const result = rows.map((r) => normalizeDamageScrapReport(r));
  storeCache.damageReports = { data: result, expiresAt: now + 30_000 };
  return result;
}

export async function createDamageScrapReport(params: {
  assetId: string;
  reportType: 'damaged' | 'missing' | 'scrap';
  reason: string;
  severity: 'minor' | 'major' | 'total_loss';
  photoPaths: string[];
  documentUrl?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  employeeEmail?: string | null;
  reportedBy: string;
}): Promise<DamageScrapReport> {
  const asset = await getAssetById(params.assetId);
  if (!asset) throw new Error('Asset not found');
  if (asset.is_deleted) throw new Error('This asset has been deleted. Reports cannot be filed against it.');

  // Prevent duplicate missing/damaged/scrapped reports only if an active unresolved report exists
  if (!env.isMockMode) {
    const { data: existingActiveReport } = await db
      .from('damage_scrap_reports')
      .select('id, report_type, status, photo_paths')
      .eq('asset_id', params.assetId)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existingActiveReport) {
      if (isMissingReportRecord(existingActiveReport)) {
        throw new Error('This asset is already reported as MISSING. You cannot file a duplicate missing report.');
      } else if (existingActiveReport.report_type === 'scrap') {
        throw new Error('This asset is already SCRAPPED and decommissioned.');
      } else if (existingActiveReport.report_type === 'damaged' && params.reportType === 'damaged') {
        throw new Error('This asset is already reported as DAMAGED and is currently under repair.');
      }
    }
  } else {
    const existingActive = memory.damageReports.find(
      (r) => r.asset_id === params.assetId && (r.status === 'pending' || r.status === 'approved')
    );
    if (existingActive) {
      if (existingActive.report_type === 'missing') {
        throw new Error('This asset is already reported as MISSING. You cannot file a duplicate missing report.');
      } else if (existingActive.report_type === 'scrap') {
        throw new Error('This asset is already SCRAPPED and decommissioned.');
      } else if (existingActive.report_type === 'damaged' && params.reportType === 'damaged') {
        throw new Error('This asset is already reported as DAMAGED and is currently under repair.');
      }
    }
  }

  // Auto-fill custodian employee details if not explicitly passed
  let empId = params.employeeId || null;
  let empName = params.employeeName || null;
  let empEmail = params.employeeEmail || null;

  if (asset?.assigned_employee) {
    if (!empId) empId = asset.assigned_employee.id;
    if (!empName) empName = asset.assigned_employee.full_name;
    if (!empEmail) empEmail = asset.assigned_employee.email || null;
  }

  const validReporterId = params.reportedBy;
  if (!env.isMockMode) {
    if (!validReporterId) throw new Error('A signed-in reporter is required to file this report.');
    const { data: userCheck } = await db.from('users').select('id').eq('id', validReporterId).maybeSingle();
    if (!userCheck) throw new Error('Reporter account not found. Please sign in again.');
  }

  const isMissingReport = params.reportType === 'missing';
  // Note: PostgreSQL report_type_enum only accepts 'damaged' | 'scrap'. 'missing' is mapped to 'damaged' in the DB column, with TYPE:missing preserved in photo_paths
  const dbReportType = isMissingReport ? 'damaged' : params.reportType;

  const initialPhotos = [...(params.photoPaths || [])];
  if (isMissingReport) {
    initialPhotos.unshift('TYPE:missing');
  }

  const newReport: DamageScrapReport = {
    id: crypto.randomUUID(),
    asset_id: params.assetId,
    report_type: params.reportType,
    reason: params.reason,
    severity: params.severity,
    photo_paths: initialPhotos,
    document_url: params.documentUrl || null,
    employee_id: empId,
    employee_name: empName,
    employee_email: empEmail,
    reported_by: validReporterId,
    status: 'pending',
    resolution_status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const targetAssetStatus =
    params.reportType === 'damaged'
      ? 'damaged'
      : params.reportType === 'missing'
      ? 'missing'
      : 'scrapped';

  const releasesCustody = params.reportType === 'missing' || params.reportType === 'scrap';
  const custodyCloseRemark = params.reportType === 'missing' ? 'Reported missing' : 'Reported for scrap';

  if (env.isMockMode) {
    memory.damageReports.unshift(newReport);
    const a = memory.assets.find((item) => item.id === params.assetId);
    if (a) {
      a.status = targetAssetStatus;
      if (releasesCustody) {
        a.assigned_employee_id = null;
        a.assigned_employee = null;
        await closeOpenAssignments({ assetId: params.assetId, at: newReport.created_at, remarks: custodyCloseRemark });
      }
      a.updated_at = new Date().toISOString();
    }
    invalidateAssetCache();
    return normalizeDamageScrapReport(newReport);
  }

  let finalReportData: any = null;
  const dbInsertPayload: Record<string, any> = {
    ...newReport,
    report_type: dbReportType,
  };

  const insertRes = await db.from('damage_scrap_reports').insert(dbInsertPayload).select().single();

  if (insertRes.error) {
    // If Supabase schema cache does not have document_url or employee fields
    if (
      insertRes.error.message?.includes('column') ||
      insertRes.error.message?.includes('schema cache') ||
      insertRes.error.message?.includes('document_url') ||
      insertRes.error.message?.includes('employee_')
    ) {
      const combinedPhotos = [...initialPhotos];
      if (params.documentUrl) {
        combinedPhotos.push(`DOC:${params.documentUrl}`);
      }
      if (empId || empName || empEmail) {
        combinedPhotos.push(`EMP:${empId || ''}|${empName || ''}|${empEmail || ''}`);
      }

      // Safe payload matching strictly the core 001_initial_schema.sql schema
      const safePayload = {
        id: newReport.id,
        asset_id: newReport.asset_id,
        report_type: dbReportType,
        reason: newReport.reason,
        severity: newReport.severity,
        photo_paths: combinedPhotos,
        reported_by: newReport.reported_by,
        status: newReport.status,
        created_at: newReport.created_at,
        updated_at: newReport.updated_at,
      };

      const fallbackRes = await db.from('damage_scrap_reports').insert(safePayload).select().single();
      if (fallbackRes.error) throw new Error(fallbackRes.error.message);
      finalReportData = fallbackRes.data;
    } else {
      throw new Error(insertRes.error.message);
    }
  } else {
    finalReportData = insertRes.data;
  }

  // Update asset status in database and unassign if missing or scrapped.
  // Note: PostgreSQL asset_status_enum only accepts:
  // 'in_service' | 'maintenance' | 'damaged' | 'scrapped' | 'in_storage'
  const targetAssetDbStatus = targetAssetStatus === 'missing' ? 'damaged' : targetAssetStatus;
  const assetUpdatePayload: Record<string, any> = {
    status: targetAssetDbStatus,
    updated_at: new Date().toISOString(),
  };
  if (releasesCustody) {
    assetUpdatePayload.assigned_employee_id = null;
  }

  const closedIds = releasesCustody
    ? await closeOpenAssignments({ assetId: params.assetId, at: newReport.created_at, remarks: custodyCloseRemark })
    : [];

  const { error: assetUpdateError } = await db
    .from('assets')
    .update(assetUpdatePayload)
    .eq('id', params.assetId);

  if (assetUpdateError) {
    await reopenAssignments(closedIds);
    await db.from('damage_scrap_reports').delete().eq('id', finalReportData.id);
    invalidateAssetCache();
    throw new Error(`Failed to update asset status for this report: ${assetUpdateError.message}`);
  }

  invalidateAssetCache();
  return normalizeDamageScrapReport({
    ...finalReportData,
    document_url: params.documentUrl || null,
    employee_id: empId,
    employee_name: empName,
    employee_email: empEmail,
  });
}

export async function updateDamageScrapReport(
  reportId: string,
  updates: Partial<DamageScrapReport>
): Promise<DamageScrapReport | null> {
  const now = new Date().toISOString();

  if (env.isMockMode) {
    const r = memory.damageReports.find((item) => item.id === reportId);
    if (!r) return null;
    Object.assign(r, updates, { updated_at: now });
    invalidateAssetCache();
    return r;
  }

  let { data, error } = await db
    .from('damage_scrap_reports')
    .update({ ...updates, updated_at: now })
    .eq('id', reportId)
    .select()
    .single();

  if (error && (error.message?.includes('column') || error.message?.includes('schema cache'))) {
    const safeUpdates: Record<string, any> = { ...updates, updated_at: now };
    if ('document_url' in safeUpdates) {
      const doc = safeUpdates.document_url;
      delete safeUpdates.document_url;
      if (doc && Array.isArray(safeUpdates.photo_paths)) {
        safeUpdates.photo_paths = [...safeUpdates.photo_paths.filter((p: string) => !p.startsWith('DOC:')), `DOC:${doc}`];
      }
    }
    delete safeUpdates.employee_id;
    delete safeUpdates.employee_name;
    delete safeUpdates.employee_email;
    delete safeUpdates.resolution_status;
    delete safeUpdates.resolution_action;
    delete safeUpdates.resolution_notes;

    const fallbackRes = await db
      .from('damage_scrap_reports')
      .update(safeUpdates)
      .eq('id', reportId)
      .select()
      .single();

    if (fallbackRes.error) throw new Error(fallbackRes.error.message);
    data = fallbackRes.data;
  } else if (error) {
    throw new Error(error.message);
  }

  invalidateAssetCache();
  return normalizeDamageScrapReport(data);
}

export async function resolveDamageMissingReport(params: {
  reportId: string;
  resolutionAction: 'reassigned' | 'returned_to_stock' | 'scrapped';
  resolutionNotes?: string;
  assignedEmployeeId?: string | null;
  reviewerId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  let report: DamageScrapReport | null = null;

  if (env.isMockMode) {
    report = memory.damageReports.find((r) => r.id === params.reportId) || null;
  } else {
    const { data } = await db
      .from('damage_scrap_reports')
      .select('*, asset:assets(*)')
      .eq('id', params.reportId)
      .single();
    report = normalizeDamageScrapReport(data);
  }

  if (!report) throw new Error('Report not found');

  if (params.resolutionAction === 'reassigned' && params.assignedEmployeeId) {
    await assertEmployeeAssignable(params.assignedEmployeeId);
  }

  const isDamaged = report.report_type === 'damaged';
  const isMissing = report.report_type === 'missing';

  let nextAssetStatus: AssetStatus = 'in_service';
  let nextResolutionStatus: 'repaired' | 'recovered' | 'scrapped' = 'repaired';

  if (params.resolutionAction === 'scrapped') {
    nextAssetStatus = 'scrapped';
    nextResolutionStatus = 'scrapped';
  } else if (params.resolutionAction === 'returned_to_stock') {
    nextAssetStatus = 'in_storage';
    nextResolutionStatus = isMissing ? 'recovered' : 'repaired';
  } else {
    // reassigned
    nextAssetStatus = 'in_service';
    nextResolutionStatus = isMissing ? 'recovered' : 'repaired';
  }

  if (env.isMockMode) {
    report.status = params.resolutionAction === 'scrapped' ? 'approved' : 'resolved';
    if (params.resolutionAction === 'scrapped') {
      report.report_type = 'scrap';
    }
    report.resolution_status = nextResolutionStatus;
    report.resolution_action = params.resolutionAction;
    report.resolution_notes = params.resolutionNotes || null;
    report.reviewer_id = params.reviewerId;
    report.reviewed_at = now;
    report.updated_at = now;

    const a = memory.assets.find((item) => item.id === report!.asset_id);
    if (a) {
      a.status = nextAssetStatus;
      if (params.resolutionAction === 'returned_to_stock' || params.resolutionAction === 'scrapped') {
        a.assigned_employee_id = null;
        a.assigned_employee = null;
      } else if (params.resolutionAction === 'reassigned') {
        if (params.assignedEmployeeId) {
          a.assigned_employee_id = params.assignedEmployeeId;
          a.assigned_employee = memory.employees.find((e) => e.id === params.assignedEmployeeId) || null;
        }
      }
      a.updated_at = now;
      await syncCustodyAfterResolution({
        assetId: a.id,
        action: params.resolutionAction,
        employeeId: a.assigned_employee_id || null,
        reviewerId: params.reviewerId,
        notes: params.resolutionNotes,
        at: now,
      });
    }
    invalidateAssetCache();
    return;
  }

  const validReviewerId = params.reviewerId;
  if (!env.isMockMode && validReviewerId) {
    const { data: revCheck } = await db.from('users').select('id').eq('id', validReviewerId).maybeSingle();
    if (!revCheck) throw new Error('Reviewer account not found. Please sign in again.');
  }

  // Update DB report with fallback if resolution_status column is missing
  const reportUpdates: Record<string, unknown> = {
    status: params.resolutionAction === 'scrapped' ? 'approved' : 'resolved',
    resolution_status: nextResolutionStatus,
    resolution_action: params.resolutionAction,
    resolution_notes: params.resolutionNotes || null,
    reviewer_id: validReviewerId,
    reviewed_at: now,
    updated_at: now,
  };
  if (params.resolutionAction === 'scrapped') {
    reportUpdates.report_type = 'scrap';
  }

  const resUpdate = await db
    .from('damage_scrap_reports')
    .update(reportUpdates)
    .eq('id', params.reportId);

  if (resUpdate.error && (resUpdate.error.message?.includes('column') || resUpdate.error.message?.includes('schema cache'))) {
    const fallbackReportUpdates: Record<string, unknown> = {
      status: params.resolutionAction === 'scrapped' ? 'approved' : 'resolved',
      review_remarks: params.resolutionNotes || `Resolved: ${params.resolutionAction}`,
      reviewer_id: params.reviewerId,
      reviewed_at: now,
      updated_at: now,
    };
    if (params.resolutionAction === 'scrapped') {
      fallbackReportUpdates.report_type = 'scrap';
    }

    await db
      .from('damage_scrap_reports')
      .update(fallbackReportUpdates)
      .eq('id', params.reportId);
  } else if (resUpdate.error) {
    throw new Error(resUpdate.error.message);
  }

  // Update Asset status & assignment: unassign if returned to stock or scrapped; assign if reassigned
  const assetUpdates: Record<string, unknown> = {
    status: nextAssetStatus,
    updated_at: now,
  };
  if (params.resolutionAction === 'returned_to_stock' || params.resolutionAction === 'scrapped') {
    assetUpdates.assigned_employee_id = null;
  } else if (params.resolutionAction === 'reassigned') {
    if (params.assignedEmployeeId) {
      assetUpdates.assigned_employee_id = params.assignedEmployeeId;
    } else if (report.asset?.assigned_employee_id) {
      assetUpdates.assigned_employee_id = report.asset.assigned_employee_id;
    }
  }

  const { error: assetUpdateError } = await db.from('assets').update(assetUpdates).eq('id', report.asset_id);
  invalidateAssetCache();
  if (assetUpdateError) {
    throw new Error(`Report was resolved, but the asset could not be updated: ${assetUpdateError.message}`);
  }

  try {
    await syncCustodyAfterResolution({
      assetId: report.asset_id,
      action: params.resolutionAction,
      employeeId: (assetUpdates.assigned_employee_id as string | null | undefined) || null,
      reviewerId: validReviewerId,
      notes: params.resolutionNotes,
      at: now,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    throw new Error(`Report was resolved, but the custody history could not be updated: ${msg}`);
  }
}

async function syncCustodyAfterResolution(params: {
  assetId: string;
  action: 'reassigned' | 'returned_to_stock' | 'scrapped';
  employeeId: string | null;
  reviewerId: string;
  notes?: string;
  at: string;
}): Promise<void> {
  if (params.action !== 'reassigned') {
    await closeOpenAssignments({
      assetId: params.assetId,
      at: params.at,
      remarks: params.action === 'scrapped' ? 'Asset scrapped' : 'Returned to stock after incident',
    });
    return;
  }

  if (!params.employeeId) return;

  const open = await getOpenAssignments(params.assetId);
  await closeOpenAssignments({
    assetId: params.assetId,
    at: params.at,
    remarks: 'Reassigned after incident resolution',
    keepEmployeeId: params.employeeId,
  });
  if (!open.some((a) => a.employee_id === params.employeeId)) {
    await openAssignment({
      assetId: params.assetId,
      employeeId: params.employeeId,
      assignedBy: params.reviewerId,
      remarks: params.notes || 'Reassigned after incident resolution',
      at: params.at,
    });
  }
}

// Reopens the custody that was closed when a missing/scrap report was filed,
// provided the previous holder is still active.
async function restoreCustodyClosedByReport(
  assetId: string,
  reportCreatedAt: string
): Promise<string | null> {
  let candidates: AssetAssignmentRow[];
  if (env.isMockMode) {
    candidates = mockAssignments().filter(
      (a) => a.asset_id === assetId && a.returned_at === reportCreatedAt
    );
  } else {
    const { data, error } = await db
      .from('asset_assignments')
      .select('*')
      .eq('asset_id', assetId)
      .eq('returned_at', reportCreatedAt)
      .order('assigned_at', { ascending: false });
    if (error) throw new Error(`Failed to load custody history: ${error.message}`);
    candidates = (data || []) as AssetAssignmentRow[];
  }

  const previous = candidates[0];
  if (!previous) return null;

  let employeeStatus: string | null | undefined;
  if (env.isMockMode) {
    employeeStatus = memory.employees.find((e) => e.id === previous.employee_id)?.status as string | undefined;
  } else {
    const { data: emp } = await db
      .from('employees')
      .select('status')
      .eq('id', previous.employee_id)
      .maybeSingle();
    employeeStatus = emp?.status;
  }
  if (!employeeStatus || isEmployeeInactive(employeeStatus)) return null;

  const remarks = [previous.remarks, 'Report rejected, custody restored'].filter(Boolean).join(' | ');
  await reopenAssignments([previous.id]);
  if (env.isMockMode) {
    previous.remarks = remarks;
  } else {
    await db.from('asset_assignments').update({ remarks }).eq('id', previous.id);
  }
  return previous.employee_id;
}

export async function reviewDamageScrapReport(params: {
  reportId: string;
  decision: 'approved' | 'rejected' | 'resolved';
  reviewRemarks?: string;
  reviewerId: string;
}): Promise<void> {
  const now = new Date().toISOString();

  let report: DamageScrapReport;
  if (env.isMockMode) {
    const r = memory.damageReports.find((item) => item.id === params.reportId);
    if (!r) throw new Error('Report not found');
    report = r;
  } else {
    const { data, error } = await db
      .from('damage_scrap_reports')
      .select('*')
      .eq('id', params.reportId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load report: ${error.message}`);
    if (!data) throw new Error('Report not found');
    report = data as DamageScrapReport;
  }
  if (report.status !== 'pending') {
    throw new Error(`This report has already been ${report.status}.`);
  }

  const releasedCustody = isMissingReportRecord(report) || report.report_type === 'scrap';

  let asset: { id: string; status: string; assigned_employee_id?: string | null; is_deleted?: boolean } | null;
  if (env.isMockMode) {
    asset = memory.assets.find((item) => item.id === report.asset_id) || null;
  } else {
    const { data } = await db
      .from('assets')
      .select('id, status, assigned_employee_id, is_deleted')
      .eq('id', report.asset_id)
      .maybeSingle();
    asset = data;
  }

  const assetUpdate: Record<string, unknown> = {};
  if (asset && !asset.is_deleted) {
    if (params.decision === 'approved') {
      if (report.report_type === 'scrap') assetUpdate.status = 'scrapped';
    } else {
      let employeeId = asset.assigned_employee_id || null;
      if (!employeeId && releasedCustody && params.decision === 'rejected') {
        employeeId = await restoreCustodyClosedByReport(asset.id, report.created_at);
      }
      assetUpdate.status = employeeId ? 'in_service' : 'in_storage';
      assetUpdate.assigned_employee_id = employeeId;
    }
  }

  if (env.isMockMode) {
    const r = report as DamageScrapReport;
      r.status = params.decision;
      r.review_remarks = params.reviewRemarks || null;
      r.reviewer_id = params.reviewerId;
      r.reviewed_at = now;
      r.updated_at = now;
    if (asset && Object.keys(assetUpdate).length > 0) {
      const stored = getStoredMockAsset(asset.id);
      Object.assign(stored, assetUpdate, { updated_at: now });
      if ('assigned_employee_id' in assetUpdate) {
        stored.assigned_employee = assetUpdate.assigned_employee_id
          ? memory.employees.find((e) => e.id === assetUpdate.assigned_employee_id) || null
          : null;
      }
    }
    invalidateAssetCache();
    return;
  }

  const validReviewerId = params.reviewerId;
  if (validReviewerId) {
    const { data: revCheck } = await db.from('users').select('id').eq('id', validReviewerId).maybeSingle();
    if (!revCheck) throw new Error('Reviewer account not found. Please sign in again.');
  }

  const { error: reportError } = await db
    .from('damage_scrap_reports')
    .update({
      status: params.decision,
      review_remarks: params.reviewRemarks || null,
      reviewer_id: validReviewerId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', params.reportId);
  if (reportError) throw new Error(`Failed to update report: ${reportError.message}`);

  if (asset && Object.keys(assetUpdate).length > 0) {
    const { error: assetError } = await db
      .from('assets')
      .update({ ...assetUpdate, updated_at: now })
      .eq('id', asset.id);
    if (assetError) throw new Error(`Failed to update asset status: ${assetError.message}`);
  }

  invalidateAssetCache();
}

// -----------------------------------------------------------------------------
// Users & Scopes (Management Module)
// -----------------------------------------------------------------------------
export async function getUsersWithScopes(): Promise<Array<User & { scope?: UserScope | null }>> {
  if (env.isMockMode) {
    return memory.users.map((u) => ({
      ...u,
      scope: memory.userScopes.find((s) => s.user_id === u.id) || null,
    }));
  }

  const { data: usersData } = await db
    .from('users')
    .select('*, scope:user_scopes(*)')
    .order('created_at', { ascending: false });

  const { data: departmentsData } = await db.from('departments').select('id, admin_user_id');

  const deptMapByAdmin = new Map<string, string>();
  departmentsData?.forEach((d) => {
    if (d.admin_user_id) deptMapByAdmin.set(d.admin_user_id, d.id);
  });

  return ((usersData as Array<User & { scope?: UserScope | null }>) || []).map((u) => {
    const scope = u.scope;
    const resolvedDeptId = scope?.department_ids?.[0] || scope?.category_ids?.[0] || deptMapByAdmin.get(u.id) || null;
    const resolvedLocId = u.location_id || scope?.location_ids?.[0] || null;
    const resolvedPltId = u.plant_id || scope?.plant_ids?.[0] || null;

    if (scope && resolvedDeptId && (!scope.department_ids || scope.department_ids.length === 0)) {
      scope.department_ids = [resolvedDeptId];
    }

    return {
      ...u,
      location_id: resolvedLocId,
      plant_id: resolvedPltId,
      department_id: resolvedDeptId,
      scope: scope
        ? {
            ...scope,
            location_ids: scope.location_ids,
            plant_ids: scope.plant_ids,
            department_ids: scope.department_ids || (resolvedDeptId ? [resolvedDeptId] : null),
            category_ids: null,
          }
        : null,
    };
  });
}

export async function updateUserScope(
  userId: string,
  scopeData: {
    can_edit: boolean;
    category_ids: string[] | null;
    location_ids: string[] | null;
    plant_ids: string[] | null;
    department_ids?: string[] | null;
    sub_department?: string | null;
  }
): Promise<void> {
  let s = memory.userScopes.find((item) => item.user_id === userId);
  if (s) {
    Object.assign(s, scopeData, { updated_at: new Date().toISOString() });
  } else {
    memory.userScopes.push({
      id: crypto.randomUUID(),
      user_id: userId,
      ...scopeData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (env.isMockMode) return;

  const dbScopePayload = {
    user_id: userId,
    can_edit: Boolean(scopeData.can_edit),
    category_ids: scopeData.category_ids || null,
    location_ids: scopeData.location_ids || null,
    plant_ids: scopeData.plant_ids || null,
    department_ids: scopeData.department_ids || null,
    sub_department: scopeData.sub_department || null,
    updated_at: new Date().toISOString(),
  };

  const { error: scopeError } = await db
    .from('user_scopes')
    .upsert(dbScopePayload, { onConflict: 'user_id' });
  if (scopeError) throw new Error(scopeError.message);

  // Sync department master admin_user_id
  if (scopeData.department_ids && scopeData.department_ids.length > 0) {
    const deptId = scopeData.department_ids[0];
    try {
      await db.from('departments').update({ admin_user_id: userId }).eq('id', deptId);
    } catch {}
  }
}

export async function createUser(
  userData: {
    email: string;
    full_name: string;
    phone?: string | null;
    emp_code?: string | null;
    role: UserRole;
    location_id?: string | null;
    plant_id?: string | null;
    department_id?: string | null;
    sub_department?: string | null;
  },
  scopeData: {
    can_edit: boolean;
    location_ids?: string[] | null;
    plant_ids?: string[] | null;
    category_ids?: string[] | null;
    department_ids?: string[] | null;
    sub_department?: string | null;
  }
): Promise<User & { scope?: UserScope | null }> {
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newUser: User = {
    id: userId,
    email: userData.email.toLowerCase().trim(),
    full_name: userData.full_name.trim(),
    phone: userData.phone || null,
    emp_code: userData.emp_code ? userData.emp_code.toUpperCase().trim() : null,
    role: userData.role,
    is_active: true,
    location_id: userData.location_id || null,
    plant_id: userData.plant_id || null,
    department_id: userData.department_id || null,
    sub_department: userData.sub_department || null,
    created_at: now,
    updated_at: now,
  };

  const newScope: UserScope = {
    id: crypto.randomUUID(),
    user_id: userId,
    can_edit: scopeData.can_edit,
    category_ids: scopeData.category_ids || null,
    location_ids: scopeData.location_ids || null,
    plant_ids: scopeData.plant_ids || null,
    department_ids: scopeData.department_ids || null,
    sub_department: scopeData.sub_department || null,
    created_at: now,
    updated_at: now,
  };

  memory.users.unshift(newUser);
  memory.userScopes.unshift(newScope);

  if (env.isMockMode) {
    return { ...newUser, scope: newScope };
  }

  const dbUserPayload = {
    id: userId,
    email: newUser.email,
    full_name: newUser.full_name,
    phone: newUser.phone,
    emp_code: newUser.emp_code,
    role: newUser.role,
    is_active: true,
    location_id: newUser.location_id,
    plant_id: newUser.plant_id,
    department_id: newUser.department_id,
    sub_department: newUser.sub_department,
    created_at: now,
    updated_at: now,
  };

  const { data: createdUser, error: userError } = await db
    .from('users')
    .insert(dbUserPayload)
    .select()
    .single();

  if (userError) throw new Error(userError.message);

  const dbScopePayload = {
    id: newScope.id,
    user_id: userId,
    can_edit: newScope.can_edit,
    category_ids: newScope.category_ids || null,
    location_ids: newScope.location_ids,
    plant_ids: newScope.plant_ids,
    department_ids: newScope.department_ids,
    sub_department: newScope.sub_department,
    created_at: now,
    updated_at: now,
  };

  const { error: scopeError } = await db.from('user_scopes').insert(dbScopePayload);
  if (scopeError) {
    await db.from('users').delete().eq('id', userId);
    throw new Error(scopeError.message);
  }

  if (newScope.department_ids && newScope.department_ids.length > 0) {
    const deptId = newScope.department_ids[0];
    try {
      await db.from('departments').update({ admin_user_id: userId }).eq('id', deptId);
    } catch {}
  }

  return { ...newUser, ...(createdUser as Partial<User>), scope: newScope };
}

export async function updateUser(
  id: string,
  updates: Partial<User>
): Promise<User | null> {
  const u = memory.users.find((user) => user.id === id);
  if (u) {
    Object.assign(u, updates, { updated_at: new Date().toISOString() });
  }

  if (env.isMockMode) {
    return u || null;
  }

  const allowedUserKeys = [
    'email', 'full_name', 'phone', 'emp_code', 'role', 'is_active', 'last_login_at',
    'location_id', 'plant_id', 'department_id', 'sub_department', 'updated_at',
  ];
  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(updates)) {
    if (allowedUserKeys.includes(key)) {
      dbUpdates[key] = value;
    }
  }

  if (Object.keys(dbUpdates).length > 0) {
    const { data, error } = await db.from('users').update(dbUpdates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return { ...(u || {}), ...(data as User) };
  }

  return u || null;
}

export async function deleteUser(userId: string): Promise<boolean> {
  if (env.isMockMode) {
    const idx = memory.users.findIndex((u) => u.id === userId);
    if (idx === -1) return false;
    memory.users.splice(idx, 1);
    memory.userScopes = memory.userScopes.filter((s) => s.user_id !== userId);
    return true;
  }
  await db.from('user_scopes').delete().eq('user_id', userId);
  const { error } = await db.from('users').delete().eq('id', userId);
  if (error) throw new Error(error.message);
  return true;
}

export interface BatchImportAssetItem {
  name: string;
  category_name?: string;
  manufacturer?: string;
  model?: string;
  serial_number: string;
  hostname?: string;
  processor?: string;
  ram?: string;
  storage?: string;
  operating_system?: string;
  mac_address?: string;
  ip_address?: string;
  purchase_date?: string;
  purchase_cost?: number;
  vendor_name?: string;
  po_number?: string;
  warranty_expiry?: string;
  remarks?: string;
  emp_code?: string;
  emp_name?: string;
  emp_email?: string;
  emp_phone?: string;
  emp_designation?: string;
}

export interface BatchImportPayload {
  location_id: string;
  plant_id: string;
  department_id: string;
  items: BatchImportAssetItem[];
}

export interface BatchImportResult {
  success: boolean;
  total_processed: number;
  assets_created: number;
  employees_created: number;
  assets_in_stock: number;
  assets_assigned: number;
  imported_tags: string[];
  created_employees: Array<{ id: string; emp_code: string; full_name: string }>;
  skipped_rows: Array<{ serial_number: string; reason: string }>;
}

export async function batchImportAssets(
  payload: BatchImportPayload,
  userId: string
): Promise<BatchImportResult> {
  const { location_id, plant_id, department_id, items } = payload;
  const now = new Date().toISOString();

  const result: BatchImportResult = {
    success: true,
    total_processed: items.length,
    assets_created: 0,
    employees_created: 0,
    assets_in_stock: 0,
    assets_assigned: 0,
    imported_tags: [],
    created_employees: [],
    skipped_rows: [],
  };

  // 1. Preload / cache categories to resolve category_id
  let existingCategories: Category[] = [];
  if (env.isMockMode) {
    existingCategories = [...memory.categories];
  } else {
    const { data: cats } = await db.from('categories').select('*');
    if (cats) existingCategories = cats as Category[];
  }

  // Helper to resolve or create category
  const resolveCategoryId = async (catName?: string): Promise<{ id: string; typeStr: string }> => {
    const cleanCat = (catName || 'EQUIPMENT').trim().toUpperCase();
    const matched = existingCategories.find(
      (c) => c.name.toUpperCase() === cleanCat || c.code.toUpperCase() === cleanCat
    );
    if (matched) {
      return { id: matched.id, typeStr: cleanCat };
    }
    const resolvedId = await resolveCategoryIdByName(cleanCat);
    if (!resolvedId) throw new Error(`Could not create asset type "${cleanCat}"`);
    existingCategories.push({ id: resolvedId, name: cleanCat, code: cleanCat } as Category);
    return { id: resolvedId, typeStr: cleanCat };
  };

  // 2. Preload existing employees into a local lookup Map to deduplicate
  const empLookup = new Map<string, { id: string; status: string; full_name: string }>();

  if (env.isMockMode) {
    memory.employees.forEach((e) => {
      if (e.emp_code) {
        empLookup.set(e.emp_code.toUpperCase(), {
          id: e.id,
          status: e.status,
          full_name: e.full_name,
        });
      }
    });
  } else {
    const { data: dbEmps } = await db.from('employees').select('id, emp_code, full_name, status');
    if (dbEmps) {
      dbEmps.forEach((e) => {
        if (e.emp_code) {
          empLookup.set(e.emp_code.toUpperCase(), {
            id: e.id,
            status: e.status,
            full_name: e.full_name,
          });
        }
      });
    }
  }

  // 3. Process each asset item sequentially to maintain atomic consistency
  for (const item of items) {
    const cleanSerial = item.serial_number?.trim().toUpperCase();
    if (!cleanSerial) continue;

    const alreadyRegistered = await findActiveAssetBySerial(cleanSerial);
    if (alreadyRegistered) {
      result.skipped_rows.push({ serial_number: cleanSerial, reason: `Already registered as ${alreadyRegistered.asset_tag}` });
      continue;
    }

    const { id: catId, typeStr: catTypeStr } = await resolveCategoryId(item.category_name);

    // Custodian Resolution & Auto-Creation Logic
    let assignedEmployeeId: string | null = null;
    const cleanEmpCode = item.emp_code?.trim().toUpperCase();

    if (cleanEmpCode) {
      if (empLookup.has(cleanEmpCode)) {
        const emp = empLookup.get(cleanEmpCode)!;
        if (emp.status !== 'inactive' && (emp.status as string) !== 'resigned') {
          assignedEmployeeId = emp.id;
        } else {
          // Inactive employee guard: route safely to stock
          assignedEmployeeId = null;
        }
      } else {
        // Auto-provision brand new Employee Profile in database!
        const newEmpId = crypto.randomUUID();
        const empFullName = (item.emp_name?.trim() || cleanEmpCode).toUpperCase();
        const newEmpData: Employee = {
          id: newEmpId,
          emp_code: cleanEmpCode,
          full_name: empFullName,
          email: item.emp_email?.trim().toLowerCase() || null,
          phone: item.emp_phone?.trim() || null,
          designation: item.emp_designation?.trim().toUpperCase() || 'STAFF',
          department_id,
          plant_id,
          location_id,
          status: 'active',
          created_at: now,
          updated_at: now,
        };

        if (env.isMockMode) {
          memory.employees.push(newEmpData);
        } else {
          try {
            await db.from('employees').insert({
              id: newEmpId,
              emp_code: cleanEmpCode,
              full_name: empFullName,
              email: item.emp_email?.trim().toLowerCase() || null,
              phone: item.emp_phone?.trim() || null,
              designation: item.emp_designation?.trim().toUpperCase() || 'STAFF',
              department_id,
              plant_id,
              location_id,
              status: 'active',
            });
          } catch (empErr) {
            console.warn(`Failed to auto-create employee ${cleanEmpCode}:`, empErr);
          }
        }

        // Cache in map so future rows in same batch reuse this employee
        empLookup.set(cleanEmpCode, {
          id: newEmpId,
          status: 'active',
          full_name: empFullName,
        });

        result.employees_created++;
        result.created_employees.push({
          id: newEmpId,
          emp_code: cleanEmpCode,
          full_name: empFullName,
        });

        assignedEmployeeId = newEmpId;
      }
    }

    // Determine target IT asset type for prefix
    let itAssetType = 'INPUT/OUTPUT DEVICE';
    if (catTypeStr.includes('LAPTOP')) itAssetType = 'LAPTOP';
    else if (catTypeStr.includes('DESKTOP')) itAssetType = 'DESKTOP';

    // Generate atomic unique tag
    let assignedTag = await generateUniqueAssetTag(catId, itAssetType);
    const assetId = crypto.randomUUID();

    const assetStatus = assignedEmployeeId ? ('in_service' as const) : ('in_storage' as const);

    const docMetadata = JSON.stringify({
      hostname: item.hostname?.trim().toUpperCase() || null,
      remarks: item.remarks?.trim() || 'Imported via IT Admin Smart Excel Batch Import',
      specs: {
        processor: item.processor?.trim().toUpperCase() || null,
        ram: item.ram?.trim().toUpperCase() || null,
        storage: item.storage?.trim().toUpperCase() || null,
        operating_system: item.operating_system?.trim().toUpperCase() || null,
        hostname: item.hostname?.trim().toUpperCase() || null,
        mac_address: item.mac_address?.trim().toUpperCase() || null,
        ip_address: item.ip_address?.trim().toUpperCase() || null,
      },
      photos: [],
      documents: [],
      imported_at: now,
      condition: item.po_number?.trim() ? 'new_purchase' : 'existing_asset',
    });

    const newAssetObj: Asset = {
      id: assetId,
      asset_tag: assignedTag,
      name: item.name?.trim().toUpperCase() || `${item.manufacturer || ''} ${item.model || ''}`.trim().toUpperCase(),
      model: item.model?.trim().toUpperCase() || null,
      manufacturer: item.manufacturer?.trim().toUpperCase() || null,
      serial_number: cleanSerial,
      category_id: catId,
      purchase_date: item.purchase_date || null,
      purchase_cost: item.purchase_cost || null,
      po_number: item.po_number?.trim().toUpperCase() || null,
      vendor_name: item.vendor_name?.trim().toUpperCase() || null,
      warranty_expiry: item.warranty_expiry || null,
      current_location_id: location_id,
      current_plant_id: plant_id,
      current_department_id: department_id,
      assigned_employee_id: assignedEmployeeId,
      status: assetStatus,
      invoice_document_path: docMetadata,
      is_deleted: false,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };

    if (env.isMockMode) {
      memory.assets.unshift(newAssetObj);
      if (assignedEmployeeId) {
        await openAssignment({
          assetId,
          employeeId: assignedEmployeeId,
          assignedBy: userId,
          remarks: item.remarks?.trim() || 'Batch Excel Assignment',
          at: now,
        });
      }
    } else {
      const VALID_ASSET_COLUMNS = new Set([
        'id', 'asset_tag', 'serial_number', 'name', 'model', 'manufacturer',
        'category_id', 'purchase_date', 'purchase_cost', 'po_number',
        'vendor_name', 'warranty_expiry', 'amc_vendor', 'amc_expiry',
        'invoice_document_path', 'current_location_id', 'current_plant_id',
        'current_department_id', 'assigned_employee_id', 'status',
        'is_deleted', 'created_by', 'created_at', 'updated_at'
      ]);

      const dbPayload: Record<string, any> = {};
      for (const [k, v] of Object.entries(newAssetObj)) {
        if (VALID_ASSET_COLUMNS.has(k)) {
          dbPayload[k] = v;
        }
      }

      const outcome = await withNamedLock(`asset-serial:${cleanSerial}`, async (): Promise<{ ok: true } | { ok: false; reason: string }> => {
        const duplicate = await findActiveAssetBySerial(cleanSerial);
        if (duplicate) return { ok: false, reason: `Already registered as ${duplicate.asset_tag}` };
        for (let attempt = 1; attempt <= TAG_COLLISION_MAX_ATTEMPTS; attempt++) {
          const { error: insertErr } = await db.from('assets').insert(dbPayload);
          if (!insertErr) return { ok: true };
          if (!isDuplicateKeyError(insertErr)) return { ok: false, reason: insertErr.message };
          await collisionBackoff(attempt);
          dbPayload.asset_tag = await generateUniqueAssetTag(catId, itAssetType);
        }
        return { ok: false, reason: 'Asset tag collided too many times; please re-import this row' };
      });
      assignedTag = dbPayload.asset_tag;
      if (!outcome.ok) {
        console.warn(`Failed to insert batch asset ${assignedTag}:`, outcome.reason);
        result.skipped_rows.push({ serial_number: cleanSerial, reason: outcome.reason });
        continue;
      }

      if (assignedEmployeeId) {
        try {
          await openAssignment({
            assetId,
            employeeId: assignedEmployeeId,
            assignedBy: userId,
            remarks: item.remarks?.trim() || 'Batch Excel Assignment',
            at: now,
          });
        } catch (assignErr) {
          console.warn(`Failed to log asset_assignment record for ${assignedTag}:`, assignErr);
        }
      }
    }

    result.assets_created++;
    result.imported_tags.push(assignedTag);
    if (assignedEmployeeId) {
      result.assets_assigned++;
    } else {
      result.assets_in_stock++;
    }
  }

  invalidateAssetCache();
  invalidateMasterDataCache();
  return result;
}

