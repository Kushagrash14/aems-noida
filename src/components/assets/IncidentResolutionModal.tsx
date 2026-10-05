'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DamageScrapReport, Employee } from '@/types/database';
import {
  X,
  Trash2,
  CheckCircle2,
  UserCheck,
  Inbox,
  HelpCircle,
  Wrench,
} from 'lucide-react';

interface IncidentResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  report: DamageScrapReport;
}

export default function IncidentResolutionModal({
  isOpen,
  onClose,
  onSuccess,
  report,
}: IncidentResolutionModalProps) {
  const [resolutionAction, setResolutionAction] = useState<'reassigned' | 'returned_to_stock' | 'scrapped'>('returned_to_stock');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/employees')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.employees)) {
          setEmployees(data.employees);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (report) {
      const defaultEmpId = report.asset?.assigned_employee_id || '';
      setSelectedEmployeeId(defaultEmpId);
      // If asset had a previous custodian, default to reassigned; else returned_to_stock
      if (defaultEmpId || (report.employee_name && !report.employee_name.includes('Stock') && !report.employee_name.includes('Direct'))) {
        setResolutionAction('reassigned');
      } else {
        setResolutionAction('returned_to_stock');
      }
    }
  }, [report]);

  if (!isOpen || !report || !mounted) return null;

  const isDamaged = report.report_type === 'damaged';
  const isMissing = report.report_type === 'missing';

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/damaged-scrap', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          action: 'resolve',
          resolutionAction,
          resolutionNotes: resolutionNotes.trim() || null,
          assignedEmployeeId: resolutionAction === 'reassigned' ? selectedEmployeeId || null : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to resolve incident');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aems:asset-updated'));
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error resolving incident');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-5 overflow-hidden">
      <div className="max-w-xl w-full max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-200 text-slate-900 overflow-hidden">
        {/* Sticky Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border shrink-0 ${isMissing ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
              {isMissing ? <HelpCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-900">
                {isMissing ? 'Recover Missing Asset' : isDamaged ? 'Resolve Damaged Asset' : 'Resolve Incident'}
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Tag: {report.asset?.asset_tag || 'N/A'} | Asset: {report.asset?.name || 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleResolve} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            <div className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="font-bold text-orange-600 block mb-1">Original Incident Reason:</span>
              &ldquo;{report.reason}&rdquo;
              {report.employee_name && !report.employee_name.includes('Stock') && !report.employee_name.includes('Direct') && (
                <div className="mt-1 text-[11px] text-slate-500 font-mono">
                  Reported Custodian: <span className="font-bold text-slate-800">{report.employee_name}</span> ({report.employee_id || 'No ID'})
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Select Recovery / Resolution Path *
              </label>

              <div className="space-y-3">
                {/* Option 1: Re-assign to Employee */}
                <label
                  className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                    resolutionAction === 'reassigned'
                      ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="resolution"
                      value="reassigned"
                      checked={resolutionAction === 'reassigned'}
                      onChange={() => setResolutionAction('reassigned')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        <span>{isMissing ? 'Recover & Re-assign to Employee' : 'Repaired & Re-assign to Employee'}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Asset is active in service and assigned to an employee custodian.
                      </p>
                    </div>
                  </div>

                  {/* Employee Dropdown when Reassigned is selected */}
                  {resolutionAction === 'reassigned' && (
                    <div className="mt-3 pt-2.5 border-t border-blue-200/60 pl-6">
                      <label className="block text-[11px] font-bold text-blue-900 uppercase mb-1">
                        Select Employee Custodian:
                      </label>
                      <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="w-full bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
                      >
                        <option value="">-- Choose Active Employee to Assign --</option>
                        {employees
                          .filter((emp) => emp.status !== 'inactive' && (emp.status as string) !== 'resigned')
                          .map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.full_name} ({emp.emp_code}) — {emp.department?.name || 'PGEL Staff'}
                            </option>
                          ))}
                      </select>
                      {report.employee_name && !report.employee_name.includes('Stock') && !report.employee_name.includes('Direct') && (
                        <p className="text-[10px] text-blue-700 mt-1 italic">
                          Prior Custodian at Incident: {report.employee_name}
                        </p>
                      )}
                    </div>
                  )}
                </label>

                {/* Option 2: Add to Stock Pool */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    resolutionAction === 'returned_to_stock'
                      ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value="returned_to_stock"
                    checked={resolutionAction === 'returned_to_stock'}
                    onChange={() => setResolutionAction('returned_to_stock')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Inbox className="w-4 h-4 text-emerald-600" />
                      <span>{isMissing ? 'Recover & Add to Stock' : 'Repaired & Add to Stock'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Asset is added to Available Stock (In Storage). Unlinks custodian so it can be deployed or issued later.
                    </p>
                  </div>
                </label>

                {/* Option 3: Scrap (ONLY for Damaged) */}
                {isDamaged && (
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      resolutionAction === 'scrapped'
                        ? 'bg-rose-50/70 border-rose-400 ring-1 ring-rose-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="resolution"
                      value="scrapped"
                      checked={resolutionAction === 'scrapped'}
                      onChange={() => setResolutionAction('scrapped')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        <span>Unrepairable -&gt; Move to Scrap Archive</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Asset cannot be repaired. De-capitalize and move to permanent Scrapped archive.
                      </p>
                    </div>
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Resolution Remarks / Recovery Note
              </label>
              <input
                type="text"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder={isMissing ? "e.g. Asset found, verified condition and recovered" : "e.g. Screen replaced by vendor, tested fully functional"}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all font-medium"
              />
            </div>
          </div>

          {/* Sticky Fixed Footer */}
          <div className="flex items-center justify-end gap-2.5 p-4 sm:px-6 border-t border-slate-100 bg-slate-50/80 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Processing...' : isMissing ? 'Confirm Recovery' : 'Confirm Resolution'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
