'use client';

import { useMemo, useState } from 'react';
import { Asset } from '@/types/database';
import ChartCard, { EmptyState } from './ChartCard';
import MetricStrip from './MetricStrip';
import TrendFrame, { TrendMode, assetDate, buildPeriods } from './TrendFrame';
import TrendModeToggle from './TrendModeToggle';
import { useDrillDown } from './DrillDownContext';

interface AssetTrendChartProps {
  assets: Asset[];
}

const LINE_COLOR = '#4f46e5';
const ADDED_BAR = 'bg-gradient-to-t from-teal-500/80 to-emerald-300/80';

export default function AssetTrendChart({ assets }: AssetTrendChartProps) {
  const [mode, setMode] = useState<TrendMode>('monthly');
  const { openAssets } = useDrillDown();

  const data = useMemo(() => {
    const periods = buildPeriods(mode);
    const dated = assets.map((a) => ({ a, t: assetDate(a) })).filter((d) => !isNaN(d.t));
    const addedLists = periods.map((p) => dated.filter((d) => d.t >= p.start && d.t < p.end).map((d) => d.a));
    const totals = periods.map((p) => dated.filter((d) => d.t < p.end).length);
    const opening = dated.filter((d) => d.t < periods[0].start).length;
    return { periods, addedLists, added: addedLists.map((l) => l.length), totals, opening };
  }, [assets, mode]);

  const current = data.totals[data.totals.length - 1] || 0;
  const addedInWindow = data.added.reduce((s, v) => s + v, 0);
  const growth = data.opening ? Math.round(((current - data.opening) / data.opening) * 100) : null;
  const avg = addedInWindow / data.periods.length;
  const windowLabel = mode === 'monthly' ? '12M' : '5Y';

  const handleColumnClick = (i: number) => {
    const list = data.addedLists[i];
    if (!list.length) return;
    openAssets(`Assets Added — ${data.periods[i].label}`, list);
  };

  return (
    <ChartCard
      emoji="📈"
      title="Total Asset Trend"
      action={
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 leading-none shadow-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[3px] rounded-full" style={{ background: LINE_COLOR }} /> Total
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${ADDED_BAR}`} /> Added
            </span>
          </div>
          <TrendModeToggle mode={mode} onChange={setMode} />
        </div>
      }
    >
      <MetricStrip
        key={`m-${mode}`}
        items={[
          { label: 'Total Assets', value: current, className: 'text-slate-900' },
          { label: `Added (${windowLabel})`, value: addedInWindow, className: 'text-teal-600' },
          { label: 'Growth', value: growth ?? 0, display: growth === null ? '—' : `${growth > 0 ? '+' : ''}${growth}%`, className: 'text-indigo-600' },
          { label: mode === 'monthly' ? 'Avg / Month' : 'Avg / Year', value: avg, display: avg.toFixed(1), className: 'text-sky-600' },
        ]}
      />
      {current === 0 ? (
        <EmptyState message="No assets to trend" />
      ) : (
        <TrendFrame
          key={`t-${mode}`}
          labels={data.periods.map((p) => p.label)}
          series={[{ key: 'total', color: LINE_COLOR, values: data.totals, area: true }]}
          bars={{ values: data.added, className: ADDED_BAR }}
          pointLabels="last"
          onColumnClick={handleColumnClick}
        />
      )}
    </ChartCard>
  );
}
