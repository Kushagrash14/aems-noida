'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  User,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Wrench,
  Filter,
  IndianRupee,
} from 'lucide-react';
import {
  Asset,
  Department,
  Plant,
  Location,
  Category,
  PMComplaint,
  DamageScrapReport,
} from '@/types/database';
import { formatCurrency, calculateAssetDepreciation } from '@/lib/utils';
import DashboardKPIModal, { KPIType } from './DashboardKPIModal';

interface DashboardKPISectionProps {
  assets: Asset[];
  complaints: PMComplaint[];
  damageReports: DamageScrapReport[];
  departments: Department[];
  plants: Plant[];
  locations: Location[];
  categories: Category[];
  onAssetUpdated?: (updatedAsset: Asset) => void;
}

export default function DashboardKPISection({
  assets,
  complaints,
  damageReports,
  departments,
  plants,
  locations,
  categories,
  onAssetUpdated,
}: DashboardKPISectionProps) {
  const [activeModal, setActiveModal] = useState<KPIType | null>(null);
  const [currentAssets, setCurrentAssets] = useState<Asset[]>(assets);

  // Sync state if initial props change
  useEffect(() => {
    setCurrentAssets(assets);
  }, [assets]);

  // Handle live updates from modal (assignment / de-assignment)
  const handleAssetUpdated = (updatedAsset: Asset) => {
    setCurrentAssets((prev) =>
      prev.map((a) => (a.id === updatedAsset.id ? updatedAsset : a))
    );
    onAssetUpdated?.(updatedAsset);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aems:asset-updated', { detail: updatedAsset }));
    }
  };

  // Compute KPI Counts & Total Valuation
  const activeAssets = currentAssets.filter((a) => !a.is_deleted);
  const totalAssetsCount = activeAssets.length;
  // Assigned: only assets that have an actual employee custodian
  const assignedCount = activeAssets.filter(
    (a) => Boolean(a.assigned_employee_id || a.assigned_employee)
  ).length;
  // In-House: deployed inside company premises, no personal employee custodian
  const inHouseCount = activeAssets.filter(
    (a) => a.status === 'in_service' && !a.assigned_employee_id && !a.assigned_employee
  ).length;
  // Stock Pool: purely undeployed assets in storage waiting for assignment
  const stockPoolCount = activeAssets.filter(
    (a) => a.status === 'in_storage'
  ).length;
  // Available KPI card = Stock Pool + In-House combined
  const availableCount = stockPoolCount + inHouseCount;

  const totalCost = activeAssets.reduce(
    (sum, a) => sum + (Number(a.purchase_cost) || 0),
    0
  );

  const netBookValue = activeAssets.reduce((sum, a) => {
    const dep = calculateAssetDepreciation(a.purchase_cost, a.purchase_date, a.category?.name);
    return sum + dep.currentBookValue;
  }, 0);

  const maintenanceCount = complaints.filter(
    (c) => c.status === 'open' || c.status === 'in_progress'
  ).length;

  const activeMissingIds = new Set(
    damageReports.filter((r) => r.report_type === 'missing' && r.status !== 'resolved').map((r) => r.asset_id)
  );
  const missingCount = activeAssets.filter(
    (a) => a.status === 'missing' || activeMissingIds.has(a.id)
  ).length;

  const activeDamageOrScrapIds = new Set(
    damageReports
      .filter((r) => (r.report_type === 'damaged' || r.report_type === 'scrap') && r.status !== 'resolved')
      .map((r) => r.asset_id)
  );
  const approvedScrapAssetIds = new Set(
    damageReports
      .filter((r) => r.status === 'approved' || r.report_type === 'scrap')
      .map((r) => r.asset_id)
  );
  const damagedAndScrapCount = activeAssets.filter(
    (a) =>
      !activeMissingIds.has(a.id) &&
      a.status !== 'missing' &&
      (a.status === 'damaged' ||
       a.status === 'scrapped' ||
       activeDamageOrScrapIds.has(a.id) ||
       approvedScrapAssetIds.has(a.id))
  ).length;

  return (
    <>
      {/* Full-Bleed 100% Solid Opaque Sticky Shield Connected Directly to Navbar */}
      <div className="sticky top-0 z-20 bg-[#F5F4F0] -mx-3 sm:-mx-4 lg:-mx-5 px-3 sm:px-4 lg:px-5 pt-2 pb-2.5 border-b border-slate-300 shadow-xs">
        <div className="w-full max-w-[1920px] mx-auto grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-2.5">
          {/* Card 1: TOTAL ASSETS */}
          <button
            type="button"
            onClick={() => setActiveModal('total')}
            className="text-left bg-white rounded-xl p-2.5 border-2 border-blue-500 shadow-xs flex flex-col justify-between min-h-[72px] transition-all hover:shadow-md hover:scale-[1.015] hover:border-blue-600 cursor-pointer group"
            title="Click to view all assets & filter dept/plant/location"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">
                TOTAL ASSETS
              </span>
              <div className="h-5 w-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Box className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-baseline justify-between w-full mt-1">
              <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">
                {totalAssetsCount}
              </div>
              <span className="text-[9px] font-bold text-blue-600 group-hover:underline inline-flex items-center gap-0.5">
                <Filter className="w-2.5 h-2.5" />
                <span>Filter -&gt;</span>
              </span>
            </div>
          </button>

          {/* Card 2: ASSIGNED / IN USE */}
          <button
            type="button"
            onClick={() => setActiveModal('assigned')}
            className="text-left bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-xs flex flex-col justify-between min-h-[72px] transition-all hover:shadow-md hover:scale-[1.015] hover:border-blue-400 cursor-pointer group"
            title="Click to view assigned assets & filter dept/plant/location"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">
                ASSIGNED / IN USE
              </span>
              <div className="h-5 w-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <User className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-baseline justify-between w-full mt-1">
              <div className="text-lg sm:text-xl font-black text-blue-600 tracking-tight leading-none">
                {assignedCount}
              </div>
              <span className="text-[9px] font-bold text-blue-600 group-hover:underline inline-flex items-center gap-0.5">
                <Filter className="w-2.5 h-2.5" />
                <span>Filter -&gt;</span>
              </span>
            </div>
          </button>

          {/* Card 3: AVAILABLE */}
          <button
            type="button"
            onClick={() => setActiveModal('available')}
            className="text-left bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-xs flex flex-col justify-between min-h-[72px] transition-all hover:shadow-md hover:scale-[1.015] hover:border-emerald-400 cursor-pointer group"
            title="Click to view available pool assets & filter dept/plant/location"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                AVAILABLE / STOCK
              </span>
              <div className="h-5 w-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <CheckCircle2 className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-baseline justify-between w-full mt-1">
              <div className="text-lg sm:text-xl font-black text-emerald-600 tracking-tight leading-none">
                {availableCount}
              </div>
              <span className="text-[9px] font-bold text-emerald-600 group-hover:underline inline-flex items-center gap-0.5">
                <Filter className="w-2.5 h-2.5" />
                <span>Filter -&gt;</span>
              </span>
            </div>
          </button>

          {/* Card 4: GROSS ASSET COST */}
          <button
            type="button"
            onClick={() => setActiveModal('cost')}
            className="text-left bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-xs flex flex-col justify-between min-h-[72px] transition-all hover:shadow-md hover:scale-[1.015] hover:border-emerald-500 cursor-pointer group"
            title="Click to view gross purchase cost valuation"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider group-hover:text-emerald-600 transition-colors truncate pr-1">
                GROSS ASSET COST
              </span>
              <div className="h-5 w-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <IndianRupee className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-baseline justify-between w-full mt-1">
              <div className="text-sm sm:text-base font-black text-emerald-700 tracking-tight leading-none truncate">
                {formatCurrency(totalCost)}
              </div>
              <span className="text-[9px] font-bold text-emerald-600 group-hover:underline inline-flex items-center gap-0.5 shrink-0 ml-1">
                <Filter className="w-2.5 h-2.5" />
                <span>Filter -&gt;</span>
              </span>
            </div>
          </button>

          {/* Card 5: BOOK VALUE (Depreciated Net Asset Value) */}
          <button
            type="button"
            onClick={() => setActiveModal('cost')}
            className="text-left bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-xs flex flex-col justify-between min-h-[72px] transition-all hover:shadow-md hover:scale-[1.015] hover:border-blue-500 cursor-pointer group"
            title="Click to view straight-line depreciated book equity"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors truncate pr-1">
                BOOK VALUE (DEP)
              </span>
              <div className="h-5 w-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <IndianRupee className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-baseline justify-between w-full mt-1">
              <div className="text-sm sm:text-base font-black text-blue-700 tracking-tight leading-none truncate">
                {formatCurrency(netBookValue)}
              </div>
              <span className="text-[9px] font-bold text-blue-600 group-hover:underline inline-flex items-center gap-0.5 shrink-0 ml-1">
                <span>Net Val</span>
              </span>
            </div>
          </button>

          {/* Card 6: MAINTENANCE */}
          <button
            type="button"
            onClick={() => setActiveModal('maintenance')}
            className="text-left bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-xs flex flex-col justify-between min-h-[72px] transition-all hover:shadow-md hover:scale-[1.015] hover:border-amber-400 cursor-pointer group"
            title="Click to view maintenance equipment & filter dept/plant/location"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider group-hover:text-amber-600 transition-colors">
                MAINTENANCE
              </span>
              <div className="h-5 w-5 rounded-md bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <AlertTriangle className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-baseline justify-between w-full mt-1">
              <div className="text-lg sm:text-xl font-black text-amber-500 tracking-tight leading-none">
                {maintenanceCount}
              </div>
              <span className="text-[9px] font-bold text-amber-600 group-hover:underline inline-flex items-center gap-0.5">
                <Filter className="w-2.5 h-2.5" />
                <span>Filter -&gt;</span>
              </span>
            </div>
          </button>

          {/* Card 7: SCRAP / DAMAGED */}
          <button
            type="button"
            onClick={() => setActiveModal('damaged')}
            className="text-left bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-xs flex flex-col justify-between min-h-[72px] transition-all hover:shadow-md hover:scale-[1.015] hover:border-rose-400 cursor-pointer group"
            title="Click to view damaged & scrapped assets"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] font-extrabold text-rose-600 uppercase tracking-wider group-hover:text-rose-700 transition-colors truncate">
                SCRAP / DAMAGED
              </span>
              <div className="h-5 w-5 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <Wrench className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-baseline justify-between w-full mt-1">
              <div className="text-lg sm:text-xl font-black text-rose-600 tracking-tight leading-none">
                {damagedAndScrapCount}
              </div>
              <span className="text-[9px] font-bold text-rose-600 group-hover:underline inline-flex items-center gap-0.5">
                <Filter className="w-2.5 h-2.5" />
                <span>Filter -&gt;</span>
              </span>
            </div>
          </button>

          {/* Card 8: MISSING / LOST */}
          <button
            type="button"
            onClick={() => setActiveModal('missing')}
            className="text-left bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-xs flex flex-col justify-between min-h-[72px] transition-all hover:shadow-md hover:scale-[1.015] hover:border-purple-400 cursor-pointer group"
            title="Click to view missing or untraceable assets"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] font-extrabold text-purple-600 uppercase tracking-wider group-hover:text-purple-700 transition-colors truncate">
                MISSING / LOST
              </span>
              <div className="h-5 w-5 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <HelpCircle className="w-3 h-3" />
              </div>
            </div>
            <div className="flex items-baseline justify-between w-full mt-1">
              <div className="text-lg sm:text-xl font-black text-purple-600 tracking-tight leading-none">
                {missingCount}
              </div>
              <span className="text-[9px] font-bold text-purple-600 group-hover:underline inline-flex items-center gap-0.5">
                <Filter className="w-2.5 h-2.5" />
                <span>Filter -&gt;</span>
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Filterable Modal Popup */}
      {activeModal && (
        <DashboardKPIModal
          isOpen={Boolean(activeModal)}
          onClose={() => setActiveModal(null)}
          kpiType={activeModal}
          assets={currentAssets}
          onAssetUpdated={handleAssetUpdated}
          complaints={complaints}
          damageReports={damageReports}
          departments={departments}
          plants={plants}
          locations={locations}
          categories={categories}
        />
      )}
    </>
  );
}
