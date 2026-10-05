'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Asset, User, Employee, Department } from '@/types/database';
import { AssetHistoryRecord } from '@/lib/store';
import AssetQRCode from '@/components/assets/AssetQRCode';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import DuplicateAssetTypeModal, { type DuplicateApprovalPayload, type DuplicateConflictInfo } from '@/components/assets/DuplicateAssetTypeModal';
import IncidentReportModal from '@/components/assets/IncidentReportModal';
import { getAssetPreviewImage } from '@/lib/assetVisuals';
import { displayAssetType } from '@/lib/assetType';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  ExternalLink,
  Info,
  Cpu,
  Receipt,
  Package,
  History,
  UserCheck,
  User as UserIcon,
  Building,
  Building2,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Search,
  AlertCircle,
  X,
  Wrench,
  HelpCircle,
  Menu,
  Sliders,
  MapPin,
  Server,
} from 'lucide-react';

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = params?.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AssetHistoryRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showQrScanModal, setShowQrScanModal] = useState(false);
  const [qrSheetUrl, setQrSheetUrl] = useState('');

  // Assign & Deassign modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeassignModal, setShowDeassignModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Incident (Damaged / Missing) Report modal states
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentReportType, setIncidentReportType] = useState<'damaged' | 'missing' | 'scrap'>('damaged');

  const openIncidentModal = (type: 'damaged' | 'missing' | 'scrap') => {
    setIncidentReportType(type);
    setShowIncidentModal(true);
  };
  const [assignEmpQuery, setAssignEmpQuery] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [assignMode, setAssignMode] = useState<'employee' | 'in_house'>('employee');
  const [assignDeptId, setAssignDeptId] = useState('');
  const [assignExactLocation, setAssignExactLocation] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignRemarks, setAssignRemarks] = useState('');
  const [assignHostname, setAssignHostname] = useState('');
  const [assignHodName, setAssignHodName] = useState('');
  const [assignHodEmpCode, setAssignHodEmpCode] = useState('');
  const [assignHodEmail, setAssignHodEmail] = useState('');
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateConflictInfo | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [deassignCondition, setDeassignCondition] = useState('Good Condition (Direct to Available Pool)');
  const [deassignRemarks, setDeassignRemarks] = useState('');
  const [deassigning, setDeassigning] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // 3-Lines Action Dropdown Menu state & ref
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-close menu on scroll or click outside
  useEffect(() => {
    if (!menuOpen) return;

    const handleScroll = () => {
      setMenuOpen(false);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    async function load() {
      try {
        const [assetRes, userRes, empRes, deptRes] = await Promise.all([
          fetch(`/api/assets/${assetId}`).then((r) => r.json()),
          fetch('/api/auth/me').then((r) => r.json()).catch(() => ({ user: null })),
          fetch('/api/employees').then((r) => r.json()).catch(() => ({ employees: [] })),
          fetch('/api/settings/departments').then((r) => r.json()).catch(() => ({ departments: [] })),
        ]);

        if (!assetRes.asset) {
          throw new Error(assetRes.error || 'Asset not found');
        }
        setAsset(assetRes.asset);
        setHistory(assetRes.history || []);

        if (userRes?.user) {
          setCurrentUser(userRes.user);
        }
        if (empRes?.employees) {
          setEmployees(empRes.employees);
        }
        if (deptRes?.departments) {
          setDepartments(deptRes.departments);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load asset');
      } finally {
        setLoading(false);
      }
    }

    if (assetId) load();
  }, [assetId]);

  // Filter employees for assignment modal
  const filteredEmployees = useMemo(() => {
    const q = assignEmpQuery.trim().toLowerCase();
    if (!q) return employees.slice(0, 10);
    return employees
      .filter(
        (e) =>
          e.emp_code.toLowerCase().includes(q) ||
          e.full_name.toLowerCase().includes(q) ||
          e.department?.name?.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [employees, assignEmpQuery]);

  const reloadAssetFromServer = async () => {
    try {
      const res = await fetch(`/api/assets/${assetId}`);
      const data = await res.json();
      if (res.ok && data.asset) {
        setAsset(data.asset);
        setHistory(data.history || []);
      }
    } catch {}
  };

  const handleAssignSubmit = async (e?: React.FormEvent, duplicateApproval?: DuplicateApprovalPayload) => {
    e?.preventDefault();
    if (!asset) return;

    if (assignMode === 'employee' && !selectedEmp) {
      alert('Please select an employee');
      return;
    }

    if (assignMode === 'in_house' && !assignExactLocation.trim()) {
      alert('Please enter exact placement spot in company');
      return;
    }

    if (assignMode === 'in_house' && assignHodEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignHodEmail.trim())) {
      alert('Please enter a valid HOD email address');
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch('/api/assets/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: assignMode,
          assetId: asset.id,
          employeeId: assignMode === 'employee' ? selectedEmp?.id : undefined,
          departmentId: assignMode === 'in_house' ? (assignDeptId || undefined) : undefined,
          exactLocation: assignMode === 'in_house' ? assignExactLocation.trim() : undefined,
          remarks: assignRemarks.trim() || undefined,
          hostname: assignHostname.trim() ? assignHostname.trim().toUpperCase() : undefined,
          duplicateApproval: duplicateApproval || undefined,
          hodNotification:
            assignMode === 'in_house' && assignHodEmail.trim()
              ? {
                  departmentName: departments.find((d) => d.id === assignDeptId)?.name || asset.department?.name,
                  name: assignHodName.trim().toUpperCase(),
                  empCode: assignHodEmpCode.trim().toUpperCase(),
                  email: assignHodEmail.trim().toLowerCase(),
                }
              : undefined,
        }),
      });

      const data = await res.json();
      if (res.status === 409 && data.conflict) {
        setDuplicateConflict(data.conflict as DuplicateConflictInfo);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Assignment failed');
      setDuplicateConflict(null);

      setAsset(data.asset);
      await reloadAssetFromServer();

      setShowAssignModal(false);
      setSelectedEmp(null);
      setAssignEmpQuery('');
      setAssignRemarks('');
      setAssignExactLocation('');
      setAssignHodName('');
      setAssignHodEmpCode('');
      setAssignHodEmail('');
      const hodNote = data.hodMail ? (data.hodMail.sent ? ' HOD notified by email.' : ' HOD email could not be sent.') : '';
      setActionToast(
        assignMode === 'employee'
          ? `Asset successfully assigned to ${selectedEmp?.full_name}!`
          : `Asset successfully deployed for In-House usage!${hodNote}`
      );
      setTimeout(() => setActionToast(null), 3500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;

    setDeassigning(true);
    try {
      const res = await fetch('/api/assets/deassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          returnCondition: deassignCondition,
          remarks: deassignRemarks.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'De-assignment failed');

      setAsset(data.asset);
      await reloadAssetFromServer();

      setShowDeassignModal(false);
      setDeassignRemarks('');
      setActionToast('Asset successfully returned to Available / Stock pool!');
      setTimeout(() => setActionToast(null), 3500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'De-assignment failed');
    } finally {
      setDeassigning(false);
    }
  };

  const openDeleteModal = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAsset = async () => {
    if (!asset) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Delete failed');
      }
      router.push('/assets');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading asset dossier...</p>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="max-w-5xl mx-auto py-12 space-y-4">
        <Link
          href="/assets"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Assets</span>
        </Link>
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-6 text-xs font-semibold">
          {error || 'Asset record does not exist or has been deleted.'}
        </div>
      </div>
    );
  }

  // Derive status label & styling
  const hasEmp = Boolean(asset.assigned_employee_id || asset.assigned_employee);
  const isInHouse = asset.status === 'in_service' && !hasEmp;
  const isStock = asset.status === 'in_storage';
  const isAvailable = isStock;
  const isScrapped = asset.status === 'scrapped';
  const isDamaged = asset.status === 'damaged';
  const isMissing = asset.status === 'missing';

  const statusDisplay = isScrapped
    ? 'Scrapped'
    : isMissing
    ? 'Missing'
    : isDamaged
    ? 'Damaged'
    : isInHouse
    ? 'In-House Active'
    : isStock
    ? 'Available in Stock'
    : hasEmp
    ? 'Assigned'
    : asset.status.toUpperCase();
  const conditionDisplay = (asset as any).condition === 'existing_asset'
    ? 'EXISTING ASSETS'
    : (asset as any).condition === 'new_purchase' || asset.po_number
    ? 'NEW PURCHASE'
    : 'EXISTING ASSETS';

  // Dynamic Specs extraction (from custom_values or parsed metadata specs)
  const specs: Record<string, any> = {
    ...((asset as any).specs || {}),
    ...((Array.isArray(asset.custom_values)
      ? asset.custom_values.reduce((acc: Record<string, string>, cv: any) => {
          const k = (cv.field?.field_name || cv.field_id || '').toLowerCase();
          acc[k] = cv.field_value;
          return acc;
        }, {})
      : asset.custom_values) || {}),
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-16 font-sans">
      {/* Top Breadcrumb Navigation */}
      <div>
        <Link
          href="/assets"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Assets</span>
        </Link>
      </div>

      {/* Main White Asset Dossier Card (Exact match to provided design) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        {/* =================================================================== */}
        {/* HEADER AREA: Thumbnail, Badges, Name, Edit/Delete & Dynamic QR Code */}
        {/* =================================================================== */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-slate-100">
          {/* Left: Thumbnail & Identity */}
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-900 via-[#0f2244] to-slate-950 p-2.5 flex items-center justify-center border border-slate-200 shadow-sm shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAssetPreviewImage(asset.category?.name, (asset as any).it_asset_type, (asset as any).photo_urls)}
                alt={asset.name}
                className="max-h-full max-w-full object-contain filter drop-shadow-md"
              />
            </div>

            <div className="space-y-1.5">
              {/* Badges Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-mono font-black tracking-wider uppercase border border-blue-200">
                  SYS ID: {asset.id.slice(0, 4).toUpperCase()}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono font-black tracking-wider uppercase border border-slate-200">
                  {asset.asset_tag}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase border ${
                    isScrapped
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : isMissing
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : isDamaged
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : isInHouse
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : isStock
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {statusDisplay.toUpperCase()}
                </span>
              </div>

              {/* Title & Subtitle */}
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {asset.name}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {asset.category?.name || 'IT Assets'} - {asset.model || 'Equipment'}
              </p>
            </div>
          </div>

          {/* Right: 3-Lines Action Menu & Unique QR Code */}
          <div className="flex items-center gap-3 self-end md:self-start relative" ref={menuRef}>
            {/* 3-Lines Hamburger Menu Button next to QR Code */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 font-bold text-xs"
                title="Asset Options"
              >
                <Menu className="w-5 h-5 text-slate-700" />
              </button>

              {/* Dropdown Menu - auto closes on mouseLeave, scroll, or click outside */}
              {menuOpen && (
                <div
                  onMouseLeave={() => setMenuOpen(false)}
                  className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 text-xs font-medium animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Asset Actions
                  </div>

                  {/* Option 1: Edit */}
                  <Link
                    href={`/assets/new?edit=${asset.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors font-bold"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600" />
                    <span>Edit</span>
                  </Link>

                  {/* Status Indicator Badges when Actions are Restricted */}
                  {isMissing && (
                    <div className="mx-2 my-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Status: Reported Missing</span>
                    </div>
                  )}

                  {isDamaged && (
                    <div className="mx-2 my-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Status: Under Repair</span>
                    </div>
                  )}

                  {isScrapped && (
                    <div className="mx-2 my-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Status: Scrapped</span>
                    </div>
                  )}

                  {/* Option 2a: De-assign (ONLY if assigned AND not in missing/damaged/scrapped state) */}
                  {!isScrapped && !isMissing && !isDamaged && asset.assigned_employee && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowDeassignModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-800 transition-colors text-left font-bold"
                    >
                      <UserMinus className="w-4 h-4 text-amber-600" />
                      <span>De-assign</span>
                    </button>
                  )}

                  {/* Option 2b: Assign to Employee (ONLY if completely unassigned AND not missing/damaged/scrapped) */}
                  {!isScrapped && !isMissing && !isDamaged && !asset.assigned_employee && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setAssignHostname(asset.hostname || '');
                        setShowAssignModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors text-left font-bold"
                    >
                      <UserPlus className="w-4 h-4 text-emerald-600" />
                      <span>Assign to Employee</span>
                    </button>
                  )}

                  {/* Option 3: Report Damaged - Allowed ONLY if not already Damaged, Missing, or Scrapped */}
                  {!isScrapped && !isDamaged && !isMissing && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        openIncidentModal('damaged');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors text-left font-bold"
                    >
                      <Wrench className="w-4 h-4 text-rose-600" />
                      <span>Report Damaged</span>
                    </button>
                  )}

                  {/* Option 4: Report Missing - Allowed ONLY if not already Missing, Damaged, or Scrapped */}
                  {!isScrapped && !isDamaged && !isMissing && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        openIncidentModal('missing');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors text-left font-bold"
                    >
                      <HelpCircle className="w-4 h-4 text-amber-600" />
                      <span>Report Missing</span>
                    </button>
                  )}

                  {/* Option 5: Delete (Soft delete, strict admin) */}
                  {(currentUser?.role === 'it_admin' || currentUser?.role === 'admin') && (
                    <div className="pt-1 mt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          openDeleteModal();
                        }}
                        disabled={deleting}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 transition-colors text-left font-bold disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Unique QR Code Display */}
            <div className="shrink-0">
              <AssetQRCode
                asset={asset}
                size={88}
                showScanModal={showQrScanModal}
                onModalClose={() => setShowQrScanModal(false)}
                onSheetUrlChange={setQrSheetUrl}
              />
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* Blue Info Banner (Matching provided image)                         */}
        {/* =================================================================== */}
        <div
          onClick={() => {
            if (qrSheetUrl) {
              window.open(qrSheetUrl, '_blank', 'noopener,noreferrer');
            } else {
              setShowQrScanModal(true);
            }
          }}
          className="bg-blue-50/90 hover:bg-blue-100/80 border border-blue-200/90 rounded-xl px-4 py-3 flex items-center justify-between text-xs font-semibold text-blue-900 shadow-2xs transition-all cursor-pointer"
          title="Open the scan page (PDF)"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Tap the QR code to open the scan page (PDF).</span>
          </div>
          <span className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1">
            <span>OPEN SCAN</span>
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>

        {/* =================================================================== */}
        {/* CUSTODIAN & ALLOCATION STATUS CARD (Interactive Stock & Custody)   */}
        {/* =================================================================== */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wider">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>CUSTODIAN &amp; ALLOCATION STATUS</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isScrapped
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : isMissing
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : isDamaged
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : isInHouse
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                  : isStock
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-blue-50 text-blue-700 border-blue-300'
              }`}
            >
              {isScrapped
                ? 'SCRAPPED / DECOMMISSIONED'
                : isMissing
                ? 'REPORTED MISSING'
                : isDamaged
                ? 'DAMAGED / UNDER REPAIR'
                : isInHouse
                ? 'IN-HOUSE ACTIVE'
                : isStock
                ? 'AVAILABLE IN STOCK POOL'
                : 'CURRENTLY ASSIGNED'}
            </span>
          </div>

          {isScrapped ? (
            <div className="p-3.5 bg-rose-50/80 rounded-xl border border-rose-200 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-black text-rose-950 text-xs uppercase tracking-wider block">
                  Scrapped / Decommissioned Equipment
                </span>
                <span className="text-[11px] text-rose-800 font-medium">
                  This asset has been decommissioned / condemned and sent to scrap pool. It is retired from operational use.
                </span>
              </div>
            </div>
          ) : isMissing ? (
            <div className="p-3.5 bg-rose-50/80 rounded-xl border border-rose-200 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-black text-rose-950 text-xs uppercase tracking-wider block">
                  Reported Missing / Lost Equipment
                </span>
                <span className="text-[11px] text-rose-800 font-medium">
                  This asset has been reported lost or missing. Operational custody is suspended.
                </span>
              </div>
            </div>
          ) : isDamaged ? (
            <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-black text-amber-950 text-xs uppercase tracking-wider block">
                  Damaged Equipment / Under Inspection
                </span>
                <span className="text-[11px] text-amber-800 font-medium">
                  This asset is reported as damaged and undergoing repair or technical review.
                </span>
              </div>
            </div>
          ) : asset.assigned_employee ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                  {asset.assigned_employee.full_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-sm">
                      {asset.assigned_employee.full_name}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {asset.assigned_employee.emp_code}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Dept: {asset.department?.name || 'General'}</span>
                    <span>•</span>
                    <span>Plant: {asset.plant?.name || 'Main Plant'}</span>
                  </div>
                  {(() => {
                    const active = history.find((h) => h.type === 'assignment' && !h.return_date);
                    return active?.date ? (
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Assigned on: <strong className="text-slate-700">{formatDateTime(active.date)}</strong></span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
          ) : isInHouse ? (
            <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-black text-emerald-950 text-xs uppercase tracking-wider block">
                  In-House Active Equipment ({asset.department?.name || 'Department Custody'})
                </span>
                <span className="text-[11px] text-emerald-800 font-medium">
                  {specs.exact_location
                    ? `Installed Location: ${specs.exact_location}`
                    : 'Active in-house equipment deployed in department.'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-white rounded-xl border border-dashed border-amber-300">
              <div className="flex items-center gap-2.5 text-xs text-slate-600">
                <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-800">Unassigned Stock: </span>
                  <span>This equipment is in available inventory pool.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* SECTION 1: GENERAL INFORMATION (Two Column Clean Grid)             */}
        {/* =================================================================== */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>GENERAL INFORMATION</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-xs">
            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                LOCATION
              </span>
              <span className="font-black text-slate-900 text-sm uppercase">
                {asset.location?.name || 'GREATER NOIDA HQ'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                PLANT NAME
              </span>
              <span className="font-black text-slate-900 text-sm uppercase">
                {asset.plant?.name || 'PLANT 1 - FINAL ASSEMBLY'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                EMPLOYEE DEPARTMENT
              </span>
              <span className="font-black text-slate-900 text-sm uppercase">
                {asset.department?.name || asset.category?.name || 'IT'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                ASSET TYPE
              </span>
              <span className="font-black text-blue-600 text-sm uppercase">
                {displayAssetType(asset)}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                EQUIPMENT MODEL
              </span>
              <span className="font-black text-blue-600 text-sm uppercase">
                {asset.model || 'N/A'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                SERIAL NUMBER
              </span>
              <span className="font-mono font-black text-slate-900 text-sm uppercase">
                {asset.serial_number || 'N/A'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                <Server className="w-3 h-3 text-blue-600" />
                HOSTNAME
              </span>
              <span className="font-mono font-black text-blue-900 text-sm uppercase">
                {asset.hostname || 'NOT CONFIGURED'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                CONDITION
              </span>
              <span className="font-black text-amber-600 text-sm uppercase">
                {conditionDisplay}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                STATUS
              </span>
              <span className="font-black text-emerald-600 text-sm uppercase">
                {statusDisplay}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                REGISTERED ON
              </span>
              <span className="font-black text-slate-900 text-sm">
                {formatDateTime(asset.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SECTION 2: NETWORK & TECH SPECIFICATIONS                           */}
        {/* =================================================================== */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span>NETWORK &amp; TECH SPECIFICATIONS</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-xs">
            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                CPU / PROCESSOR
              </span>
              <span className="font-black text-slate-900 text-sm uppercase">
                {specs.processor || specs.cpu || 'INTEL CORE I7-13700H'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                RAM
              </span>
              <span className="font-black text-slate-900 text-sm uppercase">
                {specs.ram_size || specs.ram || '16 GB'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                STORAGE (SSD)
              </span>
              <span className="font-black text-slate-900 text-sm uppercase">
                {specs.storage_capacity || specs.storage || '512 GB SSD'}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                WINDOWS VERSION / OS
              </span>
              <span className="font-black text-slate-900 text-sm uppercase">
                {specs.operating_system || specs.os || 'Windows 11 Pro'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Department Custom Specifications */}
        {Array.isArray(asset.custom_values) && asset.custom_values.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>DEPARTMENT SPECIFICATIONS &amp; DYNAMIC ATTRIBUTES</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {asset.custom_values.map((cv: any) => (
                <div key={cv.id || cv.field_id} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    {cv.field?.field_label || cv.field_id}
                  </span>
                  <span className="font-black text-slate-900 text-xs uppercase mt-0.5 block">
                    {cv.field_value || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SECTION 3: COMMERCIAL, PURCHASE ORDER & WARRANTY                   */}
        {/* =================================================================== */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Receipt className="w-3.5 h-3.5 text-blue-600" />
            <span>COMMERCIAL, PURCHASE ORDER &amp; WARRANTY</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                VENDOR NAME
              </span>
              <span className="font-black text-slate-900 text-xs uppercase mt-0.5 block">
                {asset.vendor_name || 'DIRECT OEM'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                PURCHASE ORDER (PO)
              </span>
              <span className="font-mono font-black text-blue-600 text-xs uppercase mt-0.5 block">
                {asset.po_number || 'PO-2026-N/A'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                PURCHASE COST
              </span>
              <span className="font-black text-slate-900 text-xs uppercase mt-0.5 block">
                {formatCurrency(asset.purchase_cost)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                PURCHASE DATE
              </span>
              <span className="font-black text-slate-900 text-xs uppercase mt-0.5 block">
                {formatDate(asset.purchase_date)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                WARRANTY EXPIRY
              </span>
              <span className="font-black text-slate-900 text-xs uppercase mt-0.5 block">
                {formatDate(asset.warranty_expiry)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                AMC PROVIDER / EXPIRY
              </span>
              <span className="font-black text-slate-900 text-xs uppercase mt-0.5 block">
                {asset.amc_vendor || 'N/A'} {asset.amc_expiry ? `(${formatDate(asset.amc_expiry)})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SECTION 4: ADDITIONAL HANDOVER ITEMS & PERIPHERALS CHECKLIST       */}
        {/* =================================================================== */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span>ADDITIONAL HANDOVER ITEMS &amp; PERIPHERALS</span>
          </div>

          {asset.peripherals && asset.peripherals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {asset.peripherals.map((p, i) => (
                <div
                  key={p.id || i}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-black text-slate-800 uppercase">
                      {p.peripheral_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                    {p.model_number && <span>Model: {p.model_number}</span>}
                    {p.model_number && p.serial_number && <span>•</span>}
                    {p.serial_number && <span>SN: {p.serial_number}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No additional bundled peripherals or accessories registered for this equipment.
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* SECTION 5: ASSET ASSIGNMENT & TRANSFER HISTORY (Full Audit Trail)   */}
        {/* =================================================================== */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>ASSET ASSIGNMENT &amp; CUSTODY HISTORY</span>
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase">
              {history.length} Event(s) Logged
            </span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {history.map((h, index) => {
              const isCurrent = h.status === 'Active Custodian';
              return (
                <div key={h.id || index} className="relative group">
                  {/* Timeline Dot */}
                  <div
                    className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 flex items-center justify-center bg-white ${
                      isCurrent
                        ? 'border-emerald-600 text-emerald-600 ring-4 ring-emerald-50'
                        : 'border-slate-400 text-slate-400'
                    }`}
                  >
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        isCurrent ? 'bg-emerald-600' : 'bg-slate-400'
                      }`}
                    />
                  </div>

                  {/* History Card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:shadow-xs transition-all space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            isCurrent
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {h.status}
                        </span>
                        <h4 className="text-xs font-black text-slate-900">
                          {h.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatDateTime(h.date)}</span>
                      </div>
                    </div>

                    {/* Employee Custodian Details */}
                    {h.employee_name && (
                      <div className="flex items-center gap-3 text-xs pt-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{h.employee_name}</span>
                        </div>
                        {h.emp_code && (
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                            {h.emp_code}
                          </span>
                        )}
                        {h.return_date && (
                          <span className="text-[11px] text-slate-500">
                            (Returned on: {formatDateTime(h.return_date)})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Department / Location Transfer Details */}
                    {h.type === 'transfer' && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                        <Building className="w-3.5 h-3.5 text-blue-600" />
                        <span>{h.from_dept || 'Origin'}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-bold text-slate-900">{h.to_dept}</span>
                        {h.to_plant && (
                          <span className="text-[11px] text-slate-400">
                            • {h.to_plant}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Remarks / Notes */}
                    {h.remarks && (
                      <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
                        &ldquo;{h.remarks}&rdquo;
                      </p>
                    )}

                    {h.performed_by && (
                      <p className="text-[11px] text-slate-500">
                        {h.type === 'transfer' ? 'Moved by' : 'Assigned by'}:{' '}
                        <span className="font-semibold text-slate-700">{h.performed_by}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ASSIGNMENT MODAL: Auto-Lookup Employee & Handover                     */}
      {/* ===================================================================== */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {assignMode === 'employee' ? 'Assign Asset to Employee' : 'Deploy Asset In-House'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedEmp(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
              <div className="font-black text-slate-900">{asset.name}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                <span className="font-mono font-bold text-blue-600">{asset.asset_tag}</span>
                <span>•</span>
                <span>Serial: {asset.serial_number || 'N/A'}</span>
              </div>
            </div>

            {/* Assignment Mode Tabs */}
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
                <UserIcon className="w-3.5 h-3.5" />
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

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {assignMode === 'employee' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    1. Search Employee by ID or Name *
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={assignEmpQuery}
                      onChange={(e) => setAssignEmpQuery(e.target.value.toUpperCase())}
                      placeholder="Type Employee ID (e.g. PGEL-001) or Name..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 uppercase focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-1 bg-slate-50/50">
                    {filteredEmployees.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No matching employee found.
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => setSelectedEmp(emp)}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                            selectedEmp?.id === emp.id
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-white hover:bg-blue-50 text-slate-700 border border-slate-200/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black">{emp.emp_code}</span>
                            <span>-</span>
                            <span>{emp.full_name}</span>
                          </div>
                          <span className="text-[10px] opacity-80">{emp.department?.name || 'General'}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {selectedEmp && (
                    <div className="mt-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1 animate-in fade-in duration-150">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Selected Custodian: {selectedEmp.full_name}</span>
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        ID: <strong className="font-mono">{selectedEmp.emp_code}</strong> | Dept: {selectedEmp.department?.name || 'General'}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* In-House Mode */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Assigned Department (Optional)
                    </label>
                    <select
                      value={assignDeptId}
                      onChange={(e) => setAssignDeptId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
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
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Exact Placement Spot in Company *
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={assignExactLocation}
                        onChange={(e) => setAssignExactLocation(e.target.value.toUpperCase())}
                        placeholder="e.g. GATE 1 RECEPTION, SERVER ROOM RACK 2, QUALITY LAB..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase focus:outline-none focus:border-emerald-500 focus:bg-white"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Specify exact location where this camera/printer/server/switch is installed.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-2">
                    <div className="text-[11px] font-black text-emerald-900 uppercase tracking-wider">
                      Department HOD (email notification)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={assignHodName}
                        onChange={(e) => setAssignHodName(e.target.value.toUpperCase())}
                        placeholder="HOD Name"
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="text"
                        value={assignHodEmpCode}
                        onChange={(e) => setAssignHodEmpCode(e.target.value.toUpperCase())}
                        placeholder="HOD Employee ID"
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-semibold uppercase focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="email"
                        value={assignHodEmail}
                        onChange={(e) => setAssignHodEmail(e.target.value)}
                        placeholder="hod@pgel.in"
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-semibold lowercase focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <p className="text-[10px] text-emerald-700">If an email is entered, the HOD is notified with this asset&apos;s details.</p>
                  </div>
                </div>
              )}

              {/* Hostname Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Deployment / Handover Remarks
                </label>
                <textarea
                  rows={2}
                  value={assignRemarks}
                  onChange={(e) => setAssignRemarks(e.target.value)}
                  placeholder={assignMode === 'employee' ? "e.g. Issued for official operations with charger & bag..." : "e.g. Installed for security monitoring at Gate 1..."}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || (assignMode === 'employee' ? !selectedEmp : !assignExactLocation.trim())}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{assigning ? 'Deploying...' : assignMode === 'employee' ? 'Confirm Handover' : 'Confirm In-House Deployment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DE-ASSIGNMENT MODAL: Return to Available / Stock Pool                 */}
      {/* ===================================================================== */}
      {showDeassignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <UserMinus className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  De-assign Asset
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeassignModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <div className="font-black">Current Custodian: {asset.assigned_employee?.full_name} ({asset.assigned_employee?.emp_code})</div>
              <div className="text-[11px] text-amber-700">
                Equipment: <strong>{asset.name}</strong> ({asset.asset_tag})
              </div>
            </div>

            <form onSubmit={handleDeassignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  De-assign / Return Condition *
                </label>
                <select
                  value={deassignCondition}
                  onChange={(e) => setDeassignCondition(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Good Condition (Direct to Available Pool)">
                    Good Condition (Direct to Available Pool)
                  </option>
                  <option value="Minor Scratches / Wear (Acceptable for Pool)">
                    Minor Scratches / Wear (Acceptable for Pool)
                  </option>
                  <option value="Defective / Needs Technical Maintenance">
                    Defective / Needs Technical Maintenance
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  De-assignment Inspection Remarks
                </label>
                <textarea
                  rows={2}
                  value={deassignRemarks}
                  onChange={(e) => setDeassignRemarks(e.target.value)}
                  placeholder="e.g. Employee resignation clearance, accessories returned in good order..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeassignModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deassigning}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{deassigning ? 'De-assigning...' : 'Confirm De-assignment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incident Report Modal (Damaged / Missing / Scrap) */}
      {showIncidentModal && asset && (
        <IncidentReportModal
          isOpen={showIncidentModal}
          onClose={() => setShowIncidentModal(false)}
          onSuccess={() => {
            setShowIncidentModal(false);
            window.location.reload();
          }}
          assets={[asset]}
          initialAssetId={asset.id}
          initialReportType={incidentReportType}
        />
      )}

      {/* Floating Action Toast */}
      {duplicateConflict && (
        <DuplicateAssetTypeModal
          conflict={duplicateConflict}
          employeeLabel={selectedEmp ? `${selectedEmp.full_name} (${selectedEmp.emp_code})` : undefined}
          assetContext={{ assetId: asset?.id }}
          onClose={() => setDuplicateConflict(null)}
          onDeassigned={() => {
            setDuplicateConflict(null);
            handleAssignSubmit();
          }}
          onApproved={(approval) => {
            setDuplicateConflict(null);
            handleAssignSubmit(undefined, approval);
          }}
        />
      )}

      {actionToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 text-white px-5 py-3 text-xs font-bold shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* CUSTOM SOFT DELETE ASSET MODAL */}
      {showDeleteModal && asset && (
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
                onClick={() => setShowDeleteModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <p className="font-bold text-slate-900">
                Are you sure you want to soft-delete asset &ldquo;{asset.asset_tag}&rdquo; ({asset.name})?
              </p>
              <p className="text-[11px] text-rose-700 font-medium">
                Only authorized IT Administrators can perform this action. The asset record will be archived.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAsset}
                disabled={deleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
