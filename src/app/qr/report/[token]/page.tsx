'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Shield, AlertTriangle, CheckCircle2, Wrench, RefreshCw, Send } from 'lucide-react';

interface MachinePublicInfo {
  id: string;
  machine_code: string;
  machine_name: string;
  plant_name: string;
  location_name: string;
  department_name: string;
  status: string;
}

export default function PublicQrReportPage() {
  const params = useParams();
  const token = params.token as string;

  const [machine, setMachine] = useState<MachinePublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadMachine() {
      try {
        const res = await fetch(`/api/pm/token/${token}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Invalid or expired QR token');
        }
        setMachine(data.machine);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error loading machine details');
      } finally {
        setLoading(false);
      }
    }
    loadMachine();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/pm/complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: machine.id,
          reporterName: reporterName.trim(),
          reporterContact: reporterContact.trim() || null,
          description: description.trim(),
          priority,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit complaint');
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm">Reading machine encryption token...</p>
      </div>
    );
  }

  if (error && !machine) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">QR Code Scan Error</h2>
          <p className="text-xs text-slate-400 mb-4">{error}</p>
          <p className="text-[11px] text-slate-500">
            Please ask the maintenance desk for a refreshed machine badge tag.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8 relative">
      <div className="max-w-md w-full">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>PG Electroplast • Floor Dispatch</span>
          </div>
          <h1 className="text-xl font-black text-white">Machine Breakdown Reporting</h1>
          <p className="text-xs text-slate-400 mt-0.5">Quick floor scan notification portal</p>
        </div>

        {/* Machine Badge Card */}
        {machine && (
          <div className="mb-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 to-slate-900/60 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-sm font-black text-white">{machine.machine_code}</span>
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30 uppercase">
                {machine.status}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-200">{machine.machine_name}</p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800">
              <span>{machine.plant_name}</span>
              <span>•</span>
              <span>{machine.department_name}</span>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {submitted ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Complaint Logged Successfully</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The maintenance department and plant engineers have been notified. A technician will inspect{' '}
                <span className="text-white font-bold">{machine?.machine_code}</span> shortly.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setDescription('');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Log another issue
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar (Operator)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Contact Number / Intercom</label>
                <input
                  type="text"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  placeholder="e.g. +91 98XXX XXXXX or Ext 412"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Issue Description *</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe abnormal noise, hydraulic leakage, sensor fault, motor tripping..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Severity / Urgency</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer border ${
                        priority === p
                          ? p === 'critical'
                            ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30'
                            : p === 'high'
                            ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/30'
                            : 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{submitting ? 'Transmitting Report...' : 'Submit Breakdown Alert'}</span>
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          Submissions are rate-limited and logged with machine token cryptography.
        </p>
      </div>
    </div>
  );
}
