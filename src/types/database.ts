// =============================================================================
// AEMS v2 — Normalized TypeScript Entity Definitions
// Mirrors the Postgres Database Schema 1-to-1
// =============================================================================

export type UserRole = 'it_admin' | 'admin' | 'hr' | 'user';

export interface Location {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Plant {
  id: string;
  location_id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
  location?: Location;
  departments?: Department[];
  sub_departments?: string[];
}

export interface Department {
  id: string;
  name: string;
  code: string;
  plant_id?: string | null;
  sub_department?: string | null;
  admin_user_id?: string | null;
  created_at: string;
  updated_at: string;
  admin_user?: User | null;
  plant?: Plant | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  emp_code?: string | null;
  role: UserRole;
  is_active: boolean;
  location_id?: string | null;
  plant_id?: string | null;
  department_id?: string | null;
  sub_department?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
  scope?: UserScope | null;
}

export interface UserScope {
  id: string;
  user_id: string;
  can_edit: boolean;
  category_ids: string[] | null; // null = all in scope
  location_ids: string[] | null; // null = all in scope
  plant_ids: string[] | null;    // null = all in scope
  department_ids?: string[] | null;
  sub_department?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token_hash: string;
  device_info?: string | null;
  ip_address?: string | null;
  last_activity_at: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthOTP {
  id: string;
  email: string;
  otp_hash: string;
  attempts: number;
  is_used: boolean;
  expires_at: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  icon?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'textarea';

export interface CategoryFormField {
  id: string;
  category_id: string;
  field_name: string;
  field_label: string;
  field_type: FieldType;
  options?: string[] | null; // For select field
  is_required: boolean;
  placeholder?: string | null;
  display_order: number;
  created_at: string;
}

export interface Employee {
  id: string;
  emp_code: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  department_id: string;
  plant_id: string;
  location_id: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  department?: Department;
  plant?: Plant;
  location?: Location;
}

export type AssetStatus = 'in_service' | 'maintenance' | 'damaged' | 'missing' | 'scrapped' | 'in_storage';

export interface Asset {
  id: string;
  asset_tag: string;
  serial_number?: string | null;
  name: string;
  model?: string | null;
  manufacturer?: string | null;
  category_id: string;
  hostname?: string | null;
  
  // Commercial & Warranty
  purchase_date?: string | null;
  purchase_cost?: number | null;
  po_number?: string | null;
  vendor_name?: string | null;
  warranty_expiry?: string | null;
  amc_vendor?: string | null;
  amc_expiry?: string | null;
  invoice_document_path?: string | null;
  
  // Hierarchy & Assignment
  current_location_id: string;
  current_plant_id: string;
  current_department_id: string;
  assigned_employee_id?: string | null;
  
  // Status & Soft Delete
  status: AssetStatus;
  is_deleted: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  category?: Category;
  location?: Location;
  plant?: Plant;
  department?: Department;
  assigned_employee?: Employee | null;
  peripherals?: AssetPeripheral[];
  custom_values?: Record<string, string> | AssetCustomValue[];
}

export interface AssetCustomValue {
  id: string;
  asset_id: string;
  field_id: string;
  field_value: string;
  created_at: string;
  updated_at: string;
  field?: CategoryFormField;
}

export interface AssetPeripheral {
  id: string;
  asset_id: string;
  peripheral_name: string;
  model_number?: string | null;
  serial_number?: string | null;
  is_included: boolean;
  notes?: string | null;
  created_at: string;
}

export interface AssetAssignment {
  id: string;
  asset_id: string;
  employee_id: string;
  assigned_by?: string | null;
  assigned_at: string;
  returned_at?: string | null;
  return_condition?: string | null;
  remarks?: string | null;
  employee?: Employee;
  asset?: Asset;
}

export interface AssetTransfer {
  id: string;
  asset_id: string;
  from_department_id?: string | null;
  to_department_id: string;
  from_location_id?: string | null;
  to_location_id: string;
  from_plant_id?: string | null;
  to_plant_id: string;
  transferred_by?: string | null;
  reason?: string | null;
  transferred_at: string;
  from_department?: Department;
  to_department?: Department;
}

export type ReportType = 'damaged' | 'missing' | 'scrap';
export type ReportSeverity = 'minor' | 'major' | 'total_loss';
export type ReportStatus = 'pending' | 'approved' | 'rejected' | 'resolved';

export interface DamageScrapReport {
  id: string;
  asset_id: string;
  report_type: ReportType;
  reason: string;
  severity: ReportSeverity;
  photo_paths: string[];
  document_url?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  employee_email?: string | null;
  contact_phone?: string | null;
  reported_by: string;
  status: ReportStatus;
  resolution_status?: 'pending' | 'repaired' | 'scrapped' | 'recovered' | null;
  resolution_action?: 'reassigned' | 'returned_to_stock' | 'scrapped' | null;
  resolution_notes?: string | null;
  reviewer_id?: string | null;
  review_remarks?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  asset?: Asset | null;
  reporter?: User | null;
  reviewer?: User | null;
}

export type PMMachineStatus = 'operational' | 'under_maintenance' | 'breakdown';
export type PMScheduleStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';
export type ComplaintStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'rejected';

export interface PMMachine {
  id: string;
  asset_id?: string | null;
  machine_code: string;
  machine_name: string;
  plant_id: string;
  location_id: string;
  department_id: string;
  pm_frequency_days: number;
  last_pm_date?: string | null;
  next_pm_date: string;
  qr_code_token: string;
  status: PMMachineStatus;
  created_at: string;
  updated_at: string;
  plant?: Plant;
  location?: Location;
  department?: Department;
}

export interface PMSchedule {
  id: string;
  machine_id: string;
  due_date: string;
  completed_date?: string | null;
  status: PMScheduleStatus;
  assigned_to?: string | null;
  checklist_data: Array<{ item: string; done: boolean }>;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  machine?: PMMachine;
}

export interface PMComplaint {
  id: string;
  machine_id: string;
  reporter_name: string;
  reporter_contact?: string | null;
  description: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  resolution_notes?: string | null;
  technician_cost?: number | null;
  replacement_parts?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  ip_address?: string | null;
  created_at: string;
  updated_at: string;
  machine?: PMMachine;
}

export type AuditEventCategory = 'session' | 'data_change';
export type AuditRiskLevel = 'normal' | 'warning' | 'critical';

export interface AuditLog {
  id: string;
  event_category: AuditEventCategory;
  user_id?: string | null;
  user_role: string;
  action: string;
  target_table?: string | null;
  record_id?: string | null;
  changes?: Record<string, unknown> | null;
  risk_level: AuditRiskLevel;
  ip_address?: string | null;
  user_agent?: string | null;
  location_id?: string | null;
  plant_id?: string | null;
  department_id?: string | null;
  location_name?: string | null;
  plant_name?: string | null;
  department_name?: string | null;
  emp_code?: string | null;
  session_duration?: string | null;
  created_at: string;
  user?: User;
}

export interface EmailTemplate {
  id: string;
  template_key: string;
  subject: string;
  body_html: string;
  description?: string | null;
  is_active: boolean;
  updated_at: string;
}
