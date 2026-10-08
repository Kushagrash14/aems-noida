'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Category, CategoryFormField, FieldType, Location, Plant, Department, Employee, User } from '@/types/database';
import SearchableCombobox from '@/components/ui/SearchableCombobox';
import { getAssetPreviewImage } from '@/lib/assetVisuals';
import { uploadDataUrl } from '@/lib/uploadClient';
import SmartAssetImportModal, { getDepartmentTheme } from '@/components/assets/SmartAssetImportModal';
import DuplicateAssetTypeModal, { type DuplicateApprovalPayload, type DuplicateConflictInfo } from '@/components/assets/DuplicateAssetTypeModal';
import {
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  FileText,
  X,
  UserPlus,
  Search,
  Check,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  ShieldCheck,
  LayoutGrid,
  Box,
  Sliders,
  AlertTriangle,
  HelpCircle,
  Building2,
  MapPin,
  Server,
  Mail,
} from 'lucide-react';

const SEED_LOCATIONS: Location[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    name: 'Pune',
    code: 'LOC-PUNE',
    address: 'Pune, Maharashtra',
    created_at: '',
    updated_at: '',
  },
];

const SEED_PLANTS: Plant[] = [
  { id: '22222222-2222-2222-2222-222222222201', location_id: '11111111-1111-1111-1111-111111111101', name: 'NGM', code: 'NGM', created_at: '', updated_at: '' },
  { id: '22222222-2222-2222-2222-222222222202', location_id: '11111111-1111-1111-1111-111111111101', name: 'PGTL', code: 'PGTL', created_at: '', updated_at: '' },
  { id: '22222222-2222-2222-2222-222222222203', location_id: '11111111-1111-1111-1111-111111111101', name: 'PGEL', code: 'PGEL', created_at: '', updated_at: '' },
];

const DEFAULT_DEPT_CATEGORIES: Record<string, string[]> = {
  'INFORMATION TECHNOLOGY': [
    'LAPTOP',
    'DESKTOP',
    'SERVER',
    'SOFTWARE LICENSE',
    'MONITOR',
    'CAMERA',
  ],
  'PRODUCTION & ASSEMBLY': [
    'INJECTION MOLDING MACHINE',
    'CONVEYOR BELT',
    'SMT LINE',
    'AIR COMPRESSOR',
    'DIES & TOOLING',
    'ASSEMBLY JIG',
    'INDUSTRIAL ROBOT',
  ],
  'QUALITY ASSURANCE': [
    'CALIBRATED GAUGE',
    'SPECTROMETER',
    'TESTING JIG',
    'VERNIER CALIPER',
    'MICROMETER',
    '3D CMM MACHINE',
  ],
  'PLANT MAINTENANCE & ELECTRICAL': [
    'TRANSFORMER',
    'CONTROL PANEL',
    'DG SET',
    'VFD (VARIABLE FREQUENCY DRIVE)',
    'WELDING MACHINE',
    'HYDRAULIC PRESS',
  ],
  'HEALTH, SAFETY & ENVIRONMENT': [
    'FIRE EXTINGUISHER',
    'HYDRANT SYSTEM',
    'PPE STATION',
    'SMOKE DETECTOR',
    'SAFETY ALARM',
  ],
  'HUMAN RESOURCES': [
    'WORKSTATION',
    'CONFERENCE TABLE',
    'ERGONOMIC CHAIR',
    'BIOMETRIC ATTENDANCE MACHINE',
  ],
};

type OptionListKey = 'brands' | 'models' | 'vendors' | 'processors' | 'ram_options' | 'storage_options' | 'os_options';

const IT_DEFAULT_OPTIONS: Record<OptionListKey, string[]> = {
  brands: ['LENOVO', 'DELL', 'HP', 'APPLE', 'ASUS', 'ACER', 'SAMSUNG', 'LG', 'CISCO'],
  models: ['THINKPAD T14', 'THINKPAD P16 G2', 'LATITUDE 7420', 'OPTIPLEX 7090', 'PROBOOK 450 G9', 'MACBOOK PRO 14', 'MACBOOK AIR M2', 'PRECISION 3580', 'VOSTRO 3510'],
  vendors: ['REDINGTON INDIA LTD', 'DELL ENTERPRISE SERVICES', 'INGRAM MICRO', 'HP INDIA CORP', 'COMPUCOM SYSTEMS', 'GLOBAL INFOTECH', 'WIPRO ENTERPRISE'],
  processors: ['INTEL CORE I3', 'INTEL CORE I5 12TH GEN', 'INTEL CORE I5 13TH GEN', 'INTEL CORE I7 13700H', 'INTEL CORE I9', 'AMD RYZEN 5', 'AMD RYZEN 7', 'APPLE M1', 'APPLE M2', 'APPLE M3 PRO'],
  ram_options: ['4GB DDR4', '8GB DDR4', '16GB DDR4', '16GB DDR5', '32GB DDR5', '64GB DDR5', '128GB DDR5'],
  storage_options: ['256GB NVME SSD', '512GB NVME SSD', '1TB NVME SSD', '2TB NVME SSD', '1TB HDD', '2TB HDD'],
  os_options: ['WINDOWS 11 PRO', 'WINDOWS 10 PRO', 'MACOS SONOMA', 'MACOS VENTURA', 'UBUNTU 22.04 LTS', 'RHEL 9', 'NO OS / DOS'],
};

const DEFAULT_IT_CATEGORY_FIELDS: Record<
  string,
  Array<{
    field_name: string;
    field_label: string;
    field_type: FieldType;
    options?: string[];
    is_required: boolean;
    placeholder?: string;
  }>
> = {
  'MONITOR': [
    { field_name: 'screen_size', field_label: 'Screen Size (Inches)', field_type: 'select', options: ['19 INCH', '21.5 INCH', '24 INCH', '27 INCH', '32 INCH'], is_required: false, placeholder: 'Select Screen Size' },
    { field_name: 'resolution', field_label: 'Resolution', field_type: 'select', options: ['1366x768 (HD)', '1920x1080 (FULL HD)', '2560x1440 (2K)', '3840x2160 (4K)'], is_required: false, placeholder: 'Select Resolution' },
    { field_name: 'connectivity_ports', field_label: 'Connectivity Ports', field_type: 'text', is_required: false, placeholder: 'e.g. HDMI, VGA, DISPLAYPORT' },
  ],
  'PRINTER': [
    { field_name: 'printer_type', field_label: 'Printer Type', field_type: 'select', options: ['LASERJET', 'INKJET', 'THERMAL BARCODE', 'DOT MATRIX', 'MULTIFUNCTION (MFP)'], is_required: false, placeholder: 'Select Printer Type' },
    { field_name: 'cartridge_model', field_label: 'Cartridge / Toner Model', field_type: 'text', is_required: false, placeholder: 'e.g. HP 88A, CANON 328' },
    { field_name: 'network_interface', field_label: 'Network Interface', field_type: 'select', options: ['USB ONLY', 'ETHERNET (LAN)', 'WI-FI + LAN', 'BLUETOOTH'], is_required: false, placeholder: 'Select Network Interface' },
    { field_name: 'ip_address', field_label: 'Printer IP Address', field_type: 'text', is_required: false, placeholder: 'e.g. 192.168.1.150' },
  ],
  'SERVER': [
    { field_name: 'server_form_factor', field_label: 'Form Factor', field_type: 'select', options: ['1U RACK', '2U RACK', '4U RACK', 'TOWER SERVER', 'BLADE'], is_required: false, placeholder: 'Select Form Factor' },
    { field_name: 'processor_config', field_label: 'Processor / CPU Config', field_type: 'text', is_required: false, placeholder: 'e.g. 2x INTEL XEON SILVER 4310' },
    { field_name: 'installed_ram', field_label: 'RAM Capacity', field_type: 'text', is_required: false, placeholder: 'e.g. 64GB ECC DDR4, 128GB ECC DDR4' },
    { field_name: 'raid_configuration', field_label: 'RAID Configuration', field_type: 'text', is_required: false, placeholder: 'e.g. RAID 1, RAID 5, RAID 10' },
    { field_name: 'ilo_idrac_ip', field_label: 'iLO / iDRAC Management IP', field_type: 'text', is_required: false, placeholder: 'e.g. 192.168.1.200' },
  ],
  'SWITCH': [
    { field_name: 'port_count', field_label: 'Total Ports', field_type: 'select', options: ['8 PORT', '16 PORT', '24 PORT', '48 PORT'], is_required: false, placeholder: 'Select Port Count' },
    { field_name: 'switch_type', field_label: 'Switch Type', field_type: 'select', options: ['MANAGED L2', 'MANAGED L3', 'UNMANAGED', 'POE SWITCH', 'POE+ SWITCH'], is_required: false, placeholder: 'Select Switch Type' },
    { field_name: 'management_ip', field_label: 'Management IP Address', field_type: 'text', is_required: false, placeholder: 'e.g. 192.168.1.2' },
  ],
  'ROUTER': [
    { field_name: 'wan_ports', field_label: 'WAN Interfaces', field_type: 'text', is_required: false, placeholder: 'e.g. 2x GIGABIT WAN' },
    { field_name: 'lan_ports', field_label: 'LAN Interfaces', field_type: 'text', is_required: false, placeholder: 'e.g. 4x GIGABIT LAN' },
    { field_name: 'firmware_version', field_label: 'Firmware Version', field_type: 'text', is_required: false, placeholder: 'e.g. V1.4.2' },
    { field_name: 'gateway_ip', field_label: 'Gateway IP', field_type: 'text', is_required: false, placeholder: 'e.g. 192.168.1.1' },
  ],
  'CAMERA': [
    { field_name: 'camera_type', field_label: 'Camera Type', field_type: 'select', options: ['IP DOME', 'IP BULLET', 'PTZ CAMERA', 'ANALOG HD', 'WIFI CAMERA'], is_required: false, placeholder: 'Select Camera Type' },
    { field_name: 'resolution', field_label: 'Resolution', field_type: 'select', options: ['2 MEGAPIXEL (1080P)', '4 MEGAPIXEL (2K)', '5 MEGAPIXEL', '8 MEGAPIXEL (4K)'], is_required: false, placeholder: 'Select Resolution' },
    { field_name: 'camera_ip', field_label: 'Camera IP Address', field_type: 'text', is_required: false, placeholder: 'e.g. 192.168.1.85' },
    { field_name: 'lens_size', field_label: 'Lens Focal Length', field_type: 'select', options: ['2.8MM', '3.6MM', '6MM', 'VARIFOCAL (2.8-12MM)'], is_required: false, placeholder: 'Select Lens' },
  ],
  'SOFTWARE LICENSE': [
    { field_name: 'license_type', field_label: 'License Type', field_type: 'select', options: ['PERPETUAL / LIFETIME', 'SUBSCRIPTION (ANNUAL)', 'OEM', 'VOLUME LICENSE (KMS/MAK)'], is_required: false, placeholder: 'Select License Type' },
    { field_name: 'edition_version', field_label: 'Edition / Version', field_type: 'text', is_required: false, placeholder: 'e.g. Professional 2024, Enterprise' },
    { field_name: 'license_key', field_label: 'Product / License Key', field_type: 'text', is_required: false, placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX' },
    { field_name: 'seats_count', field_label: 'Seat / User Limit', field_type: 'number', is_required: false, placeholder: 'e.g. 1, 5, 25' },
  ],
};

interface DraftData {
  draftId: string;
  savedAt: string;
  step: 1 | 2 | 3;
  selectedDeptName?: string;
  selectedCategoryName: string;
  selectedCategoryId: string;
  itAssetType: 'LAPTOP' | 'DESKTOP' | 'INPUT/OUTPUT DEVICE';
  assetTag: string;
  serialNumber: string;
  name: string;
  model: string;
  manufacturer: string;
  condition: 'new_purchase' | 'existing_asset';
  poNumber: string;
  sapAssetCode?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  vendorName: string;
  purchaseDate: string;
  purchaseCost: string;
  warrantyExpiry: string;
  amcVendor: string;
  amcExpiry: string;
  customValues: Record<string, string>;
  assignmentMode: 'employee' | 'in_house';
  locationId: string;
  plantId: string;
  departmentId: string;
  assignedEmployeeId: string;
  assignedDate: string;
  remarks: string;
  assetImages: string[];
  attachedDocs: Array<{ name: string; size: string }>;
  peripherals: Array<{ peripheral_name: string; model_number: string; serial_number: string; is_included: boolean; notes: string }>;
}

function formatMacAddress(input: string): string {
  const clean = input.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 12);
  const parts = clean.match(/.{1,2}/g);
  return parts ? parts.join(':') : clean;
}

function formatIpAddress(input: string): string {
  const clean = input.replace(/[^0-9.]/g, '');
  const parts = clean.split('.').slice(0, 4);
  const sanitized = parts.map((part) => {
    if (!part) return '';
    const num = parseInt(part, 10);
    if (isNaN(num)) return '';
    return Math.min(num, 255).toString();
  });
  return sanitized.join('.');
}

async function compressImage(
  fileOrDataUrl: File | string,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.75
): Promise<string> {
  if (typeof fileOrDataUrl === 'string' && (fileOrDataUrl.length < 150000 || !fileOrDataUrl.startsWith('data:image/'))) {
    return fileOrDataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (e) {
        console.warn('Image compression fallback:', e);
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
      }
    };
    img.onerror = () => {
      resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

const DRAFTS_STORAGE_KEY = 'aems_asset_drafts';

function AssetWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  // Lookups data
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFields, setCategoryFields] = useState<CategoryFormField[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Wizard state & Entry Modes (assigned, stock, damaged, missing)
  const [entryMode, setEntryMode] = useState<'assigned' | 'stock' | 'damaged' | 'missing'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mode');
      if (m === 'stock' || params.get('directStock') === 'true') return 'stock';
      if (m === 'damaged') return 'damaged';
      if (m === 'missing') return 'missing';
    }
    return 'assigned';
  });

  const isStockMode = entryMode === 'stock';
  const isDamagedMode = entryMode === 'damaged';
  const isMissingMode = entryMode === 'missing';
  const isDirectEntryMode = isStockMode || isDamagedMode || isMissingMode;

  const [step, setStep] = useState<1 | 2 | 3>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mode');
      if (m === 'damaged' || m === 'missing') {
        return 2;
      }
    }
    return 1;
  });

  // Reactively respond to client-side search parameter navigation
  useEffect(() => {
    const m = searchParams.get('mode');
    const directStock = searchParams.get('directStock') === 'true';

    if (m === 'stock' || directStock) {
      setEntryMode('stock');
    } else if (m === 'damaged') {
      setEntryMode('damaged');
      setStep(2);
    } else if (m === 'missing') {
      setEntryMode('missing');
      setStep(2);
    } else if (m === 'assigned') {
      setEntryMode('assigned');
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Drafts State
  const [savedDrafts, setSavedDrafts] = useState<DraftData[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // User Session & Role
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Form State: Step 1 (Department & Department-Isolated Category)
  const [selectedDeptName, setSelectedDeptName] = useState<string>('INFORMATION TECHNOLOGY');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('LAPTOP');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [itAssetType, setItAssetType] = useState<'LAPTOP' | 'DESKTOP' | 'INPUT/OUTPUT DEVICE'>('LAPTOP');
  const [deptCategoriesMap, setDeptCategoriesMap] = useState<Record<string, string[]>>(DEFAULT_DEPT_CATEGORIES);

  // Dynamic Department Theme (for IT Admin Smart Excel Importer Button)
  const deptTheme = useMemo(() => getDepartmentTheme(selectedDeptName), [selectedDeptName]);

  // Authorization for Smart Excel Batch Import (STRICTLY IT Admin only)
  const isAuthorizedForImport = useMemo(() => {
    return currentUser?.role === 'it_admin';
  }, [currentUser]);

  // Scoped departments available to the current user
  const availableDepartments = useMemo(() => {
    if (!currentUser || currentUser.role === 'it_admin') return departments;
    if (currentUser.department_id) {
      return departments.filter((d) => d.id === currentUser.department_id);
    }
    if (currentUser.scope?.department_ids && currentUser.scope.department_ids.length > 0) {
      return departments.filter((d) => currentUser.scope!.department_ids!.includes(d.id));
    }
    if (currentUser.plant_id) {
      return departments.filter((d) => !d.plant_id || d.plant_id === currentUser.plant_id);
    }
    return departments;
  }, [departments, currentUser]);

  // Check if department is locked for current user (Facility Admin & Floor Users locked to their assigned dept)
  const isDeptLockedForUser = useMemo(() => {
    if (!currentUser) return false;
    // IT Admin has cross-department access
    if (currentUser.role === 'it_admin') return false;
    // Facility Admins and Users are locked to their assigned department
    return Boolean(
      currentUser.department_id ||
      (currentUser.scope?.department_ids && currentUser.scope.department_ids.length <= 1) ||
      availableDepartments.length <= 1
    );
  }, [currentUser, availableDepartments]);


  // Form State: Step 2 (Base Identification, Commercial & Attachments)
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [sapAssetCode, setSapAssetCode] = useState('');
  const [hostname, setHostname] = useState('');
  const [assetTag, setAssetTag] = useState(''); // Empty = auto-generated atomically on save

  // Background Serial & MAC Address Check
  const [serialChecking, setSerialChecking] = useState(false);
  const [serialError, setSerialError] = useState<string | null>(null);
  const [serialValid, setSerialValid] = useState<boolean | null>(null);

  const [macChecking, setMacChecking] = useState(false);
  const [macError, setMacError] = useState<string | null>(null);
  const [macValid, setMacValid] = useState<boolean | null>(null);

  // Condition: New Purchase vs Existing Asset
  const [condition, setCondition] = useState<'new_purchase' | 'existing_asset'>('new_purchase');

  // Commercial & Purchase
  const [vendorName, setVendorName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [amcVendor, setAmcVendor] = useState('');
  const [amcExpiry, setAmcExpiry] = useState('');

  // Attachments
  const [assetImages, setAssetImages] = useState<string[]>([]);
  const [attachedDocs, setAttachedDocs] = useState<Array<{ name: string; size: string }>>([]);

  // Additional Items / Peripherals list (Empty initially - user adds manually)
  const [peripherals, setPeripherals] = useState<
    Array<{ peripheral_name: string; model_number: string; serial_number: string; is_included: boolean; notes: string }>
  >([]);

  // Searchable Combobox Options States (Persistent with Add & Delete)
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [processors, setProcessors] = useState<string[]>([]);
  const [ramOptions, setRamOptions] = useState<string[]>([]);
  const [storageOptions, setStorageOptions] = useState<string[]>([]);
  const [osOptions, setOsOptions] = useState<string[]>([]);
  const [dynamicSelectOptions, setDynamicSelectOptions] = useState<Record<string, string[]>>({});

  // Custom Field Creator & Hidden Fields State
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [hiddenFieldKeys, setHiddenFieldKeys] = useState<string[]>([]);

  // Dropdown option lists are kept separately per department.
  const optionDeptKey = (selectedDeptName || '').trim().toUpperCase() || 'INFORMATION TECHNOLOGY';
  const optionStorageKey = (list: OptionListKey) => `aems_${list}::${optionDeptKey}`;
  const isItOptionDept = optionDeptKey === 'INFORMATION TECHNOLOGY' || optionDeptKey === 'IT';
  // Lists still in state belong to the previous department until the load effect runs.
  const [optionsDept, setOptionsDept] = useState<string | null>(null);
  const optionsReady = optionsDept === optionDeptKey;

  useEffect(() => {
    const load = (list: OptionListKey): string[] => {
      try {
        // The old shared list mixed entries from every department, so it is discarded.
        localStorage.removeItem(`aems_${list}`);
        const saved = localStorage.getItem(`aems_${list}::${optionDeptKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
      return isItOptionDept ? IT_DEFAULT_OPTIONS[list] : [];
    };
    setBrands(load('brands'));
    setModels(load('models'));
    setVendors(load('vendors'));
    setProcessors(load('processors'));
    setRamOptions(load('ram_options'));
    setStorageOptions(load('storage_options'));
    setOsOptions(load('os_options'));
    setOptionsDept(optionDeptKey);
  }, [optionDeptKey, isItOptionDept]);

  const handleAddBrand = (b: string) => {
    if (!optionsReady) return;
    setBrands((prev) => {
      const updated = [b, ...prev.filter((x) => x !== b)];
      try { localStorage.setItem(optionStorageKey('brands'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleDeleteBrand = (b: string) => {
    if (!optionsReady) return;
    setBrands((prev) => {
      const updated = prev.filter((x) => x !== b);
      try { localStorage.setItem(optionStorageKey('brands'), JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (manufacturer === b) setManufacturer('');
  };

  const handleAddModel = (m: string) => {
    if (!optionsReady) return;
    setModels((prev) => {
      const updated = [m, ...prev.filter((x) => x !== m)];
      try { localStorage.setItem(optionStorageKey('models'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleDeleteModel = (m: string) => {
    if (!optionsReady) return;
    setModels((prev) => {
      const updated = prev.filter((x) => x !== m);
      try { localStorage.setItem(optionStorageKey('models'), JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (model === m) setModel('');
  };

  const handleAddVendor = (v: string) => {
    if (!optionsReady) return;
    setVendors((prev) => {
      const updated = [v, ...prev.filter((x) => x !== v)];
      try { localStorage.setItem(optionStorageKey('vendors'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleDeleteVendor = (v: string) => {
    if (!optionsReady) return;
    setVendors((prev) => {
      const updated = prev.filter((x) => x !== v);
      try { localStorage.setItem(optionStorageKey('vendors'), JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (vendorName === v) setVendorName('');
  };

  const handleAddProcessor = (p: string) => {
    if (!optionsReady) return;
    setProcessors((prev) => {
      const updated = [p, ...prev.filter((x) => x !== p)];
      try { localStorage.setItem(optionStorageKey('processors'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleDeleteProcessor = (p: string) => {
    if (!optionsReady) return;
    setProcessors((prev) => {
      const updated = prev.filter((x) => x !== p);
      try { localStorage.setItem(optionStorageKey('processors'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleAddRam = (val: string) => {
    if (!optionsReady) return;
    const clean = val.trim().toUpperCase();
    if (!clean) return;
    setRamOptions((prev) => {
      const updated = [clean, ...prev.filter((x) => x !== clean)];
      try { localStorage.setItem(optionStorageKey('ram_options'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleDeleteRam = (val: string) => {
    if (!optionsReady) return;
    setRamOptions((prev) => {
      const updated = prev.filter((x) => x !== val);
      try { localStorage.setItem(optionStorageKey('ram_options'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleAddStorage = (val: string) => {
    if (!optionsReady) return;
    const clean = val.trim().toUpperCase();
    if (!clean) return;
    setStorageOptions((prev) => {
      const updated = [clean, ...prev.filter((x) => x !== clean)];
      try { localStorage.setItem(optionStorageKey('storage_options'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleDeleteStorage = (val: string) => {
    if (!optionsReady) return;
    setStorageOptions((prev) => {
      const updated = prev.filter((x) => x !== val);
      try { localStorage.setItem(optionStorageKey('storage_options'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleAddOs = (val: string) => {
    if (!optionsReady) return;
    const clean = val.trim().toUpperCase();
    if (!clean) return;
    setOsOptions((prev) => {
      const updated = [clean, ...prev.filter((x) => x !== clean)];
      try { localStorage.setItem(optionStorageKey('os_options'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleDeleteOs = (val: string) => {
    if (!optionsReady) return;
    setOsOptions((prev) => {
      const updated = prev.filter((x) => x !== val);
      try { localStorage.setItem(optionStorageKey('os_options'), JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleAddDynamicOption = (fieldId: string, val: string, initialOptions: string[]) => {
    const clean = val.trim().toUpperCase();
    if (!clean) return;
    setDynamicSelectOptions((prev) => {
      const base = prev[fieldId] || initialOptions || [];
      const updated = [clean, ...base.filter((x) => x !== clean)];
      try { localStorage.setItem(`aems_dyn_opts_${fieldId}`, JSON.stringify(updated)); } catch {}
      return { ...prev, [fieldId]: updated };
    });
  };

  const handleDeleteDynamicOption = (fieldId: string, val: string, initialOptions: string[]) => {
    setDynamicSelectOptions((prev) => {
      const base = prev[fieldId] || initialOptions || [];
      const updated = base.filter((x) => x !== val);
      try { localStorage.setItem(`aems_dyn_opts_${fieldId}`, JSON.stringify(updated)); } catch {}
      return { ...prev, [fieldId]: updated };
    });
  };

  // Hydrate department-specific categories from localStorage
  useEffect(() => {
    try {
      const updatedMap = { ...DEFAULT_DEPT_CATEGORIES };
      Object.keys(DEFAULT_DEPT_CATEGORIES).forEach((deptKey) => {
        const stored = localStorage.getItem(`aems_dept_cats_${deptKey}`);
        if (stored) {
          try {
            updatedMap[deptKey] = JSON.parse(stored);
          } catch {}
        }
      });
      const customDeptsStr = localStorage.getItem('aems_custom_dept_list');
      if (customDeptsStr) {
        const customDepts: string[] = JSON.parse(customDeptsStr);
        customDepts.forEach((cDept) => {
          const stored = localStorage.getItem(`aems_dept_cats_${cDept}`);
          if (stored) {
            try {
              updatedMap[cDept] = JSON.parse(stored);
            } catch {}
          } else if (!updatedMap[cDept]) {
            updatedMap[cDept] = ['GENERAL EQUIPMENT'];
          }
        });
      }
      setDeptCategoriesMap(updatedMap);
    } catch (e) {
      console.error('Failed to load department categories map:', e);
    }
  }, []);

  // Department Selection Change Handler
  const handleSelectDepartment = (deptName: string) => {
    const cleanDept = deptName.trim().toUpperCase();
    if (!cleanDept) return;
    setSelectedDeptName(cleanDept);

    const matchedDept = departments.find((d) => d.name.toUpperCase() === cleanDept);
    if (matchedDept) {
      setDepartmentId(matchedDept.id);
    }

    const rawCats = deptCategoriesMap[cleanDept] || DEFAULT_DEPT_CATEGORIES[cleanDept] || ['LAPTOP'];
    const deptCats = rawCats.filter(
      (c) =>
        c.toUpperCase() !== cleanDept &&
        c.toUpperCase() !== 'INFORMATION TECHNOLOGY' &&
        c.toUpperCase() !== 'IT'
    );
    if (deptCats.length > 0) {
      setSelectedCategoryName(deptCats[0]);
    } else {
      setSelectedCategoryName('LAPTOP');
    }
  };

  // Add Asset Type for a Specific Department
  const handleAddCategoryForDept = async (deptName: string, newCategory: string) => {
    const cleanDept = deptName.trim().toUpperCase();
    const cleanCat = newCategory.trim().toUpperCase();
    if (!cleanDept || !cleanCat) return;

    setDeptCategoriesMap((prev) => {
      const existing = prev[cleanDept] || DEFAULT_DEPT_CATEGORIES[cleanDept] || [];
      const updated = [cleanCat, ...existing.filter((c) => c !== cleanCat)];
      try {
        localStorage.setItem(`aems_dept_cats_${cleanDept}`, JSON.stringify(updated));
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('aems:category-updated'));
      } catch (err) {
        console.error('Storage error:', err);
      }
      return { ...prev, [cleanDept]: updated };
    });

    setSelectedCategoryName(cleanCat);

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanCat,
          code: `CAT-${cleanCat.slice(0, 4).replace(/[^A-Z]/g, '') || 'GEN'}`,
          description: `${cleanCat} category for ${cleanDept}`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.category) {
        const created: Category = data.category;
        setCategories((prev) => [...prev, created]);
        setSelectedCategoryId(created.id);
      }
    } catch (err) {
      console.warn('Backend category creation notice:', err);
    }

    setSuccessToast(`New asset type "${cleanCat}" added for ${cleanDept}!`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Delete Asset Type from a Specific Department
  const handleDeleteCategoryForDept = (deptName: string, catToDelete: string) => {
    const cleanDept = deptName.trim().toUpperCase();
    const cleanCat = catToDelete.trim().toUpperCase();
    if (!cleanDept || !cleanCat) return;

    setDeptCategoriesMap((prev) => {
      const existing = prev[cleanDept] || DEFAULT_DEPT_CATEGORIES[cleanDept] || [];
      const updated = existing.filter((c) => c.toUpperCase() !== cleanCat);
      try {
        localStorage.setItem(`aems_dept_cats_${cleanDept}`, JSON.stringify(updated));
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('aems:category-updated'));
      } catch (err) {
        console.error('Storage error:', err);
      }
      return { ...prev, [cleanDept]: updated };
    });

    const currentList = deptCategoriesMap[cleanDept] || DEFAULT_DEPT_CATEGORIES[cleanDept] || [];
    const remaining = currentList.filter((c) => c.toUpperCase() !== cleanCat);
    if (selectedCategoryName.toUpperCase() === cleanCat) {
      setSelectedCategoryName(remaining[0] || 'LAPTOP');
    }

    setSuccessToast(`Asset type "${cleanCat}" deleted from ${cleanDept}!`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Inline Add New Department
  const handleInlineAddDepartment = async (newDept: string) => {
    const cleanDept = newDept.trim().toUpperCase();
    if (!cleanDept) return;

    try {
      const res = await fetch('/api/settings/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanDept,
          code: `DEPT-${cleanDept.slice(0, 3).replace(/[^A-Z]/g, '') || 'GEN'}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.department) {
        const created: Department = data.department;
        setDepartments((prev) => [...prev, created]);
        setDepartmentId(created.id);
      }
    } catch (err) {
      console.warn('Department API notice:', err);
    }

    try {
      const storedStr = localStorage.getItem('aems_custom_dept_list');
      const list: string[] = storedStr ? JSON.parse(storedStr) : [];
      if (!list.includes(cleanDept)) {
        localStorage.setItem('aems_custom_dept_list', JSON.stringify([...list, cleanDept]));
      }
    } catch {}

    setSelectedDeptName(cleanDept);

    if (!deptCategoriesMap[cleanDept]) {
      setDeptCategoriesMap((prev) => ({
        ...prev,
        [cleanDept]: ['GENERAL EQUIPMENT'],
      }));
      setSelectedCategoryName('GENERAL EQUIPMENT');
    }

    setSuccessToast(`Department "${cleanDept}" created and selected!`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Inline Delete Department
  const handleInlineDeleteDepartment = async (deptToDelete: string) => {
    const cleanDept = deptToDelete.trim().toUpperCase();
    const target = departments.find((d) => d.name.toUpperCase() === cleanDept);
    if (target) {
      try {
        const res = await fetch(`/api/settings/departments?id=${target.id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'Failed to delete department');
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete department');
        return;
      }
    }

    setDepartments((prev) => prev.filter((d) => d.name.toUpperCase() !== cleanDept));

    setDeptCategoriesMap((prev) => {
      const copy = { ...prev };
      delete copy[cleanDept];
      return copy;
    });

    try {
      localStorage.removeItem(`aems_dept_cats_${cleanDept}`);
      const storedStr = localStorage.getItem('aems_custom_dept_list');
      if (storedStr) {
        const list: string[] = JSON.parse(storedStr);
        const updatedList = list.filter((d) => d !== cleanDept);
        localStorage.setItem('aems_custom_dept_list', JSON.stringify(updatedList));
      }
    } catch (e) {
      console.error('Storage deletion error:', e);
    }

    const remainingDepts = departments.filter((d) => d.name.toUpperCase() !== cleanDept);
    if (selectedDeptName.toUpperCase() === cleanDept && remainingDepts.length > 0) {
      handleSelectDepartment(remainingDepts[0].name.toUpperCase());
    }

    setSuccessToast(`Department "${cleanDept}" deleted!`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  // Dynamic Custom Values (Department-wise)
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // Form State: Step 3 (Assignment, Location, Plant & Employee)
  const [assignmentMode, setAssignmentMode] = useState<'employee' | 'in_house'>('employee');
  const [exactLocation, setExactLocation] = useState('');
  const [inHouseDeptName, setInHouseDeptName] = useState('');
  const [hodName, setHodName] = useState('');
  const [hodEmpCode, setHodEmpCode] = useState('');
  const [hodEmail, setHodEmail] = useState('');
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateConflictInfo | null>(null);
  const [locationId, setLocationId] = useState('11111111-1111-1111-1111-111111111101');
  const [plantId, setPlantId] = useState('22222222-2222-2222-2222-222222222201');
  const [departmentId, setDepartmentId] = useState('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState(''); // Kept normal case

  // Employee ID search / auto-fill state
  const [empCodeQuery, setEmpCodeQuery] = useState('');
  const [matchedEmployee, setMatchedEmployee] = useState<Employee | null>(null);
  const [empSearchSearched, setEmpSearchSearched] = useState(false);

  // Create Employee Profile Modal
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [newEmpCode, setNewEmpCode] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState(''); // Kept normal case
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpDeptId, setNewEmpDeptId] = useState('');
  const [newEmpLocationId, setNewEmpLocationId] = useState('11111111-1111-1111-1111-111111111101');
  const [newEmpPlantId, setNewEmpPlantId] = useState('22222222-2222-2222-2222-222222222201');
  const [newEmpDesignation, setNewEmpDesignation] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);

  const [newEmpStatus, setNewEmpStatus] = useState<'active' | 'inactive'>('active');
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [empModalError, setEmpModalError] = useState<string | null>(null);

  // Auto-sync department and facility when currentUser or departments are resolved
  const deptAutoSyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const isEditMode = Boolean(searchParams.get('edit'));
    if (isEditMode) return;
    if (departments.length === 0) return;

    // Apply defaults once per user/URL; otherwise a manual dropdown change gets overwritten.
    const syncKey = `${currentUser?.id ?? ''}|${currentUser?.role ?? ''}|${searchParams.toString()}`;
    if (deptAutoSyncKeyRef.current === syncKey) return;
    deptAutoSyncKeyRef.current = syncKey;

    // Non-IT Admins are forced to their assigned facility & department
    if (currentUser && currentUser.role !== 'it_admin') {
      if (currentUser.location_id) {
        setLocationId(currentUser.location_id);
        setNewEmpLocationId(currentUser.location_id);
      }
      if (currentUser.plant_id) {
        setPlantId(currentUser.plant_id);
        setNewEmpPlantId(currentUser.plant_id);
      }
      if (currentUser.department_id && departments.length > 0) {
        const matched = departments.find((d) => d.id === currentUser.department_id);
        if (matched) {
          if (selectedDeptName.toUpperCase() !== matched.name.toUpperCase()) {
            handleSelectDepartment(matched.name.toUpperCase());
          }
          if (departmentId !== matched.id) {
            setDepartmentId(matched.id);
            setNewEmpDeptId(matched.id);
          }
        }
      }
      return;
    }

    const requestedDeptParam = (
      searchParams.get('department') ||
      searchParams.get('dept') ||
      searchParams.get('deptId') ||
      ''
    ).trim().toUpperCase();

    if (requestedDeptParam) {
      const matched = departments.find(
        (d) =>
          d.name.trim().toUpperCase() === requestedDeptParam ||
          d.id === requestedDeptParam
      );
      if (matched && matched.name.toUpperCase() !== selectedDeptName.toUpperCase()) {
        handleSelectDepartment(matched.name.toUpperCase());
        return;
      }
    }

    if (currentUser?.department_id) {
      const matched = departments.find((d) => d.id === currentUser.department_id);
      if (matched && matched.name.toUpperCase() !== selectedDeptName.toUpperCase()) {
        handleSelectDepartment(matched.name.toUpperCase());
      }
    }
  }, [currentUser, departments, searchParams, selectedDeptName, departmentId]);

  // Preload asset details when in Edit mode (?edit=[assetId])
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;

    fetch(`/api/assets/${editId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.asset) {
          const a = data.asset;

          // Parse metadata stored in invoice_document_path
          let meta: any = null;
          if (a.invoice_document_path && typeof a.invoice_document_path === 'string' && a.invoice_document_path.trim().startsWith('{')) {
            try {
              meta = JSON.parse(a.invoice_document_path);
            } catch (e) {
              console.warn('Failed to parse asset doc metadata:', e);
            }
          }

          if (a.name) setName(a.name);
          if (a.manufacturer) setManufacturer(a.manufacturer);
          if (a.model) setModel(a.model);
          if (a.serial_number) setSerialNumber(a.serial_number);
          if (a.sap_asset_code || meta?.sap_asset_code) setSapAssetCode(a.sap_asset_code || meta?.sap_asset_code || '');
          if (a.hostname) setHostname(a.hostname);
          if (a.asset_tag) setAssetTag(a.asset_tag);
          if (a.vendor_name) setVendorName(a.vendor_name);
          if (a.po_number) setPoNumber(a.po_number);
          if (a.invoice_number || meta?.invoice_number) setInvoiceNumber(a.invoice_number || meta?.invoice_number || '');
          if (a.invoice_date || meta?.invoice_date) setInvoiceDate(a.invoice_date || meta?.invoice_date || '');
          if (a.purchase_date) setPurchaseDate(a.purchase_date);
          if (a.purchase_cost) setPurchaseCost(String(a.purchase_cost));
          if (a.warranty_expiry) setWarrantyExpiry(a.warranty_expiry);
          if (a.amc_vendor) setAmcVendor(a.amc_vendor);
          if (a.amc_expiry) setAmcExpiry(a.amc_expiry);
          if (a.current_location_id) setLocationId(a.current_location_id);
          if (a.current_plant_id) setPlantId(a.current_plant_id);
          if (a.current_department_id) {
            setDepartmentId(a.current_department_id);
            if (a.department?.name) setSelectedDeptName(a.department.name.toUpperCase());
          }
          if (a.category_id) {
            setSelectedCategoryId(a.category_id);
            if (a.category?.name) {
              const catUpper = a.category.name.toUpperCase();
              setSelectedCategoryName(catUpper);
              if (catUpper === 'LAPTOP') setItAssetType('LAPTOP');
              else if (catUpper === 'DESKTOP') setItAssetType('DESKTOP');
              else setItAssetType('INPUT/OUTPUT DEVICE');
            }
          }
          if (a.assigned_employee_id) {
            setAssignedEmployeeId(a.assigned_employee_id);
            setAssignmentMode('employee');
          } else {
            setAssignmentMode('in_house');
          }
          if (a.peripherals && Array.isArray(a.peripherals)) {
            setPeripherals(a.peripherals);
          }

          // 1. Condition: Existing vs New Purchase
          if (meta?.condition) {
            setCondition(meta.condition);
          } else if (a.po_number && a.po_number.trim().length > 0) {
            setCondition('new_purchase');
          } else {
            setCondition('existing_asset');
          }

          // 2. Photos
          if (meta?.photos && Array.isArray(meta.photos) && meta.photos.length > 0) {
            setAssetImages(meta.photos);
            Promise.all(meta.photos.map((p: any) => (typeof p === 'string' && p.length > 150000 ? compressImage(p) : Promise.resolve(p))))
              .then((optimized) => setAssetImages(optimized as string[]));
          } else if (a.photo_urls && Array.isArray(a.photo_urls)) {
            setAssetImages(a.photo_urls);
          }

          // 3. Documents
          if (meta?.documents && Array.isArray(meta.documents) && meta.documents.length > 0) {
            setAttachedDocs(meta.documents);
          } else if (a.document_urls && Array.isArray(a.document_urls)) {
            setAttachedDocs(a.document_urls);
          } else if (a.invoice_document_path && !a.invoice_document_path.trim().startsWith('{')) {
            setAttachedDocs([{ name: 'Invoice / Document', size: 'Attached' }]);
          }

          // 4. Technical Specs & Custom Values
          let loadedSpecs: Record<string, string> = {};
          if (Array.isArray(a.custom_values)) {
            a.custom_values.forEach((cv: any) => {
              if (cv.field_id) loadedSpecs[cv.field_id] = cv.field_value;
              if (cv.field?.field_name) loadedSpecs[cv.field.field_name.toLowerCase()] = cv.field_value;
            });
          } else if (typeof a.custom_values === 'object' && a.custom_values !== null) {
            loadedSpecs = { ...a.custom_values };
          }
          if (meta?.specs && typeof meta.specs === 'object') {
            loadedSpecs = { ...loadedSpecs, ...meta.specs };
          }
          if (a.specs && typeof a.specs === 'object') {
            loadedSpecs = { ...loadedSpecs, ...a.specs };
          }
          setCustomValues(loadedSpecs);

          // 5. Hostname resolution
          const resolvedHostname = a.hostname || meta?.hostname || meta?.specs?.hostname || loadedSpecs?.hostname || '';
          if (resolvedHostname) setHostname(resolvedHostname);

          // 6. Placement & Assignment details (Employee / In-House, Remarks, Handover Date)
          const resolvedRemarks = a.remarks || meta?.remarks || '';
          if (resolvedRemarks) setRemarks(resolvedRemarks);

          const resolvedAssignedDate = a.assigned_date || meta?.assigned_date || '';
          if (resolvedAssignedDate) setAssignedDate(resolvedAssignedDate);

          const resolvedExactLoc = a.exact_location || meta?.exact_location || loadedSpecs?.exact_location || '';
          if (resolvedExactLoc) setExactLocation(resolvedExactLoc);

          if (a.assigned_employee_id) {
            setAssignedEmployeeId(a.assigned_employee_id);
            setAssignmentMode('employee');

            if (a.assigned_employee) {
              setMatchedEmployee(a.assigned_employee);
              const code = a.assigned_employee.emp_code || (a.assigned_employee as any)?.employee_code || '';
              if (code) setEmpCodeQuery(code);
              setEmpSearchSearched(true);
            }
          } else {
            setAssignmentMode('in_house');
            if (resolvedExactLoc) setExactLocation(resolvedExactLoc);
          }
        }
      })
      .catch((err) => console.error('Failed to load asset for editing:', err));
  }, [searchParams]);


  // Auto-Capitalization (CAPS) Helper for all standard text fields
  const handleCapsChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value.toUpperCase());
  };

  // Cascading Plant updates when Location changes in main form
  useEffect(() => {
    if (locationId && plants.length > 0) {
      const validPlants = plants.filter((p) => p.location_id === locationId);
      if (validPlants.length > 0 && !validPlants.some((p) => p.id === plantId)) {
        setPlantId(validPlants[0].id);
      }
    }
  }, [locationId, plants, plantId]);

  // Cascading Plant updates when Location changes in Employee modal
  useEffect(() => {
    if (newEmpLocationId && plants.length > 0) {
      const validPlants = plants.filter((p) => p.location_id === newEmpLocationId);
      if (validPlants.length > 0 && !validPlants.some((p) => p.id === newEmpPlantId)) {
        setNewEmpPlantId(validPlants[0].id);
      }
    }
  }, [newEmpLocationId, plants, newEmpPlantId]);

  // Immediate fast session/user resolve
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d?.user) setCurrentUser(d.scope ? { ...d.user, scope: d.scope } : d.user);
      })
      .catch(() => null);
  }, []);

  // Load Lookups and Drafts on mount
  useEffect(() => {
    async function loadLookups() {
      try {
        const [catsRes, deptsRes, empsRes, locsRes, plantsRes, meRes] = await Promise.all([
          fetch('/api/categories').then((r) => r.json()),
          fetch('/api/settings/departments').then((r) => r.json()),
          fetch('/api/employees').then((r) => r.json()),
          fetch('/api/locations').then((r) => r.json()),
          fetch('/api/plants').then((r) => r.json()),
          fetch('/api/auth/me').then((r) => r.json()).catch(() => null),
        ]);

        if (meRes?.user) {
          setCurrentUser(meRes.scope ? { ...meRes.user, scope: meRes.scope } : meRes.user);
        }

        if (catsRes?.categories && Array.isArray(catsRes.categories) && catsRes.categories.length > 0) {
          setCategories(catsRes.categories);
        } else {
          setCategories([]);
        }

        if (empsRes?.employees) {
          setEmployees(empsRes.employees);
        }

        const isEditMode = Boolean(searchParams.get('edit'));

        if (deptsRes?.departments?.length) {
          setDepartments(deptsRes.departments);
          const allDepts: Department[] = deptsRes.departments;

          // 1. Check if user requested a specific department in URL: ?department=... or ?dept=...
          const requestedDeptParam = (
            searchParams.get('department') ||
            searchParams.get('dept') ||
            searchParams.get('deptId') ||
            ''
          ).trim().toUpperCase();

          // 2. Check if logged-in user has an assigned department (department-wise access)
          const userDeptId = meRes?.user?.department_id;

          let targetDept: Department | undefined;

          if (requestedDeptParam) {
            targetDept = allDepts.find(
              (d) =>
                d.name.trim().toUpperCase() === requestedDeptParam ||
                d.id === requestedDeptParam
            );
          }

          if (!targetDept && userDeptId) {
            targetDept = allDepts.find((d) => d.id === userDeptId);
          }

          if (!targetDept) {
            targetDept = allDepts[0];
          }

          const targetDeptName = targetDept.name.trim().toUpperCase();

          if (!isEditMode) {
            setDepartmentId(targetDept.id);
            setSelectedDeptName(targetDeptName);
            setNewEmpDeptId(targetDept.id);

            const targetCats = (deptCategoriesMap[targetDeptName] || DEFAULT_DEPT_CATEGORIES[targetDeptName] || ['LAPTOP'])
              .filter((c) => c.toUpperCase() !== targetDeptName && c.toUpperCase() !== 'INFORMATION TECHNOLOGY' && c.toUpperCase() !== 'IT');

            if (targetCats.length > 0) {
              setSelectedCategoryName(targetCats[0]);
            }
          }
        }

        if (locsRes?.locations?.length) {
          setLocations(locsRes.locations);
          const userLoc = meRes?.user?.location_id;
          const locToSet = (userLoc && locsRes.locations.some((l: Location) => l.id === userLoc))
            ? userLoc
            : locsRes.locations[0].id;
          if (!isEditMode) {
            setLocationId(locToSet);
          }
          setNewEmpLocationId(locToSet);
        }

        if (plantsRes?.plants?.length) {
          setPlants(plantsRes.plants);
          const urlPlt = searchParams.get('plantId');
          const userPlt = meRes?.user?.plant_id;
          const pltToSet = (urlPlt && plantsRes.plants.some((p: Plant) => p.id === urlPlt))
            ? urlPlt
            : (userPlt && plantsRes.plants.some((p: Plant) => p.id === userPlt))
            ? userPlt
            : plantsRes.plants[0].id;
          if (!isEditMode) {
            setPlantId(pltToSet);
          }
          setNewEmpPlantId(pltToSet);
        }
      } catch (err) {
        console.error('Error loading lookups:', err);
      }
    }

    loadLookups();

    try {
      const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedDrafts(parsed);
      }
    } catch (e) {
      console.error('Failed to load drafts:', e);
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'stock' || params.get('directStock') === 'true') {
        setEntryMode('stock');
        // Do NOT setStep(2) here - Stock mode starts on Step 1 so user can choose Department & Asset Type!
      }
    }
  }, []);

  // Synchronize selectedCategoryId with selectedCategoryName (Safe matching only, no auto-create on keystroke)
  useEffect(() => {
    if (!selectedCategoryName) {
      setSelectedCategoryId('');
      return;
    }
    const cleanName = selectedCategoryName.trim().toUpperCase();
    if (!cleanName) {
      setSelectedCategoryId('');
      return;
    }

    const matched = categories.find(
      (c) =>
        c.name.trim().toUpperCase() === cleanName ||
        c.code.trim().toUpperCase() === cleanName
    );

    if (matched) {
      if (matched.id !== selectedCategoryId) {
        setSelectedCategoryId(matched.id);
      }
    } else {
      setSelectedCategoryId('');
    }
  }, [categories, selectedCategoryName, selectedCategoryId]);

  // Scroll container to top whenever step changes
  useEffect(() => {
    scrollToTop();
  }, [step]);

  // Load dynamic custom fields strictly for IT Department non-Laptop/Desktop asset types
  useEffect(() => {
    let isMounted = true;

    async function loadFields() {
      const deptUpper = (
        selectedDeptName ||
        departments.find((d) => d.id === departmentId)?.name ||
        ''
      ).trim().toUpperCase();
      const isITDept = deptUpper.includes('IT') || deptUpper.includes('INFORMATION TECHNOLOGY');

      // 1. If NOT IT Department, or if Laptop/Desktop, clear dynamic category fields
      if (!isITDept) {
        setCategoryFields([]);
        return;
      }

      const catUpper = (selectedCategoryName || '').trim().toUpperCase();
      if (!catUpper || catUpper.includes('LAPTOP') || catUpper.includes('DESKTOP')) {
        setCategoryFields([]);
        return;
      }

      // Storage key strictly per asset type (e.g. aems_it_cat_fields_MONITOR)
      const storageKey = `aems_it_cat_fields_${catUpper}`;

      // 2. First check if user has custom modified fields saved for this asset type
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && isMounted) {
            setCategoryFields(parsed);
            return;
          }
        }
      } catch {}

      // 3. Next, check if backend category template fields exist for this category
      if (selectedCategoryId) {
        try {
          const res = await fetch(`/api/categories/${selectedCategoryId}/fields`);
          if (res.ok && isMounted) {
            const data = await res.json();
            if (data.fields && Array.isArray(data.fields) && data.fields.length > 0) {
              setCategoryFields(data.fields);
              try {
                localStorage.setItem(storageKey, JSON.stringify(data.fields));
              } catch {}
              return;
            }
          }
        } catch (err) {
          console.error('Error fetching category fields:', err);
        }
      }

      // 4. Fallback to predefined IT defaults for this asset type
      const matchedKey = Object.keys(DEFAULT_IT_CATEGORY_FIELDS).find(
        (k) => k === catUpper || catUpper.includes(k) || k.includes(catUpper)
      );

      if (matchedKey && DEFAULT_IT_CATEGORY_FIELDS[matchedKey]) {
        const defaultList: CategoryFormField[] = DEFAULT_IT_CATEGORY_FIELDS[matchedKey].map(
          (def, idx) => ({
            id: `default_${catUpper.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${def.field_name}`,
            category_id: selectedCategoryId || 'local-it-cat',
            field_name: def.field_name,
            field_label: def.field_label,
            field_type: def.field_type,
            options: def.options,
            is_required: def.is_required,
            placeholder: def.placeholder,
            display_order: idx + 1,
            created_at: new Date().toISOString(),
          })
        );

        if (isMounted) {
          setCategoryFields(defaultList);
          try {
            localStorage.setItem(storageKey, JSON.stringify(defaultList));
          } catch {}
        }
      } else {
        if (isMounted) {
          setCategoryFields([]);
        }
      }
    }

    loadFields();

    return () => {
      isMounted = false;
    };
  }, [selectedCategoryId, selectedCategoryName, selectedDeptName, departmentId, departments]);

  // Auto-sync itAssetType when category changes
  useEffect(() => {
    const catUpper = selectedCategoryName.toUpperCase();
    if (catUpper.includes('LAPTOP')) {
      setItAssetType('LAPTOP');
    } else if (catUpper.includes('DESKTOP')) {
      setItAssetType('DESKTOP');
    } else {
      setItAssetType('INPUT/OUTPUT DEVICE');
    }
  }, [selectedCategoryName]);

  // Live duplicate check on Serial Number (runs in background without cluttering heading)
  useEffect(() => {
    const trimmed = serialNumber.trim();
    if (!trimmed || trimmed.length < 3) {
      setSerialError(null);
      setSerialValid(null);
      return;
    }

    const editId = searchParams.get('edit');
    const timer = setTimeout(async () => {
      setSerialChecking(true);
      try {
        const queryUrl = `/api/assets/check-serial?serial=${encodeURIComponent(trimmed)}${
          editId ? `&excludeId=${encodeURIComponent(editId)}` : ''
        }`;
        const res = await fetch(queryUrl);
        const data = await res.json();
        if (data.exists) {
          setSerialError(
            `Serial number already registered for asset "${data.asset.name}" (${data.asset.asset_tag})`
          );
          setSerialValid(false);
        } else {
          setSerialError(null);
          setSerialValid(true);
        }
      } catch (err) {
        console.error('Serial check error:', err);
      } finally {
        setSerialChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [serialNumber, searchParams]);

  // Live duplicate check on MAC Address (background check)
  useEffect(() => {
    const matchedMacField = categoryFields.find((f) => (f.field_label || f.field_name || '').toLowerCase().includes('mac'));
    const macKey = matchedMacField ? matchedMacField.id : 'mac_address';
    const macVal = customValues[macKey] || customValues['mac_address'] || '';
    const trimmed = macVal.trim().toUpperCase();

    if (!trimmed || trimmed.length < 5) {
      setMacError(null);
      setMacValid(null);
      return;
    }

    const editId = searchParams.get('edit');
    const timer = setTimeout(async () => {
      setMacChecking(true);
      try {
        const queryUrl = `/api/assets/check-mac?mac=${encodeURIComponent(trimmed)}${
          editId ? `&excludeId=${encodeURIComponent(editId)}` : ''
        }`;
        const res = await fetch(queryUrl);
        const data = await res.json();
        if (data.exists) {
          setMacError(
            `MAC Address "${trimmed}" is already assigned to asset "${data.asset.name}" (${data.asset.asset_tag})`
          );
          setMacValid(false);
        } else {
          setMacError(null);
          setMacValid(true);
        }
      } catch (err) {
        console.error('MAC check error:', err);
      } finally {
        setMacChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customValues, categoryFields, searchParams]);

  // Live employee lookup when typing Employee Code in Step 3
  useEffect(() => {
    const code = empCodeQuery.trim().toLowerCase();
    if (!code) {
      // If code was actively cleared by the user, reset employee selection
      if (!assignedEmployeeId) {
        setMatchedEmployee(null);
        setEmpSearchSearched(false);
      }
      return;
    }

    const matched = employees.find(
      (emp) =>
        (emp.emp_code && emp.emp_code.toLowerCase() === code) ||
        (emp.full_name && emp.full_name.toLowerCase().includes(code))
    );

    if (matched) {
      setMatchedEmployee(matched);
      if (matched.status === 'inactive' || (matched.status as string) === 'resigned') {
        setAssignedEmployeeId(''); // Inactive employees cannot be assigned
      } else {
        setAssignedEmployeeId(matched.id);
        // Note: Do NOT overwrite asset department with employee's department.
        // Asset belongs to the owning department selected in Step 1.
        if (matched.location_id) setLocationId(matched.location_id);
        if (matched.plant_id) setPlantId(matched.plant_id);
      }
      setEmpSearchSearched(true);
    } else {
      setMatchedEmployee(null);
      setAssignedEmployeeId('');
      setEmpSearchSearched(true);
    }
  }, [empCodeQuery, employees]);

  // Synchronize matchedEmployee with assignedEmployeeId when employees list loads or in edit mode
  useEffect(() => {
    if (assignedEmployeeId && !matchedEmployee && employees.length > 0) {
      const found = employees.find((e) => e.id === assignedEmployeeId);
      if (found) {
        setMatchedEmployee(found);
        if (found.status === 'inactive' || (found.status as string) === 'resigned') {
          setAssignedEmployeeId('');
        }
        if (!empCodeQuery) {
          setEmpCodeQuery(found.emp_code || '');
        }
        setEmpSearchSearched(true);
      }
    }
  }, [assignedEmployeeId, matchedEmployee, employees, empCodeQuery]);

  // Handle Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    for (const file of fileList) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressed = await compressImage(file, 1024, 1024, 0.75);
        if (compressed) {
          const stored = await uploadDataUrl(compressed, file.name);
          setAssetImages((prev) => [...prev, stored]);
        }
      } catch (err) {
        console.error('Image upload error:', err);
      }
    }
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setAssetImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Document Upload
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
      setAttachedDocs((prev) => [...prev, { name: file.name.toUpperCase(), size: sizeStr }]);
    });
    e.target.value = '';
  };

  const handleRemoveDoc = (index: number) => {
    setAttachedDocs((prev) => prev.filter((_, i) => i !== index));
  };

  // Additional Item / Peripheral handlers
  const handleAddPeripheral = () => {
    setPeripherals((prev) => [
      ...prev,
      { peripheral_name: '', model_number: '', serial_number: '', is_included: true, notes: '' },
    ]);
  };

  const handleRemovePeripheral = (index: number) => {
    setPeripherals((prev) => prev.filter((_, i) => i !== index));
  };

  // Live Dynamic Category Field Handlers (Strictly Per-Asset-Type Persisted for IT Department)
  const handleCreateCustomField = async () => {
    if (!newFieldLabel.trim()) return;

    const catUpper = (selectedCategoryName || itAssetType || '').trim().toUpperCase();
    if (!catUpper) return;

    const targetCatId = selectedCategoryId || 'local-it-cat';
    const fieldName = newFieldLabel.toLowerCase().trim().replace(/\s+/g, '_');
    const optionsArr =
      newFieldType === 'select' && newFieldOptions.trim()
        ? newFieldOptions.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

    const storageKey = `aems_it_cat_fields_${catUpper}`;

    const localField: CategoryFormField = {
      id: crypto.randomUUID(),
      category_id: targetCatId,
      field_name: fieldName,
      field_label: newFieldLabel.trim(),
      field_type: newFieldType,
      options: optionsArr,
      is_required: newFieldRequired,
      display_order: categoryFields.length + 1,
      created_at: new Date().toISOString(),
    };

    const updated = [...categoryFields, localField];
    setCategoryFields(updated);

    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}

    // If backend category exists, also try syncing to DB
    if (selectedCategoryId) {
      try {
        const res = await fetch(`/api/categories/${selectedCategoryId}/fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            field_name: fieldName,
            field_label: newFieldLabel.trim(),
            field_type: newFieldType,
            options: optionsArr,
            is_required: newFieldRequired,
            display_order: categoryFields.length + 1,
          }),
        });

        const data = await res.json();
        if (res.ok && data.field) {
          const synced = updated.map((f) => (f.id === localField.id ? data.field : f));
          setCategoryFields(synced);
          try {
            localStorage.setItem(storageKey, JSON.stringify(synced));
          } catch {}
        }
      } catch (err) {
        console.warn('Backend custom field sync notice:', err);
      }
    }

    setSuccessToast(`Field "${newFieldLabel.trim()}" added to ${selectedCategoryName} template!`);
    setTimeout(() => setSuccessToast(null), 3500);
    setNewFieldLabel('');
    setNewFieldOptions('');
    setNewFieldRequired(false);
    setShowAddFieldModal(false);
  };

  const handleDeleteCustomField = async (field: CategoryFormField) => {
    const catUpper = (selectedCategoryName || itAssetType || '').trim().toUpperCase();
    const updated = categoryFields.filter((f) => f.id !== field.id);
    setCategoryFields(updated);

    // Persist permanently for this asset type
    if (catUpper) {
      const storageKey = `aems_it_cat_fields_${catUpper}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
    }

    // Clear deleted field from active values
    setCustomValues((prev) => {
      const copy = { ...prev };
      delete copy[field.id];
      if (field.field_name) delete copy[field.field_name];
      return copy;
    });

    if (selectedCategoryId && !field.id.startsWith('default_') && !field.id.startsWith('local_')) {
      try {
        await fetch(`/api/categories/${selectedCategoryId}/fields?fieldId=${field.id}`, {
          method: 'DELETE',
        });
      } catch {}
    }

    setSuccessToast(`Field "${field.field_label}" removed from ${selectedCategoryName} template!`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleHideBuiltinField = (fieldKey: string, fieldLabel: string) => {
    setHiddenFieldKeys((prev) => {
      const updated = Array.from(new Set([...prev, fieldKey]));
      try {
        const catKey = selectedCategoryId || selectedCategoryName || 'default';
        localStorage.setItem(`aems_hidden_fields_${catKey}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setSuccessToast(`Field "${fieldLabel}" removed from ${selectedCategoryName || itAssetType} template!`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Save Draft (Zero-Lock: Does NOT burn or reserve an official asset tag)
  const handleSaveDraft = () => {
    const draftId = activeDraftId || crypto.randomUUID();
    const draft: DraftData = {
      draftId,
      savedAt: new Date().toLocaleString(),
      step,
      selectedDeptName,
      selectedCategoryName,
      selectedCategoryId,
      itAssetType,
      assetTag: '', // Drafts do not hold an official code
      serialNumber,
      name,
      model,
      manufacturer,
      condition,
      poNumber,
      sapAssetCode,
      invoiceNumber,
      invoiceDate,
      vendorName,
      purchaseDate,
      purchaseCost,
      warrantyExpiry,
      amcVendor,
      amcExpiry,
      customValues,
      assignmentMode,
      locationId,
      plantId,
      departmentId,
      assignedEmployeeId,
      assignedDate,
      remarks,
      assetImages,
      attachedDocs,
      peripherals,
    };

    const existing = savedDrafts.filter((d) => d.draftId !== draftId);
    const updated = [draft, ...existing];
    setSavedDrafts(updated);
    setActiveDraftId(draftId);
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to persist draft:', e);
    }

    setSuccessToast(`Draft saved successfully at Step ${step}!`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Restore Draft
  const handleRestoreDraft = (draft: DraftData) => {
    setActiveDraftId(draft.draftId);
    setStep(draft.step || 1);
    if (draft.selectedDeptName) setSelectedDeptName(draft.selectedDeptName);
    setSelectedCategoryName(draft.selectedCategoryName);
    setSelectedCategoryId(draft.selectedCategoryId);
    setItAssetType(draft.itAssetType || 'LAPTOP');
    setAssetTag('');
    setSerialNumber(draft.serialNumber || '');
    setName(draft.name || '');
    setModel(draft.model || '');
    setManufacturer(draft.manufacturer || '');
    setCondition(draft.condition || 'new_purchase');
    setPoNumber(draft.poNumber || '');
    setSapAssetCode(draft.sapAssetCode || '');
    setInvoiceNumber(draft.invoiceNumber || '');
    setInvoiceDate(draft.invoiceDate || '');
    setVendorName(draft.vendorName || '');
    setPurchaseDate(draft.purchaseDate || '');
    setPurchaseCost(draft.purchaseCost || '');
    setWarrantyExpiry(draft.warrantyExpiry || '');
    setAmcVendor(draft.amcVendor || '');
    setAmcExpiry(draft.amcExpiry || '');
    setCustomValues(draft.customValues || {});
    setAssignmentMode(draft.assignmentMode || 'employee');
    setLocationId(draft.locationId || SEED_LOCATIONS[0].id);
    setPlantId(draft.plantId || SEED_PLANTS[0].id);
    setDepartmentId(draft.departmentId || (departments[0]?.id ?? ''));
    setAssignedEmployeeId(draft.assignedEmployeeId || '');
    setAssignedDate(draft.assignedDate || new Date().toISOString().split('T')[0]);
    setRemarks(draft.remarks || '');
    setAssetImages(draft.assetImages || []);
    setAttachedDocs(draft.attachedDocs || []);
    setPeripherals(draft.peripherals || []);

    if (draft.assignedEmployeeId) {
      const emp = employees.find((e) => e.id === draft.assignedEmployeeId);
      if (emp) {
        setMatchedEmployee(emp);
        setEmpCodeQuery(emp.emp_code);
      }
    }

    setSuccessToast(`Restored draft from ${draft.savedAt}`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Delete Draft
  const handleDeleteDraft = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedDrafts.filter((d) => d.draftId !== draftId);
    setSavedDrafts(updated);
    if (activeDraftId === draftId) setActiveDraftId(null);
    try {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to update drafts:', err);
    }
  };

  // Create Employee Profile Submission
  const handleCreateEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpModalError(null);

    const cleanCode = newEmpCode.trim().toUpperCase() || `EMP-${Date.now().toString().slice(-6)}`;
    if (!newEmpName.trim()) {
      setEmpModalError('Full Name is mandatory');
      return;
    }

    // Duplicate Check: ensure no duplicate employee profile is created with same code
    if (newEmpCode.trim()) {
      const existingEmp = employees.find((emp) => emp.emp_code.trim().toUpperCase() === cleanCode);
      if (existingEmp) {
        setEmpModalError(
          `Employee ID "${cleanCode}" is already registered for ${existingEmp.full_name} (${existingEmp.department?.name || 'Department'}, ${existingEmp.location?.name || 'Location'}). A duplicate profile cannot be created.`
        );
        return;
      }
    }

    if (newEmpPhone.trim() && newEmpPhone.trim().length !== 10) {
      setEmpModalError('Mobile phone number must be exactly 10 digits');
      return;
    }

    setSavingEmployee(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_code: newEmpCode.trim().toUpperCase(),
          full_name: newEmpName.trim().toUpperCase(),
          email: newEmpEmail.trim() || null,
          phone: newEmpPhone.trim() || null,
          department_id: newEmpDeptId || (departments[0]?.id ?? ''),
          location_id: newEmpLocationId,
          plant_id: newEmpPlantId,
          designation: newEmpDesignation.trim().toUpperCase() || null,
          status: newEmpStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create employee profile');

      const created: Employee = data.employee;
      setEmployees((prev) => [created, ...prev]);
      setMatchedEmployee(created);
      setAssignedEmployeeId(created.id);
      setEmpCodeQuery(created.emp_code);
      // Note: Do NOT overwrite asset department with employee's department.
      if (created.location_id) setLocationId(created.location_id);
      if (created.plant_id) setPlantId(created.plant_id);

      setShowEmployeeModal(false);
      setSuccessToast(`Employee profile created for ${created.full_name} (${created.emp_code})`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: unknown) {
      setEmpModalError(err instanceof Error ? err.message : 'Error creating employee profile');
    } finally {
      setSavingEmployee(false);
    }
  };

  // Clean custom values to ensure zero cross-category attribute leakage
  const getCleanCustomValues = () => {
    const deptUpper = (selectedDeptName || '').trim().toUpperCase();
    const catUpper = (selectedCategoryName || '').trim().toUpperCase();
    const isITDept = deptUpper.includes('IT') || deptUpper.includes('INFORMATION TECHNOLOGY');
    const isLaptopOrDesktop = isITDept && (catUpper.includes('LAPTOP') || catUpper.includes('DESKTOP'));
    const isNetworkCapable = isLaptopOrDesktop;

    const activeFieldIds = new Set(categoryFields.map((f) => f.id));
    const cleaned: Record<string, string> = {};

    if (isLaptopOrDesktop) {
      if (customValues['processor']) cleaned['processor'] = customValues['processor'];
      if (customValues['ram']) cleaned['ram'] = customValues['ram'];
      if (customValues['storage']) cleaned['storage'] = customValues['storage'];
      if (customValues['operating_system']) cleaned['operating_system'] = customValues['operating_system'];
    }

    if (isNetworkCapable) {
      if (customValues['mac_address']) cleaned['mac_address'] = customValues['mac_address'];
      if (customValues['ip_address']) cleaned['ip_address'] = customValues['ip_address'];
    }

    for (const field of categoryFields) {
      if (customValues[field.id] !== undefined && customValues[field.id] !== null && customValues[field.id] !== '') {
        cleaned[field.id] = customValues[field.id];
      }
    }

    return cleaned;
  };

  // Direct Stock / Damaged / Missing Asset Registration Handler
  const handleSaveStock = async () => {
    setError(null);

    // For Damaged / Missing onboarding, ONLY Asset Name is mandatory
    if (isDamagedMode || isMissingMode) {
      if (!name.trim() && !manufacturer.trim() && !model.trim()) {
        setError('Please provide the Asset Name or Equipment Title.');
        setStep(2);
        return;
      }
    } else {
      // Stock Mode Validation
      if (!manufacturer.trim()) {
        setError('Please provide the Manufacturer / Brand.');
        setStep(2);
        return;
      }

      if (!model.trim()) {
        setError('Please provide the Model name.');
        setStep(2);
        return;
      }

      if (!sapAssetCode.trim()) {
        setError('Asset Code (According to SAP) is mandatory. Please enter the SAP Asset Code.');
        setStep(2);
        return;
      }

      if (condition === 'new_purchase' && !poNumber.trim()) {
        setError('PO Number is mandatory for Newly Purchased equipment. Please enter a valid Purchase Order number.');
        setStep(2);
        return;
      }
    }

    if (serialError) {
      setError('Cannot submit: Serial number is already assigned to another asset.');
      setStep(2);
      return;
    }

    if (macError) {
      setError('Cannot submit: MAC Address is already assigned to another asset.');
      setStep(2);
      return;
    }

    // Check mandatory dynamic department fields ONLY for normal stock mode
    if (!isDamagedMode && !isMissingMode) {
      for (const field of categoryFields) {
        if (field.is_required) {
          const val = customValues[field.id];
          if (!val || !val.trim()) {
            setError(`Department specification "${field.field_label}" is required.`);
            setStep(2);
            return;
          }
        }
      }
    }

    setLoading(true);

    try {
      const resolvedDept =
        departments.find((d) => d.name.toUpperCase() === (selectedDeptName || '').trim().toUpperCase()) ||
        departments.find((d) => d.id === departmentId) ||
        departments[0];

      const targetStatus: 'damaged' | 'missing' | 'in_storage' = isDamagedMode
        ? 'damaged'
        : isMissingMode
        ? 'missing'
        : 'in_storage';

      // Ensure all photos are compressed for fast saving
      const compressedPhotos = await Promise.all(
        (assetImages || []).map((img) => compressImage(img, 1024, 1024, 0.75))
      );

      const dynamicHostName = Object.entries(customValues).find(([k]) => {
        const f = categoryFields.find((cf) => cf.id === k);
        return f && (f.field_name?.includes('host') || f.field_label?.toLowerCase().includes('host'));
      })?.[1];
      const finalHostname = (hostname.trim() || (dynamicHostName ? String(dynamicHostName).trim() : '')).toUpperCase() || null;

      const payload = {
        asset: {
          asset_tag: '', // Empty triggers atomic server-side generation
          sap_asset_code: sapAssetCode.trim().toUpperCase() || null,
          name: name.trim().toUpperCase() || `${manufacturer} ${model}`.trim().toUpperCase() || (isDamagedMode ? 'DAMAGED EQUIPMENT' : 'MISSING EQUIPMENT'),
          model: model.trim().toUpperCase() || null,
          manufacturer: manufacturer.trim().toUpperCase() || null,
          serial_number: serialNumber.trim().toUpperCase() || null,
          hostname: finalHostname,
          category_id: selectedCategoryId || (categories[0]?.id ?? '44444444-4444-4444-4444-444444444401'),
          purchase_date: purchaseDate || null,
          purchase_cost: purchaseCost ? parseFloat(purchaseCost) : null,
          po_number: poNumber.trim().toUpperCase() || null,
          invoice_number: invoiceNumber.trim().toUpperCase() || null,
          invoice_date: invoiceDate || null,
          vendor_name: vendorName.trim().toUpperCase() || null,
          warranty_expiry: warrantyExpiry || null,
          amc_vendor: amcVendor.trim().toUpperCase() || null,
          amc_expiry: amcExpiry || null,
          current_location_id: locationId || (locations[0]?.id ?? SEED_LOCATIONS[0].id),
          current_plant_id: plantId || (plants[0]?.id ?? SEED_PLANTS[0].id),
          current_department_id: resolvedDept?.id || departmentId || (departments[0]?.id ?? '33333333-3333-3333-3333-333333333301'),
          assigned_employee_id: null,
          status: targetStatus,
          invoice_document_path: JSON.stringify({
            photos: compressedPhotos.filter(Boolean),
            documents: attachedDocs || [],
            specs: {
              ...getCleanCustomValues(),
              hostname: finalHostname || '',
            },
            sap_asset_code: sapAssetCode.trim().toUpperCase() || null,
            invoice_number: invoiceNumber.trim().toUpperCase() || null,
            invoice_date: invoiceDate || null,
            condition: condition || (poNumber.trim() ? 'new_purchase' : 'existing_asset'),
            hostname: finalHostname,
            remarks: remarks.trim() || null,
            assigned_date: assignedDate || null,
            exact_location: exactLocation.trim().toUpperCase() || null,
            assignment_mode: assignmentMode,
          }),
        },
        categoryName: selectedCategoryName.trim().toUpperCase() || null,
        itAssetType,
        peripherals: peripherals
          .filter((p) => p.is_included && p.peripheral_name.trim().length > 0)
          .map((p) => ({
            peripheral_name: p.peripheral_name.trim().toUpperCase(),
            model_number: p.model_number?.trim().toUpperCase() || undefined,
            serial_number: p.serial_number?.trim().toUpperCase() || undefined,
            is_included: true,
            notes: p.notes?.trim() || undefined,
          })),
        customValues: getCleanCustomValues(),
      };

      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save asset into database');

      // For Damaged / Missing mode, log report entry to reflect in Damaged & Scrap module immediately
      if (isDamagedMode || isMissingMode) {
        try {
          await fetch('/api/damaged-scrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assetId: data.asset.id,
              reportType: isDamagedMode ? 'damaged' : 'missing',
              reason: remarks.trim() || (isDamagedMode ? 'Initial Onboarding of Damaged/Scrap Asset' : 'Initial Onboarding of Missing/Lost Asset'),
              severity: 'minor',
            }),
          });
        } catch (reportErr) {
          console.warn('Report log warning:', reportErr);
        }
      }

      // Clear draft upon successful save
      if (activeDraftId) {
        const updatedDrafts = savedDrafts.filter((d) => d.draftId !== activeDraftId);
        setSavedDrafts(updatedDrafts);
        try {
          localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updatedDrafts));
        } catch (err) {
          console.error('Error clearing draft:', err);
        }
      }

      if (isDamagedMode) {
        setSuccessToast(`Damaged/Scrap asset registered! Reflected in Damaged Module. Tag: ${data.asset.asset_tag}`);
        setTimeout(() => router.push('/damaged-scrap'), 1500);
      } else if (isMissingMode) {
        setSuccessToast(`Missing/Lost asset registered! Reflected in Damaged Module. Tag: ${data.asset.asset_tag}`);
        setTimeout(() => router.push('/damaged-scrap'), 1500);
      } else {
        setSuccessToast(`Asset successfully registered into Available / Stock pool! Official Tag: ${data.asset.asset_tag}`);
        setTimeout(() => router.push('/assets'), 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Asset registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Final Registration Submission
  const handleSubmit = async (e?: React.FormEvent, duplicateApproval?: DuplicateApprovalPayload) => {
    e?.preventDefault();
    setError(null);

    if (!manufacturer.trim()) {
      setError('Please provide the Manufacturer / Brand.');
      setStep(2);
      return;
    }

    if (!model.trim()) {
      setError('Please provide the Model name.');
      setStep(2);
      return;
    }

    if (!sapAssetCode.trim()) {
      setError('Asset Code (According to SAP) is mandatory. Please enter the SAP Asset Code.');
      setStep(2);
      scrollToTop();
      return;
    }

    if (condition === 'new_purchase' && !poNumber.trim()) {
      setError('PO Number is mandatory for Newly Purchased equipment. Please enter a valid Purchase Order number.');
      setStep(2);
      return;
    }

    if (serialError) {
      setError('Cannot submit: Serial number is already assigned to another asset.');
      setStep(2);
      return;
    }

    if (macError) {
      setError('Cannot submit: MAC Address is already assigned to another asset.');
      setStep(2);
      return;
    }

    // Check mandatory dynamic department fields
    for (const field of categoryFields) {
      if (field.is_required) {
        const val = customValues[field.id];
        if (!val || !val.trim()) {
          setError(`Department specification "${field.field_label}" is required.`);
          setStep(2);
          return;
        }
      }
    }

    if (assignmentMode === 'employee') {
      if (!assignedEmployeeId || !assignedEmployeeId.trim()) {
        if (matchedEmployee && (matchedEmployee.status === 'inactive' || (matchedEmployee.status as string) === 'resigned')) {
          setError(`Cannot assign asset: Employee "${matchedEmployee.full_name}" is marked as INACTIVE. Inactive employees cannot receive assets. Please activate the profile in Staff Directory first.`);
        } else {
          setError('Employee assignment is mandatory when "Individual Employee Custody" mode is selected. Please enter a valid Employee ID or select "In-House / Departmental Usage".');
        }
        setStep(3);
        return;
      }
      const targetEmp = employees.find((e) => e.id === assignedEmployeeId);
      if (targetEmp && (targetEmp.status === 'inactive' || (targetEmp.status as string) === 'resigned')) {
        setError(`Cannot assign asset: Employee "${targetEmp.full_name}" is marked as INACTIVE. Inactive employees cannot receive hardware assets.`);
        setStep(3);
        return;
      }
    }

    const isNewInHouse = assignmentMode === 'in_house' && !searchParams.get('edit');
    if (isNewInHouse && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hodEmail.trim())) {
      setError('Please enter a valid HOD email address. The department HOD is notified when an in-house asset is registered.');
      setStep(3);
      return;
    }

    setLoading(true);

    const finalCustomValues = {
      ...getCleanCustomValues(),
      ...(assignmentMode === 'in_house' && exactLocation.trim()
        ? { exact_location: exactLocation.trim().toUpperCase() }
        : {}),
    };

    try {
      const editId = searchParams.get('edit');

      // Ensure all photos are compressed (< 100KB each) so updates/saves are lightning-fast (< 1s)
      const compressedPhotos = await Promise.all(
        (assetImages || []).map((img) => compressImage(img, 1024, 1024, 0.75))
      );

      const resolvedDept =
        departments.find((d) => d.name.toUpperCase() === (selectedDeptName || '').trim().toUpperCase()) ||
        departments.find((d) => d.id === departmentId) ||
        departments[0];

      const payload = {
        asset: {
          asset_tag: editId ? assetTag : '', // Empty triggers atomic server-side unique generation with collision retry loop
          sap_asset_code: sapAssetCode.trim().toUpperCase() || null,
          name: name.trim().toUpperCase() || `${manufacturer} ${model}`.trim().toUpperCase(),
          model: model.trim().toUpperCase() || null,
          manufacturer: manufacturer.trim().toUpperCase() || null,
          serial_number: serialNumber.trim().toUpperCase() || null,
          hostname: hostname.trim().toUpperCase() || null,
          category_id: selectedCategoryId || (categories[0]?.id ?? '44444444-4444-4444-4444-444444444401'),
          purchase_date: purchaseDate || null,
          purchase_cost: purchaseCost ? parseFloat(purchaseCost) : null,
          po_number: poNumber.trim().toUpperCase() || null,
          invoice_number: invoiceNumber.trim().toUpperCase() || null,
          invoice_date: invoiceDate || null,
          vendor_name: vendorName.trim().toUpperCase() || null,
          warranty_expiry: warrantyExpiry || null,
          amc_vendor: amcVendor.trim().toUpperCase() || null,
          amc_expiry: amcExpiry || null,
          current_location_id: locationId || (locations[0]?.id ?? '11111111-1111-1111-1111-111111111101'),
          current_plant_id: plantId || (plants[0]?.id ?? '22222222-2222-2222-2222-222222222201'),
          current_department_id: resolvedDept?.id || departmentId || (departments[0]?.id ?? '33333333-3333-3333-3333-333333333301'),
          assigned_employee_id: assignmentMode === 'employee' ? assignedEmployeeId : null,
          invoice_document_path: JSON.stringify({
            photos: compressedPhotos.filter(Boolean),
            documents: attachedDocs || [],
            specs: {
              ...finalCustomValues,
              hostname: hostname.trim().toUpperCase() || '',
            },
            sap_asset_code: sapAssetCode.trim().toUpperCase() || null,
            invoice_number: invoiceNumber.trim().toUpperCase() || null,
            invoice_date: invoiceDate || null,
            condition: condition || (poNumber.trim() ? 'new_purchase' : 'existing_asset'),
            hostname: hostname.trim().toUpperCase() || null,
            remarks: remarks.trim() || null,
            assigned_date: assignedDate || null,
            exact_location: exactLocation.trim().toUpperCase() || null,
            assignment_mode: assignmentMode,
          }),
          ...(editId ? {} : { status: 'in_service' as const }),
        },
        categoryName: selectedCategoryName.trim().toUpperCase() || null,
        duplicateApproval: duplicateApproval || undefined,
        hodNotification: isNewInHouse
          ? {
              departmentName: (inHouseDeptName || selectedDeptName).trim().toUpperCase(),
              name: hodName.trim().toUpperCase(),
              empCode: hodEmpCode.trim().toUpperCase(),
              email: hodEmail.trim().toLowerCase(),
            }
          : undefined,
        itAssetType,
        peripherals: peripherals
          .filter((p) => p.is_included && p.peripheral_name.trim().length > 0)
          .map((p) => ({
            peripheral_name: p.peripheral_name.trim().toUpperCase(),
            model_number: p.model_number?.trim().toUpperCase() || undefined,
            serial_number: p.serial_number?.trim().toUpperCase() || undefined,
            is_included: true,
            notes: p.notes?.trim() || undefined,
          })),
        customValues: finalCustomValues,
      };

      const url = editId ? `/api/assets/${editId}` : '/api/assets';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.status === 409 && data.conflict) {
        setDuplicateConflict(data.conflict as DuplicateConflictInfo);
        return;
      }
      if (!res.ok) throw new Error(data.error || (editId ? 'Failed to update asset' : 'Failed to register asset'));
      setDuplicateConflict(null);

      // Clear draft upon successful save
      if (activeDraftId) {
        const updatedDrafts = savedDrafts.filter((d) => d.draftId !== activeDraftId);
        setSavedDrafts(updatedDrafts);
        try {
          localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updatedDrafts));
        } catch (err) {
          console.error('Error clearing draft:', err);
        }
      }

      const hodNote = data.hodMail
        ? data.hodMail.sent
          ? ' • HOD notified by email'
          : ' • HOD email could not be sent'
        : '';
      setSuccessToast(editId ? 'Asset updated successfully!' : `Asset successfully registered! Official Tag: ${data.asset.asset_tag}${hodNote}`);
      setTimeout(() => {
        router.push(editId ? `/assets/${editId}` : '/assets');
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Asset registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`font-sans ${step === 1 ? 'max-w-6xl mx-auto space-y-4 pb-4' : 'max-w-6xl mx-auto space-y-6 pb-16'}`}>
      {duplicateConflict && (
        <DuplicateAssetTypeModal
          conflict={duplicateConflict}
          employeeLabel={matchedEmployee ? `${matchedEmployee.full_name} (${matchedEmployee.emp_code})` : undefined}
          assetContext={{
            summary: [
              'New registration',
              [manufacturer, model].filter(Boolean).join(' ') || null,
              serialNumber ? `S/N ${serialNumber.toUpperCase()}` : null,
            ].filter(Boolean).join(' • '),
          }}
          onClose={() => setDuplicateConflict(null)}
          onDeassigned={() => {
            setDuplicateConflict(null);
            handleSubmit();
          }}
          onApproved={(approval) => {
            setDuplicateConflict(null);
            handleSubmit(undefined, approval);
          }}
        />
      )}

      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 text-white px-5 py-3 text-xs font-bold shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header for Stock Entry Mode: High-visibility Stock Entry Mode Banner (Rendered on Step 2) */}
      {isStockMode && step === 2 ? (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-4 sm:p-5 shadow-md border border-emerald-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                scrollToTop();
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/20 shrink-0"
              title="Back to Department & Asset Type"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-400 text-emerald-950 font-mono shadow-xs flex items-center gap-1">
                  <Box className="w-3 h-3 text-emerald-950" />
                  STOCK INVENTORY MODE ACTIVE
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-white border border-white/20">
                  Dept: {selectedDeptName} | Type: {selectedCategoryName}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight leading-tight mt-1">
                Direct Stock Asset Registration
              </h1>
              <p className="text-xs text-emerald-100 mt-0.5">
                Adding equipment directly to Available / Stock pool. Employee allocation (Step 3) is bypassed.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveStock}
            disabled={loading}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-emerald-950 text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0 uppercase tracking-wider"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-950" />
            <span>{loading ? 'Saving in Stock...' : 'Save in Stock'}</span>
          </button>
        </div>
      ) : (
        <>
          {/* Header for Step 1: Clean, compact, NO 1-2-3 indicator bar */}
          {step === 1 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => router.push('/assets')}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer border border-transparent hover:border-slate-300"
                  title="Back to Assets"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                      {searchParams.get('edit')
                        ? `Edit Asset (${assetTag || 'Details'})`
                        : isStockMode
                        ? 'Register Stock Asset'
                        : 'Register Asset'}
                    </h1>
                    {isStockMode && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono shadow-2xs">
                        Stock Pool
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isStockMode
                      ? 'Select department and asset type to register equipment into stock inventory'
                      : 'Select department and asset type to register equipment'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Header for Step 2 & 3: Compact progress indicator */}
          {step > 1 && !isStockMode && (
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    scrollToTop();
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer border border-transparent hover:border-slate-300"
                  title="Go Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                      {searchParams.get('edit') ? `Edit Asset (${assetTag || 'Details'})` : 'Register Asset'}
                    </h1>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {step === 2
                      ? 'Step 2 of 3: Equipment details & technical specifications'
                      : 'Step 3 of 3: Location, plant & employee assignment'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full uppercase tracking-wider">
                Step {step} of 3
              </span>
            </div>
          )}
        </>
      )}

      {/* Smart Drafts Bar (Compact) */}
      {savedDrafts.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-900 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              <strong>Saved Drafts:</strong> You have {savedDrafts.length} in-progress registration draft(s).
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {savedDrafts.map((d) => (
              <div
                key={d.draftId}
                onClick={() => handleRestoreDraft(d)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                  activeDraftId === d.draftId
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <span>{d.selectedCategoryName} (Step {d.step})</span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteDraft(d.draftId, e)}
                  className="hover:text-rose-600 p-0.5"
                  title="Discard Draft"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: SELECT ASSET CATEGORY & SUB-TYPE (Single-Screen Fit)              */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* STEP 1: SELECT ASSET CATEGORY & SUB-TYPE (Desktop Single-Screen Fit)      */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left Column: Hero Banner with Logo & Asset Preview (lg:col-span-5) */}
          <div className="lg:col-span-5 relative rounded-2xl bg-gradient-to-r from-[#0b162c] via-[#0f2244] to-[#152e5a] p-4 text-white shadow-sm border border-slate-800 flex flex-col justify-between gap-4 h-full min-h-[220px]">
            {/* Upload Image Button */}
            <label className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold rounded-lg shadow-sm cursor-pointer transition-all border border-slate-200">
              <UploadCloud className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>UPLOAD IMAGE</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && file.type.startsWith('image/')) {
                    try {
                      const compressed = await compressImage(file, 1024, 1024, 0.75);
                      if (compressed) {
                        setAssetImages([await uploadDataUrl(compressed, file.name)]);
                      }
                    } catch (err) {
                      console.error('Quick image upload error:', err);
                    }
                  }
                  e.target.value = '';
                }}
              />
            </label>

            {/* Top Logo & Title */}
            <div className="space-y-1 z-10">
              <div className="h-5 px-1.5 bg-white rounded flex items-center justify-center shadow-2xs w-fit mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/pg-logo.png" alt="PG Logo" className="h-3.5 w-auto object-contain" />
              </div>

              <div>
                <span className="text-[9px] font-black tracking-widest text-blue-400 uppercase block">
                  STEP 1
                </span>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5">
                  Select Asset Type
                </h2>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Choose the plant department and specific asset type to proceed.
                </p>
              </div>
            </div>

            {/* Bottom Asset Preview */}
            <div className="relative w-full h-24 flex items-center justify-center shrink-0 pr-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAssetPreviewImage(selectedCategoryName, itAssetType, assetImages)}
                alt="Asset Preview"
                className="max-h-full max-w-full object-contain filter drop-shadow-xl transition-all"
              />
              <div className="absolute bottom-0 left-1 bg-slate-900/85 backdrop-blur-md px-2.5 py-0.5 rounded-lg border border-white/15 shadow-md">
                <p className="text-[10px] font-black text-white leading-tight">
                  {selectedCategoryName ? selectedCategoryName.toUpperCase() : 'NO ASSET TYPE'}
                </p>
                <p className="text-[9px] text-slate-300 capitalize">
                  {selectedCategoryName ? selectedCategoryName.toLowerCase() : 'Equipment'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Department & Asset Type Selection Card (lg:col-span-7) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Field 1: Select Department */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span>1. SELECT DEPARTMENT *</span>
                    {isDeptLockedForUser ? (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Assigned to your department
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold">Choose plant department</span>
                    )}
                  </label>

                  {/* Smart Excel Import Button (Theme adapts dynamically to department) */}
                  {isAuthorizedForImport && (
                    <button
                      type="button"
                      onClick={() => setShowImportModal(true)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:shadow-md transition-all cursor-pointer ${deptTheme.button}`}
                      title={`Smart Excel Batch Importer for ${selectedDeptName || 'Department'}`}
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                      <span>⚡ Smart Excel Import</span>
                    </button>
                  )}
                </div>
                {isDeptLockedForUser ? (
                  <div className="w-full bg-blue-50/60 border border-blue-200/80 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 flex items-center justify-between shadow-2xs select-none">
                    <span className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>{selectedDeptName}</span>
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-100 px-2.5 py-0.5 rounded-md border border-blue-200">
                      Assigned Department
                    </span>
                  </div>
                ) : (
                  <SearchableCombobox
                    value={selectedDeptName}
                    onChange={(val) => handleSelectDepartment(val)}
                    options={
                      availableDepartments.length > 0
                        ? availableDepartments.map((d) => d.name.toUpperCase())
                        : (currentUser?.role === 'it_admin' ? Array.from(new Set(Object.keys(deptCategoriesMap))) : [selectedDeptName])
                    }
                    onAddOption={currentUser?.role === 'it_admin' ? handleInlineAddDepartment : undefined}
                    onDeleteOption={currentUser?.role === 'it_admin' ? handleInlineDeleteDepartment : undefined}
                    placeholder="Search or type department name..."
                    required
                  />
                )}
              </div>

              {/* Field 2: Department-Specific Asset Type */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>2. ASSET TYPE ({selectedDeptName || 'DEPARTMENT'}) *</span>
                </label>
                <SearchableCombobox
                  value={selectedCategoryName}
                  onChange={(val) => setSelectedCategoryName(val.toUpperCase())}
                  options={(deptCategoriesMap[selectedDeptName] || DEFAULT_DEPT_CATEGORIES[selectedDeptName] || ['LAPTOP']).filter(
                    (c) =>
                      c.toUpperCase() !== selectedDeptName.toUpperCase() &&
                      c.toUpperCase() !== 'INFORMATION TECHNOLOGY' &&
                      c.toUpperCase() !== 'IT'
                  )}
                  onAddOption={(newCat) => handleAddCategoryForDept(selectedDeptName, newCat)}
                  onDeleteOption={(catToDelete) => handleDeleteCategoryForDept(selectedDeptName, catToDelete)}
                  placeholder={`Search or type asset type for ${selectedDeptName || 'department'}...`}
                  required
                />
              </div>

            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/assets')}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  Save as Draft
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(2);
                  scrollToTop();
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: BASE IDENTIFICATION, COMMERCIAL, ATTACHMENTS & SPECS              */}
      {/* FLOW: brand -> model -> serial -> asset code -> vendor, po -> cost -> etc */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-7">
          {/* Stock Entry Mode High-Visibility Alert Banner */}
          {isStockMode && (
            <div className="bg-emerald-50 border-2 border-emerald-500/80 rounded-xl p-3.5 px-4 flex items-center justify-between gap-3 text-xs text-emerald-950 font-semibold shadow-2xs">
              <div className="flex items-center gap-2.5">
                <Box className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 block">
                    Direct Stock Entry Active
                  </span>
                  <p className="text-xs font-bold text-emerald-950">
                    You are adding equipment directly to the <strong>Available / Stock Pool</strong>. Employee allocation (Step 3) is bypassed.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider shrink-0 shadow-2xs">
                Save in Stock Mode
              </span>
            </div>
          )}

          {/* Damaged Entry Mode High-Visibility Alert Banner */}
          {isDamagedMode && (
            <div className="bg-amber-50 border-2 border-amber-500/80 rounded-xl p-3.5 px-4 flex items-center justify-between gap-3 text-xs text-amber-950 font-semibold shadow-2xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 block">
                    Damaged / Scrap Asset Onboarding Active
                  </span>
                  <p className="text-xs font-bold text-amber-950">
                    Registering a <strong>Damaged / Scrap Item</strong> directly into the Damaged Module &amp; KPI card. Only Asset Name is mandatory.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-black uppercase tracking-wider shrink-0 shadow-2xs">
                Damaged Mode
              </span>
            </div>
          )}

          {/* Missing Entry Mode High-Visibility Alert Banner */}
          {isMissingMode && (
            <div className="bg-rose-50 border-2 border-rose-500/80 rounded-xl p-3.5 px-4 flex items-center justify-between gap-3 text-xs text-rose-950 font-semibold shadow-2xs">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-5 h-5 text-rose-700 shrink-0" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 block">
                    Missing / Lost Asset Onboarding Active
                  </span>
                  <p className="text-xs font-bold text-rose-950">
                    Registering a <strong>Missing / Lost Item</strong> directly into the Damaged/Missing Module &amp; KPI card. Only Asset Name is mandatory.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider shrink-0 shadow-2xs">
                Missing Mode
              </span>
            </div>
          )}

          {/* Section 1: BASE IDENTIFICATION */}
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              1. BASE IDENTIFICATION
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 1. Manufacturer / Brand */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Manufacturer / Brand *</label>
                <SearchableCombobox
                  value={manufacturer}
                  onChange={setManufacturer}
                  options={optionsReady ? brands : []}
                  onAddOption={handleAddBrand}
                  onDeleteOption={handleDeleteBrand}
                  placeholder={isItOptionDept ? 'e.g. LENOVO, DELL, HP' : 'Type or select brand'}
                  required
                />
              </div>

              {/* 2. Model */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Model *</label>
                <SearchableCombobox
                  value={model}
                  onChange={setModel}
                  options={optionsReady ? models : []}
                  onAddOption={handleAddModel}
                  onDeleteOption={handleDeleteModel}
                  placeholder={isItOptionDept ? 'e.g. THINKPAD P16 G2' : 'Type or select model'}
                  required
                />
              </div>

              {/* 3. Serial Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">Serial Number</label>
                  {serialChecking ? (
                    <span className="text-[10px] text-blue-600 font-bold animate-pulse">Checking DB...</span>
                  ) : serialError ? (
                    <span className="text-[10px] text-rose-600 font-bold">Duplicate Detected!</span>
                  ) : serialValid ? (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Unique
                    </span>
                  ) : null}
                </div>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={handleCapsChange(setSerialNumber)}
                  placeholder="e.g. SN-981249A"
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none uppercase transition-colors ${
                    serialError
                      ? 'bg-rose-50 border-rose-400 focus:border-rose-600'
                      : serialValid
                      ? 'bg-emerald-50/50 border-emerald-400 focus:border-emerald-600'
                      : 'bg-slate-50 border-slate-200 focus:border-blue-500 focus:bg-white'
                  }`}
                />
                {serialError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    ⚠️ {serialError}
                  </p>
                )}
              </div>

              {/* 4. Asset Code (According to SAP) - MANDATORY */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Asset Code (According to SAP) <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sapAssetCode}
                  onChange={handleCapsChange(setSapAssetCode)}
                  placeholder="e.g. SAP-1002394"
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none uppercase transition-colors ${
                    !sapAssetCode.trim()
                      ? 'bg-amber-50/40 border-amber-300 focus:border-amber-500 focus:bg-white'
                      : 'bg-slate-50 border-slate-200 focus:border-blue-500 focus:bg-white'
                  }`}
                />
              </div>

              {/* 5. Asset Code / Tag (Clean - only code) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">AEMS System Tag *</label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={
                    assetTag
                      ? assetTag
                      : `PGEL-${selectedCategoryName.toUpperCase() === 'IT' ? 'IT' : selectedCategoryName.slice(0, 3).toUpperCase()}-${itAssetType.slice(0, 3)}-${new Date().getFullYear()}-XXXX`
                  }
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 select-none cursor-not-allowed font-bold tracking-wider"
                />
              </div>
            </div>
          </div>

          {/* Section 2: COMMERCIAL, PURCHASE ORDER & WARRANTY */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. Commercial, Purchase Order &amp; Warranty
            </h2>

            {/* Condition Selection */}
            <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Acquisition Condition *
                </span>
                <span className="text-[11px] text-slate-500">
                  New purchase requires mandatory PO number
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCondition('new_purchase')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    condition === 'new_purchase'
                      ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center ${
                    condition === 'new_purchase' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                  }`}>
                    {condition === 'new_purchase' && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">New Purchase (PO Required *)</div>
                    <div className="text-[10px] text-slate-500">Mandatory PO number and purchase date</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCondition('existing_asset')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    condition === 'existing_asset'
                      ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center ${
                    condition === 'existing_asset' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                  }`}>
                    {condition === 'existing_asset' && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">Existing Asset (PO Optional)</div>
                    <div className="text-[10px] text-slate-500">Legacy equipment or uncatalogued stock</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Vendor Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Vendor Name</label>
                <SearchableCombobox
                  value={vendorName}
                  onChange={setVendorName}
                  options={optionsReady ? vendors : []}
                  onAddOption={handleAddVendor}
                  onDeleteOption={handleDeleteVendor}
                  placeholder={isItOptionDept ? 'e.g. REDINGTON INDIA, DELL' : 'Type or select vendor'}
                />
              </div>

              {/* PO Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  PO Number {condition === 'new_purchase' ? <span className="text-rose-500 font-bold">* (Required)</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
                </label>
                <input
                  type="text"
                  required={condition === 'new_purchase'}
                  value={poNumber}
                  onChange={handleCapsChange(setPoNumber)}
                  placeholder={condition === 'new_purchase' ? 'PO-2024-XXXX (Mandatory)' : 'PO-2024-XXXX (Optional)'}
                  className={`w-full border rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none uppercase ${
                    condition === 'new_purchase' && !poNumber.trim()
                      ? 'bg-amber-50/50 border-amber-300 focus:border-amber-500'
                      : 'bg-slate-50 border-slate-200 focus:border-blue-500 focus:bg-white'
                  }`}
                />
              </div>

              {/* Invoice Number (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Invoice Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={handleCapsChange(setInvoiceNumber)}
                  placeholder="e.g. INV-2024-0012"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none uppercase focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Invoice Date (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Invoice Date <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                />
              </div>

              {/* Purchase Cost */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Purchase Cost (₹ INR)</label>
                <input
                  type="number"
                  step="any"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder="e.g. 85000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Purchase Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                />
              </div>

              {/* Warranty Expiry */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Warranty Expiry Date</label>
                <input
                  type="date"
                  value={warrantyExpiry}
                  onChange={(e) => setWarrantyExpiry(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                />
              </div>

              {/* AMC Vendor & Expiry */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">AMC Vendor / Expiry Date</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={amcVendor}
                    onChange={handleCapsChange(setAmcVendor)}
                    placeholder="AMC Provider"
                    className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 uppercase"
                  />
                  <input
                    type="date"
                    value={amcExpiry}
                    onChange={(e) => setAmcExpiry(e.target.value)}
                    className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: ATTACHMENTS & MEDIA (Images & Documents) */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              3. Attachments &amp; Media (Photos &amp; Documents)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Asset Images (Multiple upload with preview) */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Asset Photos ({assetImages.length})
                    </span>
                    <span className="text-[10px] text-slate-400">Physical equipment condition photographs</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload Photos</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {assetImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                    {assetImages.map((imgSrc, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imgSrc} alt={`Asset photo ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full opacity-80 hover:opacity-100 transition-opacity cursor-pointer shadow-sm"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:bg-blue-50/40 hover:border-blue-400 transition-colors"
                  >
                    <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-600">Click to upload multiple asset images</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, WebP up to 10MB</p>
                  </div>
                )}
              </div>

              {/* Document Attachments */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Documents &amp; Invoices ({attachedDocs.length})
                    </span>
                    <span className="text-[10px] text-slate-400">PDF, scanned POs, warranty cards</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Add Document</span>
                  </button>
                  <input
                    type="file"
                    ref={docInputRef}
                    onChange={handleDocUpload}
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                    className="hidden"
                  />
                </div>

                {attachedDocs.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto p-1">
                    {attachedDocs.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-bold text-slate-800 truncate">{doc.name}</span>
                          <span className="text-[10px] text-slate-400">({doc.size})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={() => docInputRef.current?.click()}
                    className="border border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-100/60 transition-colors"
                  >
                    <FileText className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-600">Attach Invoice, PO or Warranty files</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">PDF or Word documents</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: ADDITIONAL ITEMS & PERIPHERALS CHECKLIST */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  4. Additional Handover Items &amp; Peripherals Checklist
                </h2>
                <p className="text-[11px] text-slate-400">
                  Bundle extra items/accessories handed over with the primary equipment (e.g. Monitor, Mouse, Adapter, Bag)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddPeripheral}
                className="flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>+ Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {peripherals.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-400 text-xs">
                  <p className="font-semibold text-slate-500">No handover items added</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click &quot;+ Add Item&quot; above to bundle accessories (e.g. Monitor, Mouse, Keyboard, Charger, Bag)
                  </p>
                </div>
              ) : (
                peripherals.map((p, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80"
                  >
                    <input
                      type="checkbox"
                      checked={p.is_included}
                      onChange={(e) => {
                        const copy = [...peripherals];
                        copy[index].is_included = e.target.checked;
                        setPeripherals(copy);
                      }}
                      className="h-4 w-4 rounded bg-white border-slate-300 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={p.peripheral_name}
                      onChange={(e) => {
                        const copy = [...peripherals];
                        copy[index].peripheral_name = e.target.value.toUpperCase();
                        setPeripherals(copy);
                      }}
                      placeholder="Peripheral name (e.g. DELL MONITOR, LAPTOP BAG)"
                      className="flex-1 min-w-[180px] bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 uppercase font-medium"
                    />
                    <input
                      type="text"
                      value={p.model_number}
                      onChange={(e) => {
                        const copy = [...peripherals];
                        copy[index].model_number = e.target.value.toUpperCase();
                        setPeripherals(copy);
                      }}
                      placeholder="Model No. (Optional)"
                      className="w-full sm:w-36 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 uppercase"
                    />
                    <input
                      type="text"
                      value={p.serial_number}
                      onChange={(e) => {
                        const copy = [...peripherals];
                        copy[index].serial_number = e.target.value.toUpperCase();
                        setPeripherals(copy);
                      }}
                      placeholder="Serial No. (Optional)"
                      className="w-full sm:w-36 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePeripheral(index)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 5: Technical Specifications (EXCLUSIVELY for Information Technology Department) */}
          {(() => {
            const deptUpper = (
              selectedDeptName ||
              departments.find((d) => d.id === departmentId)?.name ||
              ''
            ).trim().toUpperCase();
            const catUpper = (selectedCategoryName || '').trim().toUpperCase();
            const isITDept = deptUpper.includes('IT') || deptUpper.includes('INFORMATION TECHNOLOGY');
            const isLaptopOrDesktop = isITDept && (catUpper.includes('LAPTOP') || catUpper.includes('DESKTOP'));
            const isNetworkCapable = isLaptopOrDesktop;

            // STRICTURE: Section 5 is strictly exclusive to Information Technology Department!
            if (!isITDept) return null;

            return (
              <div className="pt-4 border-t border-slate-100 space-y-4">
                {/* Header with "+ Add Field" Button (Hidden for Laptop & Desktop Standard Template) */}
                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex-wrap gap-2">
                  <div>
                    <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      <span>
                        5. Technical Specifications ({selectedCategoryName || 'IT Asset'})
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {isLaptopOrDesktop
                        ? 'Standard hardware specifications & network connectivity attributes.'
                        : `Technical attributes & specifications for ${selectedCategoryName} asset type.`}
                    </p>
                  </div>
                  {!isLaptopOrDesktop && (
                    <button
                      type="button"
                      onClick={() => setShowAddFieldModal(!showAddFieldModal)}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4 text-white" />
                      <span>+ Add Field</span>
                    </button>
                  )}
                </div>

                {/* Inline Add Field Creator Modal / Card */}
                {showAddFieldModal && !isLaptopOrDesktop && (
                  <div className="p-4 rounded-2xl border-2 border-blue-400 bg-blue-50/70 space-y-3.5 shadow-md animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                      <span className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-blue-600" />
                        Add Custom Field to {selectedCategoryName || itAssetType} Template
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddFieldModal(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Field Label *
                        </label>
                        <input
                          type="text"
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          placeholder="e.g. Print Resolution, Port Count, Lens Type"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Field Type
                        </label>
                        <select
                          value={newFieldType}
                          onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer font-medium"
                        >
                          <option value="text">Text Input</option>
                          <option value="number">Numeric Input</option>
                          <option value="select">Dropdown Choice (Select)</option>
                          <option value="boolean">Yes / No Checkbox</option>
                        </select>
                      </div>

                      {newFieldType === 'select' && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Options (Comma separated)
                          </label>
                          <input
                            type="text"
                            value={newFieldOptions}
                            onChange={(e) => setNewFieldOptions(e.target.value)}
                            placeholder="e.g. 600 DPI, 1200 DPI"
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newFieldRequired}
                          onChange={(e) => setNewFieldRequired(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer h-4 w-4"
                        />
                        <span>Required Field</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddFieldModal(false)}
                          className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCustomField}
                          disabled={!newFieldLabel.trim()}
                          className="px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 cursor-pointer shadow-xs uppercase tracking-wider"
                        >
                          Save Field to Template
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Network Connectivity Card (Hostname + MAC Address + IP Address for Network-capable IT devices) */}
                {isNetworkCapable && (
                  <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="text-base">🌐</span> Network Connectivity
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Auto-Formatting Active</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Hostname */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Hostname
                          </label>
                        </div>
                        <input
                          type="text"
                          value={hostname}
                          onChange={handleCapsChange(setHostname)}
                          placeholder="e.g. PG-LAP-0142"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white uppercase transition-colors"
                        />
                      </div>

                      {/* MAC Address */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            MAC Address <span className="text-xs font-normal text-slate-400">(Auto-Formatted &amp; Unique)</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            {macChecking && <span className="text-[10px] text-blue-600 animate-pulse">Checking...</span>}
                            {macValid && <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5"><Check className="w-3 h-3"/> Unique</span>}
                          </div>
                        </div>
                        <input
                          type="text"
                          value={customValues['mac_address'] || ''}
                          onChange={(e) => {
                            const val = formatMacAddress(e.target.value);
                            setCustomValues((prev) => ({ ...prev, mac_address: val }));
                          }}
                          placeholder="e.g. 00:1A:2B:3C:4D:5E"
                          maxLength={17}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none uppercase ${
                            macError
                              ? 'bg-rose-50/60 border-rose-400 focus:border-rose-500'
                              : 'bg-slate-50 border-slate-200 focus:border-blue-500 focus:bg-white'
                          }`}
                        />
                        {macError && (
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-rose-600 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                            <span>{macError}</span>
                          </div>
                        )}
                      </div>

                      {/* IP Address */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            IP Address <span className="text-xs font-normal text-slate-400">(Auto-Formatted)</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          value={customValues['ip_address'] || ''}
                          onChange={(e) => {
                            const val = formatIpAddress(e.target.value);
                            setCustomValues((prev) => ({ ...prev, ip_address: val }));
                          }}
                          placeholder="e.g. 192.168.1.100"
                          maxLength={15}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white uppercase"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">IPv4 format. Uniqueness check disabled.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Core Hardware Specs Grid (Laptop & Desktop Only) */}
                {isLaptopOrDesktop && (
                  <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/90 space-y-4">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block border-b border-slate-200 pb-1.5">
                      💻 Laptop / Desktop Core Hardware Specifications (Standard Protected Fields)
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* PROCESSOR */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          Processor / CPU *
                        </label>
                        <SearchableCombobox
                          value={customValues['processor'] || ''}
                          onChange={(val) => {
                            setCustomValues((prev) => ({ ...prev, processor: val }));
                          }}
                          options={optionsReady ? processors : []}
                          onAddOption={handleAddProcessor}
                          onDeleteOption={handleDeleteProcessor}
                          placeholder="e.g. INTEL CORE I7 13700H, AMD RYZEN 7"
                          required
                        />
                      </div>

                      {/* RAM MEMORY */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          RAM Memory *
                        </label>
                        <SearchableCombobox
                          value={customValues['ram'] || ''}
                          onChange={(val) => {
                            setCustomValues((prev) => ({ ...prev, ram: val }));
                          }}
                          options={optionsReady ? ramOptions : []}
                          onAddOption={handleAddRam}
                          onDeleteOption={handleDeleteRam}
                          placeholder="e.g. 16GB DDR5, 32GB DDR5"
                          required
                        />
                      </div>

                      {/* ROM / STORAGE CAPACITY */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          ROM / Storage Capacity (SSD/HDD) *
                        </label>
                        <SearchableCombobox
                          value={customValues['storage'] || ''}
                          onChange={(val) => {
                            setCustomValues((prev) => ({ ...prev, storage: val }));
                          }}
                          options={optionsReady ? storageOptions : []}
                          onAddOption={handleAddStorage}
                          onDeleteOption={handleDeleteStorage}
                          placeholder="e.g. 512GB NVME SSD, 1TB NVME SSD"
                          required
                        />
                      </div>

                      {/* OPERATING SYSTEM */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          Operating System (OS) *
                        </label>
                        <SearchableCombobox
                          value={customValues['operating_system'] || ''}
                          onChange={(val) => {
                            setCustomValues((prev) => ({ ...prev, operating_system: val }));
                          }}
                          options={optionsReady ? osOptions : []}
                          onAddOption={handleAddOs}
                          onDeleteOption={handleDeleteOs}
                          placeholder="e.g. WINDOWS 11 PRO, MACOS SONOMA"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Dynamic Category Template Fields (Add/Delete Per-Asset-Type, Only For Non-Laptop/Desktop) */}
                {categoryFields.length > 0 && !isLaptopOrDesktop ? (
                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
                      📌 Template Attributes for {selectedCategoryName} Asset Type ({categoryFields.length} active)
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {categoryFields.map((f) => (
                        <div key={f.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5 relative group">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-700">
                              {f.field_label}{' '}
                              {f.is_required && <span className="text-rose-500 font-bold">*</span>}
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomField(f)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title={`Remove "${f.field_label}" from ${selectedCategoryName} template`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {f.field_type === 'select' && f.options ? (
                            <SearchableCombobox
                              value={customValues[f.id] || ''}
                              onChange={(val) => setCustomValues({ ...customValues, [f.id]: val })}
                              options={Array.isArray(f.options) ? f.options : []}
                              placeholder={f.placeholder || `Select ${f.field_label}`}
                              required={f.is_required}
                            />
                          ) : f.field_type === 'boolean' ? (
                            <label className="flex items-center gap-2 pt-1 text-xs text-slate-700 font-semibold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={customValues[f.id] === 'true'}
                                onChange={(e) => setCustomValues({ ...customValues, [f.id]: e.target.checked ? 'true' : 'false' })}
                                className="h-4 w-4 rounded bg-white border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                              />
                              <span>Enabled / Yes</span>
                            </label>
                          ) : (
                            <input
                              type={f.field_type === 'number' ? 'number' : 'text'}
                              value={customValues[f.id] || ''}
                              onChange={(e) => setCustomValues({ ...customValues, [f.id]: e.target.value })}
                              placeholder={f.placeholder || `Enter ${f.field_label}`}
                              required={f.is_required}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white uppercase font-medium"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : !isLaptopOrDesktop ? (
                  <div className="p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-2">
                    <Sliders className="w-7 h-7 text-slate-300" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-700">No Custom Specifications Added Yet for {selectedCategoryName} Asset Type</p>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        Click <strong className="text-blue-600">+ Add Custom Field</strong> above to add specific attributes for {selectedCategoryName} asset type (e.g. Resolution, Port Count, Lens Type, Cartridge Model).
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })()}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (isDamagedMode || isMissingMode) {
                  router.push(isDamagedMode ? '/damaged-scrap' : '/assets');
                } else {
                  setStep(1);
                  scrollToTop();
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isDamagedMode || isMissingMode ? 'Cancel & Exit' : 'Back: Department'}</span>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Save as Draft
              </button>

              {/* In Direct Entry Modes (Stock, Damaged, Missing): show direct save button */}
              {isDirectEntryMode ? (
                <button
                  type="button"
                  onClick={handleSaveStock}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl ${
                    isDamagedMode
                      ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                      : isMissingMode
                      ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                  } text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50`}
                  title={
                    isDamagedMode
                      ? 'Save directly into Damaged & Scrap assets'
                      : isMissingMode
                      ? 'Save directly into Missing assets'
                      : 'Save directly into Available / Stock inventory pool'
                  }
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {loading
                      ? 'Saving...'
                      : isDamagedMode
                      ? 'Save Damaged Asset'
                      : isMissingMode
                      ? 'Save Missing Asset'
                      : 'Save in Stock'}
                  </span>
                </button>
              ) : (
                /* In Standard Entry Wizard Mode: ONLY show Proceed to Assignment */
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    if (macError) {
                      setError('Cannot proceed: MAC Address is already assigned to another asset.');
                      scrollToTop();
                      return;
                    }
                    if (serialError) {
                      setError('Cannot proceed: Serial number is already assigned to another asset.');
                      scrollToTop();
                      return;
                    }
                    
                    const effectiveManufacturer = manufacturer.trim() || name.trim() || 'GENERIC';
                    const effectiveModel = model.trim() || name.trim() || 'STANDARD';
                    
                    if (!manufacturer.trim()) setManufacturer(effectiveManufacturer);
                    if (!model.trim()) setModel(effectiveModel);

                    if (!sapAssetCode.trim()) {
                      setError('Asset Code (According to SAP) is mandatory. Please enter the SAP Asset Code in Section 1.');
                      scrollToTop();
                      return;
                    }

                    if (condition === 'new_purchase' && !poNumber.trim()) {
                      setError('PO Number is mandatory for Newly Purchased equipment. Please enter a valid PO number in Section 2 above (or select "Existing Asset" if PO is unavailable).');
                      scrollToTop();
                      return;
                    }

                    const deptUpper = (
                      selectedDeptName ||
                      departments.find((d) => d.id === departmentId)?.name ||
                      ''
                    ).trim().toUpperCase();
                    const catUpper = (selectedCategoryName || '').trim().toUpperCase();
                    const isITDept = deptUpper.includes('IT') || deptUpper.includes('INFORMATION TECHNOLOGY');
                    const isLaptopOrDesktop = isITDept && (catUpper.includes('LAPTOP') || catUpper.includes('DESKTOP'));

                    if (isLaptopOrDesktop) {
                      if (!customValues['processor']) {
                        setError('Processor / CPU is required for Laptop / Desktop.');
                        scrollToTop();
                        return;
                      }
                      if (!customValues['ram']) {
                        setError('RAM Memory is required for Laptop / Desktop.');
                        scrollToTop();
                        return;
                      }
                      if (!customValues['storage']) {
                        setError('ROM / Storage Capacity is required for Laptop / Desktop.');
                        scrollToTop();
                        return;
                      }
                      if (!customValues['operating_system']) {
                        setError('Operating System (OS) is required for Laptop / Desktop.');
                        scrollToTop();
                        return;
                      }
                    }

                    for (const field of categoryFields) {
                      if (field.is_required) {
                        const val = customValues[field.id];
                        if (!val || !val.trim()) {
                          setError(`Department specification "${field.field_label}" is required.`);
                          scrollToTop();
                          return;
                        }
                      }
                    }

                    setStep(3);
                    scrollToTop();
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <span>Proceed to Assignment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: ASSIGNMENT, HR AUTO-LOOKUP & LOCATION DEPLOYMENT                  */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-7">
          {/* Section 1: Custody Assignment Mode Selector (Individual Employee vs In-House / Departmental Usage) */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Select Custody &amp; Assignment Type *
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Individual Employee Assignment */}
              <button
                type="button"
                onClick={() => setAssignmentMode('employee')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  assignmentMode === 'employee'
                    ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-black shrink-0 ${
                  assignmentMode === 'employee' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                }`}>
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Individual Employee Custody
                    </span>
                    {assignmentMode === 'employee' && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-blue-600 text-white uppercase">Selected</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Assign asset directly to a verified employee profile (Requires Employee ID validation).
                  </p>
                </div>
              </button>

              {/* Option B: In-House / Departmental Usage */}
              <button
                type="button"
                onClick={() => {
                  setAssignmentMode('in_house');
                  setAssignedEmployeeId('');
                  setMatchedEmployee(null);
                  setEmpCodeQuery('');
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  assignmentMode === 'in_house'
                    ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-black shrink-0 ${
                  assignmentMode === 'in_house' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      In-House / Departmental Usage
                    </span>
                    {assignmentMode === 'in_house' && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white uppercase">Selected</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Assign to Department &amp; Plant for shared or in-house usage (e.g. Printer, Camera, Switch, Server).
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Employee ID Live Auto-Lookup (Only active when assignmentMode === 'employee') */}
          {assignmentMode === 'employee' ? (
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Employee ID Verification &amp; Auto-Lookup
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enter the Employee ID. System automatically checks database and fetches profile details.
                  </p>
                </div>

                {/* Show Verified badge or Inactive Warning when employee is found */}
                {matchedEmployee && (
                  (matchedEmployee.status === 'inactive' || (matchedEmployee.status as string) === 'resigned') ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 self-start sm:self-auto shadow-2xs">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Inactive Employee (Assignment Blocked)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 self-start sm:self-auto shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Profile Verified &amp; Selected</span>
                    </span>
                  )
                )}
              </div>

              {/* Employee ID Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={empCodeQuery}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setEmpCodeQuery(val);
                    if (!val.trim()) {
                      setMatchedEmployee(null);
                      setAssignedEmployeeId('');
                      setEmpSearchSearched(false);
                    }
                  }}
                  placeholder="Enter Employee ID (e.g. PGEL-001, EMP-101)..."
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs uppercase"
                />
              </div>

              {/* Employee Lookup Status & Profile Card */}
              {matchedEmployee ? (
                (matchedEmployee.status === 'inactive' || (matchedEmployee.status as string) === 'resigned') ? (
                  <div className="bg-rose-50 rounded-xl border border-rose-300 p-4 shadow-2xs space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="text-xs font-black text-rose-900">{matchedEmployee.full_name}</span>
                        <span className="text-[11px] font-mono font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200">
                          {matchedEmployee.emp_code}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-200 text-rose-900 border border-rose-300">
                        INACTIVE
                      </span>
                    </div>
                    <p className="text-xs font-bold text-rose-700">
                      ⚠️ This employee is marked as INACTIVE. Hardware assets cannot be assigned to inactive employees. Please activate the employee profile in Staff Directory before assigning.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-emerald-300 p-4 shadow-2xs space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-black text-slate-900">
                          {matchedEmployee.full_name}
                        </span>
                        <span className="text-[11px] font-mono font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          {matchedEmployee.emp_code}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {matchedEmployee.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 pt-1">
                      <div>
                        <span className="block text-[10px] uppercase text-slate-400 font-semibold">Designation</span>
                        <span className="font-bold text-slate-800 uppercase">{matchedEmployee.designation || 'NOT SPECIFIED'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-slate-400 font-semibold">Department</span>
                        <span className="font-bold text-slate-800">
                          {matchedEmployee.department?.name || departments.find((d) => d.id === matchedEmployee.department_id)?.name || 'Assigned'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-slate-400 font-semibold">Email</span>
                        <span className="text-slate-800 font-medium truncate block lowercase">{matchedEmployee.email || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-slate-400 font-semibold">Phone</span>
                        <span className="text-slate-800 font-medium">{matchedEmployee.phone || '—'}</span>
                      </div>
                    </div>
                  </div>
                )
              ) : empCodeQuery.trim() ? (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-3.5 text-xs text-amber-900 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">No employee profile found for code "{empCodeQuery.trim().toUpperCase()}".</span>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        This employee code is not registered in the system. You can create a new profile for this employee code below:
                      </p>
                    </div>
                  </div>

                  {/* UNHIDE the Add Employee button ONLY when employee does not exist in DB */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setNewEmpCode(empCodeQuery.trim().toUpperCase());
                        if (departmentId) setNewEmpDeptId(departmentId);
                        if (locationId) setNewEmpLocationId(locationId);
                        if (plantId) setNewEmpPlantId(plantId);
                        setEmpModalError(null);
                        setShowEmployeeModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Register New Profile for "{empCodeQuery.trim().toUpperCase()}"</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 bg-slate-100/70 border border-slate-200 p-3 rounded-xl flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Enter the Employee ID above to search and auto-verify employee profile from the database.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3.5 animate-in fade-in duration-150 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-xs font-black text-emerald-950 uppercase tracking-wider block">
                    In-House / Departmental Custody Active
                  </span>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Asset will be registered under shared custody of <strong>{selectedDeptName || 'Department'}</strong>. Individual employee assignment is bypassed.
                  </p>
                </div>
              </div>

              {/* Exact In-House Placement Location Input Field */}
              <div className="pt-3 border-t border-emerald-200/80 space-y-1.5">
                <label className="block text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Exact Placement Spot / Installed Location in Company *</span>
                </label>
                <input
                  type="text"
                  value={exactLocation}
                  onChange={handleCapsChange(setExactLocation)}
                  placeholder="e.g. GATE NO. 1 GUARD ROOM, SERVER ROOM RACK-03, MAIN RECEPTION, QUALITY LAB 2..."
                  className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 font-mono"
                />
                <p className="text-[10px] text-emerald-700 font-medium">
                  Type the specific room, pillar number, gate, rack, or floor location where this equipment is installed.
                </p>
              </div>

              {/* Department HOD details: HOD is emailed the asset details on registration */}
              <div className="pt-3 border-t border-emerald-200/80 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950 uppercase tracking-wider">
                  <Mail className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Department HOD Details (Email notification)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">Department Name</label>
                    <input
                      type="text"
                      value={inHouseDeptName || selectedDeptName}
                      onChange={handleCapsChange(setInHouseDeptName)}
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold uppercase focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">HOD Name</label>
                    <input
                      type="text"
                      value={hodName}
                      onChange={handleCapsChange(setHodName)}
                      placeholder="e.g. RAJESH KUMAR"
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold uppercase focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">HOD Employee ID</label>
                    <input
                      type="text"
                      value={hodEmpCode}
                      onChange={handleCapsChange(setHodEmpCode)}
                      placeholder="e.g. PGEL-1024"
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold uppercase font-mono focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 uppercase mb-1">HOD Email *</label>
                    <input
                      type="email"
                      value={hodEmail}
                      onChange={(e) => setHodEmail(e.target.value)}
                      placeholder="hod.name@pgel.in"
                      className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold lowercase focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-emerald-700 font-medium">
                  On registration, the HOD receives an email with this asset&apos;s tag, type, serial number and installed location.
                </p>
              </div>
            </div>
          )}

          {/* Section 3: Location, Plant & Placement */}
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              2. Physical Location, Plant &amp; Department Placement
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Asset Owning Department</label>
                <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 flex items-center justify-between shadow-2xs">
                  <span>{selectedDeptName || departments.find((d) => d.id === departmentId)?.name || 'General'}</span>
                  <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    Step 1 Selected
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Location *</label>
                {currentUser?.role !== 'it_admin' ? (
                  <div className="w-full bg-blue-50/60 border border-blue-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 flex items-center justify-between shadow-2xs">
                    <span>{locations.find((loc) => loc.id === locationId)?.name || 'Assigned Location'}</span>
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200">
                      Assigned
                    </span>
                  </div>
                ) : (
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Plant / Unit *</label>
                {currentUser?.role !== 'it_admin' ? (
                  <div className="w-full bg-blue-50/60 border border-blue-200/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 flex items-center justify-between shadow-2xs">
                    <span>{plants.find((plant) => plant.id === plantId)?.name || 'Assigned Plant'}</span>
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200">
                      Assigned
                    </span>
                  </div>
                ) : (
                  <select
                    value={plantId}
                    onChange={(e) => setPlantId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                  >
                    {plants.filter((p) => !locationId || p.location_id === locationId).map((plant) => (
                      <option key={plant.id} value={plant.id}>
                        {plant.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned / Handover Date</label>
                <input
                  type="date"
                  value={assignedDate}
                  onChange={(e) => setAssignedDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks / Assignment Notes</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Issued with corporate laptop bag, power brick, HDMI adapter..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setStep(2);
                scrollToTop();
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back: Details &amp; Specs</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? (searchParams.get('edit') ? 'Updating Asset...' : 'Registering Asset...') : (searchParams.get('edit') ? 'Update Asset Details' : 'Complete Registration & Save')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INLINE EMPLOYEE PROFILE CREATION MODAL                                    */}
      {/* ========================================================================= */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Create Employee Profile
                </h3>
                <p className="text-xs text-slate-500">
                  Add employee profile to directory matching enterprise HR records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEmployeeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {empModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {empModalError}
              </div>
            )}

            <form onSubmit={handleCreateEmployeeSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Employee ID (emp_code) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employee ID <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newEmpCode}
                    onChange={handleCapsChange(setNewEmpCode)}
                    placeholder="e.g. PGEL-9901 (optional)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white uppercase"
                  />
                </div>

                {/* 2. Full Name (full_name) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmpName}
                    onChange={handleCapsChange(setNewEmpName)}
                    placeholder="e.g. RAMESH KUMAR"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white uppercase font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 3. Email (email) - Stays normal case */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={newEmpEmail}
                    onChange={(e) => setNewEmpEmail(e.target.value)}
                    placeholder="ramesh.k@pgel.in"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white lowercase"
                  />
                </div>

                {/* 4. Phone (phone) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="tel"
                    value={newEmpPhone}
                    onChange={(e) => setNewEmpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                    placeholder="Enter 10-digit Mobile Number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* 5. Department (department_id) */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Department *
                  </label>
                  <select
                    value={newEmpDeptId}
                    onChange={(e) => setNewEmpDeptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Location (location_id) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Location *
                  </label>
                  <select
                    value={newEmpLocationId}
                    onChange={(e) => setNewEmpLocationId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 7. Plant (plant_id) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plant *
                  </label>
                  <select
                    value={newEmpPlantId}
                    onChange={(e) => setNewEmpPlantId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {plants.filter((p) => !newEmpLocationId || p.location_id === newEmpLocationId).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 8. Designation (designation) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={newEmpDesignation}
                    onChange={handleCapsChange(setNewEmpDesignation)}
                    placeholder="e.g. SENIOR PRODUCTION ENGINEER"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white uppercase"
                  />
                </div>

                {/* 9. Status (status) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employment Status *
                  </label>
                  <select
                    value={newEmpStatus}
                    onChange={(e) => setNewEmpStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEmployee}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingEmployee ? 'Saving Profile...' : 'Save & Assign Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Asset Batch Import Modal (Exclusive to IT Admin & Admins) */}
      {showImportModal && isAuthorizedForImport && (
        <SmartAssetImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          departmentName={selectedDeptName}
          departmentId={
            departmentId ||
            (departments.find((d) => d.name.toUpperCase() === selectedDeptName.toUpperCase())?.id || '')
          }
          locations={locations.length > 0 ? locations : SEED_LOCATIONS}
          plants={plants.length > 0 ? plants : SEED_PLANTS}
          departments={departments}
          onImportSuccess={(res) => {
            setSuccessToast(
              `Batch Import Committed! ${res.assets_created} assets imported (${res.assets_assigned} assigned, ${res.assets_in_stock} in stock). ${res.employees_created} new staff profiles provisioned.` +
                (res.skipped_rows?.length ? ` ${res.skipped_rows.length} row(s) skipped (duplicate serial / conflict).` : '')
            );
            setTimeout(() => setSuccessToast(null), 6000);
          }}
        />
      )}
    </div>
  );
}

export default function AssetWizardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500 font-semibold text-sm">Loading Asset Entry Wizard...</div>}>
      <AssetWizardContent />
    </Suspense>
  );
}
