'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  Undo2,
  X,
  XCircle,
} from 'lucide-react';
import { uploadAttachment } from '@/lib/uploadClient';

export interface DuplicateConflictInfo {
  code: 'DUPLICATE_ASSET_TYPE';
  categoryId: string;
  categoryName: string;
  employeeId: string;
  existing: Array<{ id: string; asset_tag: string; name: string; serial_number: string | null }>;
}

export interface DuplicateApprovalPayload {
  approvalRequestId: string;
  approverName: string;
  approverDesignation: string;
  evidenceName: string;
  evidenceUrl: string;
  remarks?: string;
}

interface Props {
  conflict: DuplicateConflictInfo;
  employeeLabel?: string;
  /** The asset being assigned: its id for existing assets, or a short description for a new registration. */
  assetContext?: { assetId?: string | null; summary?: string | null };
  onClose: () => void;
  onDeassigned: () => void;
  onApproved: (approval: DuplicateApprovalPayload) => void;
}

type View = 'choose' | 'request' | 'waiting' | 'approval' | 'rejected';

interface RequestStatus {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'used';
  to_emails: string;
  cc_emails: string | null;
  decided_by_name: string | null;
  decision_remarks: string | null;
  decided_at: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TO_MEMORY_KEY = 'aems_plant_head_to_emails';
const CC_MEMORY_KEY = 'aems_plant_head_cc_emails';

function readList(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === 'string') : [];
  } catch {
    return [];
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function EmailChipsInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);

  const commit = (raw: string) => {
    const parts = raw.split(/[,;\s]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return;
    const bad = parts.find((p) => !EMAIL_RE.test(p));
    const good = parts.filter((p) => EMAIL_RE.test(p) && !value.includes(p));
    if (good.length) onChange([...value, ...good]);
    setInvalid(bad ? `"${bad}" is not a valid email` : null);
    setDraft(bad || '');
  };

  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{label}</label>
      <div className="flex flex-wrap items-center gap-1.5 min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 focus-within:border-blue-500 focus-within:bg-white">
        {value.map((email) => (
          <span key={email} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-800">
            {email}
            <button
              type="button"
              onClick={() => onChange(value.filter((e) => e !== email))}
              className="p-0.5 rounded hover:bg-blue-100 cursor-pointer"
              aria-label={`Remove ${email}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ') {
              e.preventDefault();
              commit(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          onPaste={(e) => {
            e.preventDefault();
            commit(`${draft} ${e.clipboardData.getData('text')}`);
          }}
          placeholder={value.length ? '' : placeholder}
          className="flex-1 min-w-[140px] bg-transparent text-xs py-1 focus:outline-none"
        />
      </div>
      {invalid && <p className="text-[10px] text-rose-600 font-semibold mt-1">{invalid}</p>}
    </div>
  );
}

export default function DuplicateAssetTypeModal({ conflict, employeeLabel, assetContext, onClose, onDeassigned, onApproved }: Props) {
  const storageKey = `aems_dup_approval::${conflict.employeeId}::${conflict.categoryId}::${assetContext?.assetId || 'new'}`;

  const [view, setView] = useState<View>('choose');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [toEmails, setToEmails] = useState<string[]>(() => (typeof window === 'undefined' ? [] : readList(TO_MEMORY_KEY)));
  const [ccEmails, setCcEmails] = useState<string[]>(() => (typeof window === 'undefined' ? [] : readList(CC_MEMORY_KEY)));
  const [requestRemarks, setRequestRemarks] = useState('');
  const [sending, setSending] = useState(false);

  const [request, setRequest] = useState<RequestStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const [approverName, setApproverName] = useState('');
  const [approverDesignation, setApproverDesignation] = useState('PLANT HEAD');
  const [remarks, setRemarks] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const applyStatus = useCallback(
    (next: RequestStatus) => {
      setRequest(next);
      if (next.status === 'pending') setView('waiting');
      else if (next.status === 'approved') {
        setApproverName((prev) => prev || (next.decided_by_name || '').toUpperCase());
        setView('approval');
      } else if (next.status === 'rejected') setView('rejected');
      else {
        localStorage.removeItem(storageKey);
        setRequest(null);
        setView('choose');
      }
    },
    [storageKey]
  );

  const fetchStatus = useCallback(
    async (id: string) => {
      setChecking(true);
      try {
        const res = await fetch(`/api/asset-approvals/${encodeURIComponent(id)}`);
        if (res.status === 404) {
          localStorage.removeItem(storageKey);
          setRequest(null);
          setView('choose');
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.request) applyStatus(data.request);
      } catch {
        // Keep the current view; the next poll will retry.
      } finally {
        setChecking(false);
      }
    },
    [applyStatus, storageKey]
  );

  useEffect(() => {
    const savedId = localStorage.getItem(storageKey);
    if (!savedId) return;
    const timer = setTimeout(() => fetchStatus(savedId), 0);
    return () => clearTimeout(timer);
  }, [storageKey, fetchStatus]);

  useEffect(() => {
    if (view !== 'waiting' || !request) return;
    const timer = setInterval(() => fetchStatus(request.id), 5000);
    return () => clearInterval(timer);
  }, [view, request, fetchStatus]);

  const handleDeassign = async (assetId: string) => {
    setBusyId(assetId);
    setError(null);
    try {
      const res = await fetch('/api/assets/deassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          returnCondition: 'Good Condition (Direct to Available Pool)',
          remarks: `Returned before issuing another ${conflict.categoryName}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'De-assign failed');
      onDeassigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'De-assign failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleSendRequest = async () => {
    setError(null);
    setInfo(null);
    if (toEmails.length === 0) {
      setError('Enter at least one Plant Head email address.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/asset-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: conflict.employeeId,
          categoryId: conflict.categoryId,
          assetId: assetContext?.assetId || null,
          assetSummary: assetContext?.summary || null,
          toEmails,
          ccEmails,
          remarks: requestRemarks.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send the approval request');

      localStorage.setItem(storageKey, data.request.id);
      localStorage.setItem(TO_MEMORY_KEY, JSON.stringify(toEmails));
      localStorage.setItem(CC_MEMORY_KEY, JSON.stringify(ccEmails));
      setRequest({ ...data.request, decided_by_name: null, decision_remarks: null, decided_at: null });
      setView('waiting');
      if (data.mail && !data.mail.sent) {
        setInfo(`Request saved, but the email could not be sent: ${data.mail.error || 'SMTP error'}. Please check the mail settings.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the approval request');
    } finally {
      setSending(false);
    }
  };

  const startOver = () => {
    localStorage.removeItem(storageKey);
    setRequest(null);
    setError(null);
    setInfo(null);
    setView('request');
  };

  const handleApprove = async () => {
    setError(null);
    if (!request || request.status !== 'approved') {
      setError('Plant Head approval is required before assigning.');
      return;
    }
    if (!approverName.trim() || !approverDesignation.trim()) {
      setError('Approver name and designation are required.');
      return;
    }
    if (evidence && evidence.size > 5 * 1024 * 1024) {
      setError('Evidence document must be 5 MB or smaller.');
      return;
    }
    setSubmitting(true);
    try {
      const url = evidence ? await uploadAttachment(evidence, evidence.name) : '';
      onApproved({
        approvalRequestId: request.id,
        approverName: approverName.trim().toUpperCase(),
        approverDesignation: approverDesignation.trim().toUpperCase(),
        evidenceName: evidence?.name || '',
        evidenceUrl: url,
        remarks: remarks.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evidence upload failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-amber-50 border-b border-amber-200">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">Same Asset Type Already Assigned</h3>
              <p className="text-xs text-amber-800 mt-0.5">
                {employeeLabel ? <strong>{employeeLabel}</strong> : 'This employee'} already has{' '}
                {conflict.existing.length > 1 ? `${conflict.existing.length} assets` : 'an asset'} of type{' '}
                <strong>{conflict.categoryName}</strong>.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-amber-700 hover:bg-amber-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">{error}</div>
          )}
          {info && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">{info}</div>
          )}

          {view === 'choose' && (
            <>
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Currently held {conflict.categoryName}</p>
                {conflict.existing.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 font-mono">{a.asset_tag}</div>
                      <div className="text-[11px] text-slate-600 break-words">
                        {a.name}
                        {a.serial_number ? ` • S/N ${a.serial_number}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => handleDeassign(a.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      {busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                      De-assign this
                    </button>
                  </div>
                ))}
              </div>

              <div className="relative flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase">
                <div className="flex-1 border-t border-slate-200" /> or <div className="flex-1 border-t border-slate-200" />
              </div>

              <button
                type="button"
                onClick={() => setView('request')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Need Approval — assign anyway
              </button>
            </>
          )}

          {view === 'request' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                An approval email with <strong>Approve</strong> / <strong>Reject</strong> options will be sent to the Plant Head.
                You can assign the asset only after it is approved.
              </p>
              <EmailChipsInput
                label="Plant Head Email(s) *"
                value={toEmails}
                onChange={setToEmails}
                placeholder="planthead@pgel.in — press Enter to add more"
              />
              <EmailChipsInput label="CC (optional)" value={ccEmails} onChange={setCcEmails} placeholder="Add CC emails" />
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Reason for Request</label>
                <textarea
                  value={requestRemarks}
                  onChange={(e) => setRequestRemarks(e.target.value)}
                  rows={2}
                  placeholder="Why does this employee need a second asset of the same type?"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setView('choose')}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={handleSendRequest}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Approval Request
                </button>
              </div>
            </div>
          )}

          {view === 'waiting' && request && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50">
                <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 space-y-1">
                  <p className="font-bold text-sm">Waiting for Plant Head approval</p>
                  <p className="flex items-start gap-1.5">
                    <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      Sent to <strong>{request.to_emails}</strong>
                      {request.cc_emails ? <> (CC: {request.cc_emails})</> : null}
                    </span>
                  </p>
                  <p>This window updates automatically once the Plant Head approves or rejects. You can close it and come back later.</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={startOver}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Send a new request
                </button>
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => fetchStatus(request.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                  Check status
                </button>
              </div>
            </div>
          )}

          {view === 'rejected' && request && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-rose-200 bg-rose-50">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 space-y-1">
                  <p className="font-bold text-sm">Request rejected by Plant Head</p>
                  <p>
                    Rejected by <strong>{request.decided_by_name}</strong>
                    {request.decided_at ? ` on ${formatWhen(request.decided_at)}` : ''}.
                  </p>
                  {request.decision_remarks && <p>Reason: {request.decision_remarks}</p>}
                  <p>This asset cannot be assigned to the employee.</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={startOver}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send a new request
                </button>
              </div>
            </div>
          )}

          {view === 'approval' && request && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Approved by {request.decided_by_name}
                    {request.decided_at ? ` on ${formatWhen(request.decided_at)}` : ''}
                  </p>
                  {request.decision_remarks && <p className="mt-0.5">Remarks: {request.decision_remarks}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Approved By (Name) *</label>
                  <input
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    placeholder="e.g. RAJESH KUMAR"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs uppercase focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Designation *</label>
                  <input
                    value={approverDesignation}
                    onChange={(e) => setApproverDesignation(e.target.value)}
                    placeholder="e.g. PLANT HEAD"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs uppercase focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Evidence Document (optional)</label>
                <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs text-slate-700">
                  {evidence ? <FileCheck2 className="w-4 h-4 text-emerald-600" /> : <Paperclip className="w-4 h-4 text-slate-400" />}
                  <span className="truncate">{evidence ? evidence.name : 'Attach any additional document (PDF, image)'}</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setEvidence(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Reason for issuing a second asset of the same type"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleApprove}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Approve &amp; Assign
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
