'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sliders,
  History,
  Building2,
  Wrench,
  Search,
} from 'lucide-react';
import type { MaintenanceMachine } from '../types/maintenance';
import { pmPlanStatus, computePmPlanKpis } from '../lib/maintenanceCodes';

interface MaintenancePmPlanBoardProps {
  machines: MaintenanceMachine[];
  year: number;
  onYearChange?: (year: number) => void;
  onOpenPmDoneModal?: (machine: MaintenanceMachine) => void;
  onOpenPmHistoryModal?: (machine: MaintenanceMachine) => void;
  onOpenPmSetupModal?: (machine: MaintenanceMachine) => void;
  onOpenThisMonthModal?: () => void;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default function MaintenancePmPlanBoard({
  machines,
  year,
  onYearChange,
  onOpenPmDoneModal,
  onOpenPmHistoryModal,
  onOpenPmSetupModal,
  onOpenThisMonthModal,
}: MaintenancePmPlanBoardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('ALL');

  // Unique plants list
  const plantCodes = useMemo(() => {
    const plants = new Set<string>();
    machines.forEach((m) => {
      if (m.plantCode) plants.add(m.plantCode);
    });
    return Array.from(plants);
  }, [machines]);

  const filteredMachines = useMemo(() => {
    let result = machines;
    if (selectedPlant !== 'ALL') {
      result = result.filter((m) => m.plantCode === selectedPlant);
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter((m) =>
        `${m.equipmentName || ''} ${m.assetCode || ''} ${m.machineType || ''} ${m.plantCode || ''} ${m.location || ''}`
          .toLowerCase()
          .includes(q)
      );
    }
    return result;
  }, [machines, selectedPlant, searchTerm]);

  const kpis = computePmPlanKpis(filteredMachines, year);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
      {/* Board Header & Title */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Preventive Maintenance (PM Setup &amp; 12-Month Plan vs Actual Board)
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              12-Month Calendar Matrix, Automated Intervals &amp; Execution Completion Tracker
            </p>
          </div>
        </div>

        {/* Filter Bar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenThisMonthModal && (
            <button
              type="button"
              onClick={onOpenThisMonthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>This Month Overview</span>
            </button>
          )}

          {/* Plant Dropdown */}
          <div className="relative flex items-center">
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="ALL">All Plants</option>
              {plantCodes.map((code) => (
                <option key={code} value={code}>
                  Plant {code}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 placeholder-slate-400 font-medium w-44 sm:w-56"
            />
          </div>

          {/* Year Switcher */}
          {onYearChange && (
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5 text-xs font-semibold text-slate-700">
              <button
                type="button"
                onClick={() => onYearChange(year - 1)}
                className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Previous Year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 font-mono font-black text-slate-900">{year}</span>
              <button
                type="button"
                onClick={() => onYearChange(year + 1)}
                className="p-1 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Next Year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4 KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-slate-100 p-4 bg-slate-50/20">
        {/* Card 1: ACTIVE MACHINERY */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
              ACTIVE MACHINERY
            </span>
            <span className="text-xl font-mono font-black text-slate-900 leading-none mt-1 block">
              {kpis.activeCount}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
            <Wrench className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: PM DUE THIS MONTH */}
        <button
          type="button"
          onClick={onOpenThisMonthModal}
          className="bg-amber-50/60 hover:bg-amber-50 rounded-xl p-3 border border-amber-200/90 shadow-2xs flex items-center justify-between text-left transition-all cursor-pointer group"
        >
          <div>
            <span className="text-[9px] font-black text-amber-800 uppercase tracking-wider block group-hover:underline">
              PM DUE THIS MONTH
            </span>
            <span className="text-xl font-mono font-black text-amber-600 leading-none mt-1 block">
              {kpis.dueCount}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-amber-100 text-amber-700 border border-amber-200">
            <Clock className="w-4 h-4" />
          </div>
        </button>

        {/* Card 3: OVERDUE PMS */}
        <div className="bg-rose-50/60 rounded-xl p-3 border border-rose-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-rose-800 uppercase tracking-wider block">
              OVERDUE PMS
            </span>
            <span className="text-xl font-mono font-black text-rose-600 leading-none mt-1 block">
              {kpis.overdueCount}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-rose-100 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: COMPLETED PMS */}
        <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider block">
              COMPLETED PMS ({year})
            </span>
            <span className="text-xl font-mono font-black text-emerald-600 leading-none mt-1 block">
              {kpis.completedCount}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Status Legend Bar */}
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[10px]">
            STATUS LEGEND:
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-bold text-[10px]">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Planned (Upcoming)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Maintenance Due
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold text-[10px]">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span> Overdue (Incomplete)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Done (Completed)
          </span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">
          💡 Click any cell badge to execute PM or view completion logs.
        </span>
      </div>

      {/* 12-Month Matrix Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <th className="py-3 px-4 min-w-[220px]">EQUIPMENT / MACHINE DETAILS</th>
              <th className="py-3 px-2 text-center w-16">FREQ</th>
              <th className="py-3 px-2 text-center w-20">SETUP</th>
              {MONTHS.map((m) => (
                <th key={m} className="py-3 px-1 text-center min-w-[62px]">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredMachines.map((m) => (
              <tr key={m.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="py-3 px-4 font-medium">
                  <div className="font-bold text-slate-900 text-xs">
                    {m.equipmentName || `${m.machineType} ${m.machineNumber}`}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {m.assetCode} • Plant {m.plantCode} • {m.location}
                  </div>
                </td>
                <td className="py-3 px-2 text-center font-mono font-bold text-slate-700 text-xs">
                  {m.trendMonths ? `${m.trendMonths}M` : 'Cust'}
                </td>
                <td className="py-3 px-2 text-center">
                  <button
                    type="button"
                    onClick={() => onOpenPmSetupModal?.(m)}
                    className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                    title="Click to edit Machine PM Setup & Frequency"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  </button>
                </td>
                {MONTHS.map((_, idx) => {
                  const monthNum = String(idx + 1).padStart(2, '0');
                  const yearMonthKey = `${year}-${monthNum}`;
                  const status = pmPlanStatus(m, yearMonthKey);
                  return (
                    <td key={yearMonthKey} className="py-2 px-1 text-center">
                      {status === 'Done' && (
                        <button
                          type="button"
                          onClick={() => onOpenPmHistoryModal?.(m)}
                          className="w-full py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 font-bold text-[10px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer transition-all"
                        >
                          <CheckCircle2 size={11} className="text-emerald-600 shrink-0" /> Done
                        </button>
                      )}
                      {status === 'Maintenance Due' && (
                        <button
                          type="button"
                          onClick={() => onOpenPmDoneModal?.(m)}
                          className="w-full py-1 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-[10px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer animate-pulse transition-all"
                        >
                          <Clock size={11} className="text-amber-600 shrink-0" /> Due
                        </button>
                      )}
                      {status === 'Overdue' && (
                        <button
                          type="button"
                          onClick={() => onOpenPmDoneModal?.(m)}
                          className="w-full py-1 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 font-bold text-[10px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer transition-all"
                        >
                          <AlertTriangle size={11} className="text-rose-600 shrink-0" /> Overdue
                        </button>
                      )}
                      {status === 'Planned' && (
                        <span className="w-full py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[10px] inline-block">
                          Planned
                        </span>
                      )}
                      {status === 'None' && <span className="text-slate-300">•</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

