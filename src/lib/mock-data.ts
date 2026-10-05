// =============================================================================
// AEMS v2 — Seed & In-Memory Fallback Dataset (Mirrors Migration 003)
// Used when live Supabase connection is pending configuration.
// =============================================================================

import {
  Location,
  Plant,
  Department,
  Category,
  CategoryFormField,
  User,
  UserScope,
} from '@/types/database';

export const SEED_LOCATIONS: Location[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    name: 'Pune',
    code: 'LOC-PUNE',
    address: 'Pune, Maharashtra',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const SEED_PLANTS: Plant[] = [
  {
    id: '22222222-2222-2222-2222-222222222201',
    location_id: '11111111-1111-1111-1111-111111111101',
    name: 'NGM',
    code: 'NGM',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222202',
    location_id: '11111111-1111-1111-1111-111111111101',
    name: 'PGTL',
    code: 'PGTL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222203',
    location_id: '11111111-1111-1111-1111-111111111101',
    name: 'PGEL',
    code: 'PGEL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const SEED_USERS: User[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'software.2040@pgel.in',
    full_name: 'IT Admin (AEMS Root)',
    phone: '+91 98765 43210',
    role: 'it_admin',
    is_active: true,
    last_login_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'plant.admin@pgel.in',
    full_name: 'Rajesh Sharma (Plant Admin)',
    phone: '+91 98765 43211',
    role: 'admin',
    is_active: true,
    last_login_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'hr.lead@pgel.in',
    full_name: 'Pooja Verma (HR Lead)',
    phone: '+91 98765 43212',
    role: 'hr',
    is_active: true,
    last_login_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'operator1@pgel.in',
    full_name: 'Amit Kumar (Floor User)',
    phone: '+91 98765 43213',
    role: 'user',
    is_active: true,
    last_login_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const SEED_SCOPES: UserScope[] = [
  {
    id: 's1',
    user_id: '00000000-0000-0000-0000-000000000001',
    can_edit: true,
    category_ids: null,
    location_ids: null,
    plant_ids: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's2',
    user_id: '00000000-0000-0000-0000-000000000002',
    can_edit: true,
    category_ids: null,
    location_ids: ['11111111-1111-1111-1111-111111111101'],
    plant_ids: ['22222222-2222-2222-2222-222222222201', '22222222-2222-2222-2222-222222222202'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's3',
    user_id: '00000000-0000-0000-0000-000000000003',
    can_edit: true,
    category_ids: null,
    location_ids: null,
    plant_ids: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's4',
    user_id: '00000000-0000-0000-0000-000000000004',
    can_edit: true,
    category_ids: null,
    location_ids: null,
    plant_ids: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const SEED_DEPARTMENTS: Department[] = [
  {
    id: '33333333-3333-3333-3333-333333333301',
    name: 'Information Technology',
    code: 'DEPT-IT',
    admin_user_id: '00000000-0000-0000-0000-000000000001',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333302',
    name: 'Production & Assembly',
    code: 'DEPT-PROD',
    admin_user_id: '00000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333303',
    name: 'Quality Assurance',
    code: 'DEPT-QA',
    admin_user_id: '00000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333304',
    name: 'Human Resources',
    code: 'DEPT-HR',
    admin_user_id: '00000000-0000-0000-0000-000000000003',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333305',
    name: 'Plant Maintenance & Electrical',
    code: 'DEPT-MAINT',
    admin_user_id: '00000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333306',
    name: 'Health, Safety & Environment',
    code: 'DEPT-HSE',
    admin_user_id: '00000000-0000-0000-0000-000000000002',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const SEED_CATEGORIES: Category[] = [
  { id: '44444444-4444-4444-4444-444444444401', name: 'IT', code: 'CAT-IT', description: 'Laptops, Desktops, Servers, Switches, Printers', icon: 'Laptop', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444402', name: 'Camera/NVR', code: 'CAT-SEC', description: 'CCTV Cameras, NVR, DVR, Biometric Scanners', icon: 'Video', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444403', name: 'Quality', code: 'CAT-QA', description: 'Calibrated Gauges, Testing Jigs, Spectrometers', icon: 'ShieldCheck', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444404', name: 'Electrical', code: 'CAT-ELEC', description: 'Transformers, VFDs, Control Panels, DG Sets', icon: 'Zap', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444405', name: 'Production', code: 'CAT-PROD', description: 'Molding Machines, Conveyors, SMT Lines, Compressors', icon: 'Cog', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444406', name: 'Safety', code: 'CAT-SAFE', description: 'Fire Extinguishers, Hydrant Systems, PPE Stations', icon: 'Flame', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444407', name: 'Vehicle', code: 'CAT-VEH', description: 'Forklifts, Stackers, Trucks, Company Vehicles', icon: 'Truck', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444408', name: 'Furniture', code: 'CAT-FURN', description: 'Workstations, Conference Tables, Ergonomic Chairs', icon: 'Armchair', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444409', name: 'Software License', code: 'CAT-SW', description: 'CAD/CAM Licenses, ERP Seats, OS Licences', icon: 'Key', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '44444444-4444-4444-4444-444444444410', name: 'Maintenance', code: 'CAT-MAINT', description: 'Welding Machines, Hydraulic Presses, Toolkits', icon: 'Wrench', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

export const SEED_CATEGORY_FIELDS: CategoryFormField[] = [
  { id: 'cf1', category_id: '44444444-4444-4444-4444-444444444401', field_name: 'ram_size', field_label: 'RAM Size', field_type: 'select', options: ['8 GB', '16 GB', '32 GB', '64 GB'], is_required: true, placeholder: 'Select RAM', display_order: 1, created_at: new Date().toISOString() },
  { id: 'cf2', category_id: '44444444-4444-4444-4444-444444444401', field_name: 'storage_capacity', field_label: 'Storage Capacity', field_type: 'select', options: ['256 GB SSD', '512 GB SSD', '1 TB SSD', '2 TB SSD'], is_required: true, placeholder: 'Select Storage', display_order: 2, created_at: new Date().toISOString() },
  { id: 'cf3', category_id: '44444444-4444-4444-4444-444444444401', field_name: 'operating_system', field_label: 'Operating System', field_type: 'select', options: ['Windows 11 Pro', 'Windows 10 Pro', 'Ubuntu Linux'], is_required: true, placeholder: 'Select OS', display_order: 3, created_at: new Date().toISOString() },
  { id: 'cf4', category_id: '44444444-4444-4444-4444-444444444401', field_name: 'processor', field_label: 'Processor Model', field_type: 'text', options: null, is_required: false, placeholder: 'Intel Core i7-13700H', display_order: 4, created_at: new Date().toISOString() },
  { id: 'cf5', category_id: '44444444-4444-4444-4444-444444444403', field_name: 'last_calibration_date', field_label: 'Last Calibration Date', field_type: 'date', options: null, is_required: true, placeholder: '', display_order: 1, created_at: new Date().toISOString() },
  { id: 'cf6', category_id: '44444444-4444-4444-4444-444444444403', field_name: 'calibration_due_date', field_label: 'Calibration Due Date', field_type: 'date', options: null, is_required: true, placeholder: '', display_order: 2, created_at: new Date().toISOString() },
  { id: 'cf7', category_id: '44444444-4444-4444-4444-444444444407', field_name: 'reg_number', field_label: 'Vehicle Registration No.', field_type: 'text', options: null, is_required: true, placeholder: 'UP 16 AB 1234', display_order: 1, created_at: new Date().toISOString() },
];
