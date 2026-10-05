'use client';

import { useMemo } from 'react';
import { Activity, CheckCircle2, Package, Wrench, AlertTriangle, SearchX, Trash2 } from 'lucide-react';
import { Asset } from '@/types/database';
import ChartCard from './ChartCard';
import { CountUp } from './useCountUp';
import { useDrillDown } from './DrillDownContext';

interface AssetStatusCardProps {
  assets: Asset[];
}

const STATUSES = [
  { id: 'in_service', label: 'Assigned / In Use', icon: CheckCircle2, bar: 'from-emerald-400 to-emerald-600', badge: 'bg-emerald-50 text-emerald-600', glow: 'rgba(16,185,129,0.35)' },
  { id: 'in_storage', label: 'In Stock', icon: Package, bar: 'from-blue-400 to-blue-600', badge: 'bg-blue-50 text-blue-600', glow: 'rgba(59,130,246,0.35)' },
  { id: 'maintenance', label: 'Under Maintenance', icon: Wrench, bar: 'from-amber-300 to-amber-500', badge: 'bg-amber-50 text-amber-600', glow: 'rgba(245,158,11,0.35)' },
  { id: 'damaged', label: 'Damaged', icon: AlertTriangle, bar: 'from-rose-400 to-rose-600', badge: 'bg-rose-50 text-rose-600', glow: 'rgba(244,63,94,0.35)' },
  { id: 'missing', label: 'Missing', icon: SearchX, bar: 'from-violet-400 to-violet-600', badge: 'bg-violet-50 text-violet-600', glow: 'rgba(139,92,246,0.35)' },
  { id: 'scrapped', label: 'Scrapped', icon: Trash2, bar: 'from-slate-400 to-slate-600', badge: 'bg-slate-100 text-slate-600', glow: 'rgba(100,116,139,0.3)' },
] as const;

export default function AssetStatusCard({ assets }: AssetStatusCardProps) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    assets.forEach((a) => {
      map[a.status] = (map[a.status] || 0) + 1;
    });
    return map;
  }, [assets]);

  const total = assets.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const { openAssets } = useDrillDown();

  return (
    <ChartCard
      icon={Activity}
      iconClassName="bg-emerald-50 text-emerald-600"
      title="Asset Status"
      subtitle="Where every asset stands right now"
      action={
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-slate-900 leading-none tabular-nums">
            <CountUp value={total} />
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-1">Total Assets</div>
        </div>
      }
    >
      <div className="space-y-3">
        {STATUSES.map((s, i) => {
          const count = counts[s.id] || 0;
          const Icon = s.icon;
          const delay = i * 90;
          return (
            <div
              key={s.id}
              className={`animate-slide-in flex items-center gap-3 ${count > 0 ? 'cursor-pointer' : ''}`}
              style={{ animationDelay: `${delay}ms` }}
              onClick={count > 0 ? () => openAssets(s.label, assets.filter((a) => a.status === s.id)) : undefined}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.badge} ${count > 0 ? 'animate-glow' : ''}`}
                style={count > 0 ? { ['--glow' as string]: s.glow, animationDelay: `${delay}ms` } : undefined}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">{s.label}</span>
                  <span className="text-xs text-slate-500">
                    <strong className="text-sm text-slate-900 tabular-nums">
                      <CountUp value={count} delay={delay} />
                    </strong>
                    <span className="ml-1.5 text-[11px] tabular-nums">{pct(count)}%</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  {count > 0 && (
                    <div
                      className={`relative h-full rounded-full bg-gradient-to-r ${s.bar} animate-bar-x bar-sweep`}
                      style={{ width: `${Math.max(pct(count), 2)}%`, animationDelay: `${delay + 150}ms` }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
