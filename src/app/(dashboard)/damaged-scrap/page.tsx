'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DamageScrapReport, Asset } from '@/types/database';
import { formatDateTime } from '@/lib/utils';
import {
  AlertTriangle,
  FileText,
  Wrench,
  HelpCircle,
  Trash2,
  CheckCircle2,
  Edit,
  User,
  Eye,
  Search,
  Check,
  ArrowRight,
} from 'lucide-react';
import IncidentReportModal from '@/components/assets/IncidentReportModal';
import IncidentResolutionModal from '@/components/assets/IncidentResolutionModal';
import DamagedEntryModal from '@/components/assets/DamagedEntryModal';
import MissingEntryModal from '@/components/assets/MissingEntryModal';

type ModuleType = 'damaged' | 'missing';
type ActiveTab = 'damaged' | 'missing' | 'scrap' | 'resolved';

function DamagedScrapContent() {
  const searchParams = useSearchParams();
  const [selectedPlant, setSelectedPlant] = useState<string>(
    () => searchParams.get('plantId') || searchParams.get('plant') || ''
  );

  useEffect(() => {
    setSelectedPlant(searchParams.get('plantId') || searchParams.get('plant') || '');
  }, [searchParams]);

  useEffect(() => {
    const handlePlantChanged = (e: Event) => {
      const custom = e as CustomEvent<{ plantId?: string | null }>;
      setSelectedPlant(custom.detail?.plantId || '');
    };
    window.addEventListener('aems:plant-changed', handlePlantChanged);
    return () => window.removeEventListener('aems:plant-changed', handlePlantChanged);
  }, []);

  const [reports, setReports] = useState<DamageScrapReport[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Dedicated Module Mode: 'damaged' vs 'missing'
  const [moduleMode, setModuleMode] = useState<ModuleType>('damaged');
  const [activeTab, setActiveTab] = useState<ActiveTab>('damaged');
  const [searchQuery, setSearchQuery] = useState('');

  // Dedicated Entry Modals
  const [showDamagedModal, setShowDamagedModal] = useState(false);
  const [showMissingModal, setShowMissingModal] = useState(false);

  // Edit / Legacy Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [initialReportType, setInitialReportType] = useState<'damaged' | 'missing' | 'scrap'>('damaged');
  const [editingReport, setEditingReport] = useState<DamageScrapReport | null>(null);

  // Resolution Modal
  const [resolvingReport, setResolvingReport] = useState<DamageScrapReport | null>(null);

  // Preview Image Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsRes, assetsRes] = await Promise.all([
        fetch('/api/damaged-scrap'),
        fetch('/api/assets'),
      ]);
      const rData = await reportsRes.json();
      const aData = await assetsRes.json();

      const fetchedAssets: Asset[] = aData?.assets || [];
      const fetchedReports: DamageScrapReport[] = rData?.reports ? [...rData.reports] : [];

      if (fetchedAssets.length > 0) {
        setAssets(fetchedAssets);
        const reportedAssetIds = new Set(fetchedReports.map((r) => r.asset_id));

        // Auto-include any damaged or scrapped asset from assets table that doesn't have an active report
        fetchedAssets.forEach((ast) => {
          if (ast.status === 'damaged' && !reportedAssetIds.has(ast.id)) {
            fetchedReports.unshift({
              id: `syn-${ast.id}`,
              asset_id: ast.id,
              asset: ast,
              report_type: 'damaged',
              reason: 'Direct Onboarded / Registered Damaged Equipment',
              severity: 'minor',
              status: 'pending',
              reported_by: 'SYSTEM',
              reporter: null,
              reviewer: null,
              reviewer_id: null,
              review_remarks: null,
              reviewed_at: null,
              employee_name: ast.assigned_employee?.full_name || 'Direct Onboarded',
              employee_id: ast.assigned_employee?.emp_code || 'DIRECT_ONBOARDED',
              employee_email: ast.assigned_employee?.email || null,
              document_url: null,
              photo_paths: [],
              created_at: ast.created_at || new Date().toISOString(),
              updated_at: ast.updated_at || new Date().toISOString(),
            });
            reportedAssetIds.add(ast.id);
          }
        });
      }

      setReports(fetchedReports);
    } catch (err) {
      console.error('Fetch damaged/missing data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reactively respond to client-side search parameter navigation
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const actionParam = searchParams.get('action');

    if (actionParam === 'new-missing') {
      setModuleMode('missing');
      setActiveTab('missing');
      setShowMissingModal(true);
      setShowDamagedModal(false);
    } else if (actionParam === 'new-damaged') {
      setModuleMode('damaged');
      setActiveTab('damaged');
      setShowDamagedModal(true);
      setShowMissingModal(false);
    } else if (typeParam === 'missing') {
      setModuleMode('missing');
      setActiveTab('missing');
    } else if (typeParam === 'damaged') {
      setModuleMode('damaged');
      setActiveTab('damaged');
    }
  }, [searchParams]);

  const switchModuleMode = (mode: ModuleType) => {
    setModuleMode(mode);
    if (mode === 'missing') {
      setActiveTab('missing');
    } else {
      setActiveTab('damaged');
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('type', mode);
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Dedicated classification predicates for Damaged, Missing, and Scrapped
  const isScrappedReport = (r: DamageScrapReport) => {
    return (
      r.report_type === 'scrap' ||
      r.resolution_action === 'scrapped' ||
      r.resolution_status === 'scrapped' ||
      r.asset?.status === 'scrapped'
    );
  };

  const isDamagedActive = (r: DamageScrapReport) => {
    return r.report_type === 'damaged' && r.status !== 'resolved' && !isScrappedReport(r);
  };

  const isRepairedResolved = (r: DamageScrapReport) => {
    return r.report_type === 'damaged' && r.status === 'resolved' && !isScrappedReport(r);
  };

  const isMissingActive = (r: DamageScrapReport) => {
    return r.report_type === 'missing' && r.status !== 'resolved';
  };

  const isMissingResolved = (r: DamageScrapReport) => {
    return r.report_type === 'missing' && r.status === 'resolved';
  };

  // Filtered reports by active tab & search
  const filteredReports = reports.filter((r) => {
    if (activeTab === 'damaged' && !isDamagedActive(r)) return false;
    if (activeTab === 'missing' && !isMissingActive(r)) return false;
    if (activeTab === 'scrap' && !isScrappedReport(r)) return false;
    if (activeTab === 'resolved') {
      if (moduleMode === 'missing') {
        if (!isMissingResolved(r)) return false;
      } else {
        if (!isRepairedResolved(r)) return false;
      }
    }

    if (selectedPlant) {
      const matchesPlt =
        r.asset?.current_plant_id === selectedPlant ||
        r.asset?.plant?.id === selectedPlant;
      if (!matchesPlt) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.asset?.asset_tag.toLowerCase().includes(q) ||
      r.asset?.name.toLowerCase().includes(q) ||
      (r.employee_name && r.employee_name.toLowerCase().includes(q)) ||
      (r.employee_id && r.employee_id.toLowerCase().includes(q)) ||
      r.reason.toLowerCase().includes(q)
    );
  });

  const openEditModal = (report: DamageScrapReport) => {
    setEditingReport(report);
    setInitialReportType(report.report_type);
    setShowReportModal(true);
  };

  const isMissingCenter = moduleMode === 'missing';

  return (
    <div className="space-y-3.5">
      {/* Compact Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white rounded-2xl p-3.5 px-5 border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            {isMissingCenter ? (
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
            )}

            <h1 className="text-base font-black text-slate-900 tracking-tight">
              {isMissingCenter ? 'Missing & Lost Asset Center' : 'Damaged & Scrap Asset Center'}
            </h1>

            <button
              type="button"
              onClick={() => switchModuleMode(isMissingCenter ? 'damaged' : 'missing')}
              className="ml-2 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all border border-slate-200 cursor-pointer flex items-center gap-1 shrink-0"
              title={isMissingCenter ? 'Switch to Damaged Module' : 'Switch to Missing Module'}
            >
              <span>{isMissingCenter ? 'Switch to Damaged Module' : 'Switch to Missing Module'}</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mt-1 leading-normal">
            {isMissingCenter
              ? 'Track missing or lost equipment, attach FIR complaints, auto-fetch custodian profiles, and handle recoveries.'
              : 'Track damaged equipment, auto-fetch custodian profiles, execute repairs, or move to scrapped archive.'}
          </p>
        </div>

        {/* Dedicated Header Button */}
        <div className="flex items-center gap-2 shrink-0">
          {isMissingCenter ? (
            <button
              type="button"
              onClick={() => setShowMissingModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-black px-4 py-2 shadow-xs transition-all cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>+ New Missing Entry</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowDamagedModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-black px-4 py-2 shadow-xs transition-all cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>+ New Damaged Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Tabs & Search Bar Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white p-2 px-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {isMissingCenter ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('missing')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'missing'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Missing Assets
                <span className={`ml-1 px-2 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'missing' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {reports.filter(isMissingActive).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('resolved')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'resolved'
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Recovered / Resolved History
                <span className={`ml-1 px-2 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'resolved' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {reports.filter(isMissingResolved).length}
                </span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('damaged')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'damaged'
                    ? 'bg-orange-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Damaged Assets
                <span className={`ml-1 px-2 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'damaged' ? 'bg-orange-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {reports.filter(isDamagedActive).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('scrap')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'scrap'
                    ? 'bg-rose-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Scrapped Archive
                <span className={`ml-1 px-2 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'scrap' ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {reports.filter(isScrappedReport).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('resolved')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'resolved'
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Repaired / Resolved History
                <span className={`ml-1 px-2 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'resolved' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {reports.filter(isRepairedResolved).length}
                </span>
              </button>
            </>
          )}
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search tag or custodian..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
          />
        </div>
      </div>

      {/* Reports Table / Card Container */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 uppercase font-black border-b border-slate-200 text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Asset Identification</th>
                <th className="px-4 py-2.5">Custodian Details</th>
                <th className="px-4 py-2.5">Incident Reason &amp; Attachments</th>
                <th className="px-4 py-2.5">Status &amp; Lock</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredReports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Asset Info */}
                  <td className="px-4 py-3">
                    <div className="font-mono font-black text-blue-600 text-xs">{r.asset?.asset_tag || 'AST-N/A'}</div>
                    <div className="font-bold text-slate-900 text-xs">{r.asset?.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {r.asset?.category?.name || 'General'} | Model: {r.asset?.model || 'N/A'}
                    </div>
                  </td>

                  {/* Custodian Details */}
                  <td className="px-4 py-3">
                    {(() => {
                      const empName = r.employee_name || r.asset?.assigned_employee?.full_name;
                      const isUnassigned = !empName || empName.includes('Direct') || empName.includes('Stock') || empName === 'N/A' || empName === 'UNASSIGNED';

                      if (isUnassigned) {
                        return (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Unassigned / Direct Entry
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {empName}
                            </div>
                            {(r.employee_id && r.employee_id !== 'DIRECT_ONBOARDED' && r.employee_id !== 'UNASSIGNED') && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                ID: {r.employee_id}
                              </div>
                            )}
                            {r.employee_email && r.employee_email !== 'N/A' && (
                              <div className="text-[10px] text-blue-600 font-mono">{r.employee_email}</div>
                            )}
                            {r.contact_phone && (
                              <div className="text-[10px] text-slate-600 font-mono">📞 {r.contact_phone}</div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </td>

                  {/* Reason & Attachments */}
                  <td className="px-4 py-3 max-w-sm">
                    <p className="text-xs text-slate-700 font-medium line-clamp-2">&ldquo;{r.reason}&rdquo;</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {!isMissingCenter && r.report_type !== 'missing' && (
                        <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.2 rounded border border-amber-200 uppercase font-bold">
                          Severity: {r.severity}
                        </span>
                      )}
                      {r.contact_phone && (
                        <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.2 rounded border border-slate-200 font-semibold">
                          📞 {r.contact_phone}
                        </span>
                      )}
                      {r.photo_paths && r.photo_paths.filter(p => typeof p === 'string' && !p.startsWith('EMP:') && !p.startsWith('DOC:') && !p.startsWith('TYPE:') && !p.startsWith('CONTACT:')).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const validPhotos = r.photo_paths.filter(p => typeof p === 'string' && !p.startsWith('EMP:') && !p.startsWith('DOC:') && !p.startsWith('TYPE:') && !p.startsWith('CONTACT:'));
                            if (validPhotos[0]) setPreviewImage(validPhotos[0]);
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 underline cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> Photo Proof ({r.photo_paths.filter(p => typeof p === 'string' && !p.startsWith('EMP:') && !p.startsWith('DOC:') && !p.startsWith('TYPE:') && !p.startsWith('CONTACT:')).length})
                        </button>
                      )}
                      {r.document_url && (
                        <a
                          href={r.document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 underline cursor-pointer"
                        >
                          <FileText className="w-3 h-3" /> {isMissingCenter || r.report_type === 'missing' ? 'Attached Police FIR / PDF' : 'Attached Document / Bill'}
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Status & Lock Indicator */}
                  <td className="px-4 py-3">
                    {isScrappedReport(r) ? (
                      <div>
                        <span className="rounded-lg bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 uppercase inline-flex items-center gap-1">
                          <Trash2 className="w-3 h-3" />
                          SCRAPPED
                        </span>
                        <div className="text-[10px] text-rose-600 mt-0.5 font-medium">
                          {r.resolution_action === 'scrapped' ? 'Resolved: Moved to Scrap' : 'Direct Scrap Entry'}
                        </div>
                      </div>
                    ) : r.status === 'resolved' ? (
                      <div>
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 uppercase inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {isMissingCenter || r.report_type === 'missing'
                            ? `Recovered (${r.resolution_status || 'Found'})`
                            : `Resolved (${r.resolution_status || 'Fixed'})`}
                        </span>
                        {r.resolution_action && (
                          <div className="text-[10px] text-slate-500 mt-0.5 italic">
                            Action: {r.resolution_action === 'returned_to_stock' ? 'Added to Stock' : 'Reassigned'}
                          </div>
                        )}
                      </div>
                    ) : r.report_type === 'missing' ? (
                      <span className="rounded-lg bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 uppercase inline-flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" />
                        MISSING
                      </span>
                    ) : (
                      <span className="rounded-lg bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-700 border border-orange-200 uppercase inline-flex items-center gap-1">
                        <Wrench className="w-3 h-3" />
                        DAMAGED
                      </span>
                    )}
                    <div className="text-[10px] text-slate-500 mt-0.5 font-medium">Logged: {formatDateTime(r.created_at)}</div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isScrappedReport(r) && r.status !== 'resolved' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(r)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer"
                            title="Edit Incident Entry"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setResolvingReport(r)}
                            className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {isMissingCenter || r.report_type === 'missing' ? 'Recover' : 'Resolve Action'}
                          </button>
                        </>
                      )}
                      {isScrappedReport(r) && (
                        <span className="text-rose-700 font-mono text-[11px] font-bold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 shadow-2xs">
                          <Trash2 className="w-3 h-3 text-rose-600" /> Scrapped Archive
                        </span>
                      )}
                      {!isScrappedReport(r) && r.status === 'resolved' && (
                        <span className="text-emerald-700 font-mono text-[11px] font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />{' '}
                          {isMissingCenter || r.report_type === 'missing' ? 'Recovered Archive' : 'Repaired Archive'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-xs font-medium">
                    No {activeTab} incident entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEDICATED DAMAGED ENTRY MODAL */}
      <DamagedEntryModal
        isOpen={showDamagedModal}
        onClose={() => {
          setShowDamagedModal(false);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('action');
            window.history.replaceState({}, '', url.toString());
          }
        }}
        onSuccess={() => {
          setShowDamagedModal(false);
          fetchData();
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('action');
            window.history.replaceState({}, '', url.toString());
          }
        }}
        assets={assets}
      />

      {/* DEDICATED MISSING ENTRY MODAL */}
      <MissingEntryModal
        isOpen={showMissingModal}
        onClose={() => {
          setShowMissingModal(false);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('action');
            window.history.replaceState({}, '', url.toString());
          }
        }}
        onSuccess={() => {
          setShowMissingModal(false);
          fetchData();
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('action');
            window.history.replaceState({}, '', url.toString());
          }
        }}
        assets={assets}
      />

      {/* EDIT REPORT MODAL */}
      <IncidentReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSuccess={fetchData}
        assets={assets}
        initialReportType={initialReportType}
        editingReport={editingReport}
      />

      {/* RESOLUTION ACTION MODAL */}
      {resolvingReport && (
        <IncidentResolutionModal
          isOpen={Boolean(resolvingReport)}
          onClose={() => setResolvingReport(null)}
          onSuccess={fetchData}
          report={resolvingReport}
        />
      )}

      {/* PREVIEW PHOTO MODAL */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl w-full">
            {/* eslint-disable-next-next/no-img-element */}
            <img src={previewImage} alt="Incident Photo Proof" className="max-h-[80vh] mx-auto rounded-2xl shadow-2xl border border-slate-700" />
            <div className="text-center text-xs text-slate-300 mt-2 font-medium">Click anywhere to close preview</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DamagedScrapPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500 font-semibold text-sm">Loading Damaged & Scrap Center...</div>}>
      <DamagedScrapContent />
    </Suspense>
  );
}
