'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';

interface PublicApprovalView {
  status: 'pending' | 'approved' | 'rejected' | 'used';
  employee_label: string | null;
  category_name: string;
  existing_assets: string[];
  asset_label: string | null;
  request_remarks: string | null;
  requested_by_label: string | null;
  to_emails: string;
  created_at: string;
  decided_by_name: string | null;
  decision_remarks: string | null;
  decided_at: string | null;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function PlantHeadApprovalPage() {
  return (
    <Suspense fallback={null}>
      <PlantHeadApproval />
    </Suspense>
  );
}

function PlantHeadApproval() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action') === 'reject' ? 'rejected' : 'approved';

  const [request, setRequest] = useState<PublicApprovalView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>(initialAction);
  const [approverName, setApproverName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/public/asset-approval/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setLoadError(data.error || 'This approval link is invalid.');
        else setRequest(data.request);
      })
      .catch(() => !cancelled && setLoadError('Could not load the request. Please try again.'));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    setError(null);
    if (!approverName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (decision === 'rejected' && !remarks.trim()) {
      setError('Please enter a reason for rejection.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/asset-approval/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, approverName: approverName.trim(), remarks: remarks.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.request) setRequest(data.request);
      if (!res.ok) setError(data.error || 'Could not record your decision.');
    } catch {
      setError('Could not record your decision. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const details: Array<[string, string | null | undefined]> = request
    ? [
        ['Employee', request.employee_label],
        ['Asset Type', request.category_name],
        ['Currently Holds', request.existing_assets.join('\n')],
        ['Additional Asset Requested', request.asset_label],
        ['Reason / Remarks', request.request_remarks],
        ['Requested By', request.requested_by_label],
        ['Requested On', formatWhen(request.created_at)],
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-100 flex items-start sm:items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-5 border-b-4 border-amber-500 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pg-logo.png" alt="PG Electroplast" className="h-10 w-auto bg-white rounded-md p-1" />
          <div>
            <h1 className="text-white font-extrabold text-base tracking-wide">PG ELECTROPLAST LIMITED</h1>
            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">A.E.M.S — Plant Head Approval</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {loadError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm font-semibold text-rose-700">{loadError}</div>
          )}

          {!loadError && !request && (
            <div className="flex items-center justify-center py-10 text-slate-500 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading request…
            </div>
          )}

          {request && (
            <>
              <p className="text-sm text-slate-700 leading-relaxed">
                <strong>{request.employee_label}</strong> already has an asset of type <strong>{request.category_name}</strong>,
                but an additional asset of the same type has been requested.
              </p>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                {details
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="grid grid-cols-5 border-b border-slate-100 last:border-b-0">
                      <div className="col-span-2 px-3 py-2 text-[11px] font-bold uppercase text-slate-500 bg-slate-50">{k}</div>
                      <div className="col-span-3 px-3 py-2 text-sm font-semibold text-slate-900 whitespace-pre-line break-words">{v}</div>
                    </div>
                  ))}
              </div>

              {request.status === 'pending' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDecision('approved')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold cursor-pointer ${
                        decision === 'approved' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('rejected')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold cursor-pointer ${
                        decision === 'rejected' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Your Name *</label>
                    <input
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Remarks {decision === 'rejected' ? '*' : '(optional)'}
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      placeholder={decision === 'rejected' ? 'Reason for rejection' : 'Any conditions or notes'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  {error && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">{error}</div>
                  )}

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={submit}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold cursor-pointer disabled:opacity-60 ${
                      decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    {decision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                  </button>
                </div>
              ) : (
                <div
                  className={`p-4 rounded-xl border text-sm ${
                    request.status === 'rejected' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <p className="font-bold">
                    {request.status === 'rejected' ? 'This request has been rejected.' : 'This request has been approved.'}
                  </p>
                  <p className="mt-1">
                    Decided by <strong>{request.decided_by_name}</strong>
                    {request.decided_at ? ` on ${formatWhen(request.decided_at)}` : ''}.
                  </p>
                  {request.decision_remarks && <p className="mt-1">Remarks: {request.decision_remarks}</p>}
                  {error && <p className="mt-2 text-xs font-semibold">{error}</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
