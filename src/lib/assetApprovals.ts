// =============================================================================
// AEMS v2 — Plant Head approval requests for issuing a second asset of the
// same type to an employee. The request is mailed to the plant head(s), who
// approve or reject it from a public, token-protected page.
// =============================================================================

import { randomBytes } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '@/lib/env';
import { getPool } from '@/lib/db/mysql';
import { persistDemoState } from '@/lib/demoPersistence';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'used';

export interface AssetApprovalRequest {
  id: string;
  token: string;
  asset_id: string | null;
  asset_label: string | null;
  employee_id: string;
  employee_label: string | null;
  category_id: string;
  category_name: string;
  existing_assets: string | null;
  to_emails: string;
  cc_emails: string | null;
  request_remarks: string | null;
  requested_by: string | null;
  requested_by_label: string | null;
  requested_by_email: string | null;
  status: ApprovalStatus;
  decided_by_name: string | null;
  decision_remarks: string | null;
  decided_at: string | null;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NewApprovalRequest = Pick<
  AssetApprovalRequest,
  | 'asset_id'
  | 'asset_label'
  | 'employee_id'
  | 'employee_label'
  | 'category_id'
  | 'category_name'
  | 'existing_assets'
  | 'to_emails'
  | 'cc_emails'
  | 'request_remarks'
  | 'requested_by'
  | 'requested_by_label'
  | 'requested_by_email'
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_APPROVAL_RECIPIENTS = 20;

const globalRef = globalThis as unknown as {
  __aems_approval_memory?: AssetApprovalRequest[];
  __aems_approval_table_ready?: Promise<void>;
};

function memory(): AssetApprovalRequest[] {
  if (!globalRef.__aems_approval_memory) globalRef.__aems_approval_memory = [];
  return globalRef.__aems_approval_memory;
}

if (env.isMockMode) {
  persistDemoState(
    'approvalRequests',
    () => memory(),
    (saved) => {
      if (Array.isArray(saved)) globalRef.__aems_approval_memory = saved as AssetApprovalRequest[];
    }
  );
}

function ensureTable(): Promise<void> {
  if (!globalRef.__aems_approval_table_ready) {
    globalRef.__aems_approval_table_ready = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS asset_approval_requests (
          id                  CHAR(36)     NOT NULL,
          token               VARCHAR(64)  NOT NULL,
          asset_id            CHAR(36)     NULL,
          asset_label         VARCHAR(500) NULL,
          employee_id         CHAR(36)     NOT NULL,
          employee_label      VARCHAR(255) NULL,
          category_id         CHAR(36)     NOT NULL,
          category_name       VARCHAR(255) NOT NULL,
          existing_assets     TEXT         NULL,
          to_emails           TEXT         NOT NULL,
          cc_emails           TEXT         NULL,
          request_remarks     TEXT         NULL,
          requested_by        CHAR(36)     NULL,
          requested_by_label  VARCHAR(255) NULL,
          requested_by_email  VARCHAR(255) NULL,
          status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
          decided_by_name     VARCHAR(255) NULL,
          decision_remarks    TEXT         NULL,
          decided_at          DATETIME(3)  NULL,
          used_at             DATETIME(3)  NULL,
          created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY uq_asset_approval_token (token),
          KEY idx_asset_approval_employee (employee_id, category_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      )
      .then(() => undefined)
      .catch((err) => {
        globalRef.__aems_approval_table_ready = undefined;
        throw err;
      });
  }
  return globalRef.__aems_approval_table_ready;
}

function rowToRequest(r: RowDataPacket): AssetApprovalRequest {
  return {
    id: r.id,
    token: r.token,
    asset_id: r.asset_id || null,
    asset_label: r.asset_label || null,
    employee_id: r.employee_id,
    employee_label: r.employee_label || null,
    category_id: r.category_id,
    category_name: r.category_name,
    existing_assets: r.existing_assets || null,
    to_emails: r.to_emails || '',
    cc_emails: r.cc_emails || null,
    request_remarks: r.request_remarks || null,
    requested_by: r.requested_by || null,
    requested_by_label: r.requested_by_label || null,
    requested_by_email: r.requested_by_email || null,
    status: (r.status as ApprovalStatus) || 'pending',
    decided_by_name: r.decided_by_name || null,
    decision_remarks: r.decision_remarks || null,
    decided_at: r.decided_at || null,
    used_at: r.used_at || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function toSqlDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 23).replace('T', ' ');
}

/** Splits a comma/semicolon/newline separated list and keeps unique valid emails. */
export function parseEmailList(raw: unknown): { valid: string[]; invalid: string[] } {
  const items = Array.isArray(raw) ? raw.map(String) : String(raw ?? '').split(/[,;\n]+/);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const item of items) {
    const email = item.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) invalid.push(email);
    else if (!valid.includes(email)) valid.push(email);
  }
  return { valid, invalid };
}

export async function createApprovalRequest(input: NewApprovalRequest): Promise<AssetApprovalRequest> {
  const now = new Date().toISOString();
  const request: AssetApprovalRequest = {
    ...input,
    id: crypto.randomUUID(),
    token: randomBytes(24).toString('hex'),
    status: 'pending',
    decided_by_name: null,
    decision_remarks: null,
    decided_at: null,
    used_at: null,
    created_at: now,
    updated_at: now,
  };

  if (env.isMockMode) {
    memory().unshift(request);
    return request;
  }

  await ensureTable();
  await getPool().query(
    `INSERT INTO asset_approval_requests
      (id, token, asset_id, asset_label, employee_id, employee_label, category_id, category_name, existing_assets,
       to_emails, cc_emails, request_remarks, requested_by, requested_by_label, requested_by_email, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      request.id, request.token, request.asset_id, request.asset_label, request.employee_id, request.employee_label,
      request.category_id, request.category_name, request.existing_assets, request.to_emails, request.cc_emails,
      request.request_remarks, request.requested_by, request.requested_by_label, request.requested_by_email,
    ]
  );
  return request;
}

async function findOne(column: 'id' | 'token', value: string): Promise<AssetApprovalRequest | null> {
  if (!value) return null;
  if (env.isMockMode) return memory().find((r) => r[column] === value) || null;
  await ensureTable();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT * FROM asset_approval_requests WHERE ${column === 'id' ? 'id' : 'token'} = ? LIMIT 1`,
    [value]
  );
  return rows[0] ? rowToRequest(rows[0]) : null;
}

export function getApprovalRequestById(id: string): Promise<AssetApprovalRequest | null> {
  return findOne('id', id);
}

export function getApprovalRequestByToken(token: string): Promise<AssetApprovalRequest | null> {
  return findOne('token', token);
}

/**
 * Records the plant head's decision. Only a pending request can be decided, and the
 * status check is part of the UPDATE so two clicks cannot both succeed.
 */
export async function decideApprovalRequest(
  token: string,
  decision: 'approved' | 'rejected',
  deciderName: string,
  remarks: string | null
): Promise<AssetApprovalRequest | null> {
  const now = new Date().toISOString();
  if (env.isMockMode) {
    const req = memory().find((r) => r.token === token);
    if (!req || req.status !== 'pending') return null;
    Object.assign(req, { status: decision, decided_by_name: deciderName, decision_remarks: remarks, decided_at: now, updated_at: now });
    return req;
  }
  await ensureTable();
  const [result] = await getPool().query(
    `UPDATE asset_approval_requests
        SET status = ?, decided_by_name = ?, decision_remarks = ?, decided_at = ?
      WHERE token = ? AND status = 'pending'`,
    [decision, deciderName, remarks, toSqlDate(now), token]
  );
  if (!(result as { affectedRows?: number }).affectedRows) return null;
  return getApprovalRequestByToken(token);
}

/**
 * Consumes an approved request so one approval issues exactly one extra asset.
 * Pass assetId once known; returns false if the request was not (or no longer) approved.
 */
export async function markApprovalRequestUsed(id: string, assetId: string | null): Promise<boolean> {
  const now = new Date().toISOString();
  if (env.isMockMode) {
    const req = memory().find((r) => r.id === id);
    if (!req || req.status !== 'approved') return false;
    Object.assign(req, { status: 'used', used_at: now, asset_id: req.asset_id || assetId, updated_at: now });
    return true;
  }
  await ensureTable();
  const [result] = await getPool().query(
    `UPDATE asset_approval_requests
        SET status = 'used', used_at = ?, asset_id = COALESCE(asset_id, ?)
      WHERE id = ? AND status = 'approved'`,
    [toSqlDate(now), assetId, id]
  );
  return Boolean((result as { affectedRows?: number }).affectedRows);
}

/** Records which asset a consumed approval was used for (new registrations only know it afterwards). */
export async function linkApprovalToAsset(id: string, assetId: string): Promise<void> {
  if (env.isMockMode) {
    const req = memory().find((r) => r.id === id);
    if (req && !req.asset_id) req.asset_id = assetId;
    return;
  }
  await ensureTable();
  await getPool().query(`UPDATE asset_approval_requests SET asset_id = COALESCE(asset_id, ?) WHERE id = ?`, [assetId, id]);
}

/** Puts a consumed approval back to "approved" when the assignment it was used for failed. */
export async function restoreApprovalRequest(id: string): Promise<void> {
  const now = new Date().toISOString();
  if (env.isMockMode) {
    const req = memory().find((r) => r.id === id);
    if (req && req.status === 'used') Object.assign(req, { status: 'approved', used_at: null, updated_at: now });
    return;
  }
  await ensureTable();
  await getPool().query(
    `UPDATE asset_approval_requests SET status = 'approved', used_at = NULL WHERE id = ? AND status = 'used'`,
    [id]
  );
}

/**
 * Checks that an approval request is approved and was raised for this exact
 * employee / asset type (and asset, when the request named one).
 */
export async function verifyApprovalForAssignment(params: {
  requestId: string;
  employeeId: string;
  categoryId: string;
  assetId?: string | null;
}): Promise<{ ok: true; request: AssetApprovalRequest } | { ok: false; error: string }> {
  const request = await getApprovalRequestById(params.requestId);
  if (!request) return { ok: false, error: 'Approval request not found.' };
  if (request.status === 'pending') return { ok: false, error: 'Plant Head approval is still pending.' };
  if (request.status === 'rejected') return { ok: false, error: 'This request was rejected by the Plant Head.' };
  if (request.status === 'used') return { ok: false, error: 'This approval has already been used for another assignment.' };
  if (request.employee_id !== params.employeeId || request.category_id !== params.categoryId) {
    return { ok: false, error: 'This approval was issued for a different employee or asset type.' };
  }
  if (request.asset_id && params.assetId && request.asset_id !== params.assetId) {
    return { ok: false, error: 'This approval was issued for a different asset.' };
  }
  return { ok: true, request };
}
