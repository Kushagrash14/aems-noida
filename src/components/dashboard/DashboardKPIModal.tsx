'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  Search,
  Filter,
  RotateCcw,
  ExternalLink,
  Box,
  User,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Wrench,
  Building2,
  Factory,
  MapPin,
  ShieldAlert,
  HelpCircle,
  UserPlus,
  ArrowRightLeft,
  Check,
  RefreshCw,
  Clock,
  AlertCircle,
  IndianRupee,
  Server,
} from 'lucide-react';
import {
  Asset,
  Department,
  Plant,
  Location,
  Category,
  Employee,
  PMComplaint,
  DamageScrapReport,
} from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import DuplicateAssetTypeModal, { type DuplicateApprovalPayload, type DuplicateConflictInfo } from '@/components/assets/DuplicateAssetTypeModal';

export type KPIType = 'total' | 'cost' | 'assigned' | 'available' | 'maintenance' | 'damaged' | 'missing' | 'scrapped';

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

interface DashboardKPIModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiType: KPIType;
  assets: Asset[];
  onAssetUpdated?: (updatedAsset: Asset) => void;
  complaints?: PMComplaint[];
  damageReports?: DamageScrapReport[];
  departments: Department[];
  plants: Plant[];
  locations: Location[];
  categories?: Category[];
  customTitle?: string;
  customSubtitle?: string;
}

export default function DashboardKPIModal({
  isOpen,
  onClose,
  kpiType,
  assets,
  onAssetUpdated,
  complaints = [],
  damageReports = [],
  departments,
  plants,
  locations,
  categories = [],
  customTitle,
  customSubtitle,
}: DashboardKPIModalProps) {
  // Local assets state for instant optimistic updates
  const [localAssets, setLocalAssets] = useState<Asset[]>(assets);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Assignment Modal State
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [assignMode, setAssignMode] = useState<'employee' | 'in_house'>('employee');
  const [assignDeptId, setAssignDeptId] = useState('');
  const [assignExactLocation, setAssignExactLocation] = useState('');
  const [empCodeQuery, setEmpCodeQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [assignmentRemarks, setAssignmentRemarks] = useState('');
  const [assignHostname, setAssignHostname] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateConflictInfo | null>(null);

  // De-assignment Modal State
  const [deassigningAsset, setDeassigningAsset] = useState<Asset | null>(null);
  const [returnCondition, setReturnCondition] = useState('Good / Working');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [deassignLoading, setDeassignLoading] = useState(false);

  // Toast / Error messages
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // State for interactive filters
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedPlant, setSelectedPlant] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [catRefreshTrigger, setCatRefreshTrigger] = useState(0);

  // Sync props to local assets
  useEffect(() => {
    setLocalAssets(assets);
  }, [assets]);

  // Real-time listener for asset type updates from assets/new or other windows
  useEffect(() => {
    const handleUpdate = () => setCatRefreshTrigger((prev) => prev + 1);
    window.addEventListener('aems:category-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('aems:category-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Load employees list when modal opens
  useEffect(() => {
    if (isOpen && employees.length === 0) {
      fetch('/api/employees')
        .then((r) => r.json())
        .then((data) => {
          if (data.employees) setEmployees(data.employees);
        })
        .catch(() => {});
    }
  }, [isOpen, employees.length]);

  // Filter matched employees based on search query
  const matchedEmployees = useMemo(() => {
    const q = empCodeQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 5);
    return employees
      .filter(
        (e) =>
          e.emp_code.toLowerCase().includes(q) ||
          e.full_name.toLowerCase().includes(q) ||
          (e.email && e.email.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [employees, empCodeQuery]);

  const handleOpenAssignModal = (asset: Asset) => {
    setAssigningAsset(asset);
    setAssignMode('employee');
    setSelectedEmployee(null);
    setEmpCodeQuery('');
    setAssignDeptId(asset.current_department_id || '');
    setAssignExactLocation('');
    setAssignmentRemarks('');
    setAssignHostname(asset.hostname || '');
    setModalError(null);
  };

  const handleOpenDeassignModal = (asset: Asset) => {
    setDeassigningAsset(asset);
    setReturnCondition('Good / Working');
    setReturnRemarks('');
    setModalError(null);
  };

  const handleExecuteAssign = async (e?: React.FormEvent, duplicateApproval?: DuplicateApprovalPayload) => {
    e?.preventDefault();
    if (!assigningAsset) return;

    if (assignMode === 'employee' && !selectedEmployee) {
      setModalError('Please select an employee to assign this asset to.');
      return;
    }

    if (assignMode === 'in_house' && !assignExactLocation.trim()) {
      setModalError('Please enter the exact placement spot in company (e.g. GATE 1, SERVER ROOM).');
      return;
    }

    setAssignLoading(true);
    setModalError(null);

    try {
      const res = await fetch('/api/assets/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: assignMode,
          assetId: assigningAsset.id,
          employeeId: assignMode === 'employee' ? selectedEmployee?.id : undefined,
          departmentId: assignMode === 'in_house' ? (assignDeptId || undefined) : undefined,
          exactLocation: assignMode === 'in_house' ? assignExactLocation.trim() : undefined,
          remarks: assignmentRemarks.trim() || undefined,
          hostname: assignHostname.trim() ? assignHostname.trim().toUpperCase() : undefined,
          duplicateApproval: duplicateApproval || undefined,
        }),
      });

      const data = await res.json();
      if (res.status === 409 && data.conflict) {
        setDuplicateConflict(data.conflict as DuplicateConflictInfo);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Assignment failed');

      setLocalAssets((prev) =>
        prev.map((a) => (a.id === data.asset.id ? data.asset : a))
      );
      onAssetUpdated?.(data.asset);

      const successMsg =
        assignMode === 'employee'
          ? `Asset ${assigningAsset.asset_tag} successfully assigned to ${selectedEmployee?.full_name}!`
          : `Asset ${assigningAsset.asset_tag} successfully deployed for In-House usage!`;

      setToastMessage(successMsg);
      setTimeout(() => setToastMessage(null), 3500);
      setAssigningAsset(null);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to assign asset');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleExecuteDeassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deassigningAsset) return;

    setDeassignLoading(true);
    setModalError(null);

    try {
      const res = await fetch('/api/assets/deassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: deassigningAsset.id,
          returnCondition,
          remarks: returnRemarks.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'De-assignment failed');

      setLocalAssets((prev) =>
        prev.map((a) => (a.id === data.asset.id ? data.asset : a))
      );
      onAssetUpdated?.(data.asset);

      setToastMessage(
        `Asset ${deassigningAsset.asset_tag} returned to Available / Stock pool!`
      );
      setTimeout(() => setToastMessage(null), 3500);
      setDeassigningAsset(null);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to return asset to stock');
    } finally {
      setDeassignLoading(false);
    }
  };

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (assigningAsset) setAssigningAsset(null);
        else if (deassigningAsset) setDeassigningAsset(null);
        else onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, assigningAsset, deassigningAsset]);

  // Reset filters
  const handleResetFilters = () => {
    setSelectedDept('');
    setSelectedPlant('');
    setSelectedLocation('');
    setSelectedCategory('');
    setSearchQuery('');
  };

  const hasActiveFilters = Boolean(
    selectedDept || selectedPlant || selectedLocation || selectedCategory || searchQuery
  );

  // Metadata per KPI Type
  const baseMeta = useMemo(() => {
    switch (kpiType) {
      case 'cost':
        return {
          title: 'TOTAL COST OF ASSETS',
          subtitle: 'Cumulative purchasing cost and asset valuation breakdown',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: IndianRupee,
          iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        };
      case 'assigned':
        return {
          title: 'ASSIGNED / IN USE ASSETS',
          subtitle: 'Assets currently assigned and in active custody of employees',
          badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: User,
          iconColor: 'text-blue-600 bg-blue-50 border-blue-200',
        };
      case 'available':
        return {
          title: 'AVAILABLE / IN-HOUSE ASSETS',
          subtitle: 'Stock pool assets ready for assignment + assets deployed In-House (departmental use)',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2,
          iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        };
      case 'maintenance':
        return {
          title: 'MAINTENANCE & COMPLAINTS',
          subtitle: 'Assets and equipment currently logged under breakdown or maintenance',
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: AlertTriangle,
          iconColor: 'text-amber-600 bg-amber-50 border-amber-200',
        };
      case 'damaged':
        return {
          title: 'SCRAP & DAMAGED ASSETS',
          subtitle: 'Assets flagged with physical damage, in quarantine, or decommissioned / scrapped',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: Wrench,
          iconColor: 'text-rose-600 bg-rose-50 border-rose-200',
        };
      case 'missing':
        return {
          title: 'MISSING ASSETS',
          subtitle: 'Assets reported missing or untraceable awaiting review/recovery',
          badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: HelpCircle,
          iconColor: 'text-purple-600 bg-purple-50 border-purple-200',
        };
      case 'scrapped':
        return {
          title: 'SCRAPPED ASSETS',
          subtitle: 'Assets decommissioned, scrapped, or written off',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: Trash2,
          iconColor: 'text-rose-600 bg-rose-50 border-rose-200',
        };
      case 'total':
      default:
        return {
          title: 'TOTAL REGISTERED ASSETS',
          subtitle: 'Full catalog of physical, IT, and production assets',
          badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: Box,
          iconColor: 'text-blue-600 bg-blue-50 border-blue-200',
        };
    }
  }, [kpiType]);

  const kpiMeta = {
    ...baseMeta,
    title: customTitle || baseMeta.title,
    subtitle: customSubtitle || baseMeta.subtitle,
  };

  // Step 1: Filter assets by KPI card type using localAssets
  const baseAssets = useMemo(() => {
    switch (kpiType) {
      case 'cost':
        return localAssets.filter((a) => !a.is_deleted);
      case 'assigned':
        // Only assets that have an actual employee custodian
        return localAssets.filter(
          (a) => Boolean(a.assigned_employee_id || a.assigned_employee)
        );
      case 'available':
        // Stock Pool (in_storage) + In-House Active (in_service, no employee)
        return localAssets.filter(
          (a) =>
            !a.is_deleted &&
            (
              a.status === 'in_storage' ||
              (a.status === 'in_service' && !a.assigned_employee_id && !a.assigned_employee)
            )
        );
      case 'maintenance': {
        const openComplaintMachineIds = new Set(
          complaints
            .filter((c) => c.status === 'open' || c.status === 'in_progress')
            .map((c) => c.machine_id)
        );
        return localAssets.filter(
          (a) =>
            a.status === 'maintenance' ||
            openComplaintMachineIds.has(a.id) ||
            openComplaintMachineIds.has((a as { machine_id?: string }).machine_id || '')
        );
      }
      case 'damaged': {
        const activeDamagedIds = new Set(
          damageReports.filter((r) => (r.report_type === 'damaged' || r.report_type === 'scrap') && r.status !== 'resolved').map((r) => r.asset_id)
        );
        const approvedScrapAssetIds = new Set(
          damageReports.filter((r) => r.status === 'approved' || r.report_type === 'scrap').map((r) => r.asset_id)
        );
        return localAssets.filter(
          (a) =>
            !a.is_deleted &&
            (a.status === 'damaged' ||
             a.status === 'scrapped' ||
             activeDamagedIds.has(a.id) ||
             approvedScrapAssetIds.has(a.id))
        );
      }
      case 'missing': {
        const activeMissingIds = new Set(
          damageReports.filter((r) => r.report_type === 'missing' && r.status !== 'resolved').map((r) => r.asset_id)
        );
        return localAssets.filter((a) => !a.is_deleted && (a.status === 'missing' || activeMissingIds.has(a.id)));
      }
      case 'scrapped': {
        const approvedScrapAssetIds = new Set(
          damageReports.filter((r) => r.status === 'approved' || r.report_type === 'scrap').map((r) => r.asset_id)
        );
        return localAssets.filter(
          (a) => !a.is_deleted && (a.status === 'scrapped' || approvedScrapAssetIds.has(a.id))
        );
      }
      case 'total':
      default:
        return localAssets.filter((a) => !a.is_deleted);
    }
  }, [kpiType, localAssets, complaints, damageReports]);

  // Step 2: Apply user interactive filters & sorting
  const filteredAssets = useMemo(() => {
    // Resolve target location ID & Name
    const targetLoc = locations.find((l) => l.id === selectedLocation || l.name.toUpperCase() === selectedLocation.toUpperCase());
    const locId = targetLoc ? targetLoc.id : selectedLocation;
    const locName = targetLoc ? targetLoc.name.toLowerCase() : selectedLocation.toLowerCase();

    // Resolve target plant ID & Name
    const targetPlant = plants.find((p) => p.id === selectedPlant || p.name.toUpperCase() === selectedPlant.toUpperCase());
    const plantId = targetPlant ? targetPlant.id : selectedPlant;
    const plantName = targetPlant ? targetPlant.name.toLowerCase() : selectedPlant.toLowerCase();

    // Resolve target department ID & Name
    const targetDept = departments.find((d) => d.id === selectedDept || d.name.toUpperCase() === selectedDept.toUpperCase());
    const deptId = targetDept ? targetDept.id : selectedDept;
    const deptName = targetDept ? targetDept.name.toLowerCase() : selectedDept.toLowerCase();

    // Build category ID -> Name lookup map
    const categoryIdToNameMap = new Map<string, string>();
    categories.forEach((c) => {
      if (c.id && c.name) categoryIdToNameMap.set(c.id, c.name);
    });

    // Resolve target category ID & Name
    const targetCat = categories.find((c) => c.id === selectedCategory || c.name.toUpperCase() === selectedCategory.toUpperCase());
    const catId = targetCat ? targetCat.id : selectedCategory;

    const list = baseAssets.filter((asset) => {
      // 1. Department Filter
      if (selectedDept) {
        const aDeptId = asset.current_department_id || asset.department?.id || '';
        const aDeptName = (asset.department?.name || '').toLowerCase();
        const matchDept =
          (deptId && aDeptId === deptId) ||
          (deptName && aDeptName.includes(deptName)) ||
          (deptName && deptName.includes('it') && (aDeptName.includes('it') || aDeptName.includes('information technology')));
        if (!matchDept) return false;
      }

      // 2. Category / Asset Type Filter
      if (selectedCategory) {
        const selectedCatUpper = selectedCategory.trim().toUpperCase();
        if (selectedCatUpper) {
          const aCatId = asset.category_id || asset.category?.id || '';
          const joinedCatName = asset.category?.name?.toUpperCase() || '';
          const mappedCatName = (categoryIdToNameMap.get(asset.category_id) || '').toUpperCase();
          const assetName = (asset.name || '').toUpperCase();
          const assetModel = (asset.model || '').toUpperCase();
          const assetTag = (asset.asset_tag || '').toUpperCase();
          const itType = ((asset as { itAssetType?: string }).itAssetType || '').toUpperCase();

          // Collect all custom field values
          const customTexts: string[] = [];
          if (asset.custom_values) {
            if (Array.isArray(asset.custom_values)) {
              asset.custom_values.forEach((cv) => {
                if (typeof cv === 'object' && cv !== null) {
                  if (cv.field_value) customTexts.push(String(cv.field_value).toUpperCase());
                }
              });
            } else if (typeof asset.custom_values === 'object') {
              Object.values(asset.custom_values).forEach((val) => {
                if (val) customTexts.push(String(val).toUpperCase());
              });
            }
          }

          const allTexts = [joinedCatName, mappedCatName, assetName, assetModel, assetTag, itType, ...customTexts].join(' ');

          // Direct category ID match
          let matchCat = Boolean(catId && aCatId === catId);

          // Direct text match
          if (!matchCat && allTexts.includes(selectedCatUpper)) {
            matchCat = true;
          }

          // Synonym / Asset Subtype matching rules
          if (!matchCat) {
            if (selectedCatUpper.includes('LAPTOP')) {
              matchCat =
                allTexts.includes('LAPTOP') ||
                allTexts.includes('NOTEBOOK') ||
                allTexts.includes('LATITUDE') ||
                allTexts.includes('THINKPAD') ||
                allTexts.includes('MACBOOK') ||
                allTexts.includes('PROBOOK') ||
                allTexts.includes('ELITEBOOK') ||
                allTexts.includes('ZENBOOK') ||
                allTexts.includes('ASPIRE') ||
                assetTag.includes('-LPT-') ||
                assetTag.includes('-LAPTOP-');
            } else if (selectedCatUpper.includes('DESKTOP')) {
              matchCat =
                allTexts.includes('DESKTOP') ||
                allTexts.includes('WORKSTATION') ||
                allTexts.includes('TOWER') ||
                allTexts.includes('OPTIPLEX') ||
                allTexts.includes('THINKCENTRE') ||
                allTexts.includes('PRODESK') ||
                allTexts.includes('ALL-IN-ONE') ||
                allTexts.includes('AIO') ||
                assetTag.includes('-DSK-') ||
                assetTag.includes('-DESKTOP-');
            } else if (selectedCatUpper.includes('PRINTER') || selectedCatUpper.includes('SCANNER')) {
              matchCat =
                allTexts.includes('PRINTER') ||
                allTexts.includes('SCANNER') ||
                allTexts.includes('LASERJET') ||
                allTexts.includes('DESKJET') ||
                allTexts.includes('MFP') ||
                allTexts.includes('EPSON') ||
                allTexts.includes('CANON') ||
                assetTag.includes('-PRN-') ||
                assetTag.includes('-SCN-');
            } else if (selectedCatUpper.includes('SWITCH') || selectedCatUpper.includes('ROUTER')) {
              matchCat =
                allTexts.includes('SWITCH') ||
                allTexts.includes('ROUTER') ||
                allTexts.includes('GATEWAY') ||
                allTexts.includes('CISCO') ||
                allTexts.includes('TPLINK') ||
                allTexts.includes('D-LINK') ||
                allTexts.includes('MIKROTIK') ||
                assetTag.includes('-SWT-') ||
                assetTag.includes('-RTR-');
            } else if (selectedCatUpper.includes('SERVER')) {
              matchCat =
                allTexts.includes('SERVER') ||
                allTexts.includes('POWEREDGE') ||
                allTexts.includes('PROLIANT') ||
                assetTag.includes('-SRV-');
            } else if (selectedCatUpper.includes('CAMERA') || selectedCatUpper.includes('NVR') || selectedCatUpper.includes('CCTV')) {
              matchCat =
                allTexts.includes('CAMERA') ||
                allTexts.includes('NVR') ||
                allTexts.includes('DVR') ||
                allTexts.includes('CCTV') ||
                allTexts.includes('HIKVISION') ||
                allTexts.includes('CP PLUS') ||
                assetTag.includes('-CAM-') ||
                assetTag.includes('-NVR-');
            } else if (selectedCatUpper.includes('MONITOR')) {
              matchCat =
                allTexts.includes('MONITOR') ||
                allTexts.includes('DISPLAY') ||
                allTexts.includes('SCREEN') ||
                assetTag.includes('-MON-');
            } else if (selectedCatUpper.includes('UPS') || selectedCatUpper.includes('BACKUP')) {
              matchCat =
                allTexts.includes('UPS') ||
                allTexts.includes('INVERTER') ||
                allTexts.includes('APC') ||
                allTexts.includes('BACKUP') ||
                assetTag.includes('-UPS-');
            } else if (selectedCatUpper.includes('SOFTWARE') || selectedCatUpper.includes('LICENSE')) {
              matchCat =
                allTexts.includes('SOFTWARE') ||
                allTexts.includes('LICENSE') ||
                allTexts.includes('OFFICE 365') ||
                allTexts.includes('WINDOWS') ||
                allTexts.includes('ANTIVIRUS') ||
                assetTag.includes('-LIC-');
            } else {
              // Word token matching fallback
              const tokens = selectedCatUpper.split(/[\s\/\-_]+/).filter((t) => t.length > 2);
              if (tokens.length > 0) {
                matchCat = tokens.some((tok) => allTexts.includes(tok));
              }
            }
          }

          if (!matchCat) return false;
        }
      }

      // 3. Plant Filter
      if (selectedPlant) {
        const aPlantId = asset.current_plant_id || asset.plant?.id || '';
        const aPlantName = (asset.plant?.name || '').toLowerCase();
        const matchPlant =
          (plantId && aPlantId === plantId) ||
          (plantName && aPlantName.includes(plantName));
        if (!matchPlant) return false;
      }

      // 4. Location Filter
      if (selectedLocation) {
        const aLocId = asset.current_location_id || asset.location?.id || '';
        const aLocName = (asset.location?.name || '').toLowerCase();
        const matchLoc =
          (locId && aLocId === locId) ||
          (locName && aLocName.includes(locName));
        if (!matchLoc) return false;
      }

      // 5. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const tag = (asset.asset_tag || '').toLowerCase();
        const name = (asset.name || '').toLowerCase();
        const serial = (asset.serial_number || '').toLowerCase();
        const model = (asset.model || '').toLowerCase();
        const empName = (asset.assigned_employee?.full_name || '').toLowerCase();
        const empCode = (asset.assigned_employee?.emp_code || '').toLowerCase();

        const matches =
          tag.includes(q) ||
          name.includes(q) ||
          serial.includes(q) ||
          model.includes(q) ||
          empName.includes(q) ||
          empCode.includes(q);

        if (!matches) return false;
      }

      return true;
    });

    if (kpiType === 'cost') {
      list.sort((a, b) => {
        const costA = Number(a.purchase_cost) || 0;
        const costB = Number(b.purchase_cost) || 0;
        if (costA > 0 && costB <= 0) return -1;
        if (costA <= 0 && costB > 0) return 1;
        return costB - costA;
      });
    }

    return list;
  }, [baseAssets, selectedDept, selectedCategory, selectedPlant, selectedLocation, searchQuery, kpiType, locations, plants, departments, categories]);

  // Combine unique department options from departments + categories
  // Combine unique department options from departments
  const departmentOptions = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    departments.forEach((d) => {
      const cleanName = d.name.trim();
      if (cleanName && !seen.has(cleanName.toLowerCase())) {
        seen.add(cleanName.toLowerCase());
        list.push({ id: d.id, name: cleanName });
      }
    });

    return list;
  }, [departments]);

  // Dynamically compute category / asset type options (cascaded by department if selected)
  const categoryOptions = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    const deptNameSet = new Set(departments.map((d) => d.name.trim().toUpperCase()));

    const addCategory = (id: string, catName: string) => {
      const clean = catName.trim().toUpperCase();
      if (!clean) return;
      // Filter out if name matches a department name
      if (deptNameSet.has(clean)) return;

      if (!seen.has(clean)) {
        seen.add(clean);
        list.push({ id, name: clean });
      }
    };

    // Find selected department name if active
    let targetDeptName = '';
    if (selectedDept) {
      const matched = departments.find(
        (d) => d.id === selectedDept || d.name.toUpperCase() === selectedDept.toUpperCase()
      );
      targetDeptName = matched ? matched.name.toUpperCase() : selectedDept.toUpperCase();
    }

    // 1. If a department is selected:
    if (targetDeptName) {
      let deptCats: string[] = [];
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`aems_dept_cats_${targetDeptName}`);
          if (stored) {
            deptCats = JSON.parse(stored);
          }
        } catch {}
      }

      // If no custom storage found for this dept, use clean standard defaults
      if (!deptCats || deptCats.length === 0) {
        deptCats = DEFAULT_DEPT_CATEGORIES[targetDeptName] || [];
      }

      // Add the configured types for this department
      deptCats.forEach((cat) => addCategory(cat, cat));

      // Dynamically add any asset type actually present on assets belonging to this department
      // This ensures whenever a user adds assets, their exact names update automatically
      baseAssets.forEach((a) => {
        const aDeptName = a.department?.name?.toUpperCase() || '';
        const aDeptId = a.current_department_id || a.department?.id || '';
        const belongsToDept =
          aDeptId === selectedDept ||
          aDeptName === targetDeptName ||
          (targetDeptName.includes('IT') && (aDeptName.includes('IT') || aDeptName.includes('INFORMATION')));

        if (belongsToDept) {
          const catName =
            a.category?.name ||
            (a.category_id && categories.find((c) => c.id === a.category_id)?.name);
          if (catName) {
            addCategory(a.category_id || catName, catName);
          }
        }
      });
    } else {
      // 2. When ALL DEPARTMENTS is selected:
      // Include configured types across all known departments
      const allDepts = Array.from(
        new Set([
          ...departments.map((d) => d.name.toUpperCase()),
          ...Object.keys(DEFAULT_DEPT_CATEGORIES),
        ])
      );

      allDepts.forEach((deptKey) => {
        let catsForDept: string[] = [];
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem(`aems_dept_cats_${deptKey}`);
            if (stored) catsForDept = JSON.parse(stored);
          } catch {}
        }
        if (!catsForDept || catsForDept.length === 0) {
          catsForDept = DEFAULT_DEPT_CATEGORIES[deptKey] || [];
        }
        catsForDept.forEach((cat) => addCategory(cat, cat));
      });

      // Also check any custom departments in localStorage
      if (typeof window !== 'undefined') {
        try {
          const customDeptsStr = localStorage.getItem('aems_custom_dept_list');
          if (customDeptsStr) {
            const customDepts: string[] = JSON.parse(customDeptsStr);
            customDepts.forEach((cDept) => {
              const stored = localStorage.getItem(`aems_dept_cats_${cDept}`);
              if (stored) {
                const parsed: string[] = JSON.parse(stored);
                parsed.forEach((cat) => addCategory(cat, cat));
              }
            });
          }
        } catch {}
      }

      // Add all asset types present on all registered assets
      baseAssets.forEach((a) => {
        const catName =
          a.category?.name ||
          (a.category_id && categories.find((c) => c.id === a.category_id)?.name);
        if (catName) {
          addCategory(a.category_id || catName, catName);
        }
      });

      // Add active categories from DB categories list
      categories.forEach((c) => {
        if (c.name) addCategory(c.id, c.name);
      });
    }

    return list;
  }, [categories, baseAssets, selectedDept, departments, isOpen, catRefreshTrigger]);

  const filteredTotalCost = useMemo(() => {
    return filteredAssets.reduce((sum, a) => sum + (Number(a.purchase_cost) || 0), 0);
  }, [filteredAssets]);

  if (!isOpen) return null;

  const IconComponent = kpiMeta.icon;

  return (
    <div
      className="fixed top-14 inset-x-0 bottom-0 z-40 flex items-start sm:items-center justify-center p-2 sm:p-3.5 bg-slate-900/40 backdrop-blur-xs antialiased animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      {/* Modal Card */}
      <div
        className="bg-white w-full max-w-5xl my-auto max-h-[calc(100vh-4.5rem)] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================================================================= */}
        {/* MODAL HEADER: Title, Count Badge, Valuation, Close Button          */}
        {/* ================================================================= */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-2xs ${kpiMeta.iconColor}`}
            >
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  {kpiMeta.title}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide border uppercase ${kpiMeta.badgeColor}`}
                >
                  {filteredAssets.length} {filteredAssets.length === 1 ? 'Asset' : 'Assets'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wide border uppercase bg-emerald-50 text-emerald-700 border-emerald-200">
                  Valuation: {formatCurrency(filteredTotalCost)}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 line-clamp-1">
                {kpiMeta.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors cursor-pointer"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* FILTER BAR: Department wise, Plant wise, Location wise & Search   */}
        {/* ================================================================= */}
        <div className="p-3 sm:p-3.5 bg-slate-50/90 border-b border-slate-200 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Filter Assets</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* 1. Location Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <select
                value={selectedLocation}
                onChange={(e) => {
                  const locId = e.target.value;
                  setSelectedLocation(locId);
                  if (locId) {
                    const plantBelongs = plants.some((p) => p.id === selectedPlant && p.location_id === locId);
                    if (!plantBelongs) setSelectedPlant('');
                  }
                }}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="">📍 All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Plant Filter (Cascading based on Location) */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Factory className="w-3.5 h-3.5" />
              </div>
              <select
                value={selectedPlant}
                onChange={(e) => setSelectedPlant(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="">🏭 All Plants</option>
                {(selectedLocation ? plants.filter((p) => p.location_id === selectedLocation) : plants).map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Department Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <select
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setSelectedCategory('');
                }}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="">🏢 All Departments</option>
                {departmentOptions.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Asset Type Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Box className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="">📦 All Asset Types</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Text Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tag, serial, staff..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Active:</span>
              {selectedDept && (
                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold">
                  Dept: {departmentOptions.find((d) => d.id === selectedDept)?.name || selectedDept}
                  <button
                    type="button"
                    onClick={() => setSelectedDept('')}
                    className="hover:text-blue-900 cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                  Type: {categoryOptions.find((c) => c.id === selectedCategory)?.name || selectedCategory}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className="hover:text-emerald-900 cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedPlant && (
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-bold">
                  Plant: {plants.find((p) => p.id === selectedPlant)?.name || selectedPlant}
                  <button
                    type="button"
                    onClick={() => setSelectedPlant('')}
                    className="hover:text-purple-900 cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedLocation && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                  Location: {locations.find((l) => l.id === selectedLocation)?.name || selectedLocation}
                  <button
                    type="button"
                    onClick={() => setSelectedLocation('')}
                    className="hover:text-amber-900 cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-800 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                  Query: &ldquo;{searchQuery}&rdquo;
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="hover:text-slate-900 cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* MODAL BODY: Filtered Asset List Table                              */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-[160px]">
          {filteredAssets.length > 0 ? (
            <div className="overflow-x-auto min-w-[700px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">Asset Code &amp; Name</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Plant &amp; Location</th>
                    <th className="px-4 py-3">Assigned Custodian</th>
                    <th className="px-4 py-3">Purchase Cost</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredAssets.map((asset) => {
                    const hasEmp = Boolean(asset.assigned_employee_id || asset.assigned_employee);
                    const isInHouse = asset.status === 'in_service' && !hasEmp;
                    const isStock = asset.status === 'in_storage';
                    const deptName =
                      asset.department?.name || asset.category?.name || 'General';

                    return (
                      <tr
                        key={asset.id}
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                        onClick={() => {
                          window.location.href = `/assets/${asset.id}`;
                        }}
                      >
                        {/* Asset Tag & Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 group-hover:border-blue-300 group-hover:text-blue-600 transition-colors">
                              {asset.asset_tag}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              #{asset.id.slice(0, 4).toUpperCase()}
                            </span>
                          </div>
                          <div className="font-bold text-slate-800 mt-1 line-clamp-1">
                            {asset.name}
                          </div>
                          {asset.serial_number && (
                            <div className="text-[10px] font-mono text-slate-400">
                              SN: {asset.serial_number}
                            </div>
                          )}
                          {asset.hostname && (
                            <div className="text-[10px] font-mono font-bold text-blue-600 flex items-center gap-1 mt-0.5">
                              <Server className="w-2.5 h-2.5 shrink-0" />
                              <span>HOST: {asset.hostname}</span>
                            </div>
                          )}
                        </td>

                        {/* Department */}
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200 uppercase">
                            {deptName}
                          </span>
                        </td>

                        {/* Plant & Location */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800 text-[11px]">
                            {asset.plant?.name || 'Assembly Plant'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {asset.location?.name || 'Main Location'}
                          </div>
                        </td>

                        {/* Assigned Custodian */}
                        <td className="px-4 py-3">
                          {asset.assigned_employee ? (
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1">
                                <User className="w-3 h-3 text-blue-600" />
                                <span>{asset.assigned_employee.full_name}</span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">
                                {asset.assigned_employee.emp_code}
                              </span>
                            </div>
                          ) : asset.status === 'scrapped' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 uppercase">
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>Scrapped</span>
                            </span>
                          ) : asset.status === 'damaged' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-orange-800 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 uppercase">
                              <Wrench className="w-3 h-3 text-orange-600" />
                              <span>Damaged</span>
                            </span>
                          ) : asset.status === 'missing' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                              <ShieldAlert className="w-3 h-3 text-amber-600" />
                              <span>Missing</span>
                            </span>
                          ) : isInHouse ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                                <Building2 className="w-3 h-3 text-emerald-600" />
                                <span>In-House Active</span>
                              </span>
                              <div className="text-[10px] font-bold text-slate-600">
                                {deptName}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                              <CheckCircle2 className="w-3 h-3 text-amber-600" />
                              <span>In Stock</span>
                            </span>
                          )}
                        </td>

                        {/* Purchase Cost */}
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {formatCurrency(asset.purchase_cost)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                              asset.status === 'scrapped' || asset.status === 'damaged'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : asset.status === 'maintenance'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : isInHouse
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                                : isStock
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {isInHouse
                              ? 'IN-HOUSE ACTIVE'
                              : asset.status === 'in_service'
                              ? 'IN USE'
                              : asset.status === 'in_storage'
                              ? 'AVAILABLE IN STOCK'
                              : asset.status.toUpperCase()}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {isStock ? (
                              <button
                                type="button"
                                onClick={() => handleOpenAssignModal(asset)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer"
                                title="Assign to Employee (Direct Handover)"
                              >
                                <UserPlus className="w-3 h-3" />
                                <span>Assign To</span>
                              </button>
                            ) : asset.assigned_employee ? (
                              <button
                                type="button"
                                onClick={() => handleOpenDeassignModal(asset)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[11px] transition-all cursor-pointer"
                                title="De-assign asset and return to Available / Stock pool"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-amber-600" />
                                <span>De-assign</span>
                              </button>
                            ) : null}

                            <Link
                              href={`/assets/${asset.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 transition-all font-bold text-[11px] cursor-pointer"
                            >
                              <span>View</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">
                  No Assets Found Matching Filters
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try adjusting the department, plant, location, or search keyword above to view
                  matching assets.
                </p>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* MODAL FOOTER: Summary & Close                                     */}
        {/* ================================================================= */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-500 shrink-0">
          <div>
            Showing <span className="text-slate-900 font-bold">{filteredAssets.length}</span> of{' '}
            <span className="text-slate-900 font-bold">{baseAssets.length}</span> {kpiMeta.title.toLowerCase()}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Toast message in modal */}
      {duplicateConflict && (
        <DuplicateAssetTypeModal
          conflict={duplicateConflict}
          employeeLabel={selectedEmployee ? `${selectedEmployee.full_name} (${selectedEmployee.emp_code})` : undefined}
          assetContext={{ assetId: assigningAsset?.id }}
          onClose={() => setDuplicateConflict(null)}
          onDeassigned={() => {
            setDuplicateConflict(null);
            handleExecuteAssign();
          }}
          onApproved={(approval) => {
            setDuplicateConflict(null);
            handleExecuteAssign(undefined, approval);
          }}
        />
      )}

      {toastMessage && (
        <div className="fixed top-6 right-6 z-[70] flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold shadow-xl animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-MODAL: ASSIGN ASSET (EMPLOYEE OR IN-HOUSE)                     */}
      {/* =================================================================== */}
      {assigningAsset && (
        <div
          className="fixed top-14 inset-x-0 bottom-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
          onClick={() => setAssigningAsset(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-4 sm:p-6 space-y-3.5 my-auto max-h-[calc(100vh-5rem)] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    {assignMode === 'employee' ? 'Assign Asset to Employee' : 'Deploy Asset In-House'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allocate <span className="font-mono font-bold text-blue-600">{assigningAsset.asset_tag}</span> ({assigningAsset.name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningAsset(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode selection tabs */}
            <div className="flex border-b border-slate-200 gap-2">
              <button
                type="button"
                onClick={() => setAssignMode('employee')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  assignMode === 'employee'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Employee Custody</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('in_house')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  assignMode === 'in_house'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>In-House / Departmental Usage</span>
              </button>
            </div>

            {modalError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-medium">{modalError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteAssign} className="space-y-4">
              {assignMode === 'employee' ? (
                /* Employee Mode */
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employee ID Verification &amp; Auto-Lookup *
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={empCodeQuery}
                      onChange={(e) => {
                        setEmpCodeQuery(e.target.value.toUpperCase());
                        setSelectedEmployee(null);
                      }}
                      placeholder="Enter Employee ID (e.g. PGEL-001, EMP-101)..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-500 focus:bg-white uppercase"
                    />
                  </div>

                  {matchedEmployees.length > 0 && !selectedEmployee && (
                    <div className="mt-2 border border-slate-200 rounded-xl bg-slate-50 max-h-40 overflow-y-auto divide-y divide-slate-100">
                      {matchedEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setEmpCodeQuery(emp.emp_code);
                          }}
                          className="w-full text-left p-2.5 hover:bg-blue-50/70 transition-colors flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{emp.full_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {emp.emp_code} • {emp.designation || 'Staff'}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            Select
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedEmployee && (
                    <div className="mt-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs font-black text-slate-900">{selectedEmployee.full_name}</span>
                          <span className="text-[10px] font-mono font-bold bg-white text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                            {selectedEmployee.emp_code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {selectedEmployee.designation || 'Designation N/A'} • {selectedEmployee.department?.name || 'Assigned Department'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployee(null);
                          setEmpCodeQuery('');
                        }}
                        className="text-[11px] font-bold text-slate-400 hover:text-rose-600 underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* In-House Mode */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Assigned Department (Optional)
                    </label>
                    <select
                      value={assignDeptId}
                      onChange={(e) => setAssignDeptId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white"
                    >
                      <option value="">Select Department (Default: Asset Dept)</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Exact Placement Spot in Company *
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={assignExactLocation}
                        onChange={(e) => setAssignExactLocation(e.target.value.toUpperCase())}
                        placeholder="e.g. GATE 1 RECEPTION, SERVER ROOM RACK 2, QUALITY LAB..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white uppercase"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Specify exact location where this camera/printer/server/switch is installed.
                    </p>
                  </div>
                </div>
              )}

              {/* System Hostname (For Laptop, Desktop, Server, Workstations) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-600" />
                    <span>System Hostname / Computer Name</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (Laptops, Desktops, Servers)
                  </span>
                </label>
                <input
                  type="text"
                  value={assignHostname}
                  onChange={(e) => setAssignHostname(e.target.value.toUpperCase())}
                  placeholder="e.g. PG-LAP-0482, SRV-DB-01, DESK-HR-02"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white uppercase"
                />
              </div>

              {/* Handover Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deployment / Handover Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={assignmentRemarks}
                  onChange={(e) => setAssignmentRemarks(e.target.value)}
                  placeholder={assignMode === 'employee' ? "e.g. Assigned with laptop bag, 65W charger" : "e.g. Installed for security monitoring at Gate 1"}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningAsset(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading || (assignMode === 'employee' ? !selectedEmployee : !assignExactLocation.trim())}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {assignLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{assignLoading ? 'Deploying...' : assignMode === 'employee' ? 'Confirm Employee Assignment' : 'Confirm In-House Deployment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-MODAL: DE-ASSIGN ASSET & RETURN TO STOCK POOL                   */}
      {/* =================================================================== */}
      {deassigningAsset && (
        <div
          className="fixed top-14 inset-x-0 bottom-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
          onClick={() => setDeassigningAsset(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 space-y-3.5 my-auto max-h-[calc(100vh-5rem)] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Return Asset to Available / Stock
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  De-assign <span className="font-mono font-bold text-blue-600">{deassigningAsset.asset_tag}</span> ({deassigningAsset.name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeassigningAsset(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-medium">{modalError}</span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Current Custodian:</span>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-900 text-sm">
                  {deassigningAsset.assigned_employee?.full_name || 'Assigned Staff'}
                </span>
                <span className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                  {deassigningAsset.assigned_employee?.emp_code}
                </span>
              </div>
            </div>

            <form onSubmit={handleExecuteDeassign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Return Condition *
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                >
                  <option value="Good / Working">Good / Fully Working</option>
                  <option value="Minor Wear &amp; Tear">Minor Wear &amp; Tear</option>
                  <option value="Requires Maintenance">Requires Maintenance / Service</option>
                  <option value="Damaged">Damaged / Defective</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Return Notes &amp; Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="e.g. Employee transferred or resigned, equipment cleaned and verified into stock pool"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeassigningAsset(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deassignLoading}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {deassignLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{deassignLoading ? 'Processing...' : 'Confirm De-assignment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
