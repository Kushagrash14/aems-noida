export type MaintenanceMachineStatus =
  | 'Active'
  | 'Maintenance Due'
  | 'Overdue'
  | 'Done'
  | 'Down';

export type MaintenanceComplaintStatus = 'Open' | 'Resolved';

export interface MaintenancePmLog {
  plannedDate?: string;
  doneOn: string; // ISO Date YYYY-MM-DD
  technicianCount?: number;
  technicianNames?: string[];
  doneBy?: string;
  doneRemarks?: string;
}

export const CUSTOM_TREND_MONTHS = 0;
export const TREND_MONTH_OPTIONS = [1, 2, 3, 4, 5, 6, 12] as const;
export type TrendMonths = (typeof TREND_MONTH_OPTIONS)[number];
export const DEFAULT_TREND_MONTHS: TrendMonths = 2;

export function isCustomTrend(months?: number): boolean {
  return Number(months) === CUSTOM_TREND_MONTHS;
}

export interface MaintenanceMachine {
  id: string;
  machineType: string;
  machineNumber: string;
  assetCode: string;
  equipmentName?: string;
  department?: string;
  responsibility?: string;
  location: string;
  plantCode: string;
  warrantyStatus?: 'in_warranty' | 'out_of_warranty';
  warrantyExpiryDate?: string;
  modelNumber?: string;
  serialNumber?: string;
  trendMonths?: number; // PM frequency: 1, 2, 3, 6, 12 months (0 = Custom)
  customPlanDates?: string[];
  nextMaintenanceDate: string; // YYYY-MM-DD
  lastMaintenanceDate?: string;
  status: MaintenanceMachineStatus;
  remarks?: string;
  pmLogs?: MaintenancePmLog[];
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}
