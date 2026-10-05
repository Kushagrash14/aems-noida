'use client';

import { useState } from 'react';
import { X, Sliders, Calendar, Building2, Wrench, Save } from 'lucide-react';
import type { MaintenanceMachine, TrendMonths } from '@/types/maintenance';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  machine: MaintenanceMachine | null;
  onSaveSetup: (machineId: string, trendMonths: number, nextPmDate: string, equipmentName: string) => void;
}

export default function MachinePmSetupModal({ isOpen, onClose, machine, onSaveSetup }: Props) {
  const [equipmentName, setEquipmentName] = useState(machine?.equipmentName || '');
  const [trendMonths, setTrendMonths] = useState<number>(machine?.trendMonths ?? 2);
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState(machine?.nextMaintenanceDate || '');
  const [saving, setSaving] = useState(false);

  if (!isOpen || !machine) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    onSaveSetup(machine.id, trendMonths, nextMaintenanceDate, equipmentName);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700 border border-blue-200">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">PM Setup &amp; Frequency Configuration</h3>
              <p className="text-xs text-slate-500 font-medium">
                Asset Code: <span className="font-mono font-bold text-slate-700">{machine.assetCode}</span>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-800">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Equipment / Machine Name *
            </label>
            <input
              type="text"
              required
              value={equipmentName}
              onChange={(e) => setEquipmentName(e.target.value)}
              placeholder="e.g. Injection Molding Press Machine #1"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              PM Frequency Interval (Trend Months) *
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[1, 2, 3, 4, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTrendMonths(m)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    trendMonths === m
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m} Month{m > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Base Next PM Maintenance Date (YYYY-MM-DD) *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                value={nextMaintenanceDate}
                onChange={(e) => setNextMaintenanceDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Details Pill */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 font-bold uppercase block">Plant Code</span>
              <span className="font-bold text-slate-800">{machine.plantCode}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase block">Location</span>
              <span className="font-bold text-slate-800">{machine.location}</span>
            </div>
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
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
