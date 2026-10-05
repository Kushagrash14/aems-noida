'use client';

import { X, CheckCircle2, Calendar, User, Wrench, FileText, Clock } from 'lucide-react';
import type { MaintenanceMachine } from '@/types/maintenance';
import { formatDate } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  machine: MaintenanceMachine | null;
}

export default function PmHistoryModal({ isOpen, onClose, machine }: Props) {
  if (!isOpen || !machine) return null;

  const logs = machine.pmLogs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700 border border-blue-200">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Preventive Maintenance Completion Log History</h3>
              <p className="text-xs text-slate-500 font-medium">
                {machine.equipmentName || machine.machineType} • <span className="font-mono font-bold text-slate-700">{machine.assetCode}</span>
              </p>
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

        {/* Machine Stats Summary */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Plant Placement</span>
            <span className="font-bold text-slate-800">{machine.plantCode} ({machine.location})</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Frequency</span>
            <span className="font-bold text-slate-800">{machine.trendMonths ? `${machine.trendMonths} Months` : 'Custom'}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Completed Cycles</span>
            <span className="font-bold text-emerald-700">{logs.length} Logged</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Next PM Due</span>
            <span className="font-bold text-blue-700">{machine.nextMaintenanceDate || 'Not Scheduled'}</span>
          </div>
        </div>

        {/* Logs Timeline List */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>PM Done</span>
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-900">
                      Completed On: {formatDate(log.doneOn)}
                    </span>
                  </div>
                  {log.plannedDate && (
                    <span className="text-[11px] text-slate-400 font-medium">
                      Target Planned Date: {formatDate(log.plannedDate)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Technicians ({log.technicianCount || log.technicianNames?.length || 1})</span>
                    <p className="font-medium text-slate-700 mt-0.5">
                      {log.technicianNames?.length ? log.technicianNames.join(', ') : 'Assigned Servicing Team'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Verified / Logged By</span>
                    <p className="font-medium text-slate-700 mt-0.5">{log.doneBy || 'Maintenance Desk'}</p>
                  </div>
                </div>

                {log.doneRemarks && (
                  <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                    <span className="font-bold text-slate-700">Remarks: </span>
                    <span>{log.doneRemarks}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              No PM completion log history found for this machinery.
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
