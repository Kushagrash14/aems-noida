'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PMComplaint } from '@/types/database';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  AlertOctagon,
  Wrench,
  CheckCircle2,
  Clock,
  User,
  ArrowLeft,
  DollarSign,
  Package,
} from 'lucide-react';

export default function ComplaintsInboxPage() {
  const [complaints, setComplaints] = useState<PMComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolution modal state
  const [resolvingComplaint, setResolvingComplaint] = useState<PMComplaint | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [technicianCost, setTechnicianCost] = useState('');
  const [replacementParts, setReplacementParts] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = async () => {
    try {
      const res = await fetch('/api/pm/complaint');
      const data = await res.json();
      if (data?.complaints) {
        setComplaints(data.complaints);
      }
    } catch (err) {
      console.error('Fetch complaints error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingComplaint) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/pm/complaint', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaintId: resolvingComplaint.id,
          resolutionNotes,
          technicianCost: technicianCost ? Number(technicianCost) : null,
          replacementParts: replacementParts || null,
        }),
      });

      if (res.ok) {
        setResolvingComplaint(null);
        setResolutionNotes('');
        setTechnicianCost('');
        setReplacementParts('');
        fetchComplaints();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to resolve complaint');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/maintenance" className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to PM Schedules</span>
            </Link>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Machinery Breakdown Complaints Inbox</h1>
          <p className="text-xs text-slate-400">
            Real-time feed of rate-limited floor scan reports submitted by factory workers and operators
          </p>
        </div>
      </div>

      {/* Complaints List */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Reported Machine</th>
                <th className="px-4 py-3.5">Issue & Priority</th>
                <th className="px-4 py-3.5">Floor Reporter</th>
                <th className="px-4 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {complaints.map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-mono font-bold text-white">{c.machine?.machine_code || 'Unknown Unit'}</div>
                    <div className="text-[11px] text-slate-400">{c.machine?.machine_name}</div>
                  </td>
                  <td className="px-4 py-3.5 max-w-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded px-1.5 py-0.2 text-[10px] uppercase font-bold border ${getPriorityBadge(c.priority)}`}>
                        {c.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-2">{c.description}</p>
                    {c.resolution_notes && (
                      <p className="mt-1 text-[11px] text-emerald-400 font-medium">
                        Resolution: {c.resolution_notes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-white">{c.reporter_name}</div>
                    <div className="text-[10px] text-slate-500">{c.reporter_contact || 'No contact provided'}</div>
                    <div className="text-[9px] font-mono text-slate-600 mt-0.5">IP: {c.ip_address}</div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400">
                    {formatDateTime(c.created_at)}
                  </td>
                  <td className="px-4 py-3.5">
                    {c.status === 'resolved' ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3" />
                        Open
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {c.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => setResolvingComplaint(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {complaints.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">
                    No active breakdown complaints in inbox.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESOLUTION MODAL */}
      {resolvingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full glass-card rounded-2xl p-6 border border-slate-700 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-base font-bold text-white mb-1">
              Resolve Complaint — {resolvingComplaint.machine?.machine_code}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter technician findings, replaced spare parts, and labor/vendor service charges.
            </p>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Resolution Action Taken *</label>
                <textarea
                  rows={3}
                  required
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describe electrical/mechanical repair conducted..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Replacement Spares / Parts Used</label>
                <input
                  type="text"
                  value={replacementParts}
                  onChange={(e) => setReplacementParts(e.target.value)}
                  placeholder="e.g. 50A Contactor, Hydraulic Seal O-Ring"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Technician / Vendor Cost (₹ INR)</label>
                <input
                  type="number"
                  value={technicianCost}
                  onChange={(e) => setTechnicianCost(e.target.value)}
                  placeholder="e.g. 4500"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResolvingComplaint(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Resolving...' : 'Complete Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
