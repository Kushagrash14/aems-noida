'use client';

import { X, Calendar, CheckCircle2, Clock, AlertTriangle, Building2, Factory } from 'lucide-react';
import type { MaintenanceMachine } from '@/types/maintenance';
import { getPmCellStatus, istTodayKey } from '@/lib/maintenanceCodes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  machines: MaintenanceMachine[];
  selectedYear: number;
}

export default function ThisMonthPmModal({ isOpen, onClose, machines, selectedYear }: Props) {
  if (!isOpen) return null;

  const now = new Date();
  const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');
  const currentYearMonthKey = `${selectedYear}-${currentMonthNum}`;
  const monthName = now.toLocaleString('en-US', { month: 'long' });

  // Filter machines that have PM activity in current month
  const thisMonthMachines = machines.map((m) => {
    const status = getPmCellStatus(m, currentYearMonthKey, now);
    return { machine: m, status };
  }).filter((item) => item.status !== 'None');

  // Group by Plant
  const plantGroups: Record<string, typeof thisMonthMachines> = {};
  thisMonthMachines.forEach((item) => {
    const p = item.machine.plantCode || 'General';
    if (!plantGroups[p]) plantGroups[p] = [];
    plantGroups[p].push(item);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700 border border-blue-200">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">This Month PM Overview ({monthName} {selectedYear})</h3>
              <p className="text-xs text-slate-500 font-medium">Plant-wise machinery maintenance schedule and completion status</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plant Breakdown Overview */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {Object.keys(plantGroups).length > 0 ? (
            Object.entries(plantGroups).map(([plant, items]) => (
              <div key={plant} className="space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs uppercase tracking-wider pb-1 border-b border-slate-200">
                  <Factory className="w-4 h-4 text-blue-600" />
                  <span>Plant: {plant} ({items.length} Machines)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {items.map(({ machine, status }) => (
                    <div key={machine.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{machine.equipmentName || machine.machineType}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{machine.assetCode} • {machine.location}</div>
                      </div>

                      <div>
                        {status === 'Done' && (
                          <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done
                          </span>
                        )}
                        {status === 'Maintenance Due' && (
                          <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300 flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-600" /> Due
                          </span>
                        )}
                        {status === 'Overdue' && (
                          <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-900 font-bold text-[10px] border border-rose-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Overdue
                          </span>
                        )}
                        {status === 'Planned' && (
                          <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                            Planned
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              No PM maintenance tasks scheduled or due for this month.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
