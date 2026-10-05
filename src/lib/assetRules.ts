// =============================================================================
// AEMS v2 — Assignment business rules shared by register & assign APIs
// =============================================================================

import { getAssets, getCategories } from '@/lib/store';

export interface SameTypeAssetInfo {
  id: string;
  asset_tag: string;
  name: string;
  serial_number: string | null;
}

export interface DuplicateTypeConflict {
  code: 'DUPLICATE_ASSET_TYPE';
  categoryId: string;
  categoryName: string;
  employeeId: string;
  existing: SameTypeAssetInfo[];
}

export interface DuplicateApproval {
  approvalRequestId: string;
  approverName: string;
  approverDesignation: string;
  evidenceName: string;
  evidenceUrl: string;
  remarks?: string;
}

export async function findSameTypeConflict(params: {
  employeeId: string;
  categoryId: string;
  excludeAssetId?: string;
}): Promise<DuplicateTypeConflict | null> {
  const { employeeId, categoryId, excludeAssetId } = params;
  if (!employeeId || !categoryId) return null;

  const sameType = (await getAssets({ categoryId })).filter(
    (a) => a.assigned_employee_id === employeeId && a.id !== excludeAssetId && !a.is_deleted
  );
  if (sameType.length === 0) return null;

  const category = (await getCategories()).find((c) => c.id === categoryId);
  return {
    code: 'DUPLICATE_ASSET_TYPE',
    categoryId,
    categoryName: category?.name?.toUpperCase() || 'SAME TYPE',
    employeeId,
    existing: sameType.map((a) => ({
      id: a.id,
      asset_tag: a.asset_tag,
      name: a.name,
      serial_number: a.serial_number ?? null,
    })),
  };
}

export function parseDuplicateApproval(raw: unknown): DuplicateApproval | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const approval: DuplicateApproval = {
    approvalRequestId: str(r.approvalRequestId),
    approverName: str(r.approverName),
    approverDesignation: str(r.approverDesignation),
    evidenceName: str(r.evidenceName),
    evidenceUrl: str(r.evidenceUrl),
    remarks: str(r.remarks) || undefined,
  };
  // The Plant Head's emailed approval is the evidence; an extra document is optional.
  if (!approval.approvalRequestId || !approval.approverName || !approval.approverDesignation) return null;
  return approval;
}

export interface HodNotification {
  email: string;
  name?: string;
  empCode?: string;
  departmentName?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseHod(raw: unknown): HodNotification | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const email = typeof r.email === 'string' ? r.email.trim() : '';
  if (!EMAIL_RE.test(email)) return null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return { email, name: str(r.name), empCode: str(r.empCode), departmentName: str(r.departmentName) };
}

export function approvalForAudit(a: DuplicateApproval): Record<string, unknown> {
  return {
    ...a,
    evidenceUrl: a.evidenceUrl.startsWith('data:') ? `[inline document: ${a.evidenceName}]` : a.evidenceUrl || null,
  };
}

export function describeApproval(a: DuplicateApproval): string {
  return `Duplicate asset type approved by ${a.approverName} (${a.approverDesignation}) via Plant Head email approval${a.evidenceName ? `; evidence: ${a.evidenceName}` : ''}`;
}
