// =============================================================================
// AEMS v2 — Enterprise SMTP Mailer Service (Microsoft Office 365)
// =============================================================================

import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/lib/env';

// Lazy-initialized Nodemailer transporter
let transporterInstance: Transporter | null = null;

export function getSmtpTransporter(): Transporter {
  if (transporterInstance) {
    return transporterInstance;
  }

  const host = env.smtpHost || process.env.SMTP_HOST || 'smtp.office365.com';
  const port = Number(env.smtpPort || process.env.SMTP_PORT || 587);
  const user = env.smtpEmail || process.env.SMTP_EMAIL || 'verify.software2040@pgel.in';
  const pass = env.smtpPassword || process.env.SMTP_PASSWORD || '';

  transporterInstance = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // false for 587 (STARTTLS)
    auth: {
      user,
      pass,
    },
    tls: {
      minVersion: 'TLSv1.2',
    },
  });

  return transporterInstance;
}

export interface SendMailOptions {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using configured Office 365 SMTP
 */
export async function sendEmail({
  to,
  cc,
  subject,
  html,
  text,
  from,
}: SendMailOptions): Promise<SendMailResult> {
  const fromAddress = from || env.otpFromEmail || process.env.OTP_FROM_EMAIL || 'verify.software2040@pgel.in';
  const senderFormatted = `"PG Groups AEMS" <${fromAddress}>`;

  try {
    const transporter = getSmtpTransporter();

    const info = await transporter.sendMail({
      from: senderFormatted,
      to,
      ...(cc ? { cc } : {}),
      subject,
      text: text || html.replace(/<[^>]*>?/gm, ''),
      html,
    });

    console.log(`\x1b[32m[AEMS SMTP SUCCESS]\x1b[0m Email sent to ${to}. MessageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown SMTP error';
    console.error(`\x1b[31m[AEMS SMTP ERROR]\x1b[0m Failed to send email to ${to}:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Send branded OTP verification email to user
 */
export async function sendOtpEmail(toEmail: string, otpCode: string): Promise<SendMailResult> {
  const subject = `[AEMS] Your Verification Code: ${otpCode}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AEMS Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; text-align: center; border-bottom: 3px solid #2563eb;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">PG GROUPS</h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Asset Entry Management System (AEMS v2)</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #1e293b; font-size: 18px; font-weight: 700;">Account Authentication</h2>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                You have requested a secure One-Time Password (OTP) to authenticate into the <strong>Asset Entry Management System</strong>.
              </p>

              <!-- OTP Code Display Card -->
              <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="display: block; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">Your One-Time Password</span>
                <span style="display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #2563eb; background-color: #ffffff; padding: 8px 24px; border-radius: 8px; border: 1px solid #e2e8f0;">
                  ${otpCode}
                </span>
                <span style="display: block; font-size: 12px; font-weight: 600; color: #dc2626; margin-top: 12px;">
                  ⏱️ Valid for the next 10 minutes only
                </span>
              </div>

              <!-- Security Information -->
              <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                • Do not share this OTP with anyone, including IT Support.<br>
                • If you did not initiate this login request, please inform your plant IT administrator immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 500;">
                © 2026 PG Groups. All rights reserved.<br>
                This is an automated notification from <a href="mailto:verify.software2040@pgel.in" style="color: #2563eb; text-decoration: none;">verify.software2040@pgel.in</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
PG GROUPS — AEMS v2
==================================
Account Authentication Code

Your One-Time Password (OTP) is: ${otpCode}

This code is valid for 10 minutes.
Do not share this code with anyone.

If you did not request this OTP, please contact your IT administrator immediately.

© 2026 PG Groups.
verify.software2040@pgel.in
  `.trim();

  return sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface InHouseHodMailParams {
  to: string;
  hodName?: string;
  hodEmpCode?: string;
  departmentName: string;
  assetTag: string;
  assetName: string;
  assetType?: string;
  serialNumber?: string | null;
  model?: string | null;
  plantName?: string | null;
  locationName?: string | null;
  exactLocation?: string | null;
  registeredBy?: string | null;
  registeredAt: string;
}

/**
 * Notify the department HOD that an asset was registered under in-house departmental custody
 */
export async function sendInHouseHodEmail(p: InHouseHodMailParams): Promise<SendMailResult> {
  const when = new Date(p.registeredAt).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const rows: Array<[string, string | null | undefined]> = [
    ['Asset Tag', p.assetTag],
    ['Asset Name', p.assetName],
    ['Asset Type', p.assetType],
    ['Model', p.model],
    ['Serial Number', p.serialNumber],
    ['Department', p.departmentName],
    ['Plant', p.plantName],
    ['Location', p.locationName],
    ['Installed At', p.exactLocation],
    ['Registered By', p.registeredBy],
    ['Registered On', when],
  ];
  const tableRows = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;width:40%">${k}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600">${escapeHtml(String(v))}</td></tr>`
    )
    .join('');

  const greeting = p.hodName ? `Dear ${escapeHtml(p.hodName)}${p.hodEmpCode ? ` (${escapeHtml(p.hodEmpCode)})` : ''},` : 'Dear HOD,';

  const html = `
<div style="background:#f1f5f9;padding:32px 10px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:3px solid #059669">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:800">PG GROUPS</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase">A.E.M.S — In-House Asset Assignment</p>
    </td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 12px;color:#1e293b;font-size:14px">${greeting}</p>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6">
        The following asset has been registered and assigned for in-house use under your department <strong>${escapeHtml(p.departmentName)}</strong>.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;border-collapse:separate;overflow:hidden">${tableRows}</table>
      <p style="margin:20px 0 0;color:#64748b;font-size:12px">Please contact the IT team if this assignment is incorrect.</p>
    </td></tr>
    <tr><td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:11px">Automated notification from A.E.M.S</td></tr>
  </table>
</div>`.trim();

  return sendEmail({
    to: p.to,
    subject: `[A.E.M.S] In-House Asset Assigned to ${p.departmentName}: ${p.assetTag}`,
    html,
  });
}

function detailRowsHtml(rows: Array<[string, string | null | undefined]>): string {
  return rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;width:40%">${k}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600">${escapeHtml(String(v))}</td></tr>`
    )
    .join('');
}

function mailShell(p: { accent: string; subtitle: string; body: string }): string {
  return `
<div style="background:#f1f5f9;padding:32px 10px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="background:#0f172a;padding:20px 28px;border-bottom:3px solid ${p.accent}">
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:800">PG GROUPS</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase">${p.subtitle}</p>
    </td></tr>
    <tr><td style="padding:28px">${p.body}</td></tr>
    <tr><td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:11px">Automated notification from A.E.M.S</td></tr>
  </table>
</div>`.trim();
}

function mailButton(href: string, label: string, color: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 26px;margin:4px 6px;border-radius:10px;background:${color};color:#ffffff;font-size:14px;font-weight:800;text-decoration:none">${label}</a>`;
}

function formatMailDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

export interface DuplicateApprovalRequestMailParams {
  to: string[];
  cc: string[];
  employeeLabel: string;
  employeeDepartment?: string | null;
  categoryName: string;
  existingAssets: string[];
  requestedAsset?: string | null;
  requestedBy: string;
  requestRemarks?: string | null;
  requestedAt: string;
  approveUrl: string;
  rejectUrl: string;
}

/** Asks the plant head(s) to approve issuing a second asset of the same type. */
export async function sendDuplicateApprovalRequestEmail(p: DuplicateApprovalRequestMailParams): Promise<SendMailResult> {
  const rows = detailRowsHtml([
    ['Employee', p.employeeLabel],
    ['Department', p.employeeDepartment],
    ['Asset Type', p.categoryName],
    ['Currently Holds', p.existingAssets.join(', ')],
    ['Additional Asset Requested', p.requestedAsset],
    ['Reason / Remarks', p.requestRemarks],
    ['Requested By', p.requestedBy],
    ['Requested On', formatMailDate(p.requestedAt)],
  ]);

  const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:14px">Dear Plant Head,</p>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6">
        <strong>${escapeHtml(p.employeeLabel)}</strong> already has an asset of type <strong>${escapeHtml(p.categoryName)}</strong>,
        but an additional asset of the same type has been requested for this employee. Your approval is required before it can be assigned.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;border-collapse:separate;overflow:hidden">${rows}</table>
      <div style="margin:26px 0 8px;text-align:center">
        ${mailButton(p.approveUrl, 'Approve', '#059669')}
        ${mailButton(p.rejectUrl, 'Reject', '#dc2626')}
      </div>
      <p style="margin:10px 0 0;color:#64748b;font-size:12px;text-align:center">
        The button opens a secure page where you can add remarks and confirm your decision.
      </p>`;

  return sendEmail({
    to: p.to.join(', '),
    cc: p.cc.length ? p.cc.join(', ') : undefined,
    subject: `[A.E.M.S] Approval Required: Additional ${p.categoryName} for ${p.employeeLabel}`,
    html: mailShell({ accent: '#f59e0b', subtitle: 'A.E.M.S — Asset Approval Request', body }),
  });
}

export interface ApprovalDecisionMailParams {
  to: string;
  cc: string[];
  decision: 'approved' | 'rejected';
  decidedBy: string;
  decisionRemarks?: string | null;
  employeeLabel: string;
  categoryName: string;
  decidedAt: string;
}

/** Tells the requester (cc: plant heads) what the plant head decided. */
export async function sendApprovalDecisionEmail(p: ApprovalDecisionMailParams): Promise<SendMailResult> {
  const approved = p.decision === 'approved';
  const rows = detailRowsHtml([
    ['Employee', p.employeeLabel],
    ['Asset Type', p.categoryName],
    ['Decision', approved ? 'APPROVED' : 'REJECTED'],
    ['Decided By', p.decidedBy],
    ['Remarks', p.decisionRemarks],
    ['Decided On', formatMailDate(p.decidedAt)],
  ]);
  const body = `
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6">
        The request for an additional <strong>${escapeHtml(p.categoryName)}</strong> for <strong>${escapeHtml(p.employeeLabel)}</strong>
        has been <strong style="color:${approved ? '#059669' : '#dc2626'}">${approved ? 'APPROVED' : 'REJECTED'}</strong>.
        ${approved ? 'You can now complete the assignment in A.E.M.S.' : 'The asset cannot be assigned.'}
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;border-collapse:separate;overflow:hidden">${rows}</table>`;

  return sendEmail({
    to: p.to,
    cc: p.cc.length ? p.cc.join(', ') : undefined,
    subject: `[A.E.M.S] Request ${approved ? 'Approved' : 'Rejected'}: Additional ${p.categoryName} for ${p.employeeLabel}`,
    html: mailShell({ accent: approved ? '#059669' : '#dc2626', subtitle: 'A.E.M.S — Approval Decision', body }),
  });
}

export interface AssetAssignedEmployeeMailParams {
  to: string;
  cc?: string[];
  employeeName: string;
  empCode?: string | null;
  assetTag: string;
  assetName: string;
  assetType?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  plantName?: string | null;
  locationName?: string | null;
  assignedBy: string;
  assignedAt: string;
  approvedBy?: string | null;
}

/** Informs the employee that an asset has been assigned to them. */
export async function sendAssetAssignedEmployeeEmail(p: AssetAssignedEmployeeMailParams): Promise<SendMailResult> {
  const rows = detailRowsHtml([
    ['Asset Tag', p.assetTag],
    ['Asset Name', p.assetName],
    ['Asset Type', p.assetType],
    ['Model', p.model],
    ['Serial Number', p.serialNumber],
    ['Plant', p.plantName],
    ['Location', p.locationName],
    ['Approved By', p.approvedBy],
    ['Assigned By', p.assignedBy],
    ['Assigned On', formatMailDate(p.assignedAt)],
  ]);
  const body = `
      <p style="margin:0 0 12px;color:#1e293b;font-size:14px">Dear ${escapeHtml(p.employeeName)}${p.empCode ? ` (${escapeHtml(p.empCode)})` : ''},</p>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6">
        The following company asset has been assigned to you. Please take care of it and report any damage or loss to the IT team immediately.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:10px;border-collapse:separate;overflow:hidden">${rows}</table>
      <p style="margin:20px 0 0;color:#64748b;font-size:12px">Please contact the IT team if this assignment is incorrect.</p>`;

  return sendEmail({
    to: p.to,
    cc: p.cc && p.cc.length ? p.cc.join(', ') : undefined,
    subject: `[A.E.M.S] Asset Assigned to You: ${p.assetTag}`,
    html: mailShell({ accent: '#2563eb', subtitle: 'A.E.M.S — Asset Assignment', body }),
  });
}

/**
 * Verify SMTP connection and credentials
 */
export async function verifySmtp(): Promise<{ connected: boolean; error?: string }> {
  try {
    const transporter = getSmtpTransporter();
    await transporter.verify();
    return { connected: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown SMTP verification error';
    return { connected: false, error: errorMsg };
  }
}
