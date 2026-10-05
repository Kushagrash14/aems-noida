'use client';

import { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { Asset, Category } from '@/types/database';
import { formatCompactNumber } from '@/lib/utils';
import ChartCard, { EmptyState } from './ChartCard';

interface AssetCategoryChartProps {
  assets: Asset[];
  categories: Category[];
}

const MAX_ROWS = 6;
const COLORS = [
  'from-blue-500 to-indigo-500',
  'from-violet-500 to-fuchsia-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-cyan-500',
  'from-rose-400 to-pink-500',
];

export default function AssetCategoryChart({ assets, categories }: AssetCategoryChartProps) {
  const rows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; value: number }>();
    assets.forEach((a) => {
      const id = a.category_id || a.category?.id || 'uncategorised';
      const name = a.category?.name || categories.find((c) => c.id === id)?.name || 'Uncategorised';
      const row = map.get(id) || { id, name, count: 0, value: 0 };
      row.count += 1;
      row.value += Number(a.purchase_cost) || 0;
      map.set(id, row);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [assets, categories]);

  const shown = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - shown.length;
  const max = Math.max(...shown.map((r) => r.count), 1);
  const total = assets.length;

  return (
    <ChartCard
      icon={LayoutGrid}
      iconClassName="bg-violet-50 text-violet-600"
      title="Assets by Category"
      subtitle="Asset count and purchase value by category"
      action={
        <span className="text-[11px] font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full shrink-0">
          {rows.length} Categories
        </span>
      }
    >
      {shown.length === 0 ? (
        <EmptyState message="No assets yet" />
      ) : (
        <div className="space-y-3.5">
          {shown.map((r, i) => (
            <div key={r.id}>
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-slate-800 min-w-0 break-words">{r.name}</span>
                <span className="text-xs text-slate-500 shrink-0">
                  <strong className="text-sm text-slate-900">{r.count}</strong>
                  <span className="mx-1.5 text-slate-300">|</span>
                  ₹{formatCompactNumber(r.value)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${COLORS[i % COLORS.length]} animate-bar-x`}
                    style={{ width: `${Math.max((r.count / max) * 100, 3)}%`, animationDelay: `${i * 70}ms` }}
                  />
                </div>
                <span className="w-9 text-right text-[11px] font-medium text-slate-400">
                  {total ? Math.round((r.count / total) * 100) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {hidden > 0 && (
        <div className="mt-auto text-[11px] text-slate-500">+ {hidden} more categories</div>
      )}
    </ChartCard>
  );
}
