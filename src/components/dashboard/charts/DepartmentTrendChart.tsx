'use client';

import { useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Asset, Department } from '@/types/database';
import ChartCard, { EmptyState } from './ChartCard';
import MetricStrip from './MetricStrip';
import TrendFrame, { TrendMode, assetDate, buildPeriods } from './TrendFrame';
import TrendModeToggle from './TrendModeToggle';
import { useDrillDown } from './DrillDownContext';

interface DepartmentTrendChartProps {
  assets: Asset[];
  departments: Department[];
}

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
const MAX_LINES = 6;

const shortLabel = (d: Department) => (d.code || '').replace(/^DEPT-/i, '') || d.name.split(/\s+/)[0];

export default function DepartmentTrendChart({ assets, departments }: DepartmentTrendChartProps) {
  const [mode, setMode] = useState<TrendMode>('monthly');
  const { openAssets } = useDrillDown();

  const data = useMemo(() => {
    const periods = buildPeriods(mode);
    const lines = departments
      .map((d) => {
        const dated = assets
          .filter((a) => (a.current_department_id || a.department?.id) === d.id)
          .map((a) => ({ a, t: assetDate(a) }))
          .filter((x) => !isNaN(x.t));
        const values = periods.map((p) => dated.filter((x) => x.t < p.end).length);
        const opening = dated.filter((x) => x.t < periods[0].start).length;
        return { d, dated, values, growth: values[values.length - 1] - opening };
      })
      .filter((l) => l.values[l.values.length - 1] > 0)
      .sort((a, b) => b.values[b.values.length - 1] - a.values[a.values.length - 1])
      .slice(0, MAX_LINES)
      .map((l, i) => ({ ...l, color: COLORS[i % COLORS.length] }));
    return { periods, lines };
  }, [assets, departments, mode]);

  const top = data.lines[0];
  const fastest = [...data.lines].sort((a, b) => b.growth - a.growth)[0];

  const handlePointClick = (deptId: string, i: number) => {
    const line = data.lines.find((l) => l.d.id === deptId);
    if (!line) return;
    const list = line.dated.filter((x) => x.t < data.periods[i].end).map((x) => x.a);
    openAssets(`${line.d.name} — as of ${data.periods[i].label}`, list);
  };

  return (
    <ChartCard
      icon={Building2}
      iconClassName="bg-purple-50 text-purple-600"
      title="Department-wise Trend"
      action={<TrendModeToggle mode={mode} onChange={setMode} />}
    >
      <MetricStrip
        key={`m-${mode}`}
        items={[
          { label: 'Top Dept', value: 0, display: top ? shortLabel(top.d) : '—', className: 'text-slate-900' },
          { label: 'Top Count', value: top?.values[top.values.length - 1] ?? 0, className: 'text-indigo-600' },
          { label: 'Fastest Growth', value: 0, display: fastest ? shortLabel(fastest.d) : '—', className: 'text-teal-600' },
          { label: mode === 'monthly' ? 'Growth (12M)' : 'Growth (5Y)', value: fastest?.growth ?? 0, display: `+${fastest?.growth ?? 0}`, className: 'text-emerald-600' },
        ]}
      />

      {data.lines.length === 0 ? (
        <EmptyState message="No department assets to trend" />
      ) : (
        <>
          <TrendFrame
            key={`t-${mode}`}
            labels={data.periods.map((p) => p.label)}
            series={data.lines.map((l) => ({ key: l.d.id, color: l.color, values: l.values }))}
            pointLabels="none"
            zeroBased={false}
            onPointClick={handlePointClick}
          />
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-700">
            {data.lines.map((l) => (
              <span key={l.d.id} className="flex items-center gap-1.5" title={l.d.name}>
                <span className="w-3 h-[3px] rounded-full" style={{ background: l.color }} />
                {shortLabel(l.d)}
                <span className="text-slate-400 tabular-nums">{l.values[l.values.length - 1]}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}
