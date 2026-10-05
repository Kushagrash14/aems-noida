'use client';

import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import type { MaintenanceMachine } from '../types/maintenance';
import { computeNextPmDateAfterDone } from '../lib/maintenanceCodes';

interface MaintenanceDoneModalProps {
  machine: MaintenanceMachine | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    nextMaintenanceDate: string;
    remarks: string;
    technicianCount: number;
    technicianNames: string[];
  }) => void;
}

export default function MaintenanceDoneModal({
  machine,
  saving = false,
  onClose,
  onConfirm,
}: MaintenanceDoneModalProps) {
  if (!machine) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultNextDate = computeNextPmDateAfterDone(todayStr, machine.trendMonths || 2);
  const [nextDate, setNextDate] = useState(defaultNextDate);
  const [remarks, setRemarks] = useState('');
  const [techNames, setTechNames] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const technicians = techNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onConfirm({
      nextMaintenanceDate: nextDate,
      remarks,
      technicianCount: technicians.length || 1,
      technicianNames: technicians,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Mark Preventive Maintenance Done</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs text-slate-800">
          <div>
            <label className="font-semibold text-slate-600 uppercase text-[10px] tracking-wider block">Equipment</label>
            <p className="font-bold text-slate-900 mt-0.5">{machine.equipmentName || machine.assetCode}</p>
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Technician Name(s) (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. Ramesh Kumar, Suresh Verma"
              value={techNames}
              onChange={(e) => setTechNames(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Next Maintenance Date</label>
            <input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-semibold"
              required
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Close-out Remarks</label>
            <textarea
              rows={2}
              placeholder="Oil change completed, filters replaced..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Confirm Mark Done'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
