'use client';

import { useMemo } from 'react';
import { Asset, Plant } from '@/types/database';
import ChartCard, { EmptyState } from './ChartCard';
import BarChartFrame, { BarGroup } from './BarChartFrame';
import MetricStrip, { formatShortRupee } from './MetricStrip';
import { useDrillDown } from './DrillDownContext';

interface AssetValueByPlantChartProps {
  assets: Asset[];
  plants: Plant[];
}

const TOTAL_BAR = 'bg-gradient-to-t from-indigo-600 to-indigo-400';
const IN_USE_BAR = 'bg-gradient-to-t from-teal-500 to-emerald-300';

const costOf = (a: Asset) => Number(a.purchase_cost) || 0;

export default function AssetValueByPlantChart({ assets, plants }: AssetValueByPlantChartProps) {
  const { openAssets } = useDrillDown();

  const stats = useMemo(() => {
    const live = assets.filter((a) => a.status !== 'scrapped');
    const sum = (list: Asset[]) => list.reduce((s, a) => s + costOf(a), 0);

    const groups: BarGroup[] = [...plants]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => {
        const list = live.filter((a) => a.current_plant_id === p.id);
        const total = sum(list);
        const inUse = sum(list.filter((a) => a.status === 'in_service'));
        return {
          id: p.id,
          label: p.name,
          bars: [
            { key: 'total', value: total, className: TOTAL_BAR, label: formatShortRupee(total) },
            { key: 'inUse', value: inUse, className: IN_USE_BAR, label: formatShortRupee(inUse) },
          ],
        };
      });

    const total = sum(live);
    const inUse = sum(live.filter((a) => a.status === 'in_service'));
    return {
      groups,
      total,
      inUse,
      inStock: sum(live.filter((a) => a.status === 'in_storage')),
      utilisation: total ? Math.round((inUse / total) * 100) : 0,
    };
  }, [assets, plants]);

  const handleBarClick = (plantId: string, key: string) => {
    const plant = plants.find((p) => p.id === plantId);
    const list = assets.filter(
      (a) => a.current_plant_id === plantId && a.status !== 'scrapped' && (key === 'total' || a.status === 'in_service')
    );
    const value = list.reduce((s, a) => s + costOf(a), 0);
    openAssets(`${plant?.name || 'Plant'} — ${key === 'total' ? 'Total Value' : 'In-Use Value'}`, list, `${list.length} assets worth ${formatShortRupee(value)}`);
  };

  return (
    <ChartCard
      emoji="💰"
      title="Asset Value by Plant"
      action={
        <div className="hidden sm:flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 leading-none shadow-sm shrink-0">
          <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${TOTAL_BAR}`} /> Total</span>
          <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${IN_USE_BAR}`} /> In Use</span>
        </div>
      }
    >
      <MetricStrip
        items={[
          { label: 'Total Value', value: stats.total, display: formatShortRupee(stats.total), className: 'text-slate-900' },
          { label: 'In Use', value: stats.inUse, display: formatShortRupee(stats.inUse), className: 'text-teal-600' },
          { label: 'In Stock', value: stats.inStock, display: formatShortRupee(stats.inStock), className: 'text-sky-600' },
          { label: 'Utilisation', value: stats.utilisation, suffix: '%', className: 'text-indigo-600' },
        ]}
      />
      {stats.total === 0 ? (
        <EmptyState message="No purchase cost recorded" />
      ) : (
        <BarChartFrame
          groups={stats.groups}
          formatTick={(v) => formatShortRupee(v).replace('₹', '')}
          barMaxWidth={36}
          onBarClick={handleBarClick}
        />
      )}
    </ChartCard>
  );
}
