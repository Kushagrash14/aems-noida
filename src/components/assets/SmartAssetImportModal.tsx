'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Users,
  Box,
  Server,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Info,
  Check,
  Building2,
  MapPin,
  HelpCircle,
} from 'lucide-react';
import { Location, Plant, Department, Employee, Asset } from '@/types/database';

export interface SmartAssetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentName: string;
  departmentId: string;
  locations: Location[];
  plants: Plant[];
  departments: Department[];
  onImportSuccess?: (result: {
    total_processed: number;
    assets_created: number;
    employees_created: number;
    assets_in_stock: number;
    assets_assigned: number;
    imported_tags: string[];
    skipped_rows?: Array<{ serial_number: string; reason: string }>;
  }) => void;
}

interface ParsedImportRow {
  rowNum: number;
  name: string;
  category_name?: string;
  manufacturer?: string;
  model?: string;
  serial_number: string;
  sap_asset_code?: string;
  hostname?: string;
  purchase_date?: string;
  purchase_cost?: number;
  vendor_name?: string;
  po_number?: string;
  invoice_number?: string;
  invoice_date?: string;
  warranty_expiry?: string;
  emp_code?: string;
  emp_name?: string;
  emp_email?: string;
  emp_phone?: string;
  emp_designation?: string;
  remarks?: string;

  // Technical & Network Specifications (for IT Laptops/Desktops/Devices)
  processor?: string;
  ram?: string;
  storage?: string;
  operating_system?: string;
  mac_address?: string;
  ip_address?: string;

  // Analysis flags
  status: 'valid' | 'warning' | 'error';
  statusMessages: string[];
  willCreateEmployee?: boolean;
  isAssigned?: boolean;
  isStock?: boolean;
}

// Dynamic Theme Palette Generator based on Department Name
export function getDepartmentTheme(deptName: string) {
  const upper = (deptName || '').toUpperCase();

  if (upper.includes('INFORMATION') || upper.includes('IT')) {
    return {
      name: 'Information Technology',
      gradient: 'from-blue-600 via-indigo-600 to-cyan-600',
      heroGradient: 'from-[#0a1128] via-[#0d1e4c] to-[#122b68]',
      border: 'border-blue-500/40',
      glow: 'shadow-blue-500/25',
      badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
      button: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/30',
      pill: 'bg-blue-50 text-blue-700 border-blue-200',
      accentText: 'text-blue-400',
      accentBg: 'bg-blue-600',
      lightBg: 'bg-blue-50/70 border-blue-100',
    };
  }

  if (upper.includes('PRODUCTION') || upper.includes('ASSEMBLY')) {
    return {
      name: 'Production & Assembly',
      gradient: 'from-amber-600 via-orange-600 to-yellow-600',
      heroGradient: 'from-[#231505] via-[#3a2008] to-[#542d0a]',
      border: 'border-amber-500/40',
      glow: 'shadow-amber-500/25',
      badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
      button: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-500/30',
      pill: 'bg-amber-50 text-amber-700 border-amber-200',
      accentText: 'text-amber-400',
      accentBg: 'bg-amber-600',
      lightBg: 'bg-amber-50/70 border-amber-100',
    };
  }

  if (upper.includes('DISPATCH') || upper.includes('LOGISTIC')) {
    return {
      name: 'Dispatch & Logistics',
      gradient: 'from-emerald-600 via-teal-600 to-cyan-600',
      heroGradient: 'from-[#051c14] via-[#092b20] to-[#0e3f30]',
      border: 'border-emerald-500/40',
      glow: 'shadow-emerald-500/25',
      badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
      button: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/30',
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accentText: 'text-emerald-400',
      accentBg: 'bg-emerald-600',
      lightBg: 'bg-emerald-50/70 border-emerald-100',
    };
  }

  if (upper.includes('QUALITY') || upper.includes('QA')) {
    return {
      name: 'Quality Assurance',
      gradient: 'from-purple-600 via-violet-600 to-indigo-600',
      heroGradient: 'from-[#190a28] via-[#291142] to-[#3a185e]',
      border: 'border-purple-500/40',
      glow: 'shadow-purple-500/25',
      badge: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
      button: 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white shadow-purple-500/30',
      pill: 'bg-purple-50 text-purple-700 border-purple-200',
      accentText: 'text-purple-400',
      accentBg: 'bg-purple-600',
      lightBg: 'bg-purple-50/70 border-purple-100',
    };
  }

  if (upper.includes('MAINTENANCE') || upper.includes('ELECTRICAL')) {
    return {
      name: 'Maintenance & Electrical',
      gradient: 'from-rose-600 via-red-600 to-orange-600',
      heroGradient: 'from-[#260a0f] via-[#3d1018] to-[#591723]',
      border: 'border-rose-500/40',
      glow: 'shadow-rose-500/25',
      badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/30',
      button: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-500/30',
      pill: 'bg-rose-50 text-rose-700 border-rose-200',
      accentText: 'text-rose-400',
      accentBg: 'bg-rose-600',
      lightBg: 'bg-rose-50/70 border-rose-100',
    };
  }

  if (upper.includes('SAFETY') || upper.includes('HSE')) {
    return {
      name: 'Health & Safety (HSE)',
      gradient: 'from-teal-600 via-emerald-600 to-green-600',
      heroGradient: 'from-[#05211d] via-[#09352e] to-[#0d4a41]',
      border: 'border-teal-500/40',
      glow: 'shadow-teal-500/25',
      badge: 'bg-teal-500/10 text-teal-400 border border-teal-500/30',
      button: 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-teal-500/30',
      pill: 'bg-teal-50 text-teal-700 border-teal-200',
      accentText: 'text-teal-400',
      accentBg: 'bg-teal-600',
      lightBg: 'bg-teal-50/70 border-teal-100',
    };
  }

  // Default theme
  return {
    name: deptName || 'General Assets',
    gradient: 'from-indigo-600 via-blue-600 to-slate-700',
    heroGradient: 'from-[#0f172a] via-[#1e293b] to-[#334155]',
    border: 'border-indigo-500/40',
    glow: 'shadow-indigo-500/25',
    badge: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30',
    button: 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-500/30',
    pill: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    accentText: 'text-indigo-400',
    accentBg: 'bg-indigo-600',
    lightBg: 'bg-indigo-50/70 border-indigo-100',
  };
}

export default function SmartAssetImportModal({
  isOpen,
  onClose,
  departmentName,
  departmentId,
  locations,
  plants,
  departments,
  onImportSuccess,
}: SmartAssetImportModalProps) {
  const theme = useMemo(() => getDepartmentTheme(departmentName), [departmentName]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cascading Location & Plant selection
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id || '');
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');

  // Update selected plant whenever location changes
  useEffect(() => {
    if (selectedLocationId) {
      const availablePlants = plants.filter((p) => p.location_id === selectedLocationId);
      setSelectedPlantId(availablePlants[0]?.id || '');
    } else if (locations[0]?.id) {
      setSelectedLocationId(locations[0].id);
    }
  }, [selectedLocationId, locations, plants]);

  // Existing database assets & employees for local pre-flight duplicate checking
  const [dbEmployees, setDbEmployees] = useState<Employee[]>([]);
  const [dbAssets, setDbAssets] = useState<Asset[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        fetch('/api/employees').then((r) => r.json()).catch(() => ({ employees: [] })),
        fetch('/api/assets').then((r) => r.json()).catch(() => ({ assets: [] })),
      ]).then(([empsRes, assetsRes]) => {
        if (empsRes.employees) setDbEmployees(empsRes.employees);
        if (assetsRes.assets) setDbAssets(assetsRes.assets);
        setDbLoaded(true);
      });
    }
  }, [isOpen]);

  // Upload & Scanner State
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [securityScanPassed, setSecurityScanPassed] = useState<boolean | null>(null);
  const [securityScanAlert, setSecurityScanAlert] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Parsed and analyzed rows
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'valid' | 'warning' | 'error'>('all');

  // Import Submission State
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total_processed: number;
    assets_created: number;
    employees_created: number;
    assets_in_stock: number;
    assets_assigned: number;
    imported_tags: string[];
    created_employees: Array<{ id: string; emp_code: string; full_name: string }>;
    skipped_rows?: Array<{ serial_number: string; reason: string }>;
  } | null>(null);

  // Reset state when closed
  const handleClose = () => {
    setSelectedFile(null);
    setSecurityScanPassed(null);
    setSecurityScanAlert(null);
    setParsedRows([]);
    setImportResult(null);
    setImporting(false);
    onClose();
  };

  // 1. Download Custom Department Excel Template
  const handleDownloadTemplate = () => {
    const cleanDept = (departmentName || 'DEPARTMENT').toUpperCase();
    const wb = XLSX.utils.book_new();

    // Contextual Sample Data based on Department
    let sampleRows: any[] = [];
    if (cleanDept.includes('IT') || cleanDept.includes('INFORMATION')) {
      sampleRows = [
        {
          'Asset Name': 'Lenovo ThinkPad T14 Gen 3',
          'Asset Type': 'LAPTOP',
          'Manufacturer / Brand': 'Lenovo',
          'Model': '21AH00BUIN',
          'Serial Number': 'PF3XA001',
          'Asset Code (According to SAP)': 'SAP-1002394',
          'Processor / CPU': 'Intel Core i7-12700H',
          'RAM Memory': '16 GB DDR4',
          'Storage Capacity': '512 GB NVMe SSD',
          'Operating System': 'Windows 11 Pro',
          'Hostname': 'PGEL-HQ-L042',
          'MAC Address': '00:1A:2B:3C:4D:5E',
          'IP Address': '192.168.1.105',
          'Purchase Date (YYYY-MM-DD)': '2024-03-15',
          'Purchase Cost (INR)': 78500,
          'Vendor Name': 'Redington India Ltd',
          'PO Number': 'PO-2024-0012',
          'Invoice Number (Optional)': 'INV-2024-0012',
          'Invoice Date (Optional)': '2024-03-15',
          'Warranty Expiry (YYYY-MM-DD)': '2027-03-14',
          'Employee Code (Optional)': 'PG-1001',
          'Employee Full Name (Optional)': 'AMIT SHARMA',
          'Employee Email (Optional)': 'amit.sharma@pgel.in',
          'Employee Phone (Optional)': '9876543210',
          'Employee Designation (Optional)': 'Sr. Software Engineer',
          'Remarks (Optional)': 'Assigned for Core ERP Migration',
        },
        {
          'Asset Name': 'Dell OptiPlex 7090 Desktop',
          'Asset Type': 'DESKTOP',
          'Manufacturer / Brand': 'Dell',
          'Model': 'OptiPlex 7090 MT',
          'Serial Number': 'DL901234',
          'Asset Code (According to SAP)': 'SAP-1002395',
          'Processor / CPU': 'Intel Core i5-11500',
          'RAM Memory': '16 GB DDR4',
          'Storage Capacity': '1 TB SSD',
          'Operating System': 'Windows 11 Pro',
          'Hostname': 'PGEL-HQ-D018',
          'MAC Address': '00:1A:2B:3C:4D:5F',
          'IP Address': '192.168.1.106',
          'Purchase Date (YYYY-MM-DD)': '2024-01-20',
          'Purchase Cost (INR)': 62000,
          'Vendor Name': 'Compucom Systems',
          'PO Number': 'PO-2024-0044',
          'Invoice Number (Optional)': 'INV-2024-0044',
          'Invoice Date (Optional)': '2024-01-20',
          'Warranty Expiry (YYYY-MM-DD)': '2027-01-19',
          'Employee Code (Optional)': 'PG-1002',
          'Employee Full Name (Optional)': 'PRIYA PATEL',
          'Employee Email (Optional)': 'priya.patel@pgel.in',
          'Employee Phone (Optional)': '9876543211',
          'Employee Designation (Optional)': 'UI/UX Lead',
          'Remarks (Optional)': 'Design Workstation with Dual Monitor Setup',
        },
        {
          'Asset Name': 'Dell 24-inch FHD Monitor P2422H',
          'Asset Type': 'MONITOR',
          'Manufacturer / Brand': 'Dell',
          'Model': 'P2422H',
          'Serial Number': 'CN-0M3817',
          'Asset Code (According to SAP)': 'SAP-1002396',
          'Processor / CPU': '',
          'RAM Memory': '',
          'Storage Capacity': '',
          'Operating System': '',
          'Hostname': '',
          'MAC Address': '',
          'IP Address': '',
          'Purchase Date (YYYY-MM-DD)': '2024-02-10',
          'Purchase Cost (INR)': 14500,
          'Vendor Name': 'Compucom Systems',
          'PO Number': 'PO-2024-0062',
          'Invoice Number (Optional)': 'INV-2024-0062',
          'Invoice Date (Optional)': '2024-02-10',
          'Warranty Expiry (YYYY-MM-DD)': '2027-02-09',
          'Employee Code (Optional)': '',
          'Employee Full Name (Optional)': '',
          'Employee Email (Optional)': '',
          'Employee Phone (Optional)': '',
          'Employee Designation (Optional)': '',
          'Remarks (Optional)': 'Direct Stock pool reserve for emergency swap',
        },
      ];
    } else if (cleanDept.includes('PRODUCTION') || cleanDept.includes('ASSEMBLY')) {
      sampleRows = [
        {
          'Asset Name': 'Injection Molding Machine 350T',
          'Asset Type': 'INJECTION MOLDING MACHINE',
          'Manufacturer / Brand': 'Toshiba',
          'Model': 'EC350SXIII',
          'Serial Number': 'TSH-350-2024-01',
          'Hostname': '',
          'Purchase Date (YYYY-MM-DD)': '2023-11-01',
          'Purchase Cost (INR)': 3500000,
          'Vendor Name': 'Toshiba Machine India',
          'PO Number': 'PO-PROD-2023-88',
          'Warranty Expiry (YYYY-MM-DD)': '2025-10-31',
          'Employee Code (Optional)': 'PG-2001',
          'Employee Full Name (Optional)': 'RAJESH KUMAR',
          'Employee Email (Optional)': 'rajesh.kumar@pgel.in',
          'Employee Phone (Optional)': '9811223344',
          'Employee Designation (Optional)': 'Molding Line Supervisor',
          'Remarks (Optional)': 'Bay 4 Molding Area Unit 1',
        },
        {
          'Asset Name': 'Heavy Duty Motorized Conveyor 15M',
          'Asset Type': 'CONVEYOR BELT',
          'Manufacturer / Brand': 'Siemens Drive Tech',
          'Model': 'CV-15M-HD',
          'Serial Number': 'SMS-CV-8821',
          'Hostname': '',
          'Purchase Date (YYYY-MM-DD)': '2024-01-15',
          'Purchase Cost (INR)': 450000,
          'Vendor Name': 'Siemens India Ltd',
          'PO Number': 'PO-PROD-2024-11',
          'Warranty Expiry (YYYY-MM-DD)': '2026-01-14',
          'Employee Code (Optional)': '',
          'Employee Full Name (Optional)': '',
          'Employee Email (Optional)': '',
          'Employee Phone (Optional)': '',
          'Employee Designation (Optional)': '',
          'Remarks (Optional)': 'Final Assembly Feed Line - Plant Floor Asset',
        },
      ];
    } else {
      sampleRows = [
        {
          'Asset Name': `Standard ${cleanDept} Workstation Unit`,
          'Asset Type': 'EQUIPMENT',
          'Manufacturer / Brand': 'Standard Industrial',
          'Model': 'ST-500',
          'Serial Number': 'EQ-2024-001',
          'Hostname': '',
          'Purchase Date (YYYY-MM-DD)': '2024-01-15',
          'Purchase Cost (INR)': 45000,
          'Vendor Name': 'Industrial Equipment Supply',
          'PO Number': 'PO-2024-991',
          'Warranty Expiry (YYYY-MM-DD)': '2026-01-14',
          'Employee Code (Optional)': 'EMP-501',
          'Employee Full Name (Optional)': 'SANJAY VERMA',
          'Employee Email (Optional)': 'sanjay@pgel.in',
          'Employee Phone (Optional)': '9800000001',
          'Employee Designation (Optional)': 'Department Operator',
          'Remarks (Optional)': 'Main floor equipment',
        },
      ];
    }

    const ws = XLSX.utils.json_to_sheet(sampleRows);

    // Auto-fit column widths
    const colWidths = Object.keys(sampleRows[0] || {}).map((k) => ({
      wch: Math.max(k.length + 3, 20),
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, `${cleanDept.slice(0, 25)} Template`);

    // Guidelines Sheet
    const guidelines = [
      ['AEMS v2 — SMART ASSET BATCH IMPORTER GUIDELINES'],
      ['Department:', cleanDept],
      [''],
      ['RULE 1: Genuine Excel Only', 'Only genuine .xlsx and .xls files are supported. CSV and other scripts are strictly rejected.'],
      ['RULE 2: Mandatory Columns', '"Asset Name" and "Serial Number" are strictly mandatory for each row.'],
      ['RULE 3: Unique Serial Numbers', 'Every serial number must be globally unique across PG Electroplast.'],
      ['RULE 4: Smart Custodian Handling', 'If "Employee Code" is provided and the employee does not exist in the database, AEMS will AUTOMATICALLY CREATE their active profile in the Staff Directory and link the asset!'],
      ['RULE 5: Inactive Employee Safety', 'If an employee code belongs to an inactive or resigned staff member, the asset will safely route to "In Stock".'],
      ['RULE 6: Unassigned to Stock', 'If Employee Code is left blank, the asset is automatically added directly to the "In Stock" available pool.'],
      ['RULE 7: Invoices & Photos', 'Physical asset photos, invoices, and warranty documents can be uploaded anytime via the "Edit Asset" screen.'],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guidelines);
    wsGuide['!cols'] = [{ wch: 35 }, { wch: 75 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Guidelines & Rules');

    // Trigger download
    const cleanFileName = `PGEL_${cleanDept.replace(/[^A-Z0-9]/g, '_')}_Import_Template.xlsx`;
    XLSX.writeFile(wb, cleanFileName);
  };

  // 2. Multi-Stage Security Quarantine & Integrity Scanning
  const processUploadedFile = async (file: File) => {
    setIsScanning(true);
    setSecurityScanPassed(null);
    setSecurityScanAlert(null);
    setParsedRows([]);
    setSelectedFile(file);

    // Stage 1: Strict Extension and MIME Guard
    const fileName = file.name.toLowerCase();
    const isXlsx = fileName.endsWith('.xlsx');
    const isXls = fileName.endsWith('.xls');

    if (!isXlsx && !isXls) {
      setSecurityScanPassed(false);
      setSecurityScanAlert(
        'Security Quarantine Activated: Only genuine Microsoft Excel (.xlsx, .xls) files are permitted. CSV, executable scripts, and other file types are rejected.'
      );
      setIsScanning(false);
      return;
    }

    // Stage 2: File Size Cap (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setSecurityScanPassed(false);
      setSecurityScanAlert('Security Quarantine: File exceeds maximum allowed limit of 10MB.');
      setIsScanning(false);
      return;
    }

    try {
      const buffer = await file.arrayBuffer();

      // Stage 3: Anti-Malware and Injection Vector Detection
      // Check for HTML/Script injection or SQL commands inside the binary/strings
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const rawTextSample = textDecoder.decode(buffer.slice(0, 100000));

      const maliciousRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|DROP\s+TABLE|UNION\s+SELECT|xp_cmdshell|exec\s*\(|cmd\.exe/i;
      if (maliciousRegex.test(rawTextSample)) {
        setSecurityScanPassed(false);
        setSecurityScanAlert(
          'Security Critical Alert: Malicious script tags or SQL injection signatures detected inside file payload. File quarantined and upload blocked.'
        );
        setIsScanning(false);
        return;
      }

      // Stage 4: Parse Excel Workbook
      const workbook = XLSX.read(buffer, { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        setSecurityScanPassed(false);
        setSecurityScanAlert('Corrupted File: No valid spreadsheet sheets found.');
        setIsScanning(false);
        return;
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });

      if (rawJson.length === 0) {
        setSecurityScanPassed(false);
        setSecurityScanAlert('Empty Workbook: The uploaded sheet contains 0 data rows.');
        setIsScanning(false);
        return;
      }

      // Stage 5: In-Depth Row Parsing & Integrity Validation
      const seenSerialsInSheet = new Set<string>();
      const existingDbSerials = new Set<string>(
        dbAssets.map((a) => (a.serial_number || '').trim().toUpperCase()).filter(Boolean)
      );
      const existingDbEmpCodes = new Map<string, Employee>();
      dbEmployees.forEach((e) => {
        if (e.emp_code) existingDbEmpCodes.set(e.emp_code.trim().toUpperCase(), e);
      });

      const analyzed: ParsedImportRow[] = [];

      rawJson.forEach((row, idx) => {
        const rowNum = idx + 2; // Excel row numbering (1-based, +1 for header)

        // Flexible key lookups (case-insensitive fuzzy)
        const getVal = (patterns: RegExp[]): string => {
          for (const key of Object.keys(row)) {
            if (patterns.some((p) => p.test(key))) {
              const val = row[key];
              return typeof val === 'string' ? val.trim() : String(val ?? '').trim();
            }
          }
          return '';
        };

        const name = getVal([/^asset.*name$/i, /^name$/i, /^title$/i, /^item$/i]);
        const category_name = getVal([/^asset.*type$/i, /^category$/i, /^type$/i]) || 'EQUIPMENT';
        const manufacturer = getVal([/^manufacturer/i, /^brand$/i, /^make$/i]);
        const model = getVal([/^model$/i, /^model.*no$/i, /^model.*number$/i]);
        const serial_number = getVal([/^serial/i, /^sn$/i, /^s\/n$/i]);
        const hostname = getVal([/^hostname$/i, /^host$/i, /^system.*name$/i]);
        const processor = getVal([/^processor/i, /^cpu/i]);
        const ram = getVal([/^ram/i, /^memory/i]);
        const storage = getVal([/^storage/i, /^hdd/i, /^ssd/i, /^hard.*disk/i, /^rom/i]);
        const operating_system = getVal([/^operating.*system/i, /^os$/i, /^windows.*ver/i]);
        const mac_address = getVal([/^mac.*address/i, /^mac$/i]);
        const ip_address = getVal([/^ip.*address/i, /^ip$/i]);
        const purchase_date = getVal([/^purchase.*date/i, /^invoice.*date/i, /^date$/i]);
        const purchaseCostStr = getVal([/^purchase.*cost/i, /^cost/i, /^price/i, /^amount/i]);
        const purchase_cost = purchaseCostStr ? parseFloat(purchaseCostStr.replace(/[^0-9.]/g, '')) || undefined : undefined;
        const vendor_name = getVal([/^vendor/i, /^supplier/i]);
        const po_number = getVal([/^po.*number/i, /^po.*no/i, /^po$/i]);
        const sap_asset_code = getVal([/^sap.*asset.*code/i, /^sap.*code/i, /^sap$/i, /^asset.*code.*sap/i]);
        const invoice_number = getVal([/^invoice.*number/i, /^invoice.*no/i, /^inv.*no/i, /^invoice$/i]);
        const invoice_date = getVal([/^invoice.*date/i, /^bill.*date/i]);
        const warranty_expiry = getVal([/^warranty.*expiry/i, /^warranty/i]);
        const emp_code = getVal([/^emp.*code/i, /^employee.*code/i, /^emp.*id/i, /^custodian.*code/i]);
        const emp_name = getVal([/^emp.*name/i, /^employee.*name/i, /^custodian.*name/i, /^full.*name/i]);
        const emp_email = getVal([/^emp.*email/i, /^employee.*email/i, /^email$/i]);
        const emp_phone = getVal([/^emp.*phone/i, /^phone/i, /^mobile/i]);
        const emp_designation = getVal([/^emp.*desig/i, /^designation/i, /^role$/i]);
        const remarks = getVal([/^remarks/i, /^notes/i, /^comments/i]);

        const statusMessages: string[] = [];
        let status: 'valid' | 'warning' | 'error' = 'valid';
        let willCreateEmployee = false;
        let isAssigned = false;
        let isStock = false;

        // Validation Checks
        if (!name) {
          status = 'error';
          statusMessages.push('Missing Asset Name');
        }

        const cleanSerial = serial_number.toUpperCase();
        if (!cleanSerial) {
          status = 'error';
          statusMessages.push('Missing Serial Number');
        } else {
          // Check for Excel formula injection in serial or name
          if (/^[=+\-@]/.test(serial_number) || /^[=+\-@]/.test(name)) {
            status = 'error';
            statusMessages.push('Formula Injection syntax detected in cell');
          }

          // Check duplicate in current sheet
          if (seenSerialsInSheet.has(cleanSerial)) {
            status = 'error';
            statusMessages.push(`Duplicate Serial in this sheet: "${cleanSerial}"`);
          } else {
            seenSerialsInSheet.add(cleanSerial);
          }

          // Check duplicate against existing database
          if (existingDbSerials.has(cleanSerial)) {
            status = 'error';
            statusMessages.push(`Serial already registered in AEMS database: "${cleanSerial}"`);
          }
        }

        // Employee Custodian checks
        const cleanEmpCode = emp_code.toUpperCase();
        if (cleanEmpCode) {
          if (existingDbEmpCodes.has(cleanEmpCode)) {
            const emp = existingDbEmpCodes.get(cleanEmpCode)!;
            if (emp.status === 'inactive' || (emp.status as string) === 'resigned') {
              if (status !== 'error') status = 'warning';
              statusMessages.push(`Staff ${cleanEmpCode} is INACTIVE → Will safely route to In Stock`);
              isStock = true;
            } else {
              isAssigned = true;
              statusMessages.push(`Assigned to: ${emp.full_name} (${cleanEmpCode})`);
            }
          } else {
            // Brand new employee auto-provisioning!
            willCreateEmployee = true;
            isAssigned = true;
            statusMessages.push(`Auto-Provision: New profile will be created for "${emp_name || cleanEmpCode}"`);
          }
        } else {
          // No employee code -> direct stock pool
          isStock = true;
          statusMessages.push('Unassigned: Will be added directly to In Stock pool');
        }

        analyzed.push({
          rowNum,
          name,
          category_name,
          manufacturer,
          model,
          serial_number: cleanSerial,
          sap_asset_code: sap_asset_code || undefined,
          hostname,
          purchase_date,
          purchase_cost,
          vendor_name,
          po_number,
          invoice_number: invoice_number || undefined,
          invoice_date: invoice_date || undefined,
          warranty_expiry,
          emp_code: cleanEmpCode,
          emp_name,
          emp_email,
          emp_phone,
          emp_designation,
          remarks,
          processor,
          ram,
          storage,
          operating_system,
          mac_address,
          ip_address,
          status,
          statusMessages,
          willCreateEmployee,
          isAssigned,
          isStock,
        });
      });

      setParsedRows(analyzed);
      setSecurityScanPassed(true);
      setSecurityScanAlert(null);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setSecurityScanPassed(false);
      setSecurityScanAlert(`File Parsing Failed: ${err.message || 'Unable to parse spreadsheet contents.'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Stat Counters
  const totalRowsCount = parsedRows.length;
  const validRowsCount = parsedRows.filter((r) => r.status === 'valid').length;
  const warningRowsCount = parsedRows.filter((r) => r.status === 'warning').length;
  const errorRowsCount = parsedRows.filter((r) => r.status === 'error').length;
  const newStaffCount = parsedRows.filter((r) => r.willCreateEmployee).length;
  const stockCount = parsedRows.filter((r) => r.isStock).length;
  const assignedCount = parsedRows.filter((r) => r.isAssigned).length;

  const canExecuteImport =
    totalRowsCount > 0 &&
    errorRowsCount === 0 &&
    securityScanPassed === true &&
    Boolean(selectedLocationId) &&
    Boolean(selectedPlantId) &&
    !importing;

  // Filtered rows for active tab
  const displayRows = useMemo(() => {
    if (activeTab === 'valid') return parsedRows.filter((r) => r.status === 'valid');
    if (activeTab === 'warning') return parsedRows.filter((r) => r.status === 'warning');
    if (activeTab === 'error') return parsedRows.filter((r) => r.status === 'error');
    return parsedRows;
  }, [parsedRows, activeTab]);

  // Execute Import Call
  const handleConfirmImport = async () => {
    if (!canExecuteImport) return;

    setImporting(true);
    try {
      const itemsPayload = parsedRows.map((r) => ({
        name: r.name,
        category_name: r.category_name,
        manufacturer: r.manufacturer,
        model: r.model,
        serial_number: r.serial_number,
        sap_asset_code: r.sap_asset_code,
        hostname: r.hostname,
        purchase_date: r.purchase_date,
        purchase_cost: r.purchase_cost,
        vendor_name: r.vendor_name,
        po_number: r.po_number,
        invoice_number: r.invoice_number,
        invoice_date: r.invoice_date,
        warranty_expiry: r.warranty_expiry,
        remarks: r.remarks,
        emp_code: r.emp_code,
        emp_name: r.emp_name,
        emp_email: r.emp_email,
        emp_phone: r.emp_phone,
        emp_designation: r.emp_designation,
        processor: r.processor,
        ram: r.ram,
        storage: r.storage,
        operating_system: r.operating_system,
        mac_address: r.mac_address,
        ip_address: r.ip_address,
      }));

      const res = await fetch('/api/assets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: selectedLocationId,
          plant_id: selectedPlantId,
          department_id: departmentId,
          items: itemsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete batch import');
      }

      setImportResult(data);
      if (onImportSuccess) {
        onImportSuccess(data);
      }
    } catch (err: any) {
      console.error('Import execution error:', err);
      alert(`Import Failed: ${err.message || 'An unexpected error occurred.'}`);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh]">
        {/* Compact Dynamic Department Header Banner */}
        <div className={`px-4 py-2.5 bg-gradient-to-r ${theme.heroGradient} text-white shrink-0 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="p-1 rounded-lg bg-white/10 text-white shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
              Smart Excel Batch Asset Importer
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase bg-white/10 text-white border border-white/20 font-mono flex items-center gap-1 shrink-0">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              IT ADMIN
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${theme.badge}`}>
              {departmentName || 'DEPARTMENT'}
            </span>
          </div>

          <button
            onClick={handleClose}
            disabled={importing}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer border border-white/10 shrink-0"
            title="Close Importer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Fitted for single-screen viewing */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
          {/* SUCCESS SCREEN */}
          {importResult ? (
            <div className="text-center py-6 space-y-4 max-w-lg mx-auto animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-md border border-emerald-200">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Batch Import Successfully Committed!
                </h3>
                <p className="text-xs text-slate-500">
                  All equipment and custodian assignments have been safely written to the database.
                </p>
              </div>

              {/* Result Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs text-left">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Created</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{importResult.assets_created}</p>
                </div>

                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Assigned</p>
                  <p className="text-base font-black text-emerald-700 mt-0.5">{importResult.assets_assigned}</p>
                </div>

                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">+New Staff</p>
                  <p className="text-base font-black text-blue-700 mt-0.5">{importResult.employees_created}</p>
                </div>

                <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">In Stock</p>
                  <p className="text-base font-black text-amber-700 mt-0.5">{importResult.assets_in_stock}</p>
                </div>
              </div>

              {importResult.skipped_rows && importResult.skipped_rows.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 text-left space-y-1.5">
                  <p className="text-[11px] font-black text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Rows Not Imported ({importResult.skipped_rows.length})
                  </p>
                  <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                    {importResult.skipped_rows.map((row, idx) => (
                      <li key={`${row.serial_number}-${idx}`} className="text-[10px] text-amber-900">
                        <span className="font-mono font-bold">{row.serial_number}</span> — {row.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importResult.created_employees && importResult.created_employees.length > 0 && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 text-left space-y-1.5">
                  <p className="text-[11px] font-black text-blue-900 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Auto-Provisioned Staff Profiles ({importResult.created_employees.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {importResult.created_employees.map((emp) => (
                      <span
                        key={emp.id}
                        className="px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[10px] font-bold text-blue-800 shadow-2xs"
                      >
                        {emp.full_name} ({emp.emp_code})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    window.location.href = '/assets';
                  }}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>Go to Asset Directory</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Ultra-Compact Top Bar: Location, Plant, Locked Department & Download Template in ONE single row! */}
              <div className="bg-white p-2 px-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  {/* Location Picker */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase">Location:</span>
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="text-xs font-bold px-2 py-1 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Plant Picker */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase">Plant:</span>
                    <select
                      value={selectedPlantId}
                      onChange={(e) => setSelectedPlantId(e.target.value)}
                      className="text-xs font-bold px-2 py-1 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      {plants
                        .filter((p) => p.location_id === selectedLocationId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.code})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Dept Badge */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase">Dept:</span>
                    <span className="font-extrabold text-[11px] text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {departmentName}
                    </span>
                  </div>
                </div>

                {/* Download Template Button */}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className={`py-1 px-3 rounded-lg ${theme.button} text-[11px] font-black shadow-xs flex items-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider shrink-0`}
                  title={`Download pre-formatted Excel template for ${departmentName}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .XLSX Template</span>
                </button>
              </div>

              {/* State A: When No File Uploaded -> Sleek Compact Dropzone & Feature Badges */}
              {parsedRows.length === 0 ? (
                <div className="space-y-2.5">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processUploadedFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 sm:p-7 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                        : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/80 shadow-2xs'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processUploadedFile(file);
                        e.target.value = '';
                      }}
                    />

                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
                      <UploadCloud className="w-5 h-5" />
                    </div>

                    <div>
                      <p className="text-xs sm:text-sm font-extrabold text-slate-800">
                        Click to browse or drag &amp; drop Excel workbook
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Strictly accepts <strong className="text-slate-700">.XLSX</strong> and <strong className="text-slate-700">.XLS</strong> spreadsheets up to 10MB.
                      </p>
                    </div>

                    {isScanning && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 animate-pulse mt-0.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Smart Scanner running pre-flight security checks...</span>
                      </div>
                    )}
                  </div>

                  {/* Security Quarantine Alert (if rejected) */}
                  {securityScanPassed === false && securityScanAlert && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-extrabold text-rose-900 uppercase tracking-wide text-[10px]">
                          Security Threat / Quarantine Alert
                        </p>
                        <p className="mt-0.5 text-[11px]">{securityScanAlert}</p>
                      </div>
                    </div>
                  )}

                  {/* 3 Compact Feature Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 px-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <div>
                        <p className="font-extrabold text-slate-900 text-[10px] uppercase">Auto-Staff Provisioning</p>
                        <p className="text-[10px] text-slate-500 leading-tight">Creates active profile &amp; assigns asset</p>
                      </div>
                    </div>

                    <div className="p-2 px-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2">
                      <Box className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-extrabold text-slate-900 text-[10px] uppercase">In-Stock Routing</p>
                        <p className="text-[10px] text-slate-500 leading-tight">Unassigned or inactive staff sent to stock</p>
                      </div>
                    </div>

                    <div className="p-2 px-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-extrabold text-slate-900 text-[10px] uppercase">Serial Collision Guard</p>
                        <p className="text-[10px] text-slate-500 leading-tight">Checks duplicates in-sheet &amp; database</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* State B: When File is Parsed -> Compact File Banner + Stat Strip + Table */
                <div className="space-y-2 animate-in fade-in duration-200">
                  {/* File & Scanner Status Bar */}
                  <div className="bg-white p-2 px-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-extrabold text-slate-900 truncate text-[11px] max-w-[260px]">
                        {selectedFile?.name}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({selectedFile ? `${Math.round(selectedFile.size / 1024)} KB` : ''})
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        <Check className="w-2.5 h-2.5" />
                        CLEAN SCAN
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setParsedRows([]);
                        setSecurityScanPassed(null);
                      }}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer shrink-0"
                    >
                      Change File
                    </button>
                  </div>

                  {/* Compact Stats Strip */}
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                      <p className="text-[9px] font-black text-slate-400 uppercase">Total</p>
                      <p className="text-sm font-black text-slate-900">{totalRowsCount}</p>
                    </div>

                    <div className="p-1.5 bg-white rounded-lg border border-emerald-200">
                      <p className="text-[9px] font-black text-emerald-600 uppercase">Valid</p>
                      <p className="text-sm font-black text-emerald-700">{validRowsCount}</p>
                    </div>

                    <div className="p-1.5 bg-white rounded-lg border border-blue-200">
                      <p className="text-[9px] font-black text-blue-600 uppercase">+New Staff</p>
                      <p className="text-sm font-black text-blue-700">{newStaffCount}</p>
                    </div>

                    <div className="p-1.5 bg-white rounded-lg border border-amber-200">
                      <p className="text-[9px] font-black text-amber-600 uppercase">To Stock</p>
                      <p className="text-sm font-black text-amber-700">{stockCount}</p>
                    </div>

                    <div className="p-1.5 bg-white rounded-lg border border-rose-200">
                      <p className="text-[9px] font-black text-rose-600 uppercase">Errors</p>
                      <p className="text-sm font-black text-rose-700">{errorRowsCount}</p>
                    </div>
                  </div>

                  {/* Warning / Error inline strips */}
                  {warningRowsCount > 0 && (
                    <div className="p-1.5 px-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{warningRowsCount} asset(s) linked to inactive staff will safely route to In Stock pool.</span>
                    </div>
                  )}

                  {errorRowsCount > 0 && (
                    <div className="p-1.5 px-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{errorRowsCount} error(s) detected (duplicate serials or missing names). Must be resolved.</span>
                    </div>
                  )}

                  {/* Compact Table */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="p-1.5 px-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-extrabold text-[10px] text-slate-700 uppercase">
                        Row Custody Mapping Preview
                      </span>

                      {/* Filter Tabs */}
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setActiveTab('all')}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                            activeTab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          All ({totalRowsCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('valid')}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                            activeTab === 'valid' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          Valid ({validRowsCount})
                        </button>
                        {warningRowsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('warning')}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                              activeTab === 'warning' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            Warn ({warningRowsCount})
                          </button>
                        )}
                        {errorRowsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('error')}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                              activeTab === 'error' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            Err ({errorRowsCount})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[160px] overflow-y-auto divide-y divide-slate-100 text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="py-1.5 px-2.5">Row</th>
                            <th className="py-1.5 px-2.5">Status</th>
                            <th className="py-1.5 px-2.5">Asset Details</th>
                            <th className="py-1.5 px-2.5">Serial No</th>
                            <th className="py-1.5 px-2.5">Custodian Resolution</th>
                            <th className="py-1.5 px-2.5">Validation Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {displayRows.map((row) => (
                            <tr
                              key={row.rowNum}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                row.status === 'error' ? 'bg-rose-50/40' : row.status === 'warning' ? 'bg-amber-50/30' : ''
                              }`}
                            >
                              <td className="py-1.5 px-2.5 font-mono text-slate-400 text-[10px]">#{row.rowNum}</td>

                              <td className="py-1.5 px-2.5 shrink-0">
                                {row.status === 'valid' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check className="w-2.5 h-2.5" />
                                    Valid
                                  </span>
                                )}
                                {row.status === 'warning' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    Warn
                                  </span>
                                )}
                                {row.status === 'error' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    Error
                                  </span>
                                )}
                              </td>

                              <td className="py-1.5 px-2.5">
                                <p className="font-extrabold text-slate-900 leading-tight text-[11px]">
                                  {row.name || <span className="text-rose-500 italic">Missing Name</span>}
                                </p>
                                <p className="text-[9px] text-slate-400">
                                  {[row.category_name, row.manufacturer, row.model].filter(Boolean).join(' • ')}
                                </p>
                                {[row.processor, row.ram, row.storage].filter(Boolean).length > 0 && (
                                  <p className="text-[8.5px] font-mono font-semibold text-blue-600 bg-blue-50 px-1 py-0.5 rounded mt-0.5 inline-block">
                                    {[row.processor, row.ram, row.storage].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                              </td>

                              <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900 text-[11px]">
                                <div>{row.serial_number || <span className="text-rose-500 italic">None</span>}</div>
                                {row.sap_asset_code && (
                                  <span className="inline-block mt-0.5 text-[8.5px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    SAP: {row.sap_asset_code}
                                  </span>
                                )}
                              </td>

                              <td className="py-1.5 px-2.5">
                                {row.willCreateEmployee ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
                                    <Users className="w-2.5 h-2.5 text-blue-600" />
                                    Auto-Create: {row.emp_name || row.emp_code}
                                  </span>
                                ) : row.emp_code && row.isAssigned ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    {row.emp_code}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                    <Box className="w-2.5 h-2.5 text-slate-500" />
                                    In Stock
                                  </span>
                                )}
                              </td>

                              <td className="py-1.5 px-2.5 text-[10px]">
                                {row.statusMessages.map((msg, i) => (
                                  <p
                                    key={i}
                                    className={
                                      row.status === 'error'
                                        ? 'text-rose-600 font-bold'
                                        : row.status === 'warning'
                                        ? 'text-amber-700'
                                        : 'text-slate-500'
                                    }
                                  >
                                    {msg}
                                  </p>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Ultra-Compact Footer */}
        {!importResult && (
          <div className="px-4 py-2 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 text-xs">
            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Collision-safe sequential tags • Immutable security audit logged</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={importing}
                className="px-3 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!canExecuteImport}
                className={`px-4 py-1.5 rounded-lg ${theme.button} text-[11px] font-black shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 uppercase tracking-wider`}
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Committing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Import ({validRowsCount + warningRowsCount})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
