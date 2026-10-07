'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Asset, Category, Department, Location, Plant, User } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { getAssetPreviewImage } from '@/lib/assetVisuals';
import {
  Search,
  Filter,
  ArrowRightLeft,
  Trash2,
  Eye,
  Building2,
  Factory,
  MapPin,
  Laptop,
  Monitor,
  Keyboard,
  Printer,
  Network,
  RotateCcw,
  ShieldAlert,
  Download,
  RefreshCw,
  CheckCircle2,
  User as UserIcon,
  SlidersHorizontal,
  Layers,
  Wrench,
  Cog,
  ShieldCheck,
  Truck,
  ChevronDown,
  X,
  Plus,
} from 'lucide-react';

function AssetsDirectoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Primary Data
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Master Filter Open/Close State (Auto-close on scroll or mouse leave)
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterContainerRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const newAssetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleNewAssetBtnClick = () => {
    if (newAssetTimerRef.current) {
      clearTimeout(newAssetTimerRef.current);
      newAssetTimerRef.current = null;
      router.push('/assets/new?mode=stock');
    } else {
      newAssetTimerRef.current = setTimeout(() => {
        newAssetTimerRef.current = null;
        router.push('/assets/new');
      }, 250);
    }
  };

  // Master Filter State (Location -> Plant -> Department -> Category Type -> Status -> Search)
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedPlant, setSelectedPlant] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedCategoryType, setSelectedCategoryType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync Master Filters from URL Search Parameters (e.g. from Sidebar department links or Navbar plant selector)
  useEffect(() => {
    const deptParam = searchParams.get('deptId') || searchParams.get('department') || '';
    setSelectedDepartment(deptParam);
    const locParam = searchParams.get('locationId') || searchParams.get('location') || '';
    setSelectedLocation(locParam);
    const plantParam = searchParams.get('plantId') || searchParams.get('plant') || '';
    setSelectedPlant(plantParam);
    const statusParam = searchParams.get('status') || '';
    if (statusParam) setSelectedStatus(statusParam);
    const searchParam = searchParams.get('search') || '';
    if (searchParam) setSearchQuery(searchParam);
  }, [searchParams]);

  // Transfer modal state
  const [transferringAsset, setTransferringAsset] = useState<Asset | null>(null);
  const [toDepartmentId, setToDepartmentId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // Soft Delete modal state
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Auto-close filter on screen scroll
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleScroll = () => {
      setIsFilterOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isFilterOpen]);

  // Click outside to close filter popover
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  // Handle mouse enter & leave for auto-close when cursor moves away
  const handleFilterMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleFilterMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsFilterOpen(false);
    }, 450);
  };

  // Load all lookups and assets
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [lookupsRes, assetsRes, meRes] = await Promise.all([
        fetch('/api/lookups'),
        fetch('/api/assets'),
        fetch('/api/auth/me').catch(() => null),
      ]);

      if (lookupsRes.ok) {
        const d = await lookupsRes.json();
        setLocations(d.locations || []);
        setPlants(d.plants || []);
        setDepartments(d.departments || []);
        setCategories(d.categories || []);
      }

      if (assetsRes.ok) {
        const d = await assetsRes.json();
        setAssets(d.assets || []);
      }

      if (meRes && meRes.ok) {
        const d = await meRes.json();
        if (d.user) setCurrentUser(d.user);
      }
    } catch (err) {
      console.error('Failed to load asset directory:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Set default target department for transfer modal
  useEffect(() => {
    if (departments.length > 0 && !toDepartmentId) {
      setToDepartmentId(departments[0].id);
    }
  }, [departments, toDepartmentId]);

  // Cascading Hierarchy Handlers: Location -> Plant -> Department -> Category
  const handleLocationChange = (locId: string) => {
    setSelectedLocation(locId);
    setSelectedPlant('');
    setSelectedDepartment('');
    setSelectedCategoryType('ALL');
  };

  const handlePlantChange = (plantId: string) => {
    setSelectedPlant(plantId);
    setSelectedDepartment('');
    setSelectedCategoryType('ALL');
  };

  const handleDepartmentChange = (deptId: string) => {
    setSelectedDepartment(deptId);
    setSelectedCategoryType('ALL');
  };

  // Available plants based on selected location
  const filteredPlants = useMemo(() => {
    if (!selectedLocation) return plants;
    return plants.filter((p) => p.location_id === selectedLocation);
  }, [plants, selectedLocation]);

  // Available departments based on selected Plant & Location (Strict Hierarchy)
  const filteredDepartments = useMemo(() => {
    if (selectedPlant) {
      return departments.filter((d) => !d.plant_id || d.plant_id === selectedPlant);
    }
    if (selectedLocation) {
      const locPlantIds = plants.filter((p) => p.location_id === selectedLocation).map((p) => p.id);
      return departments.filter((d) => !d.plant_id || locPlantIds.includes(d.plant_id));
    }
    return departments;
  }, [departments, plants, selectedLocation, selectedPlant]);

const DEFAULT_DEPT_CATEGORIES: Record<string, string[]> = {
  'INFORMATION TECHNOLOGY': [
    'LAPTOP',
    'DESKTOP',
    'SERVER',
    'SOFTWARE LICENSE',
    'MONITOR',
    'CAMERA',
    'PRINTER',
    'NETWORK',
  ],
  'DISPATCH': [
    'BARCODE SCANNER',
    'LABEL PRINTER',
    'PACKAGING CONVEYOR',
    'WEIGHING SCALE',
    'HAND PALLET TRUCK',
    'STRAPPING MACHINE',
  ],
  'QUALITY': [
    'CALIBRATED GAUGE',
    'SPECTROMETER',
    'TESTING JIG',
    'VERNIER CALIPER',
    'MICROMETER',
    '3D CMM MACHINE',
  ],
  'QUALITY ASSURANCE': [
    'CALIBRATED GAUGE',
    'SPECTROMETER',
    'TESTING JIG',
    'VERNIER CALIPER',
    'MICROMETER',
    '3D CMM MACHINE',
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
};

  // Reactive version tracker for category updates across tabs/modals
  const [categoryVersion, setCategoryVersion] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setCategoryVersion((v) => v + 1);
    window.addEventListener('aems:category-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('aems:category-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Dynamic Asset Types for the selected Department
  const departmentAssetTypes = useMemo(() => {
    if (!selectedDepartment) {
      const types = new Set<string>();
      ['LAPTOP', 'DESKTOP', 'MONITOR', 'PRINTER'].forEach((t) => types.add(t));
      assets.forEach((a) => {
        if (a.category?.name) types.add(a.category.name.toUpperCase());
      });
      return Array.from(types);
    }

    const dept = departments.find((d) => d.id === selectedDepartment);
    const cleanDept = dept ? dept.name.toUpperCase().trim() : '';

    // 1. Read dynamically updated categories from localStorage (added in entry form)
    let localCats: string[] = [];
    try {
      const stored = localStorage.getItem(`aems_dept_cats_${cleanDept}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) localCats = parsed;
      }
    } catch {}

    // 2. Read from default dept categories
    const matchedKey = Object.keys(DEFAULT_DEPT_CATEGORIES).find(
      (k) => k === cleanDept || cleanDept.includes(k) || k.includes(cleanDept)
    );
    const defaultCats = matchedKey ? DEFAULT_DEPT_CATEGORIES[matchedKey] : [];

    // 3. Read from actual assets that belong to this department
    const assetCats: string[] = [];
    assets.forEach((a) => {
      const matches =
        a.current_department_id === selectedDepartment ||
        a.department?.id === selectedDepartment ||
        (a.department?.name && a.department.name.toUpperCase() === cleanDept);
      if (matches && a.category?.name) {
        assetCats.push(a.category.name.toUpperCase());
      }
    });

    const combined = Array.from(
      new Set([
        ...localCats.map((s) => s.toUpperCase()),
        ...defaultCats.map((s) => s.toUpperCase()),
        ...assetCats,
      ])
    ).filter(
      (cat) =>
        cat !== cleanDept &&
        cat !== 'ALL' &&
        cat.length > 0
    );

    return combined.length > 0 ? combined : ['EQUIPMENT'];
  }, [selectedDepartment, departments, assets, categoryVersion]);

  const matchesCategoryType = (asset: Asset, type: string): boolean => {
    if (!type || type === 'ALL') return true;
    const t = type.toLowerCase().trim();
    const catName = (asset.category?.name || '').toLowerCase().trim();
    if (catName && (catName === t || catName.includes(t) || t.includes(catName))) return true;

    const name = (asset.name || '').toLowerCase();
    const model = (asset.model || '').toLowerCase();
    const tag = (asset.asset_tag || '').toUpperCase();
    const custom = (asset.custom_values || {}) as Record<string, string>;
    const itType = String(custom.it_asset_type || custom.device_type || '').toLowerCase();

    if (t === 'laptop') {
      return (
        itType.includes('laptop') ||
        tag.includes('-LPT-') ||
        name.includes('laptop') ||
        name.includes('thinkpad') ||
        name.includes('latitude') ||
        name.includes('macbook') ||
        name.includes('notebook') ||
        model.includes('laptop') ||
        model.includes('thinkpad') ||
        model.includes('latitude')
      );
    }

    if (t === 'desktop') {
      return (
        itType.includes('desktop') ||
        tag.includes('-DSK-') ||
        name.includes('desktop') ||
        name.includes('optiplex') ||
        name.includes('workstation') ||
        name.includes('tower') ||
        model.includes('desktop') ||
        model.includes('optiplex')
      );
    }

    return name.includes(t) || model.includes(t) || itType.includes(t);
  };

  // Helper to infer badge label for an asset
  const getAssetTypeBadge = (asset: Asset) => {
    if (matchesCategoryType(asset, 'laptop')) return 'Laptop';
    if (matchesCategoryType(asset, 'desktop')) return 'Desktop';
    if (matchesCategoryType(asset, 'input/output')) return 'I/O Device';
    if (matchesCategoryType(asset, 'printer')) return 'Printer';
    if (matchesCategoryType(asset, 'network')) return 'Network';
    return asset.category?.name || 'Equipment';
  };

  // Filtered Assets Pipeline
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // 1. Location Filter
      if (selectedLocation) {
        const matchesLoc =
          asset.current_location_id === selectedLocation ||
          asset.location?.id === selectedLocation ||
          asset.location?.name === selectedLocation;
        if (!matchesLoc) return false;
      }

      // 2. Plant Filter
      if (selectedPlant) {
        const matchesPlt =
          asset.current_plant_id === selectedPlant ||
          asset.plant?.id === selectedPlant ||
          asset.plant?.name === selectedPlant;
        if (!matchesPlt) return false;
      }

      // 3. Department Filter (Strictly by Asset's Assigned Department)
      if (selectedDepartment) {
        const matchesDept =
          asset.current_department_id === selectedDepartment ||
          asset.department?.id === selectedDepartment ||
          (asset.department?.name &&
            asset.department.name.toLowerCase() === selectedDepartment.toLowerCase());
        if (!matchesDept) return false;
      }

      // 4. Category Type Filter
      if (selectedCategoryType && selectedCategoryType !== 'ALL') {
        if (!matchesCategoryType(asset, selectedCategoryType)) {
          return false;
        }
      }

      // 5. Status Filter
      if (selectedStatus && selectedStatus !== 'ALL') {
        const hasEmp = Boolean(asset.assigned_employee_id || asset.assigned_employee);
        const isInHouse = asset.status === 'in_service' && !hasEmp;
        const isAssigned = asset.status === 'in_service' && hasEmp;
        const isStock = asset.status === 'in_storage';

        if (selectedStatus === 'IN_HOUSE' && !isInHouse) {
          return false;
        }
        if (selectedStatus === 'IN_USE' && !isAssigned) {
          return false;
        }
        if (selectedStatus === 'AVAILABLE' && !isStock) {
          return false;
        }
        if (selectedStatus === 'MAINTENANCE' && asset.status !== 'maintenance') {
          return false;
        }
        if (
          selectedStatus === 'SCRAPPED' &&
          asset.status !== 'scrapped' &&
          asset.status !== 'damaged'
        ) {
          return false;
        }
      }

      // 6. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const tag = (asset.asset_tag || '').toLowerCase();
        const sap = (asset.sap_asset_code || '').toLowerCase();
        const invoice = (asset.invoice_number || '').toLowerCase();
        const name = (asset.name || '').toLowerCase();
        const serial = (asset.serial_number || '').toLowerCase();
        const model = (asset.model || '').toLowerCase();
        const staff = (asset.assigned_employee?.full_name || '').toLowerCase();
        const empCode = (asset.assigned_employee?.emp_code || '').toLowerCase();
        const po = (asset.po_number || '').toLowerCase();
        const vendor = (asset.vendor_name || '').toLowerCase();

        const hit =
          tag.includes(q) ||
          sap.includes(q) ||
          invoice.includes(q) ||
          name.includes(q) ||
          serial.includes(q) ||
          model.includes(q) ||
          staff.includes(q) ||
          empCode.includes(q) ||
          po.includes(q) ||
          vendor.includes(q);

        if (!hit) return false;
      }

      return true;
    });
  }, [
    assets,
    selectedLocation,
    selectedPlant,
    selectedDepartment,
    selectedCategoryType,
    selectedStatus,
    searchQuery,
  ]);

  const activeFiltersCount = [
    Boolean(selectedLocation),
    Boolean(selectedPlant),
    Boolean(selectedDepartment),
    Boolean(selectedCategoryType && selectedCategoryType !== 'ALL'),
    Boolean(selectedStatus && selectedStatus !== 'ALL'),
    Boolean(searchQuery.trim()),
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedLocation('');
    setSelectedPlant('');
    setSelectedDepartment('');
    setSelectedCategoryType('ALL');
    setSelectedStatus('ALL');
    setSearchQuery('');
  };

  // Soft Delete handlers (Custom Modal)
  const openSoftDeleteModal = (asset: Asset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentUser && currentUser.role !== 'it_admin' && currentUser.role !== 'admin') {
      alert('Access Restricted: Only IT Administrators and System Admins have permission to delete assets.');
      return;
    }
    setDeletingAsset(asset);
  };

  const confirmSoftDelete = async () => {
    if (!deletingAsset) return;
    setDeletingLoading(true);
    try {
      const res = await fetch(`/api/assets/${deletingAsset.id}`, { method: 'DELETE' });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== deletingAsset.id));
        setDeletingAsset(null);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete asset');
      }
    } catch {
      alert('Delete request failed');
    } finally {
      setDeletingLoading(false);
    }
  };

  // Department Transfer submit handler
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringAsset) return;
    setTransferLoading(true);

    try {
      const res = await fetch('/api/assets/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: transferringAsset.id,
          toDepartmentId,
          toLocationId: transferringAsset.current_location_id,
          toPlantId: transferringAsset.current_plant_id,
          reason: transferReason,
        }),
      });

      if (res.ok) {
        setTransferringAsset(null);
        setTransferReason('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Transfer failed');
      }
    } finally {
      setTransferLoading(false);
    }
  };

  // Export filtered assets to CSV
  const handleExportCSV = () => {
    if (filteredAssets.length === 0) {
      alert('No assets to export with current filters.');
      return;
    }

    const headers = [
      'Asset Tag',
      'SAP Asset Code',
      'Name',
      'Model',
      'Serial Number',
      'Department',
      'Type',
      'Location',
      'Plant',
      'Custodian Name',
      'Custodian Code',
      'Purchase Cost',
      'Status',
      'PO Number',
      'Invoice Number',
      'Invoice Date',
      'Warranty Expiry',
    ];

    const rows = filteredAssets.map((a) => [
      `"${a.asset_tag}"`,
      `"${a.sap_asset_code || ''}"`,
      `"${a.name.replace(/"/g, '""')}"`,
      `"${(a.model || '').replace(/"/g, '""')}"`,
      `"${a.serial_number || ''}"`,
      `"${a.department?.name || a.category?.name || ''}"`,
      `"${getAssetTypeBadge(a)}"`,
      `"${a.location?.name || ''}"`,
      `"${a.plant?.name || ''}"`,
      `"${a.assigned_employee?.full_name || 'Unassigned'}"`,
      `"${a.assigned_employee?.emp_code || ''}"`,
      a.purchase_cost || 0,
      `"${a.status}"`,
      `"${a.po_number || ''}"`,
      `"${a.invoice_number || ''}"`,
      `"${a.invoice_date || ''}"`,
      `"${a.warranty_expiry || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PGEL_Assets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 antialiased font-sans pt-3">
      {/* =================================================================== */}
      {/* 1. ULTRA-COMPACT UNIFIED ASSET DIRECTORY BAR WITH INTEGRATED FILTER */}
      {/* =================================================================== */}
      {/* =================================================================== */}
      {/* 1. ULTRA-COMPACT UNIFIED ASSET DIRECTORY BAR WITH INTEGRATED FILTER */}
      {/* =================================================================== */}
      <div
        ref={filterContainerRef}
        onMouseEnter={handleFilterMouseEnter}
        onMouseLeave={handleFilterMouseLeave}
        className="relative bg-white rounded-xl px-3.5 py-2.5 border border-slate-200 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Left: Pristine Title & Count + Active Department Pill */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <h1 className="text-base font-black text-slate-900 tracking-tight shrink-0">
              Asset Directory
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              {filteredAssets.length} Assets
            </span>
            {selectedDepartment && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white shadow-2xs">
                <span>Dept: {departments.find((d) => d.id === selectedDepartment)?.name || selectedDepartment}</span>
                <button
                  type="button"
                  onClick={() => setSelectedDepartment('')}
                  className="hover:text-blue-200 cursor-pointer"
                  title="Clear Department Filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {/* Right: Inline Search Bar + Master Filter Toggle + Refresh + Export + New Asset */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Compact Search Input */}
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tag, staff..."
                className="w-full pl-7 pr-2.5 py-1 bg-slate-50 hover:bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs transition-colors"
              />
            </div>

            {/* Master Filter Button */}
            <button
              type="button"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border shadow-2xs transition-all cursor-pointer ${
                isFilterOpen || activeFiltersCount > 0
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-600/20'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
              title="Click to open filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-blue-700 text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-150 ${isFilterOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchData}
              disabled={refreshing}
              className="p-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
              title="Export CSV"
            >
              <Download className="w-3 h-3 text-blue-600" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            {/* Primary "+ New Asset" Button */}
            <button
              type="button"
              onClick={handleNewAssetBtnClick}
              title="Single click: New Asset Form | Double click: Direct Stock Entry (Save in Stock)"
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Asset</span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* COMPACT MASTER FILTER POPOVER (Cascading: Location -> Plant -> Dept) */}
        {/* =================================================================== */}
        {isFilterOpen && (
          <div className="absolute top-full right-0 mt-1.5 z-40 w-full sm:w-[520px] bg-white rounded-xl border border-slate-200 shadow-xl p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800 uppercase tracking-wider">
                <Filter className="w-3 h-3 text-blue-600" />
                <span>Filters</span>
              </div>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Reset All
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Close filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Row 1: 3 Dependent Selects (Location -> Plant -> Department) */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5">
                  1. Location
                </span>
                <select
                  value={selectedLocation}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-[11px] font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value="">All Locations</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  <span>2. Plant</span>
                  {selectedLocation && <span className="text-[9px] text-blue-600 font-normal">({filteredPlants.length})</span>}
                </span>
                <select
                  value={selectedPlant}
                  onChange={(e) => handlePlantChange(e.target.value)}
                  disabled={Boolean(selectedLocation) && filteredPlants.length === 0}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-[11px] font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <option value="">{selectedLocation ? 'Select Plant...' : 'All Plants'}</option>
                  {filteredPlants.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  <span>3. Department</span>
                  {(selectedPlant || selectedLocation) && <span className="text-[9px] text-blue-600 font-normal">({filteredDepartments.length})</span>}
                </span>
                <select
                  value={selectedDepartment}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  disabled={(Boolean(selectedPlant) || Boolean(selectedLocation)) && filteredDepartments.length === 0}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-md text-[11px] font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <option value="">{selectedPlant ? 'Select Dept...' : 'All Departments'}</option>
                  {filteredDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Asset Type Compact Chips */}
            <div>
              <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                <span>4. Equipment / Asset Type</span>
                {selectedCategoryType !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryType('ALL')}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Reset Type
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryType('ALL')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    selectedCategoryType === 'ALL'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Layers className="w-2.5 h-2.5" />
                  <span>All Equipment</span>
                </button>

                {departmentAssetTypes.map((typeLabel) => {
                  const isActive = selectedCategoryType.toUpperCase() === typeLabel.toUpperCase();
                  return (
                    <button
                      key={typeLabel}
                      type="button"
                      onClick={() => setSelectedCategoryType(typeLabel)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer uppercase ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{typeLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 3: Status & Close */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-semibold text-slate-700 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">All Status</option>
                  <option value="IN_HOUSE">In-House Active</option>
                  <option value="IN_USE">Assigned to Employee</option>
                  <option value="AVAILABLE">Stock Inventory Pool</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="SCRAPPED">Scrapped / Damaged</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-bold">
                  {filteredAssets.length} found
                </span>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px] shadow-2xs cursor-pointer"
                >
                  Apply &amp; Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Active Filter Banner (Appears when any filter is active) */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200/80 px-3 py-1.5 rounded-lg text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1">
              <Filter className="w-3 h-3 text-blue-600" />
              Active Filters:
            </span>
            {selectedLocation && (
              <span className="inline-flex items-center gap-1 bg-white text-slate-800 border border-blue-200 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-2xs">
                📍 Loc: {locations.find((l) => l.id === selectedLocation)?.name}
                <button type="button" onClick={() => handleLocationChange('')} className="hover:text-rose-600 cursor-pointer font-bold ml-0.5">×</button>
              </span>
            )}
            {selectedPlant && (
              <span className="inline-flex items-center gap-1 bg-white text-slate-800 border border-purple-200 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-2xs">
                🏭 Plant: {plants.find((p) => p.id === selectedPlant)?.name}
                <button type="button" onClick={() => handlePlantChange('')} className="hover:text-rose-600 cursor-pointer font-bold ml-0.5">×</button>
              </span>
            )}
            {selectedDepartment && (
              <span className="inline-flex items-center gap-1 bg-white text-slate-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-2xs">
                🏢 Dept: {departments.find((d) => d.id === selectedDepartment)?.name}
                <button type="button" onClick={() => handleDepartmentChange('')} className="hover:text-rose-600 cursor-pointer font-bold ml-0.5">×</button>
              </span>
            )}
            {selectedCategoryType !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-white text-slate-800 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-2xs">
                🏷️ Type: {selectedCategoryType}
                <button type="button" onClick={() => setSelectedCategoryType('ALL')} className="hover:text-rose-600 cursor-pointer font-bold ml-0.5">×</button>
              </span>
            )}
            {selectedStatus !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-white text-slate-800 border border-slate-300 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-2xs">
                ⚡ Status: {selectedStatus}
                <button type="button" onClick={() => setSelectedStatus('ALL')} className="hover:text-rose-600 cursor-pointer font-bold ml-0.5">×</button>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer shrink-0 ml-2"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. ASSETS TABLE (Starts immediately underneath, no wasted space)    */}
      {/* =================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Asset Code &amp; Name</th>
                <th className="px-4 py-3">Department &amp; Type</th>
                <th className="px-4 py-3">Location &amp; Plant</th>
                <th className="px-4 py-3">Assigned Custodian</th>
                <th className="px-4 py-3">Purchase Cost</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredAssets.map((a) => {
                const hasEmp = Boolean(a.assigned_employee_id || a.assigned_employee);
                const isInHouse = a.status === 'in_service' && !hasEmp;
                const isStock = a.status === 'in_storage';
                const typeLabel = getAssetTypeBadge(a);

                return (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`/assets/${a.id}`)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                  >
                    {/* 1. Asset Code, Name & Visual */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center p-1.5 shrink-0 border border-slate-700/60 shadow-xs group-hover:border-blue-500/50 transition-colors">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getAssetPreviewImage(a.category?.name, (a as any).it_asset_type, (a as any).photo_urls)}
                            alt={a.name}
                            className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 group-hover:border-blue-300 group-hover:text-blue-600 transition-colors">
                              {a.asset_tag}
                            </span>
                            {a.sap_asset_code && (
                              <span className="font-mono font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[10px]" title="SAP Asset Code">
                                SAP: {a.sap_asset_code}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-slate-400">
                              #{a.id.slice(0, 4).toUpperCase()}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 text-xs mt-0.5 line-clamp-1">
                            {a.name}
                          </div>
                          {a.serial_number && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              SN: {a.serial_number}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 2. Department & Sub-Category Type */}
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-black text-[10px] border border-slate-200 uppercase">
                        {a.department?.name || a.category?.name || 'General'}
                      </span>
                      <div className="mt-0.5">
                        <span className="inline-block px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                          {typeLabel}
                        </span>
                      </div>
                    </td>

                    {/* 3. Location & Plant */}
                    <td className="px-4 py-3">
                      <div className="font-black text-slate-800 text-[11px]">
                        {a.plant?.name || 'Assembly Plant'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {a.location?.name || 'Main Location'}
                      </div>
                    </td>

                    {/* 4. Assigned Custodian */}
                    <td className="px-4 py-3">
                      {a.assigned_employee ? (
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{a.assigned_employee.full_name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">
                            {a.assigned_employee.emp_code}
                          </span>
                        </div>
                      ) : a.status === 'scrapped' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 uppercase">
                          <Trash2 className="w-3 h-3 text-rose-600" />
                          <span>Scrapped</span>
                        </span>
                      ) : a.status === 'damaged' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-orange-800 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 uppercase">
                          <Wrench className="w-3 h-3 text-orange-600" />
                          <span>Damaged</span>
                        </span>
                      ) : a.status === 'missing' ? (
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
                            {a.department?.name || 'Department Custody'}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                          <CheckCircle2 className="w-3 h-3 text-amber-600" />
                          <span>In Stock</span>
                        </span>
                      )}
                    </td>

                    {/* 5. Purchase Cost */}
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      {formatCurrency(a.purchase_cost)}
                    </td>

                    {/* 6. Status Badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                          a.status === 'scrapped' || a.status === 'damaged'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : a.status === 'maintenance'
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
                          : a.status === 'in_service'
                          ? 'IN USE'
                          : a.status === 'in_storage'
                          ? 'AVAILABLE IN STOCK'
                          : a.status.toUpperCase()}
                      </span>
                    </td>

                    {/* 7. Actions */}
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/assets/${a.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="View Asset Dossier & QR"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setTransferringAsset(a)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Department Transfer"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                        </button>
                        {(currentUser?.role === 'it_admin' || currentUser?.role === 'admin') && (
                          <button
                            type="button"
                            onClick={(e) => openSoftDeleteModal(a, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Soft Delete (Admin Only)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredAssets.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">
                      No assets found matching Master Filters
                    </h4>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-0.5">
                      Try adjusting the location, plant, department, or equipment type filters.
                    </p>
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-colors"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEPARTMENT TRANSFER MODAL */}
      {transferringAsset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Transfer Asset Department
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTransferringAsset(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
              <div className="font-bold text-slate-900">{transferringAsset.name}</div>
              <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                Tag: {transferringAsset.asset_tag} | Current Dept: {transferringAsset.department?.name || 'Unassigned'}
              </div>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Destination Department *
                </label>
                <select
                  required
                  value={toDepartmentId}
                  onChange={(e) => setToDepartmentId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                >
                  <option value="">-- Select Target Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Transfer
                </label>
                <textarea
                  rows={2}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Reassigned for production line expansion"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTransferringAsset(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>{transferLoading ? 'Transferring...' : 'Execute Transfer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM SOFT DELETE ASSET MODAL */}
      {deletingAsset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Delete Asset
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingAsset(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <p className="font-bold text-slate-900">
                Are you sure you want to soft-delete asset &ldquo;{deletingAsset.asset_tag}&rdquo; ({deletingAsset.name})?
              </p>
              <p className="text-[11px] text-rose-700 font-medium">
                Only authorized IT Administrators can perform this action. The asset record will be archived.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingAsset(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSoftDelete}
                disabled={deletingLoading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingLoading ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">Loading Asset Directory...</span>
          </div>
        </div>
      }
    >
      <AssetsDirectoryContent />
    </Suspense>
  );
}
