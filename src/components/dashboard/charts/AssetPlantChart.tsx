'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Factory } from 'lucide-react';
import { Asset, Plant } from '@/types/database';
import ChartCard, { EmptyState } from './ChartCard';
import { CountUp } from './useCountUp';
import { useDrillDown } from './DrillDownContext';

interface AssetPlantChartProps {
  assets: Asset[];
  plants: Plant[];
}

interface Bar {
  key: string;
  value: number;
  className: string;
}

interface Group {
  id: string;
  label: string;
  bars: Bar[];
}

const CHART_HEIGHT = 150;

const TOTAL_BAR = 'bg-gradient-to-t from-indigo-600 to-indigo-400';
const ASSIGNED_BAR = 'bg-gradient-to-t from-teal-500 to-emerald-300';

const STATUS_BARS = [
  { id: 'in_service', label: 'Assigned', className: ASSIGNED_BAR },
  { id: 'in_storage', label: 'In Stock', className: 'bg-gradient-to-t from-sky-500 to-sky-300' },
  { id: 'maintenance', label: 'Repair', className: 'bg-gradient-to-t from-amber-500 to-amber-300' },
  { id: 'damaged', label: 'Damaged', className: 'bg-gradient-to-t from-rose-600 to-rose-400' },
  { id: 'missing', label: 'Missing', className: 'bg-gradient-to-t from-violet-600 to-violet-400' },
] as const;

function niceStep(max: number): number {
  const raw = Math.max(max / 4, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  return ([1, 2, 3, 5, 10].find((s) => s * magnitude >= raw) || 10) * magnitude;
}

export default function AssetPlantChart({ assets, plants }: AssetPlantChartProps) {
  const [plantId, setPlantId] = useState<string>('all');

  const sortedPlants = useMemo(() => [...plants].sort((a, b) => a.name.localeCompare(b.name)), [plants]);

  const assetsByPlant = useMemo(() => {
    const map = new Map<string, Asset[]>();
    assets.forEach((a) => {
      const matchedP = sortedPlants.find(
        (p) =>
          p.id === a.current_plant_id ||
          p.id === (a as any).plant_id ||
          p.id === a.plant?.id ||
          p.name === a.current_plant_id ||
          (p.code && p.code === a.current_plant_id) ||
          (a.plant?.name && a.plant.name === p.name)
      );
      const id = matchedP?.id || a.current_plant_id || a.plant?.id;
      if (!id) return;
      const list = map.get(id) || [];
      list.push(a);
      map.set(id, list);
    });
    return map;
  }, [assets, sortedPlants]);

  const scopedAssets = useMemo(
    () => (plantId === 'all' ? sortedPlants.flatMap((p) => assetsByPlant.get(p.id) || []) : assetsByPlant.get(plantId) || []),
    [plantId, sortedPlants, assetsByPlant]
  );

  const groups: Group[] = useMemo(() => {
    if (plantId === 'all') {
      return sortedPlants.map((p) => {
        const list = assetsByPlant.get(p.id) || [];
        return {
          id: p.id,
          label: p.name,
          bars: [
            { key: 'total', value: list.length, className: TOTAL_BAR },
            { key: 'assigned', value: list.filter((a) => a.status === 'in_service').length, className: ASSIGNED_BAR },
          ],
        };
      });
    }
    return STATUS_BARS.map((s) => ({
      id: s.id,
      label: s.label,
      bars: [{ key: s.id, value: scopedAssets.filter((a) => a.status === s.id).length, className: s.className }],
    }));
  }, [plantId, sortedPlants, assetsByPlant, scopedAssets]);

  const total = scopedAssets.length;
  const assigned = scopedAssets.filter((a) => a.status === 'in_service').length;
  const inStock = scopedAssets.filter((a) => a.status === 'in_storage').length;
  const utilisation = total ? Math.round((assigned / total) * 100) : 0;

  const { openAssets } = useDrillDown();
  const handleBarClick = (g: Group, b: Bar) => {
    if (plantId === 'all') {
      const list = assetsByPlant.get(g.id) || [];
      const assignedOnly = b.key === 'assigned';
      openAssets(`${g.label} — ${assignedOnly ? 'Assigned' : 'All Assets'}`, assignedOnly ? list.filter((a) => a.status === 'in_service') : list);
      return;
    }
    const plantName = sortedPlants.find((p) => p.id === plantId)?.name || '';
    openAssets(`${plantName} — ${g.label}`, scopedAssets.filter((a) => a.status === b.key));
  };

  const step = niceStep(Math.max(...groups.flatMap((g) => g.bars.map((b) => b.value)), 0));
  const yMax = step * 4;
  const ticks = [4, 3, 2, 1, 0].map((n) => n * step);

  return (
    <ChartCard
      icon={Factory}
      iconClassName="bg-indigo-50 text-indigo-600"
      title="Assets by Plant"
      action={
        <div className="flex items-center gap-2 shrink-0">
          {plantId === 'all' && (
            <div className="hidden sm:flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 leading-none shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${TOTAL_BAR}`} /> Total
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${ASSIGNED_BAR}`} /> Assigned
              </span>
            </div>
          )}
          <div className="relative shrink-0">
            <select
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              className="appearance-none cursor-pointer rounded-md border border-slate-200 bg-white pl-2.5 pr-7 py-1 text-[11px] font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              <option value="all">All Plants</option>
              {sortedPlants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-4 divide-x divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/70" key={`m-${plantId}`}>
        <Metric label="Total" value={total} className="text-slate-900" />
        <Metric label="Assigned" value={assigned} className="text-teal-600" delay={80} />
        <Metric label="In Stock" value={inStock} className="text-sky-600" delay={160} />
        <Metric label="Utilisation" value={utilisation} suffix="%" className="text-indigo-600" delay={240} />
      </div>

      {groups.length === 0 ? (
        <EmptyState message="No plants to show" />
      ) : (
        <div className="flex-1 flex flex-col pt-3" style={{ minHeight: CHART_HEIGHT }} key={plantId}>
          <div className="flex-1 flex gap-2 min-h-0">
            <div className="relative w-9 shrink-0 text-[10px] font-bold text-slate-600 tabular-nums">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute right-0 -translate-y-1/2 leading-none"
                  style={{ top: `${(1 - t / yMax) * 100}%` }}
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="relative flex-1 min-w-0">
              <div className="absolute inset-0 pointer-events-none rounded-lg bg-gradient-to-b from-slate-50/80 to-transparent">
                {ticks.map((t) => (
                  <div
                    key={t}
                    className={`absolute inset-x-0 border-t ${t === 0 ? 'border-slate-300' : 'border-slate-200/70'}`}
                    style={{ top: `${(1 - t / yMax) * 100}%` }}
                  />
                ))}
              </div>

              <div className="absolute inset-0 flex items-end justify-around gap-3">
                {groups.map((g, gi) => (
                  <div key={g.id} className="flex items-end justify-center gap-1.5 h-full flex-1 min-w-0">
                    {g.bars.map((b, bi) => {
                      const pct = b.value > 0 ? (b.value / yMax) * 100 : 0;
                      const delay = gi * 120 + bi * 80;
                      return (
                        <div
                          key={b.key}
                          className={`relative flex items-end h-full w-full max-w-[36px] ${b.value > 0 ? 'cursor-pointer' : ''}`}
                          onClick={b.value > 0 ? () => handleBarClick(g, b) : undefined}
                        >
                          <span
                            className={`absolute inset-x-0 text-center text-[11px] font-bold tabular-nums animate-fade-up ${
                              b.value > 0 ? 'text-slate-800' : 'text-slate-300'
                            }`}
                            style={{ bottom: `calc(${pct}% + 5px)`, animationDelay: `${delay + 450}ms` }}
                          >
                            <CountUp value={b.value} delay={delay} />
                          </span>
                          <div
                            className={`w-full rounded-t-lg animate-bar-spring ${
                              b.value > 0 ? `bar-shine ${b.className} shadow-[0_4px_12px_-4px_rgba(79,70,229,0.3)]` : 'bg-slate-200'
                            }`}
                            style={{
                              height: b.value > 0 ? `max(${pct}%, 6px)` : 3,
                              animationDelay: `${delay}ms`,
                              ['--bar-delay' as string]: `${delay}ms`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-1.5">
            <div className="w-9 shrink-0" />
            <div className="flex-1 flex justify-around gap-3">
              {groups.map((g) => (
                <span key={g.id} className="flex-1 min-w-0 text-center text-[11px] font-bold text-slate-800 leading-tight break-words line-clamp-2" title={g.label}>
                  {g.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function Metric({
  label,
  value,
  className,
  suffix = '',
  delay = 0,
}: {
  label: string;
  value: number;
  className: string;
  suffix?: string;
  delay?: number;
}) {
  return (
    <div className="px-2.5 py-1.5">
      <div className="text-[9px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-base font-semibold leading-tight tabular-nums ${className}`}>
        <CountUp value={value} delay={delay} suffix={suffix} />
      </div>
    </div>
  );
}
