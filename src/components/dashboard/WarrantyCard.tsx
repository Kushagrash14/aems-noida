'use client';

import { useMemo } from 'react';
import { ShieldCheck, ShieldOff, ShieldAlert, Clock, AlertTriangle, CheckCircle2, CalendarCheck, ShieldPlus } from 'lucide-react';
import { Asset } from '@/types/database';
import ChartCard from './charts/ChartCard';
import { CountUp } from './charts/useCountUp';
import { useDrillDown } from './charts/DrillDownContext';

interface WarrantyCardProps {
  assets: Asset[];
}

const DAY_MS = 1000 * 60 * 60 * 24;

export default function WarrantyCard({ assets }: WarrantyCardProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const covered: Asset[] = [], uncovered: Asset[] = [];
    const ranges: Asset[][] = [[], [], [], [], []];

    assets.forEach((a) => {
      const d = a.warranty_expiry ? new Date(a.warranty_expiry) : null;
      const days = d && !isNaN(d.getTime())
        ? Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today) / DAY_MS)
        : -1;
      if (days < 0) {
        uncovered.push(a);
        return;
      }
      covered.push(a);
      ranges[days <= 15 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4].push(a);
    });

    return {
      covered,
      uncovered,
      ranges,
      inWarranty: covered.length,
      noWarranty: uncovered.length,
      within15: ranges[0].length,
      d16to30: ranges[1].length,
      d31to60: ranges[2].length,
      d61to90: ranges[3].length,
      beyond90: ranges[4].length,
    };
  }, [assets]);

  const { openAssets } = useDrillDown();

  const total = assets.length;
  const inPct = total ? Math.round((stats.inWarranty / total) * 100) : 0;
  const noPct = 100 - inPct;

  const rows = [
    { label: 'Within 15 days',  count: stats.within15, icon: AlertTriangle, bar: 'from-rose-400 to-rose-600',     badge: 'bg-rose-50 text-rose-500',     glow: 'rgba(244,63,94,0.35)',   text: 'text-rose-600'    },
    { label: '16 – 30 days',    count: stats.d16to30,  icon: Clock,         bar: 'from-amber-300 to-amber-500',   badge: 'bg-amber-50 text-amber-500',   glow: 'rgba(245,158,11,0.35)',  text: 'text-amber-600'   },
    { label: '31 – 60 days',    count: stats.d31to60,  icon: Clock,         bar: 'from-orange-300 to-orange-500', badge: 'bg-orange-50 text-orange-500', glow: 'rgba(249,115,22,0.35)',  text: 'text-orange-500'  },
    { label: '61 – 90 days',    count: stats.d61to90,  icon: CalendarCheck, bar: 'from-sky-400 to-sky-600',       badge: 'bg-sky-50 text-sky-500',       glow: 'rgba(14,165,233,0.35)',  text: 'text-sky-600'     },
    { label: '90+ days left',   count: stats.beyond90, icon: ShieldPlus,    bar: 'from-emerald-400 to-emerald-600', badge: 'bg-emerald-50 text-emerald-600', glow: 'rgba(16,185,129,0.35)', text: 'text-emerald-600' },
  ];

  return (
    <ChartCard
      icon={ShieldAlert}
      iconClassName="bg-rose-50 text-rose-600"
      title="Warranty"
      subtitle="Warranty coverage and upcoming expiries"
      action={
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-slate-900 leading-none tabular-nums"><CountUp value={total} /></div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5">Total Assets</div>
        </div>
      }
    >
      {/* Compact top boxes */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-2.5 py-1.5 animate-fade-up flex items-center gap-2 cursor-pointer"
          onClick={() => openAssets('In Warranty', stats.covered)}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">In Warranty</div>
            <div className="text-lg font-black text-slate-900 tabular-nums leading-tight"><CountUp value={stats.inWarranty} /></div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex-1 h-1 rounded-full bg-emerald-100 overflow-hidden">
                <div className="relative h-full rounded-full bg-emerald-500 animate-bar-x bar-sweep" style={{ width: `${inPct}%` }} />
              </div>
              <span className="text-[9px] font-bold text-emerald-600 tabular-nums">{inPct}%</span>
            </div>
          </div>
        </div>

        <div
          className="rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 animate-fade-up flex items-center gap-2 cursor-pointer"
          style={{ animationDelay: '60ms' }}
          onClick={() => openAssets('No Warranty', stats.uncovered)}
        >
          <ShieldOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">No Warranty</div>
            <div className="text-lg font-black text-slate-900 tabular-nums leading-tight"><CountUp value={stats.noWarranty} delay={60} /></div>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex-1 h-1 rounded-full bg-slate-200 overflow-hidden">
                <div className="relative h-full rounded-full bg-slate-400 animate-bar-x bar-sweep" style={{ width: `${noPct}%`, animationDelay: '60ms' }} />
              </div>
              <span className="text-[9px] font-bold text-slate-500 tabular-nums">{noPct}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 pt-0.5">Assets in warranty — Expiring Soon</div>

      {/* Compact rows */}
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const Icon = r.icon;
          const delay = i * 70;
          const barPct = stats.inWarranty > 0 ? Math.max((r.count / stats.inWarranty) * 100, r.count > 0 ? 3 : 0) : 0;
          return (
            <div
              key={r.label}
              className={`animate-slide-in flex items-center gap-2 ${r.count > 0 ? 'cursor-pointer' : ''}`}
              style={{ animationDelay: `${delay}ms` }}
              onClick={r.count > 0 ? () => openAssets(`Warranty Expiring — ${r.label}`, stats.ranges[i]) : undefined}
            >
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${r.badge} ${r.count > 0 ? 'animate-glow' : ''}`}
                style={r.count > 0 ? { ['--glow' as string]: r.glow, animationDelay: `${delay}ms` } : undefined}
              >
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-semibold text-slate-700">{r.label}</span>
                  <span className={`text-[11px] font-black tabular-nums ${r.text}`}><CountUp value={r.count} delay={delay} /></span>
                </div>
                <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                  {r.count > 0 && (
                    <div className={`relative h-full rounded-full bg-gradient-to-r ${r.bar} animate-bar-x bar-sweep`} style={{ width: `${barPct}%`, animationDelay: `${delay + 120}ms` }} />
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
