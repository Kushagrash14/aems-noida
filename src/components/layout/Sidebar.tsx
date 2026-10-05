'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSidebar } from './SidebarContext';
import { User } from '@/types/database';
import {
  LayoutDashboard,
  Box,
  Sliders,
  Wrench,
  Users,
  UserCheck,
  FileSpreadsheet,
  FileText,
  Settings,
  ShieldCheck,
  Building,
  Building2,
  Pin,
  PinOff,
  X,
  ChevronDown,
  LogOut,
  Laptop,
  Video,
  Zap,
  Cog,
  Flame,
  Truck,
  Armchair,
  Key,
  Folder,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';

interface CategoryItem {
  id: string;
  name: string;
  code: string;
  icon: typeof Folder;
}

const DEFAULT_DEPARTMENTS: CategoryItem[] = [
  { id: '44444444-4444-4444-4444-444444444401', name: 'IT Assets', code: 'CAT-IT', icon: Laptop },
  { id: '44444444-4444-4444-4444-444444444402', name: 'Camera / NVR', code: 'CAT-SEC', icon: Video },
  { id: '44444444-4444-4444-4444-444444444403', name: 'Quality Assurance', code: 'CAT-QA', icon: ShieldCheck },
  { id: '44444444-4444-4444-4444-444444444404', name: 'Electrical & Power', code: 'CAT-ELEC', icon: Zap },
  { id: '44444444-4444-4444-4444-444444444405', name: 'Production & Tooling', code: 'CAT-PROD', icon: Cog },
  { id: '44444444-4444-4444-4444-444444444406', name: 'Safety & HSE', code: 'CAT-SAFE', icon: Flame },
  { id: '44444444-4444-4444-4444-444444444407', name: 'Vehicles & Fleet', code: 'CAT-VEH', icon: Truck },
  { id: '44444444-4444-4444-4444-444444444408', name: 'Furniture & Fixture', code: 'CAT-FURN', icon: Armchair },
  { id: '44444444-4444-4444-4444-444444444409', name: 'Software Licenses', code: 'CAT-SW', icon: Key },
  { id: '44444444-4444-4444-4444-444444444410', name: 'Plant Maintenance', code: 'CAT-MAINT', icon: Wrench },
];

function getCategoryIcon(nameOrIcon: string) {
  const lower = (nameOrIcon || '').toLowerCase();
  if (lower.includes('it') || lower.includes('laptop') || lower.includes('computer')) return Laptop;
  if (lower.includes('cam') || lower.includes('nvr') || lower.includes('cctv') || lower.includes('sec')) return Video;
  if (lower.includes('qual') || lower.includes('qa')) return ShieldCheck;
  if (lower.includes('elec') || lower.includes('power')) return Zap;
  if (lower.includes('prod') || lower.includes('mould') || lower.includes('tool')) return Cog;
  if (lower.includes('safe') || lower.includes('fire')) return Flame;
  if (lower.includes('veh') || lower.includes('truck') || lower.includes('forklift')) return Truck;
  if (lower.includes('furn') || lower.includes('chair')) return Armchair;
  if (lower.includes('soft') || lower.includes('lic')) return Key;
  if (lower.includes('maint')) return Wrench;
  return Folder;
}

const SETTINGS_NAV_ITEMS = [
  { href: '/settings?tab=users', label: 'User Management', icon: ShieldCheck, tab: 'users' },
  { href: '/settings?tab=location_plant', label: 'Plant or Location', icon: Building, tab: 'location_plant' },
  { href: '/settings?tab=entry_form', label: 'Entry Form', icon: Sliders, tab: 'entry_form' },
  { href: '/settings?tab=bulk_import', label: 'Bulk Excel Import', icon: FileSpreadsheet, tab: 'bulk_import' },
  { href: '/settings?tab=security_audit', label: 'Security Audit', icon: FileText, tab: 'security_audit' },
];

interface SidebarProps {
  user?: User | null;
}

function SidebarContent({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOpen, isPinned, togglePin, closeSidebar, setHovered } = useSidebar();
  const [currentTab, setCurrentTab] = useState('users');
  const [deptExpanded, setDeptExpanded] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleNavClick = () => {
    if (!isPinned) {
      closeSidebar();
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  useEffect(() => {
    const typeVal = searchParams.get('type');
    const tabVal = searchParams.get('tab');
    setCurrentTab(typeVal || tabVal || 'users');

    const deptId = searchParams.get('deptId') || '';
    setSelectedDeptId(deptId);

    if (deptId) {
      setDeptExpanded(true);
    }
  }, [pathname, searchParams]);

  // Fetch dynamic departments on mount and route changes
  useEffect(() => {
    fetch('/api/settings/departments')
      .then((r) => r.json())
      .then((deptRes) => {
        if (Array.isArray(deptRes?.departments)) {
          setDepartments(deptRes.departments);
        }
      })
      .catch(() => {});
  }, [pathname]);

  return (
    <>
      {/* Mobile-only Backdrop (visible ONLY on mobile screens when sidebar is open; desktop has NO click-blocking backdrop so all buttons and cards are directly clickable) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[70] transition-opacity cursor-pointer animate-in fade-in duration-150"
          onClick={closeSidebar}
        />
      )}

      {/* Edge Hover Trigger Strip (active when sidebar is closed, strictly below navbar) */}
      {!isPinned && !isOpen && (
        <div
          onMouseEnter={() => setHovered(true)}
          className="fixed left-0 top-14 bottom-0 w-3 z-30 transition-all pointer-events-auto"
          aria-hidden="true"
        />
      )}

      {/* Sliding Sidebar Drawer (Clean White Theme) */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          if (!isPinned) setHovered(false);
        }}
        className={`fixed left-0 top-0 bottom-0 w-64 bg-white/95 backdrop-blur-2xl border-r border-slate-200/90 shadow-2xl z-[80] flex flex-col transition-transform duration-300 ease-out font-sans ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header (Without PG Logo Box) */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900 tracking-wider">AEMS</span>
              <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                v2.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Navigation Menu</p>
          </div>

          <div className="flex items-center gap-1">
            {/* Pin / Unpin button */}
            <button
              onClick={togglePin}
              title={isPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isPinned
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              {isPinned ? <Pin className="w-3.5 h-3.5 rotate-45 text-blue-600" /> : <PinOff className="w-3.5 h-3.5" />}
            </button>

            {/* Close button */}
            <button
              onClick={closeSidebar}
              title="Close menu"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        {/* Navigation Links */}
        <nav className="flex-1 space-y-0.5 px-3 py-3 overflow-y-auto">
          {/* 1. Overview (All Roles) */}
          <Link
            href="/"
            onClick={handleNavClick}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              pathname === '/'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className={`h-4 w-4 shrink-0 ${pathname === '/' ? 'text-white' : 'text-slate-500'}`} />
            <span>Overview</span>
          </Link>

          {/* 2. Assets Directory (All Roles) */}
          <Link
            href="/assets"
            onClick={handleNavClick}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              pathname === '/assets' && !selectedDeptId
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <Box className={`h-4 w-4 shrink-0 ${pathname === '/assets' && !selectedDeptId ? 'text-white' : 'text-slate-500'}`} />
            <span>Assets Directory</span>
          </Link>

          {/* 3. Damaged & Scrap Assets (All Roles) */}
          <Link
            href="/damaged-scrap?type=damaged"
            onClick={handleNavClick}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              pathname.startsWith('/damaged-scrap') && currentTab !== 'missing'
                ? 'bg-orange-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className={`h-4 w-4 shrink-0 ${pathname.startsWith('/damaged-scrap') && currentTab !== 'missing' ? 'text-white' : 'text-orange-500'}`} />
            <span>Damaged &amp; Scrap</span>
          </Link>

          {/* 4. Missing & Lost Assets (All Roles) */}
          <Link
            href="/damaged-scrap?type=missing"
            onClick={handleNavClick}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              pathname.startsWith('/damaged-scrap') && currentTab === 'missing'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <HelpCircle className={`h-4 w-4 shrink-0 ${pathname.startsWith('/damaged-scrap') && currentTab === 'missing' ? 'text-white' : 'text-amber-500'}`} />
            <span>Missing &amp; Lost</span>
          </Link>

          {/* 5. Departments Expandable Accordion (Strictly IT Admin Only) */}
          {user?.role === 'it_admin' && (
            <div className="space-y-0.5 pt-0.5">
              <button
                type="button"
                onClick={() => setDeptExpanded((prev) => !prev)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  pathname.startsWith('/assets') && selectedDeptId
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-100'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className={`h-4 w-4 shrink-0 ${deptExpanded ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span>Departments</span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    deptExpanded ? 'rotate-180 text-blue-600' : 'text-slate-400'
                  }`}
                />
              </button>

              {deptExpanded && (
                <div className="pl-3 pr-1 py-1 space-y-0.5 border-l-2 border-blue-200 ml-4 animate-in slide-in-from-top-1 duration-150">
                  {departments.length === 0 ? (
                    <p className="text-[11px] text-slate-400 px-2 py-1 italic">No departments created</p>
                  ) : (
                    departments.map((d) => {
                      const isDeptActive = pathname === '/assets' && selectedDeptId === d.id;
                      return (
                        <Link
                          key={d.id}
                          href={`/assets?deptId=${d.id}`}
                          onClick={() => {
                            setSelectedDeptId(d.id);
                            handleNavClick();
                          }}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                            isDeptActive
                              ? 'bg-blue-600 text-white font-bold shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <Building2 className={`h-3.5 w-3.5 shrink-0 ${isDeptActive ? 'text-white' : 'text-slate-400'}`} />
                          <span className="truncate">{d.name}</span>
                        </Link>
                      );
                    })
                  )}

                  <Link
                    href="/settings?tab=location_plant"
                    onClick={handleNavClick}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-blue-600 font-semibold hover:bg-blue-50 transition-colors mt-1"
                  >
                    <span>Manage Departments →</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* =================================================================== */}
          {/* MANAGEMENT SECTION                                                 */}
          {/* =================================================================== */}
          <div className="pt-3 pb-1 px-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              MANAGEMENT
            </span>
          </div>

          {/* Preventive Maintenance (IT Admin Only) */}
          {user?.role === 'it_admin' && (
            <Link
              href="/maintenance"
              onClick={handleNavClick}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                pathname.startsWith('/maintenance')
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Wrench className={`h-4 w-4 shrink-0 ${pathname.startsWith('/maintenance') ? 'text-white' : 'text-slate-500'}`} />
              <span>Preventive Maintenance</span>
            </Link>
          )}

          {/* Staff Directory (All Roles: IT Admin, Admin, and User) */}
          <Link
            href="/staff-directory"
            onClick={handleNavClick}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              pathname.startsWith('/staff-directory')
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <UserCheck className={`h-4 w-4 shrink-0 ${pathname.startsWith('/staff-directory') ? 'text-white' : 'text-slate-500'}`} />
            <span>Staff Directory</span>
          </Link>

          {/* HR Dashboard (IT Admin & HR Only) */}
          {(user?.role === 'it_admin' || user?.role === 'hr') && (
            <Link
              href="/employees"
              onClick={handleNavClick}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                pathname.startsWith('/employees')
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Users className={`h-4 w-4 shrink-0 ${pathname.startsWith('/employees') ? 'text-white' : 'text-slate-500'}`} />
              <span>HR Dashboard</span>
            </Link>
          )}

          {/* Admin User Management Link (Admin role only - directly takes to user management tab) */}
          {user?.role === 'admin' && (
            <Link
              href="/settings?tab=users"
              onClick={handleNavClick}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                pathname.startsWith('/settings')
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className={`h-4 w-4 shrink-0 ${pathname.startsWith('/settings') ? 'text-white' : 'text-slate-500'}`} />
              <span>User Management</span>
            </Link>
          )}

          {/* Settings & Administration Hub (IT Admin Only - Full 5 tabs) */}
          {user?.role === 'it_admin' && (
            <Link
              href="/settings"
              onClick={handleNavClick}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                pathname.startsWith('/settings')
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              }`}
            >
              <Settings className={`h-4 w-4 shrink-0 ${pathname.startsWith('/settings') ? 'text-white' : 'text-slate-500'}`} />
              <span>Settings &amp; Admin</span>
            </Link>
          )}
        </nav>

        {/* Sidebar Footer with User Identity & Sign out */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.full_name || 'IT Admin'}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase truncate">
                  {user?.role === 'it_admin' ? 'IT ADMIN' : user?.role === 'admin' ? 'ADMIN' : 'USER'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sign out of current session"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-100/80 border border-rose-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">{loggingOut ? '...' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<aside className="w-64 bg-white border-r border-slate-200" />}>
      <SidebarContent {...props} />
    </Suspense>
  );
}
