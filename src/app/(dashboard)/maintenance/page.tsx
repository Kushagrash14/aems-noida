'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { MaintenanceMachine, MaintenancePmLog } from '@/types/maintenance';
import { PMMachine } from '@/types/database';
import { formatDate } from '@/lib/utils';
import { computePmPlanKpis } from '@/lib/maintenanceCodes';
import {
  Wrench,
  QrCode,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Download,
  AlertOctagon,
  Sliders,
} from 'lucide-react';
import MaintenancePmPlanBoard from '@/components/MaintenancePmPlanBoard';
import MaintenanceDoneModal from '@/components/MaintenanceDoneModal';
import PmHistoryModal from '@/components/maintenance/PmHistoryModal';
import MachinePmSetupModal from '@/components/maintenance/MachinePmSetupModal';
import ThisMonthPmModal from '@/components/maintenance/ThisMonthPmModal';

const INITIAL_MAINTENANCE_MACHINES: MaintenanceMachine[] = [
  {
    id: 'm1',
    machineType: 'Injection Molding',
    machineNumber: 'M-101',
    assetCode: 'AST-INJ-101',
    equipmentName: 'Plastic Injection Molding Machine 250T',
    department: 'Production & Tooling',
    responsibility: 'Rajesh Verma (Plant Manager)',
    location: 'Pune',
    plantCode: 'GN-P1',
    warrantyStatus: 'in_warranty',
    warrantyExpiryDate: '2027-12-31',
    trendMonths: 2,
    nextMaintenanceDate: '2026-09-25',
    lastMaintenanceDate: '2026-07-25',
    status: 'Active',
    remarks: 'Main hydraulic cylinder checked & oil filter replaced',
    pmLogs: [
      {
        plannedDate: '2026-05-25',
        doneOn: '2026-05-24',
        technicianCount: 2,
        technicianNames: ['Suresh Pal', 'Amit Kumar'],
        doneBy: 'Preventive Desk',
        doneRemarks: 'Oil filter replaced, pressure calibrated.',
      },
      {
        plannedDate: '2026-07-25',
        doneOn: '2026-07-25',
        technicianCount: 3,
        technicianNames: ['Rajesh Verma', 'Suresh Pal', 'Vikram Singh'],
        doneBy: 'Lead Maintenance Engineer',
        doneRemarks: 'Complete 2-Month preventive servicing done.',
      },
    ],
  },
  {
    id: 'm2',
    machineType: 'SMT Placement',
    machineNumber: 'SMT-204',
    assetCode: 'AST-SMT-204',
    equipmentName: 'High Speed PCB SMT Pick & Place Machine',
    department: 'Electronics SMT',
    responsibility: 'Deepak Sharma',
    location: 'Pune Unit 1',
    plantCode: 'PUN-U1',
    warrantyStatus: 'out_of_warranty',
    trendMonths: 1,
    nextMaintenanceDate: '2026-09-10',
    lastMaintenanceDate: '2026-08-10',
    status: 'Maintenance Due',
    remarks: 'Nozzle calibration and feeder belt inspection pending',
    pmLogs: [
      {
        plannedDate: '2026-08-10',
        doneOn: '2026-08-09',
        technicianCount: 2,
        technicianNames: ['Deepak Sharma', 'Anil Joshi'],
        doneBy: 'SMT Maintenance Desk',
        doneRemarks: 'Feeder cleaning and vacuum nozzle check done.',
      },
    ],
  },
  {
    id: 'm3',
    machineType: 'Stamping Press',
    machineNumber: 'PRESS-500',
    assetCode: 'AST-PRESS-500',
    equipmentName: 'Hydraulic Metal Stamping Press 500T',
    department: 'Tool Room & Press',
    responsibility: 'Rakesh Nair',
    location: 'Pune',
    plantCode: 'AHM-PLT',
    warrantyStatus: 'in_warranty',
    trendMonths: 3,
    nextMaintenanceDate: '2026-10-15',
    lastMaintenanceDate: '2026-07-15',
    status: 'Active',
    remarks: 'Safety light curtains aligned, die clamp pressure tested',
    pmLogs: [
      {
        plannedDate: '2026-07-15',
        doneOn: '2026-07-14',
        technicianCount: 4,
        technicianNames: ['Rakesh Nair', 'Vikas Gupta', 'Manoj Kumar'],
        doneBy: 'Heavy Equipment Maintenance',
        doneRemarks: 'Quarterly hydraulic fluid flush & valve seal replacement.',
      },
    ],
  },
  {
    id: 'm4',
    machineType: 'CNC Milling Center',
    machineNumber: 'CNC-501',
    assetCode: 'AST-CNC-501',
    equipmentName: '5-Axis CNC Precision Milling Machine',
    department: 'Tool Room & Press',
    responsibility: 'Mahesh Patil',
    location: 'Pune',
    plantCode: 'GN-P2',
    warrantyStatus: 'in_warranty',
    trendMonths: 6,
    nextMaintenanceDate: '2026-11-01',
    lastMaintenanceDate: '2026-05-01',
    status: 'Active',
    remarks: 'Spindle lubrication & axis backlash measurement completed',
    pmLogs: [
      {
        plannedDate: '2026-05-01',
        doneOn: '2026-05-01',
        technicianCount: 2,
        technicianNames: ['Mahesh Patil', 'Karan Mehta'],
        doneBy: 'CNC Service Desk',
        doneRemarks: '6-Month major calibration and coolant tank flush.',
      },
    ],
  },
  {
    id: 'm5',
    machineType: 'Air Compressor',
    machineNumber: 'COMP-75HP',
    assetCode: 'AST-COMP-75',
    equipmentName: 'Industrial Screw Air Compressor 75HP',
    department: 'Utility & Power',
    responsibility: 'Sanjay Yadav',
    location: 'Pune',
    plantCode: 'GN-P1',
    warrantyStatus: 'out_of_warranty',
    trendMonths: 1,
    nextMaintenanceDate: '2026-08-01',
    lastMaintenanceDate: '2026-07-01',
    status: 'Overdue',
    remarks: 'Air filter replacement overdue by 45 days',
    pmLogs: [
      {
        plannedDate: '2026-07-01',
        doneOn: '2026-07-01',
        technicianCount: 1,
        technicianNames: ['Sanjay Yadav'],
        doneBy: 'Utility Maintenance',
        doneRemarks: 'Monthly condensate drain check & belt tensioning.',
      },
    ],
  },
  {
    id: 'm6',
    machineType: 'Welding Robot',
    machineNumber: 'ROBOT-W1',
    assetCode: 'AST-ROBOT-01',
    equipmentName: '6-Axis Articulated Arc Welding Robot',
    department: 'Production & Tooling',
    responsibility: 'Vikram Singh',
    location: 'Pune Unit 1',
    plantCode: 'PUN-U1',
    warrantyStatus: 'in_warranty',
    trendMonths: 2,
    nextMaintenanceDate: '2026-09-30',
    lastMaintenanceDate: '2026-07-30',
    status: 'Active',
    remarks: 'Torch tip & wire feed assembly serviced',
    pmLogs: [
      {
        plannedDate: '2026-07-30',
        doneOn: '2026-07-29',
        technicianCount: 2,
        technicianNames: ['Vikram Singh', 'Ramesh Pawar'],
        doneBy: 'Robotics Service Team',
        doneRemarks: 'Bimanual wrist axis greasing & teach pendant cable check.',
      },
    ],
  },
];

export default function MaintenancePage() {
  const [machines, setMachines] = useState<MaintenanceMachine[]>(INITIAL_MAINTENANCE_MACHINES);
  const [dbMachines, setDbMachines] = useState<PMMachine[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Modals state
  const [doneModalMachine, setDoneModalMachine] = useState<MaintenanceMachine | null>(null);
  const [historyModalMachine, setHistoryModalMachine] = useState<MaintenanceMachine | null>(null);
  const [setupModalMachine, setSetupModalMachine] = useState<MaintenanceMachine | null>(null);
  const [showThisMonthModal, setShowThisMonthModal] = useState(false);

  // QR Modal
  const [qrModalMachine, setQrModalMachine] = useState<PMMachine | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('aems_maintenance_machines_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMachines(parsed);
        }
      }
    } catch {}

    // Load existing database machinery for QR code table
    fetch('/api/pm/machines')
      .then((res) => res.json())
      .then((data) => {
        if (data?.machines) setDbMachines(data.machines);
      })
      .catch(() => null);
  }, []);

  // Save PM Done completion with persistence
  const handleSavePmDone = (machineId: string, log: MaintenancePmLog, nextPmDate: string) => {
    setMachines((prev) => {
      const updated = prev.map((m) => {
        if (m.id === machineId) {
          const updatedLogs = [log, ...(m.pmLogs || [])];
          return {
            ...m,
            lastMaintenanceDate: log.doneOn,
            nextMaintenanceDate: nextPmDate,
            status: 'Done' as const,
            pmLogs: updatedLogs,
          };
        }
        return m;
      });
      try { localStorage.setItem('aems_maintenance_machines_v2', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // Save Machine Setup with persistence
  const handleSaveSetup = (machineId: string, trendMonths: number, nextPmDate: string, equipmentName: string) => {
    setMachines((prev) => {
      const updated = prev.map((m) => {
        if (m.id === machineId) {
          return {
            ...m,
            trendMonths,
            nextMaintenanceDate: nextPmDate,
            equipmentName,
          };
        }
        return m;
      });
      try { localStorage.setItem('aems_maintenance_machines_v2', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const openQrModal = async (machine: PMMachine) => {
    setQrModalMachine(machine);
    const publicReportUrl = `${window.location.origin}/qr/report/${machine.qr_code_token}`;
    try {
      const url = await QRCode.toDataURL(publicReportUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('QR generation error:', err);
    }
  };

  const overdueCount = machines.filter(
    (m) => m.nextMaintenanceDate && new Date(m.nextMaintenanceDate).getTime() < Date.now()
  ).length;

  const kpis = computePmPlanKpis(machines, selectedYear);

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Preventive Maintenance (PM) &amp; Equipment Ledger
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Automated maintenance intervals, 12-Month Plan vs Actual matrix, machinery health, and floor QR-code reporting tags.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowThisMonthModal(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 shadow-xs transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            This Month PM Overview
          </button>

          <Link
            href="/maintenance/complaints"
            className="flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 transition-all shadow-xs"
          >
            <AlertOctagon className="w-4 h-4 text-amber-400" />
            Complaint Inbox
          </Link>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ACTIVE MACHINERY */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Total PM Machinery</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{kpis.activeCount}</p>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">Configured PM Schedule</p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Wrench className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: MAINTENANCE DUE */}
        <button
          type="button"
          onClick={() => setShowThisMonthModal(true)}
          className="bg-white rounded-2xl p-4 border border-amber-200/90 shadow-2xs flex items-center justify-between text-left hover:border-amber-400 transition-all cursor-pointer group"
        >
          <div>
            <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider group-hover:underline">
              PM Maintenance Due
            </p>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{kpis.dueCount}</p>
            <p className="text-[10px] text-amber-700 mt-1 font-medium">Pending PM this month</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 group-hover:bg-amber-100">
            <Clock className="w-6 h-6" />
          </div>
        </button>

        {/* Card 3: OVERDUE PMs */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider">PM Overdue</p>
            <p className="text-2xl font-black text-rose-600 mt-0.5">{kpis.overdueCount}</p>
            <p className="text-[10px] text-rose-700 mt-1 font-medium">Requires immediate action</p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: COMPLETED PMs */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Completed PM ({selectedYear})</p>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{kpis.completedCount}</p>
            <p className="text-[10px] text-emerald-700 mt-1 font-medium">Serviced successfully</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Alert Banner for Overdue Machines */}
      {overdueCount > 0 && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Action Required: {overdueCount} Machinery PM Overdue</p>
              <p className="text-[11px] text-rose-700">
                Scheduled maintenance deadlines have passed. Mark PM complete or assign technicians to prevent assembly line downtime.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs bg-rose-600 text-white px-3 py-1 rounded-lg font-bold shadow-xs">
            {overdueCount} Overdue
          </span>
        </div>
      )}

      {/* 12-MONTH PLAN VS ACTUAL MATRIX BOARD */}
      <MaintenancePmPlanBoard
        machines={machines}
        year={selectedYear}
        onYearChange={setSelectedYear}
        onOpenPmDoneModal={(m: MaintenanceMachine) => setDoneModalMachine(m)}
        onOpenPmHistoryModal={(m: MaintenanceMachine) => setHistoryModalMachine(m)}
        onOpenPmSetupModal={(m: MaintenanceMachine) => setSetupModalMachine(m)}
        onOpenThisMonthModal={() => setShowThisMonthModal(true)}
      />

      {/* Database Machines & QR Code Tags Table */}
      {dbMachines.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Physical Machines &amp; Floor QR Code Tags Registry ({dbMachines.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-bold border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Machine Code &amp; Details</th>
                  <th className="px-4 py-3">Plant Placement</th>
                  <th className="px-4 py-3">PM Frequency</th>
                  <th className="px-4 py-3">Last Maintained</th>
                  <th className="px-4 py-3">Next PM Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Floor QR Tag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {dbMachines.map((m) => {
                  const isOverdue = new Date(m.next_pm_date).getTime() < Date.now();
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono font-black text-slate-900">{m.machine_code}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{m.machine_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{m.plant?.name}</div>
                        <div className="text-[10px] text-slate-400">{m.department?.name}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        Every {m.pm_frequency_days} Days
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(m.last_pm_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`font-semibold ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                          {formatDate(m.next_pm_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {m.status === 'breakdown' ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200 uppercase">
                            Breakdown
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200 uppercase">
                            Operational
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openQrModal(m)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>View QR</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS INTEGRATION */}
      {doneModalMachine && (
        <MaintenanceDoneModal
          machine={doneModalMachine}
          onClose={() => setDoneModalMachine(null)}
          onConfirm={({ nextMaintenanceDate, remarks, technicianCount, technicianNames }) => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const newLog: MaintenancePmLog = {
              plannedDate: doneModalMachine.nextMaintenanceDate,
              doneOn: todayStr,
              technicianCount,
              technicianNames,
              doneBy: 'System User',
              doneRemarks: remarks,
            };
            handleSavePmDone(doneModalMachine.id, newLog, nextMaintenanceDate);
            setDoneModalMachine(null);
          }}
        />
      )}

      <PmHistoryModal
        isOpen={Boolean(historyModalMachine)}
        onClose={() => setHistoryModalMachine(null)}
        machine={historyModalMachine}
      />

      <MachinePmSetupModal
        isOpen={Boolean(setupModalMachine)}
        onClose={() => setSetupModalMachine(null)}
        machine={setupModalMachine}
        onSaveSetup={handleSaveSetup}
      />

      <ThisMonthPmModal
        isOpen={showThisMonthModal}
        onClose={() => setShowThisMonthModal(false)}
        machines={machines}
        selectedYear={selectedYear}
      />

      {/* QR MODAL */}
      {qrModalMachine && qrDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="max-w-sm w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Floor Equipment QR Tag</span>
              <button
                onClick={() => setQrModalMachine(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block border border-slate-200 shadow-md mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={qrModalMachine.machine_code} className="w-56 h-56 mx-auto" />
            </div>

            <div className="space-y-1 mb-5">
              <p className="font-mono text-base font-black text-slate-900">{qrModalMachine.machine_code}</p>
              <p className="text-xs font-semibold text-slate-700">{qrModalMachine.machine_name}</p>
              <p className="text-[11px] text-slate-500">{qrModalMachine.plant?.name}</p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={qrDataUrl}
                download={`${qrModalMachine.machine_code}_QR_Tag.png`}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Save Badge</span>
              </a>
              <Link
                href={`/qr/report/${qrModalMachine.qr_code_token}`}
                target="_blank"
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all"
                title="Simulate Mobile Scan"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
