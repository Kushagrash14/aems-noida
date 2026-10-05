'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Asset, Department } from '@/types/database';
import ChartCard, { EmptyState } from './ChartCard';
import { CountUp } from './useCountUp';
import { useDrillDown } from './DrillDownContext';

interface AssetDepartmentChartProps {
  assets: Asset[];
  departments: Department[];
}

const COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
  '#06b6d4', '#84cc16',
];

function shortLabel(d: Department): string {
  return (d.code || '').replace(/^DEPT-/i, '') || d.name.split(/\s+/)[0];
}

// Rounded top bar shape
function RoundedBar(props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill = '#6366f1' } = props;
  const r = Math.min(6, width / 2);
  if (height <= 0 || width <= 0) return null;
  return (
    <path
      d={`M${x + r},${y} h${width - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${height - r} h${-width} v${-(height - r)} a${r},${r} 0 0 1 ${r},${-r}z`}
      fill={fill}
      style={{ filter: `drop-shadow(0 4px 8px ${fill}55)` }}
    />
  );
}

export default function AssetDepartmentChart({ assets, departments }: AssetDepartmentChartProps) {
  const { chartData, total } = useMemo(() => {
    const data = departments
      .map((d, i) => ({
        id: d.id,
        name: shortLabel(d),
        fullName: d.name,
        assets: assets.filter(
          (a) => (a.current_department_id || a.department?.id) === d.id
        ).length,
        color: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.assets - a.assets);
    const total = data.reduce((s, r) => s + r.assets, 0);
    return { chartData: data, total };
  }, [assets, departments]);

  const hasData = chartData.some((d) => d.assets > 0);
  const { openAssets } = useDrillDown();

  return (
    <ChartCard
      emoji="🏢"
      title="Assets by Department"
      action={
        <div
          className="shrink-0 flex items-center gap-2 rounded-xl px-3 py-1.5"
          style={{
            background: 'linear-gradient(135deg,#6366f122,#8b5cf611)',
            border: '1px solid #6366f130',
          }}
        >
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">Total</span>
          <span className="text-[15px] font-black text-indigo-700 tabular-nums">
            <CountUp value={total} />
          </span>
        </div>
      }
    >
      {!hasData ? (
        <EmptyState message="No assets assigned to departments" />
      ) : (
        <div className="flex-1 min-h-[150px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 18, right: 6, left: -20, bottom: 0 }}
              barCategoryGap="32%"
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />

              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />

              <YAxis
                tick={{ fontSize: 9, fontWeight: 600, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickCount={5}
                allowDecimals={false}
              />

              <Bar
                dataKey="assets"
                shape={<RoundedBar />}
                cursor="pointer"
                onClick={(_, index) => {
                  const row = chartData[index];
                  if (row?.assets) openAssets(`${row.fullName} — Assets`, assets.filter((a) => (a.current_department_id || a.department?.id) === row.id));
                }}
                label={{
                  position: 'top',
                  fontSize: 11,
                  fontWeight: 800,
                  fill: '#475569',
                  formatter: (v: unknown) => (Number(v) > 0 ? String(v) : ''),
                }}
                animationDuration={900}
                animationEasing="ease-out"
              >
                {chartData.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
