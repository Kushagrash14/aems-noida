'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Asset,
  Category,
  Department,
  Location,
  Plant,
  PMComplaint,
  DamageScrapReport,
  User,
  UserScope,
} from '@/types/database';
import DashboardKPISection from './DashboardKPISection';
import AssetPlantChart from './charts/AssetPlantChart';
import AssetStatusCard from './charts/AssetStatusCard';
import AssetDepartmentChart from './charts/AssetDepartmentChart';
import AssetAgeDistributionChart from './charts/AssetAgeDistributionChart';
import WarrantyCard from './WarrantyCard';
import AmcCard from './AmcCard';
import AssetValueByPlantChart from './charts/AssetValueByPlantChart';
import AssetTrendChart from './charts/AssetTrendChart';
import DepartmentTrendChart from './charts/DepartmentTrendChart';
import { DrillDownApi, DrillDownContext } from './charts/DrillDownContext';
import DashboardKPIModal from './DashboardKPIModal';

type DrillDownState = { title: string; subtitle?: string; assets: Asset[] };

interface DashboardClientViewProps {
  initialAssets: Asset[];
  complaints: PMComplaint[];
  damageReports: DamageScrapReport[];
  locations: Location[];
  plants: Plant[];
  departments: Department[];
  categories: Category[];
  user: User | null;
  scope: UserScope | null;
}

export default function DashboardClientView({
  initialAssets,
  complaints,
  damageReports,
  locations,
  plants,
  departments,
  categories,
  user,
  scope,
}: DashboardClientViewProps) {
  const searchParams = useSearchParams();

  // Local live state initialized from server payload
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  const drillDownApi = useMemo<DrillDownApi>(
    () => ({
      openAssets: (title, list, subtitle) => setDrillDown({ title, subtitle, assets: list }),
    }),
    []
  );

  // Synchronize when server initialAssets change
  useEffect(() => {
    setAssets(initialAssets);
  }, [initialAssets]);

  // Real-time automatic background refresh on focus and custom asset updates
  useEffect(() => {
    let isMounted = true;
    const fetchLatestAssets = async () => {
      try {
        const res = await fetch('/api/assets');
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && Array.isArray(data.assets)) {
          setAssets(data.assets);
        }
      } catch {}
    };

    let lastFetched = Date.now();
    const handleFocus = () => {
      if (Date.now() - lastFetched > 45000) {
        lastFetched = Date.now();
        fetchLatestAssets();
      }
    };

    const handleAssetEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Asset>;
      if (customEvent.detail && customEvent.detail.id) {
        setAssets((prev) =>
          prev.map((a) => (a.id === customEvent.detail.id ? customEvent.detail : a))
        );
      }
      fetchLatestAssets();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('aems:asset-updated', handleAssetEvent);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('aems:asset-updated', handleAssetEvent);
    };
  }, []);

  // 1. Read Filter State with instant local state + reactive listeners
  const [selectedPlant, setSelectedPlant] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const url = new URLSearchParams(window.location.search);
      return url.get('plantId') || '';
    }
    return searchParams.get('plantId') || '';
  });
  const [selectedLocation, setSelectedLocation] = useState<string>(() => searchParams.get('locationId') || '');
  const [selectedDepartment, setSelectedDepartment] = useState<string>(() => searchParams.get('deptId') || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(() => searchParams.get('categoryId') || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(() => searchParams.get('status') || '');
  const [searchQuery, setSearchQuery] = useState<string>(() => (searchParams.get('search') || '').toLowerCase().trim());

  // Synchronize from Next.js router searchParams
  useEffect(() => {
    const p = searchParams.get('plantId') || '';
    setSelectedPlant(p);
    setSelectedLocation(searchParams.get('locationId') || '');
    setSelectedDepartment(searchParams.get('deptId') || '');
    setSelectedCategory(searchParams.get('categoryId') || '');
    setSelectedStatus(searchParams.get('status') || '');
    setSearchQuery((searchParams.get('search') || '').toLowerCase().trim());
  }, [searchParams]);

  // Synchronize instantly from Navbar custom event (0ms instantaneous reactivity!)
  useEffect(() => {
    const handlePlantChanged = (e: Event) => {
      const custom = e as CustomEvent<{ plantId?: string | null }>;
      const nextId = custom.detail?.plantId || '';
      setSelectedPlant(nextId);
    };
    window.addEventListener('aems:plant-changed', handlePlantChanged);
    return () => window.removeEventListener('aems:plant-changed', handlePlantChanged);
  }, []);

  // Matched plant object to support ID, Name, or Code comparisons
  const selectedPlantObj = useMemo(() => {
    if (!selectedPlant) return null;
    return plants.find((p) => p.id === selectedPlant || p.name === selectedPlant || (p.code && p.code === selectedPlant));
  }, [plants, selectedPlant]);

  // 2. Filtered Assets Pipeline — Fully Synced with Navbar
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Location Filter
      if (selectedLocation) {
        const matchesLoc =
          asset.current_location_id === selectedLocation ||
          (asset.location && asset.location.id === selectedLocation);
        if (!matchesLoc) return false;
      }

      // Plant Filter (Comprehensive match by ID, Name, and Code)
      if (selectedPlant) {
        const rawPlantId = asset.current_plant_id || (asset as any).plant_id || asset.plant?.id;
        const rawPlantName = asset.plant?.name;
        const matchesPlant =
          rawPlantId === selectedPlant ||
          rawPlantName === selectedPlant ||
          Boolean(
            selectedPlantObj && (
              rawPlantId === selectedPlantObj.id ||
              rawPlantId === selectedPlantObj.name ||
              (selectedPlantObj.code && rawPlantId === selectedPlantObj.code) ||
              rawPlantName === selectedPlantObj.name ||
              (selectedPlantObj.code && rawPlantName === selectedPlantObj.code)
            )
          );
        if (!matchesPlant) return false;
      }

      // Department Filter
      if (selectedDepartment) {
        const matchesDept =
          asset.current_department_id === selectedDepartment ||
          (asset.department && asset.department.id === selectedDepartment);
        if (!matchesDept) return false;
      }

      // Category Filter
      if (selectedCategory) {
        const matchesCat =
          asset.category_id === selectedCategory ||
          (asset.category && asset.category.id === selectedCategory);
        if (!matchesCat) return false;
      }

      // Status Filter
      if (selectedStatus && selectedStatus !== 'ALL') {
        if (asset.status !== selectedStatus) return false;
      }

      // Search Query Filter
      if (searchQuery) {
        const tag = (asset.asset_tag || '').toLowerCase();
        const name = (asset.name || '').toLowerCase();
        const serial = (asset.serial_number || '').toLowerCase();
        const model = (asset.model || '').toLowerCase();
        const custodian = (asset.assigned_employee?.full_name || '').toLowerCase();
        const empCode = (asset.assigned_employee?.emp_code || '').toLowerCase();

        const hit =
          tag.includes(searchQuery) ||
          name.includes(searchQuery) ||
          serial.includes(searchQuery) ||
          model.includes(searchQuery) ||
          custodian.includes(searchQuery) ||
          empCode.includes(searchQuery);

        if (!hit) return false;
      }

      return true;
    });
  }, [assets, selectedLocation, selectedPlant, selectedPlantObj, selectedDepartment, selectedCategory, selectedStatus, searchQuery]);

  // Filter complaints strictly matching selected plant and facility scope
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (selectedPlant) {
        const pId = c.machine?.plant_id;
        const matches =
          pId === selectedPlant ||
          Boolean(
            selectedPlantObj && (
              pId === selectedPlantObj.id ||
              pId === selectedPlantObj.name ||
              (selectedPlantObj.code && pId === selectedPlantObj.code)
            )
          );
        if (!matches) return false;
      }
      if (selectedLocation) {
        const lId = c.machine?.location_id;
        if (lId && lId !== selectedLocation) return false;
      }
      if (selectedDepartment) {
        const dId = c.machine?.department_id;
        if (dId && dId !== selectedDepartment) return false;
      }
      return true;
    });
  }, [complaints, selectedPlant, selectedPlantObj, selectedLocation, selectedDepartment]);

  // Filter damage reports strictly matching selected plant and facility scope
  const filteredDamageReports = useMemo(() => {
    return damageReports.filter((d) => {
      if (selectedPlant) {
        const pId = d.asset?.current_plant_id || (d.asset as any)?.plant_id || d.asset?.plant?.id;
        const pName = d.asset?.plant?.name;
        const matches =
          pId === selectedPlant ||
          pName === selectedPlant ||
          Boolean(
            selectedPlantObj && (
              pId === selectedPlantObj.id ||
              pId === selectedPlantObj.name ||
              (selectedPlantObj.code && pId === selectedPlantObj.code) ||
              pName === selectedPlantObj.name
            )
          );
        if (!matches) return false;
      }
      if (selectedLocation) {
        const lId = d.asset?.current_location_id || d.asset?.location?.id;
        if (lId && lId !== selectedLocation) return false;
      }
      if (selectedDepartment) {
        const dId = d.asset?.current_department_id || d.asset?.department?.id;
        if (dId && dId !== selectedDepartment) return false;
      }
      return true;
    });
  }, [damageReports, selectedPlant, selectedPlantObj, selectedLocation, selectedDepartment]);

  return (
    <div className="antialiased font-sans pb-10">
      {/* 1. Pinned Sticky KPI Cards (Connected seamlessly to Navbar, 100% Solid Opaque Shield) */}
      <DashboardKPISection
        assets={filteredAssets}
        complaints={filteredComplaints}
        damageReports={filteredDamageReports}
        departments={departments}
        plants={plants}
        locations={locations}
        categories={categories}
        onAssetUpdated={(updated) => {
          setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        }}
      />

      {/* 2. Scrolling Analytics & Visualizations Container */}
      <div className="pt-3.5 space-y-4">
        <DrillDownContext.Provider value={drillDownApi}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 md:[&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1 gap-4.5 relative z-10 items-stretch">
          <AssetPlantChart assets={filteredAssets} plants={plants} />
          <AssetStatusCard assets={filteredAssets} />
          <AssetDepartmentChart assets={filteredAssets} departments={departments} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 md:[&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1 gap-4.5 relative z-10 items-stretch">
          <AssetAgeDistributionChart assets={filteredAssets} />
          <WarrantyCard assets={filteredAssets} />
          <AssetTrendChart assets={filteredAssets} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 md:[&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1 gap-4.5 relative z-10 items-stretch">
          <AssetValueByPlantChart assets={filteredAssets} plants={plants} />
          <AmcCard assets={filteredAssets} />
          <DepartmentTrendChart assets={filteredAssets} departments={departments} />
        </div>
        </DrillDownContext.Provider>
      </div>

      {drillDown && (
        <DashboardKPIModal
          isOpen
          onClose={() => setDrillDown(null)}
          kpiType="total"
          customTitle={drillDown.title}
          customSubtitle={drillDown.subtitle || `${drillDown.assets.length} assets in this segment`}
          assets={drillDown.assets}
          onAssetUpdated={(updated) => {
            setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          }}
          complaints={filteredComplaints}
          damageReports={filteredDamageReports}
          departments={departments}
          plants={plants}
          locations={locations}
          categories={categories}
        />
      )}
    </div>
  );
}
