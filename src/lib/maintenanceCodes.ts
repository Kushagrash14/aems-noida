import type { MaintenanceMachine, MaintenancePmLog } from '../types/maintenance';
import { CUSTOM_TREND_MONTHS, isCustomTrend } from '../types/maintenance';

export function istTodayKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function pmCellKey(year: number, monthZeroBased: number, week1to4: number): string {
  const m = String(monthZeroBased + 1).padStart(2, '0');
  return `${year}-${m}-W${week1to4}`;
}

export function weekOfMonth(d: Date): number {
  const day = d.getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export function isPmDoneInMonth(machine: MaintenanceMachine, yearMonthKey: string): boolean {
  if (!machine.pmLogs?.length) return false;
  return machine.pmLogs.some((log) => log.doneOn?.startsWith(yearMonthKey));
}

export const getPmCellStatus = pmPlanStatus;

export function pmPlanStatus(
  machine: MaintenanceMachine,
  yearMonthKey: string, // YYYY-MM
  now = new Date()
): 'Planned' | 'Maintenance Due' | 'Overdue' | 'Done' | 'None' {
  if (isPmDoneInMonth(machine, yearMonthKey)) {
    return 'Done';
  }

  const nextPm = machine.nextMaintenanceDate?.slice(0, 7);
  if (nextPm === yearMonthKey) {
    const currentMonthKey = istTodayKey(now).slice(0, 7);
    if (yearMonthKey < currentMonthKey) return 'Overdue';
    if (yearMonthKey === currentMonthKey) return 'Maintenance Due';
    return 'Planned';
  }

  // Calculate recurring PM months based on trendMonths
  if (machine.trendMonths && machine.nextMaintenanceDate) {
    const nextDate = new Date(machine.nextMaintenanceDate);
    if (!isNaN(nextDate.getTime())) {
      const [yearStr, monthStr] = yearMonthKey.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10) - 1;
      
      const nextY = nextDate.getFullYear();
      const nextM = nextDate.getMonth();
      const freq = machine.trendMonths;

      const monthDiff = (y - nextY) * 12 + (m - nextM);
      if (monthDiff > 0 && monthDiff % freq === 0) {
        const currentMonthKey = istTodayKey(now).slice(0, 7);
        if (yearMonthKey < currentMonthKey) return 'Overdue';
        if (yearMonthKey === currentMonthKey) return 'Maintenance Due';
        return 'Planned';
      }
    }
  }

  return 'None';
}

export function canMarkMaintenanceDone(machine: MaintenanceMachine, now = new Date()): boolean {
  if (!machine.nextMaintenanceDate) return true;
  const dueDate = new Date(machine.nextMaintenanceDate);
  if (isNaN(dueDate.getTime())) return true;

  const today = new Date(istTodayKey(now));
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays <= 7;
}

export function computeNextPmDateAfterDone(lastDoneDateStr: string, months = 2): string {
  const d = new Date(lastDoneDateStr);
  if (isNaN(d.getTime())) return lastDoneDateStr;
  d.setMonth(d.getMonth() + (months || 2));
  return d.toISOString().slice(0, 10);
}

export function computePmPlanKpis(machines: MaintenanceMachine[], year: number) {
  const now = new Date();
  const currentMonthKey = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let due = 0;
  let overdue = 0;
  let completed = 0;

  machines.forEach((m) => {
    const status = pmPlanStatus(m, currentMonthKey, now);
    if (status === 'Maintenance Due') due++;
    if (status === 'Overdue') overdue++;
    const completedInYear = m.pmLogs?.filter((log) => log.doneOn?.startsWith(String(year))) || [];
    completed += completedInYear.length;
  });

  return {
    activeCount: machines.length,
    dueCount: due,
    overdueCount: overdue,
    completedCount: completed,
  };
}
