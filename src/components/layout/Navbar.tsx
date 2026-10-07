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
  ChevronDown,
  Users,
  User as UserIcon,
  HelpCircle,
  Box,
  AlertTriangle,
} from 'lucide-react';

interface NavbarProps {
  user?: User | null;
  scope?: UserScope | null;
}

const LOCATIONS_STATIC = [
  { id: '', name: 'All Locations (Corporate Scope)', short: 'All Locations' },
  { id: '11111111-1111-1111-1111-111111111101', name: 'Pune', short: 'Pune' },
];

const PLANTS_STATIC: Array<{ id: string; location_id: string; name: string; short: string; code?: string }> = [
  { id: '', location_id: '', name: 'All Plants', short: 'All Plants', code: '' },
  { id: '22222222-2222-2222-2222-222222222201', location_id: '11111111-1111-1111-1111-111111111101', name: 'NGM', short: 'NGM', code: 'NGM' },
  { id: '22222222-2222-2222-2222-222222222202', location_id: '11111111-1111-1111-1111-111111111101', name: 'PGTL', short: 'PGTL', code: 'PGTL' },
  { id: '22222222-2222-2222-2222-222222222203', location_id: '11111111-1111-1111-1111-111111111101', name: 'PGEL', short: 'PGEL', code: 'PGEL' },
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

  // Dynamic Structure Data
  const [locations, setLocations] = useState<Location[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Popover Open State
  const [entryMenuOpen, setEntryMenuOpen] = useState(false);
  const entryMenuRef = useRef<HTMLDivElement | null>(null);

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

  // Close entry menu popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (entryMenuRef.current && !entryMenuRef.current.contains(e.target as Node)) {
        setEntryMenuOpen(false);
      }
    }
    if (entryMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [entryMenuOpen]);

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

      // Dispatch real-time global event for instant reactivity
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aems:plant-changed', { detail: { plantId: updates.plantId } }));
      }
    },
    [router]
  );

  const handleOpenAddEmployee = () => {
    window.dispatchEvent(new CustomEvent('aems:open-add-employee'));
  };

  const isItAdmin = activeUser?.role === 'it_admin';

  // Allowed plants based on user privileges and assigned multi-plant scopes
  const userAllowedPlants = useMemo(() => {
    const allAvailable = plants.length > 0 ? plants : PLANTS_STATIC.filter((p) => p.id);
    if (isItAdmin) {
      return allAvailable;
    }
    // Check if non-IT admin/user has scoped plant_ids
    if (activeScope?.plant_ids && activeScope.plant_ids.length > 0) {
      const scoped = allAvailable.filter((p) => activeScope.plant_ids!.includes(p.id));
      if (scoped.length > 0) return scoped;
    }
    // Fallback to activeUser.plant_id
    if (activeUser?.plant_id) {
      const p = allAvailable.filter((pl) => pl.id === activeUser.plant_id);
      if (p.length > 0) return p;
    }
    return allAvailable;
  }, [plants, isItAdmin, activeScope, activeUser]);

  const assignedPltId = activeUser?.plant_id || activeScope?.plant_ids?.[0] || '';
  const assignedPlt = plants.find((p) => p.id === assignedPltId) || PLANTS_STATIC.find((p) => p.id === assignedPltId);
  const activePltObj = plants.find((p) => p.id === localPlant) || PLANTS_STATIC.find((p) => p.id === localPlant);
  const pltDisplay = activePltObj
    ? activePltObj.name
    : (!isItAdmin && userAllowedPlants.length === 1 ? (userAllowedPlants[0]?.name || 'Assigned Plant') : 'All Plants');

  const handleDirectPlantChange = (pltId: string) => {
    setLocalPlant(pltId);
    const matchedPlant = plants.find((p) => p.id === pltId);
    updateUrlParams({
      plantId: pltId || null,
      locationId: matchedPlant?.location_id || null,
    });
  };

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

        {/* Direct Production Plant Filter Dropdown */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border bg-white/[0.08] hover:bg-white/[0.12] border-white/15 text-slate-200 shadow-2xs transition-all select-none">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span className="text-slate-400 font-bold text-[11px] shrink-0">Plant:</span>
          {userAllowedPlants.length > 1 ? (
            <div className="relative flex items-center">
              <select
                value={localPlant}
                onChange={(e) => handleDirectPlantChange(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-4 appearance-none [&>option]:bg-slate-900 [&>option]:text-white"
                title="Filter all data by Production Plant"
              >
                <option value="">
                  {isItAdmin ? 'All Plants' : `All Assigned Plants (${userAllowedPlants.length})`}
                </option>
                {userAllowedPlants.map((p) => {
                  const code = 'code' in p && (p as any).code ? (p as any).code : '';
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} {code && code !== p.name ? `(${code})` : ''}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none -ml-3" />
            </div>
          ) : (
            <span className="text-white font-bold text-xs">
              {userAllowedPlants[0]?.name || pltDisplay}
            </span>
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
