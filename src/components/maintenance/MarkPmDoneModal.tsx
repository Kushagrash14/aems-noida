'use client';

import { useState } from 'react';
import { X, CheckCircle2, Calendar, User, Wrench, FileText, ArrowRight } from 'lucide-react';
import type { MaintenanceMachine, MaintenancePmLog } from '@/types/maintenance';
import { computeNextPmDateAfterDone, istTodayKey } from '@/lib/maintenanceCodes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  machine: MaintenanceMachine | null;
  onSavePmDone: (machineId: string, log: MaintenancePmLog, nextPmDate: string) => void;
}

export default function MarkPmDoneModal({ isOpen, onClose, machine, onSavePmDone }: Props) {
  const [doneOn, setDoneOn] = useState(() => istTodayKey());
  const [technicianCount, setTechnicianCount] = useState<number>(2);
  const [techniciansStr, setTechniciansStr] = useState('Rajesh Kumar, Sunil Verma');
  const [doneBy, setDoneBy] = useState('IT & Plant Maintenance Desk');
  const [doneRemarks, setDoneRemarks] = useState('Routine preventive servicing, sensor cleaning & alignment completed successfully.');
  const [saving, setSaving] = useState(false);

  if (!isOpen || !machine) return null;

  const nextPmPreview = computeNextPmDateAfterDone(doneOn, machine.trendMonths || 2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const names = techniciansStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const newLog: MaintenancePmLog = {
      plannedDate: machine.nextMaintenanceDate,
      doneOn,
      technicianCount,
      technicianNames: names,
      doneBy,
      doneRemarks,
    };

    onSavePmDone(machine.id, newLog, nextPmPreview);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Mark Preventive Maintenance Done</h3>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs text-slate-800">
          {/* Machine Info Bar */}
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-blue-600 tracking-wider">Current Schedule</span>
              <p className="font-bold text-slate-900 mt-0.5">Due Date: {machine.nextMaintenanceDate || 'Not set'}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-blue-600 tracking-wider">Frequency Interval</span>
              <p className="font-bold text-slate-900 mt-0.5">{machine.trendMonths ? `${machine.trendMonths} Months` : 'Custom'}</p>
            </div>
          </div>

          {/* Completion Date & Done By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Completion Date (Done On) *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={doneOn}
                  onChange={(e) => setDoneOn(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Verified / Executed By *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={doneBy}
                  onChange={(e) => setDoneBy(e.target.value)}
                  placeholder="e.g. IT & Plant Maintenance Desk"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Technician Count & Technician Names */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Technicians Count
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={technicianCount}
                onChange={(e) => setTechnicianCount(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Technician Names (Comma Separated)
              </label>
              <div className="relative">
                <Wrench className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={techniciansStr}
                  onChange={(e) => setTechniciansStr(e.target.value)}
                  placeholder="e.g. Rajesh Kumar, Sunil Verma"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Service Remarks &amp; Checklist Summary *
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <textarea
                required
                rows={3}
                value={doneRemarks}
                onChange={(e) => setDoneRemarks(e.target.value)}
                placeholder="Describe servicing work, replaced parts, calibration..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Next PM Date Preview Banner */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-800">Auto Next PM Date Preview:</span>
              <span className="font-mono font-black text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                {nextPmPreview}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-600" />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save & Advance Next PM Date'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
