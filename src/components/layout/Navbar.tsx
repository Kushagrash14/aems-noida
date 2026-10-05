'use client';

import { useState, useEffect, useRef, useMemo, useCallback, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { User, UserScope, Location, Plant, Department, Category } from '@/types/database';
import { useSidebar } from './SidebarContext';
import {
  Menu,
  Search,
  RotateCw,
  Download,
  Plus,
  MapPin,
  X,
  Check,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  Users,
  User as UserIcon,
  Box,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';

interface NavbarProps {
  user?: User | null;
  scope?: UserScope | null;
}

const LOCATIONS_STATIC = [
  { id: '', name: 'All Locations (Corporate Scope)', short: 'All Locations' },
  { id: '11111111-1111-1111-1111-111111111101', name: 'Pune', short: 'Pune' },
];

const PLANTS_STATIC = [
  { id: '', location_id: '', name: 'All Plants', short: 'All Plants' },
  { id: '22222222-2222-2222-2222-222222222201', location_id: '11111111-1111-1111-1111-111111111101', name: 'NGM', short: 'NGM' },
  { id: '22222222-2222-2222-2222-222222222202', location_id: '11111111-1111-1111-1111-111111111101', name: 'PGTL', short: 'PGTL' },
  { id: '22222222-2222-2222-2222-222222222203', location_id: '11111111-1111-1111-1111-111111111101', name: 'PGEL', short: 'PGEL' },
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

function NavbarContent({ user, scope }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toggleSidebar, isOpen: isSidebarOpen, isPinned, setHovered } = useSidebar();

  const [currentUser, setCurrentUser] = useState<User | null>(user || null);
  const [currentScope, setCurrentScope] = useState<UserScope | null>(scope || null);

  useEffect(() => {
    if (user) setCurrentUser(user);
    if (scope) setCurrentScope(scope);
    if (!user) {
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((d) => {
          if (d?.user) setCurrentUser(d.user);
          if (d?.scope) setCurrentScope(d.scope);
        })
        .catch(() => null);
    }
  }, [user, scope]);

  const activeUser = currentUser || user;
  const activeScope = currentScope || scope;

  const isHRView = activeUser?.role === 'hr' || pathname?.startsWith('/employees');

  // Search & Filter state synced with URL Search Params
  const searchVal = searchParams.get('search') || '';
  const locationIdVal = searchParams.get('locationId') || '';
  const plantIdVal = searchParams.get('plantId') || '';
  const deptIdVal = searchParams.get('deptId') || '';
  const categoryIdVal = searchParams.get('categoryId') || '';
  const statusVal = searchParams.get('status') || 'ALL';

  // Fast 60fps local search input state to prevent typing lag
  const [localSearch, setLocalSearch] = useState(searchVal);

  useEffect(() => {
    setLocalSearch(searchVal);
  }, [searchVal]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchVal) {
        updateUrlParams({ search: localSearch });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, searchVal]);

  // Synchronous optimistic local state for instant 0ms dropdown responsiveness
  const [localLocation, setLocalLocation] = useState(locationIdVal);
  const [localPlant, setLocalPlant] = useState(plantIdVal);
  const [localDept, setLocalDept] = useState(deptIdVal);
  const [localCategory, setLocalCategory] = useState(categoryIdVal);
  const [localStatus, setLocalStatus] = useState(statusVal);

  useEffect(() => {
    setLocalLocation(locationIdVal);
  }, [locationIdVal]);

  useEffect(() => {
    setLocalPlant(plantIdVal);
  }, [plantIdVal]);

  useEffect(() => {
    setLocalDept(deptIdVal);
  }, [deptIdVal]);

  useEffect(() => {
    setLocalCategory(categoryIdVal);
  }, [categoryIdVal]);

  useEffect(() => {
    setLocalStatus(statusVal);
  }, [statusVal]);

  // Dynamic Structure Data for Filter Popover
  const [locations, setLocations] = useState<Location[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deptCategoryMap, setDeptCategoryMap] = useState<Record<string, string[]>>({});

  // Popover Open States
  const [scopeFilterOpen, setScopeFilterOpen] = useState(false);
  const [hrFilterOpen, setHrFilterOpen] = useState(false);
  const [entryMenuOpen, setEntryMenuOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const entryMenuRef = useRef<HTMLDivElement | null>(null);
  const hrFilterRef = useRef<HTMLDivElement | null>(null);

  // Temp picker state inside scope popover
  const [tempLocId, setTempLocId] = useState('');
  const [tempPltId, setTempPltId] = useState('');

  const [isPending, startTransition] = useTransition();

  // Fetch dynamic structure lookups (locations, plants, departments, categories) without heavy assets download
  const fetchLookups = useCallback(() => {
    Promise.all([
      fetch('/api/locations').then((r) => r.json()),
      fetch('/api/plants').then((r) => r.json()),
      fetch('/api/settings/departments').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([locRes, plantRes, deptRes, catRes]) => {
        if (locRes?.locations) setLocations(locRes.locations);
        if (plantRes?.plants) setPlants(plantRes.plants);
        if (deptRes?.departments) setDepartments(deptRes.departments);
        if (catRes?.categories) setCategories(catRes.categories);
      })
      .catch(() => {});
  }, []);

  // Fetch on mount and subscribe only to relevant data mutation events
  useEffect(() => {
    fetchLookups();

    const handleDataUpdate = () => fetchLookups();
    window.addEventListener('aems:asset-updated', handleDataUpdate);
    window.addEventListener('aems:category-updated', handleDataUpdate);

    return () => {
      window.removeEventListener('aems:asset-updated', handleDataUpdate);
      window.removeEventListener('aems:category-updated', handleDataUpdate);
    };
  }, [fetchLookups]);

  // Close scope, entry menu & filter popovers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) {
        setScopeFilterOpen(false);
      }
      if (entryMenuRef.current && !entryMenuRef.current.contains(e.target as Node)) {
        setEntryMenuOpen(false);
      }
      if (hrFilterRef.current && !hrFilterRef.current.contains(e.target as Node)) {
        setHrFilterOpen(false);
      }
    }
    if (scopeFilterOpen || entryMenuOpen || hrFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [scopeFilterOpen, entryMenuOpen, hrFilterOpen]);

  // Non-blocking URL search parameters update
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(window.location.search);
      Object.entries(updates).forEach(([key, val]) => {
        if (val === null || val === '' || val === 'ALL') {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      });
      const qs = params.toString();
      const currentPath = window.location.pathname;
      const newUrl = qs ? `${currentPath}?${qs}` : currentPath;

      // Fast synchronous update in browser history
      window.history.replaceState(null, '', newUrl);

      // Transition Next.js route in background without locking UI
      startTransition(() => {
        router.replace(newUrl, { scroll: false });
      });
    },
    [router]
  );

  const handleOpenScope = () => {
    setTempLocId(localLocation);
    setTempPltId(localPlant);
    setScopeFilterOpen((prev) => !prev);
  };

  const handleApplyScope = () => {
    setScopeFilterOpen(false);
    setLocalLocation(tempLocId);
    setLocalPlant(tempPltId);
    updateUrlParams({
      locationId: tempLocId,
      plantId: tempPltId,
    });
  };

  const handleResetScope = () => {
    setTempLocId('');
    setTempPltId('');
    setScopeFilterOpen(false);
    setLocalLocation('');
    setLocalPlant('');
    updateUrlParams({
      locationId: null,
      plantId: null,
    });
  };

  // Instant Cascading Selection Handlers with 0ms optimistic UI update
  const handleLocationChange = (locId: string) => {
    let newPlt = localPlant;
    let newDept = localDept;

    if (locId) {
      const validPlants = plants.filter((p) => p.location_id === locId);
      if (!validPlants.some((p) => p.id === localPlant)) {
        newPlt = '';
        newDept = '';
      }
    } else {
      newPlt = '';
      newDept = '';
    }

    setLocalLocation(locId);
    setLocalPlant(newPlt);
    setLocalDept(newDept);
    setLocalCategory('');

    updateUrlParams({
      locationId: locId,
      plantId: newPlt,
      deptId: newDept,
      categoryId: null,
    });
  };

  const handlePlantChange = (pltId: string) => {
    let newDept = localDept;
    if (pltId) {
      const validDepts = departments.filter((d) => !d.plant_id || d.plant_id === pltId);
      if (!validDepts.some((d) => d.id === localDept)) {
        newDept = '';
      }
    } else {
      newDept = '';
    }

    setLocalPlant(pltId);
    setLocalDept(newDept);
    setLocalCategory('');

    updateUrlParams({
      plantId: pltId,
      deptId: newDept,
      categoryId: null,
    });
  };

  const handleDeptChange = (dId: string) => {
    setLocalDept(dId);
    setLocalCategory('');
    updateUrlParams({
      deptId: dId,
      categoryId: null,
    });
  };

  const handleCategoryChange = (cId: string) => {
    setLocalCategory(cId);
    updateUrlParams({
      categoryId: cId,
    });
  };

  const handleStatusChange = (st: string) => {
    setLocalStatus(st);
    updateUrlParams({
      status: st,
    });
  };

  const resetAllHRFilters = () => {
    setLocalLocation('');
    setLocalPlant('');
    setLocalDept('');
    setLocalCategory('');
    setLocalStatus('ALL');
    updateUrlParams({
      locationId: null,
      plantId: null,
      deptId: null,
      categoryId: null,
      status: null,
      search: null,
    });
  };

  const handleOpenAddEmployee = () => {
    window.dispatchEvent(new CustomEvent('aems:open-add-employee'));
  };

  const activeHRFiltersCount = useMemo(() => {
    let count = 0;
    if (localLocation) count++;
    if (localPlant) count++;
    if (localDept) count++;
    if (localCategory) count++;
    if (localStatus && localStatus !== 'ALL') count++;
    return count;
  }, [localLocation, localPlant, localDept, localCategory, localStatus]);

  const isItAdmin = activeUser?.role === 'it_admin';

  // For non-IT Admin, resolve their assigned location, plant, and department
  const assignedLocId = activeUser?.location_id || activeScope?.location_ids?.[0] || '';
  const assignedPltId = activeUser?.plant_id || activeScope?.plant_ids?.[0] || '';
  const assignedDeptId = activeUser?.department_id || activeScope?.department_ids?.[0] || '';

  const assignedLoc = locations.find((l) => l.id === assignedLocId) || LOCATIONS_STATIC.find((l) => l.id === assignedLocId);
  const assignedPlt = plants.find((p) => p.id === assignedPltId) || PLANTS_STATIC.find((p) => p.id === assignedPltId);
  const assignedDept = departments.find((d) => d.id === assignedDeptId);

  const activeLocObj = locations.find((l) => l.id === localLocation) || LOCATIONS_STATIC.find((l) => l.id === localLocation);
  const activePltObj = plants.find((p) => p.id === localPlant) || PLANTS_STATIC.find((p) => p.id === localPlant);
  const locDisplay = !isItAdmin
    ? (assignedLoc?.name || (locations.length === 0 ? 'Loading...' : 'Assigned Location'))
    : (activeLocObj ? (activeLocObj.name.length > 18 ? activeLocObj.name.slice(0, 18) + '...' : activeLocObj.name) : 'All Locations');
  const pltDisplay = !isItAdmin
    ? (assignedPlt?.name || (plants.length === 0 ? 'Loading...' : 'Assigned Plant'))
    : (activePltObj ? (activePltObj.name.length > 18 ? activePltObj.name.slice(0, 18) + '...' : activePltObj.name) : 'All Plants');
  const deptDisplay = assignedDept?.name || '';
  const isFilterActive = Boolean(localLocation || localPlant);

  const availablePlantsForHR = useMemo(() => {
    if (!localLocation) return plants;
    return plants.filter((p) => p.location_id === localLocation);
  }, [plants, localLocation]);

  const availableDeptsForHR = useMemo(() => {
    if (localPlant) {
      return departments.filter((d) => !d.plant_id || d.plant_id === localPlant);
    }
    if (localLocation) {
      const pIds = plants.filter((p) => p.location_id === localLocation).map((p) => p.id);
      return departments.filter((d) => !d.plant_id || pIds.includes(d.plant_id));
    }
    return departments;
  }, [departments, plants, localLocation, localPlant]);

  // Step 4: Dynamically cascade categories for the selected department
  const availableCategoriesForNavbar = useMemo(() => {
    // 1. Strictly filter out any category whose name matches a department name
    const deptNameSet = new Set(departments.map((d) => d.name.trim().toUpperCase()));
    const cleanDbCats = categories.filter((c) => !deptNameSet.has(c.name.trim().toUpperCase()));

    // Target department ID: either selected from dropdown or user's assigned department
    const targetDeptId = localDept || (!isItAdmin ? assignedDeptId : '');

    // If no department is selected, return all clean categories
    if (!targetDeptId) return cleanDbCats;

    const selectedDept = departments.find((d) => d.id === targetDeptId);
    if (!selectedDept) return cleanDbCats;

    const deptNameUpper = selectedDept.name.trim().toUpperCase();

    // 2. Category IDs already used by assets belonging to this department
    const assetCatIdsForDept = deptCategoryMap[targetDeptId] || [];

    // 3. User custom department categories from localStorage
    let customDeptCatNames: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`aems_dept_cats_${deptNameUpper}`);
        if (stored) {
          customDeptCatNames = JSON.parse(stored).map((s: string) => s.trim().toUpperCase());
        }
      } catch {}
    }

    // 4. Predefined default categories for this department
    let defaultCats: string[] = [];
    Object.keys(DEFAULT_DEPT_CATEGORIES).forEach((key) => {
      const keyUpper = key.toUpperCase();
      if (
        deptNameUpper === keyUpper ||
        deptNameUpper.includes(keyUpper) ||
        keyUpper.includes(deptNameUpper)
      ) {
        defaultCats.push(...DEFAULT_DEPT_CATEGORIES[key].map((s) => s.toUpperCase()));
      }
    });

    // Allowed category names for this department
    const allowedDeptCatNames = new Set([
      ...customDeptCatNames,
      ...defaultCats,
    ]);

    // Filter DB categories: strictly match configured department types OR categories of existing assets in this dept
    const filtered = cleanDbCats.filter((c) => {
      if (assetCatIdsForDept.includes(c.id)) return true;
      const cNameUpper = c.name.trim().toUpperCase();
      if (allowedDeptCatNames.has(cNameUpper)) return true;
      return false;
    });

    return filtered;
  }, [categories, departments, localDept, assignedDeptId, isItAdmin, deptCategoryMap]);

  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleAssetButtonClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      router.push('/assets/new?mode=stock');
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        router.push('/assets/new');
      }, 250);
    }
  };

  return (
    <header
      className="sticky top-0 z-50 h-14 w-full px-4 flex items-center gap-0 shadow-md select-none"
      style={{
        background: 'linear-gradient(180deg, #0e1726 0%, #070c16 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Left Section: Hamburger + Brand — shrink-0 so it never squishes */}
      <div className="flex items-center gap-2.5 shrink-0 pr-3">
        <button
          onClick={toggleSidebar}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { if (!isPinned) setHovered(false); }}
          title={isSidebarOpen ? 'Collapse Navigation Menu' : 'Open Navigation Menu (Hover to preview)'}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isSidebarOpen ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* PG Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="flex items-center justify-center rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105"
            style={{
              height: 48, paddingLeft: 14, paddingRight: 14, background: '#ffffff',
              boxShadow: '0 0 0 1.5px rgba(255,255,255,0.2), 0 0 18px 4px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pg-logo.png" alt="PG Logo" style={{ height: 38, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </div>
          <div className="hidden sm:flex flex-col justify-center leading-none border-l border-slate-700 pl-3">
            <span className="font-black text-[15px] tracking-[0.22em] bg-gradient-to-r from-white via-sky-200 to-blue-400 bg-clip-text text-transparent">A.E.M.S</span>
            <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Asset Entry Management System</span>
          </div>
        </Link>

        {/* HR ROLE BADGE */}
        {isHRView && (
          <span className="px-2 py-0.5 rounded-md bg-blue-600/30 text-blue-300 font-black text-xs border border-blue-500/40 flex items-center gap-1">
            <Users className="w-3 h-3 text-blue-400" />
            <span>HR</span>
          </span>
        )}
      </div>

      {/* Divider left */}
      <div className="h-6 w-px shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }} />

      {/* Search bar — fills ALL remaining space between the two dividers */}
      <div className="flex-1 min-w-0 px-3">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={isHRView ? 'Search staff by name, emp ID, department...' : 'Search assets, serial numbers, hostnames...'}
            className="w-full pl-10 pr-4 py-[7px] text-[12.5px] font-medium text-white placeholder:text-slate-500 rounded-full focus:outline-none transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.background = 'rgba(99,102,241,0.14)';
              e.currentTarget.style.border = '1px solid rgba(99,102,241,0.55)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.border = '1px solid rgba(255,255,255,0.12)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Divider right */}
      <div className="h-6 w-px shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }} />

      {/* Right Section — shrink-0 so it never squishes */}
      <div className="flex items-center gap-2 shrink-0 pl-3">

        {/* Compact Scoped Plant Badge for Facility Admin & Users */}
        {!isItAdmin ? (
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border bg-white/[0.06] border-white/10 text-slate-200 shadow-2xs select-none"
            title={`Assigned Facility Scope: ${locDisplay} > ${pltDisplay}${deptDisplay ? ` > ${deptDisplay}` : ''}`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>
              Plant: <strong className="text-white font-semibold">{pltDisplay}</strong>
            </span>
          </div>
        ) : (
          /* Interactive Compact Plant Scope Badge (IT ADMIN ONLY) */
          <div className="relative hidden md:block" ref={scopeRef}>
            <button
              type="button"
              onClick={handleOpenScope}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-all cursor-pointer select-none ${
                isFilterActive
                  ? 'bg-blue-600/30 border-blue-400 text-blue-100 shadow-xs'
                  : 'bg-white/[0.06] border-white/10 text-slate-300 hover:bg-white/[0.12] hover:text-white'
              }`}
              title={`Location & Plant Scope (${locDisplay} > ${pltDisplay})`}
            >
              <MapPin className={`w-3.5 h-3.5 shrink-0 ${isFilterActive ? 'text-blue-400 animate-pulse' : 'text-emerald-400'}`} />
              <span>
                Plant: <strong className="text-white font-semibold">{pltDisplay}</strong>
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${scopeFilterOpen ? 'rotate-180 text-blue-400' : 'text-slate-400'}`} />
            </button>

            {/* Scope Dropdown Popover */}
            {scopeFilterOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-xs text-slate-800 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>Filter Location &amp; Plant Scope</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScopeFilterOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Location
                  </label>
                  <select
                    value={tempLocId}
                    onChange={(e) => {
                      const newLoc = e.target.value;
                      setTempLocId(newLoc);
                      if (newLoc) {
                        const plantMatch = (plants.length ? plants : PLANTS_STATIC).find((p) => p.id === tempPltId);
                        if (plantMatch && (plantMatch as Plant).location_id !== newLoc) {
                          setTempPltId('');
                        }
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {(locations.length ? locations : LOCATIONS_STATIC).map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Production Plant
                  </label>
                  <select
                    value={tempPltId}
                    onChange={(e) => setTempPltId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {(plants.length ? plants : PLANTS_STATIC)
                      .filter((p) => !tempLocId || !p.location_id || p.location_id === tempLocId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleResetScope}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Reset to All
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyScope}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Scope</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HIERARCHICAL FILTER BUTTON (TO THE LEFT OF RELOAD) */}
        <div ref={hrFilterRef} className="relative">
          <button
            type="button"
            onClick={() => setHrFilterOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-all cursor-pointer shadow-2xs ${
              hrFilterOpen || activeHRFiltersCount > 0
                ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/20 shadow-md'
                : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border-white/10'
            }`}
            title="Hierarchical Filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-300" />
            <span>Filter</span>
            {activeHRFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-blue-700 font-extrabold text-[10px] flex items-center justify-center ml-0.5">
                {activeHRFiltersCount}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${hrFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* CASCADING FILTER POPOVER */}
          {hrFilterOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white border border-slate-200 text-slate-800 rounded-2xl p-4 shadow-2xl z-[100] space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-extrabold tracking-wide uppercase text-slate-900">Filters</span>
                </div>
                <div className="flex items-center gap-2">
                  {activeHRFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={resetAllHRFilters}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setHrFilterOpen(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Close filter menu"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {/* Location */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Location</span>
                    {localLocation && <span className="text-emerald-600 text-[9px] font-bold">✓ Selected</span>}
                  </label>
                  <select
                    value={localLocation}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                  >
                    <option value="" className="text-slate-900">
                      {isItAdmin
                        ? `All Locations (${locations.length || LOCATIONS_STATIC.length})`
                        : (assignedLoc?.name || locations[0]?.name || 'Assigned Location')}
                    </option>
                    {isItAdmin
                      ? (locations.length ? locations : LOCATIONS_STATIC).map((loc) => (
                          <option key={loc.id} value={loc.id} className="text-slate-900">
                            {loc.name}
                          </option>
                        ))
                      : locations.length > 1 &&
                        locations.map((loc) => (
                          <option key={loc.id} value={loc.id} className="text-slate-900">
                            {loc.name}
                          </option>
                        ))}
                  </select>
                </div>

                {/* Plant */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    <span>Plant</span>
                  </label>
                  <select
                    value={localPlant}
                    onChange={(e) => handlePlantChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                  >
                    <option value="" className="text-slate-900">
                      {isItAdmin
                        ? (localLocation
                            ? `All Plants at Location (${availablePlantsForHR.length})`
                            : `All Plants (${plants.length || PLANTS_STATIC.length})`)
                        : (assignedPlt?.name || plants[0]?.name || 'Assigned Plant')}
                    </option>
                    {isItAdmin
                      ? availablePlantsForHR.map((p) => (
                          <option key={p.id} value={p.id} className="text-slate-900">
                            {p.name}
                          </option>
                        ))
                      : plants.length > 1 &&
                        plants.map((p) => (
                          <option key={p.id} value={p.id} className="text-slate-900">
                            {p.name}
                          </option>
                        ))}
                  </select>
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    <span>Department</span>
                  </label>
                  <select
                    value={localDept}
                    onChange={(e) => handleDeptChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                  >
                    <option value="" className="text-slate-900">
                      {isItAdmin
                        ? `All Departments (${availableDeptsForHR.length})`
                        : (assignedDept?.name || departments[0]?.name || 'Assigned Department')}
                    </option>
                    {isItAdmin
                      ? availableDeptsForHR.map((d) => (
                          <option key={d.id} value={d.id} className="text-slate-900">
                            {d.name} ({d.code})
                          </option>
                        ))
                      : departments.length > 1 &&
                        departments.map((d) => (
                          <option key={d.id} value={d.id} className="text-slate-900">
                            {d.name} ({d.code})
                          </option>
                        ))}
                  </select>
                </div>

                {/* Asset Type (when NOT in HR View) */}
                {!isHRView && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      <span>Asset Type</span>
                    </label>
                    <select
                      value={localCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                    >
                      <option value="" className="text-slate-900">
                        {localDept || (!isItAdmin && assignedDeptId)
                          ? `All Asset Types for Department (${availableCategoriesForNavbar.length})`
                          : `All Asset Types (${availableCategoriesForNavbar.length})`}
                      </option>
                      {availableCategoriesForNavbar.map((c) => (
                        <option key={c.id} value={c.id} className="text-slate-900">
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    <span>{isHRView ? 'Employment Status' : 'Lifecycle Status'}</span>
                  </label>
                  <select
                    value={localStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                  >
                    {isHRView ? (
                      <>
                        <option value="ALL" className="text-slate-900">All Status (Active + Inactive)</option>
                        <option value="ACTIVE" className="text-slate-900">Active Staff Only</option>
                        <option value="INACTIVE" className="text-slate-900">Inactive Records Only</option>
                      </>
                    ) : (
                      <>
                        <option value="ALL" className="text-slate-900">All Lifecycle Statuses</option>
                        <option value="in_service" className="text-slate-900">Active / In Service</option>
                        <option value="in_storage" className="text-slate-900">Available / Stock Pool</option>
                        <option value="maintenance" className="text-slate-900">Under Maintenance</option>
                        <option value="damaged" className="text-slate-900">Damaged</option>
                        <option value="scrapped" className="text-slate-900">Scrapped</option>
                        <option value="missing" className="text-slate-900">Missing / Lost</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={() => window.location.reload()}
          title="Refresh Data"
          className="p-1.5 bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white rounded-lg border border-white/10 shadow-xs transition-colors cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* Download / Export Button (IT Admin) */}
        {user?.role === 'it_admin' && (
          <Link
            href="/bulk-import"
            title="Bulk Excel Import / Export"
            className="p-1.5 bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white rounded-lg border border-white/10 shadow-xs transition-colors flex items-center justify-center"
          >
            <Download className="w-3.5 h-3.5" />
          </Link>
        )}

        {/* "+ Add Employee" Button for HR View */}
        {isHRView ? (
          <button
            type="button"
            onClick={handleOpenAddEmployee}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-full shadow-xs transition-all whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Employee</span>
          </button>
        ) : (
          /* "+ New Entry" Dropdown Menu for Asset View */
          <div className="relative" ref={entryMenuRef}>
            <button
              type="button"
              onClick={() => setEntryMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-xs font-bold rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer select-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Entry</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${entryMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {entryMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-[100] text-xs text-slate-800 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Select Entry Mode
                </div>

                <Link
                  href="/assets/new?mode=assigned"
                  onClick={() => setEntryMenuOpen(false)}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-blue-50 transition-colors group cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 group-hover:text-blue-700">New Assigned Asset</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Handover to employee profile</div>
                  </div>
                </Link>

                <Link
                  href="/assets/new?mode=stock"
                  onClick={() => setEntryMenuOpen(false)}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-emerald-50 transition-colors group cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Box className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 group-hover:text-emerald-700">Stock / Inventory Asset</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Available unassigned buffer pool</div>
                  </div>
                </Link>

                <Link
                  href="/damaged-scrap?action=new-damaged"
                  onClick={() => setEntryMenuOpen(false)}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-orange-50 transition-colors group cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 group-hover:text-orange-700">Damaged / Scrap Asset</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Broken / scrap equipment onboarding</div>
                  </div>
                </Link>

                <Link
                  href="/damaged-scrap?action=new-missing"
                  onClick={() => setEntryMenuOpen(false)}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-amber-50 transition-colors group cursor-pointer"
                >
                  <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 group-hover:text-amber-700">Missing / Lost Asset</div>
                    <div className="text-[10px] text-slate-500 leading-tight">Lost / stolen equipment onboarding</div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default function Navbar(props: NavbarProps) {
  return (
    <Suspense fallback={<header className="h-14 bg-[#0b1426] border-b border-[#1c2a44]" />}>
      <NavbarContent {...props} />
    </Suspense>
  );
}
