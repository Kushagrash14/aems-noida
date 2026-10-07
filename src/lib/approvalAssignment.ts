// =============================================================================
// AEMS v2 — Glue between duplicate-type approvals and the register / assign APIs
// =============================================================================

import type { Asset } from '@/types/database';
import type { DuplicateApproval } from '@/lib/assetRules';
import { markApprovalRequestUsed, restoreApprovalRequest, verifyApprovalForAssignment } from '@/lib/assetApprovals';
import { getAssetById, getEmployees } from '@/lib/store';
import { sendAssetAssignedEmployeeEmail } from '@/lib/mailer';

/**
 * Verifies the Plant Head approval and consumes it before the assignment runs.
 * Returns an error message when the approval cannot be used.
 */
export async function consumeDuplicateApproval(
  approval: DuplicateApproval,
  params: { employeeId: string; categoryId: string; assetId?: string | null }
): Promise<string | null> {
  const check = await verifyApprovalForAssignment({ requestId: approval.approvalRequestId, ...params });
  if (!check.ok) return check.error;
  const consumed = await markApprovalRequestUsed(approval.approvalRequestId, params.assetId || null);
  return consumed ? null : 'This approval has already been used for another assignment.';
}

export async function releaseDuplicateApproval(approval: DuplicateApproval | null): Promise<void> {
  if (approval) await restoreApprovalRequest(approval.approvalRequestId).catch(() => undefined);
}

/** Emails the employee that an asset has been assigned to them (skipped when no email on file). */
export async function notifyEmployeeOfAssignment(params: {
  assetId: string;
  employeeId: string;
  assignedBy: { full_name?: string | null; email?: string | null };
  approval?: DuplicateApproval | null;
  fallbackAsset?: Asset;
}): Promise<{ sent: boolean; error?: string } | undefined> {
  const employee = (await getEmployees()).find((e) => e.id === params.employeeId);
  if (!employee?.email) return undefined;
  const asset = (await getAssetById(params.assetId)) || params.fallbackAsset;
  if (!asset) return undefined;

  const assignedBy = params.assignedBy.full_name && params.assignedBy.email
    ? `${params.assignedBy.full_name} (${params.assignedBy.email})`
    : params.assignedBy.full_name || params.assignedBy.email || 'A.E.M.S';

  const result = await sendAssetAssignedEmployeeEmail({
    to: employee.email,
    employeeName: employee.full_name,
    empCode: employee.emp_code,
    assetTag: asset.asset_tag,
    sapAssetCode: asset.sap_asset_code,
    assetName: asset.name,
    assetType: asset.category?.name,
    model: asset.model,
    serialNumber: asset.serial_number,
    plantName: asset.plant?.name,
    locationName: asset.location?.name,
    assignedBy,
    assignedAt: new Date().toISOString(),
    approvedBy: params.approval ? `${params.approval.approverName} (${params.approval.approverDesignation})` : null,
  });
  return { sent: result.success, error: result.error };
}
