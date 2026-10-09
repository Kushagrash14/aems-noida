'use client';

import { useMemo, useState } from 'react';
import { Hourglass } from 'lucide-react';
import { Asset } from '@/types/database';
import { formatCompactNumber } from '@/lib/utils';
import ChartCard from './ChartCard';
import { CountUp } from './useCountUp';
import { useDrillDown } from './DrillDownContext';

interface AssetAgeDistributionChartProps {
  assets: Asset[];
}

const CHART_HEIGHT = 150;
const YEAR_MS = 1000 * 60 * 60 * 24 * 365.25;

const BUCKETS = [
  { id: 'new', label: 'Under 1 yr', stage: 'New', bar: 'bg-gradient-to-t from-emerald-500 to-emerald-300', text: 'text-emerald-600' },
  { id: 'good', label: '1 – 3 yrs', stage: 'Good', bar: 'bg-gradient-to-t from-sky-500 to-sky-300', text: 'text-sky-600' },
  { id: 'ageing', label: '3 – 5 yrs', stage: 'Ageing', bar: 'bg-gradient-to-t from-amber-500 to-amber-300', text: 'text-amber-600' },
  { id: 'old', label: 'Over 5 yrs', stage: 'Old', bar: 'bg-gradient-to-t from-rose-500 to-rose-300', text: 'text-rose-600' },
] as const;

function niceStep(max: number): number {
  const raw = Math.max(max / 4, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 2.5, 3, 4, 5, 6, 8, 10].filter((s) => Number.isInteger(s * magnitude));
  return (steps.find((s) => s * magnitude >= raw) || 10) * magnitude;
}

export default function AssetAgeDistributionChart({ assets }: AssetAgeDistributionChartProps) {
  const [mode, setMode] = useState<'count' | 'value'>('count');

  const buckets = useMemo(() => {
    const now = new Date().getTime();
    const data = BUCKETS.map((b) => ({ ...b, count: 0, value: 0, items: [] as Asset[] }));
    assets.forEach((a) => {
      const cost = Number(a.purchase_cost) || 0;
      const purchased = a.purchase_date ? new Date(a.purchase_date).getTime() : NaN;
      const age = isNaN(purchased) ? 0 : Math.max((now - purchased) / YEAR_MS, 0);
      const idx = age < 1 ? 0 : age <= 3 ? 1 : age <= 5 ? 2 : 3;
      data[idx].count++;
      data[idx].value += cost;
      data[idx].items.push(a);
    });
    return data;
  }, [assets]);

  const { openAssets } = useDrillDown();

  const valueOf = (b: (typeof buckets)[number]) => (mode === 'count' ? b.count : b.value);
  const fmt = (v: number) => (mode === 'count' ? String(v) : `₹${formatCompactNumber(v)}`);
  const step = niceStep(Math.max(...buckets.map(valueOf), 0));
  const yMax = step * 4;
  const ticks = [4, 3, 2, 1, 0].map((n) => n * step);

  return (
    <ChartCard
      icon={Hourglass}
      iconClassName="bg-amber-50 text-amber-600"
      title="Assets by Age"
      action={
        <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 leading-none shadow-sm">
          {BUCKETS.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm ${b.bar}`} /> {b.stage}
            </span>
          ))}
        </div>
        <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-[11px] font-bold shadow-sm shrink-0">
          {(['count', 'value'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2.5 py-0.5 rounded cursor-pointer ${mode === m ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              {m === 'count' ? 'Count' : 'Value'}
            </button>
          ))}
        </div>
        </div>
      }
    >
      <div className="flex-1 flex flex-col pt-5" style={{ minHeight: CHART_HEIGHT }} key={mode}>
        <div className="flex-1 flex gap-2 min-h-0">
          <div className="relative w-10 shrink-0 text-[10px] font-bold text-slate-600 tabular-nums">
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${(1 - t / yMax) * 100}%` }}>
                {mode === 'count' ? t : formatCompactNumber(t)}
              </span>
            ))}
          </div>

          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-0 pointer-events-none">
              {ticks.map((t) => (
                <div
                  key={t}
                  className={`absolute inset-x-0 border-t ${t === 0 ? 'border-slate-300' : 'border-slate-200/70'}`}
                  style={{ top: `${(1 - t / yMax) * 100}%` }}
                />
              ))}
            </div>

            <div className="absolute inset-0 flex items-end justify-around gap-3">
              {buckets.map((b, i) => {
                const v = valueOf(b);
                const pct = v > 0 ? (v / yMax) * 100 : 0;
                const delay = i * 120;
                return (
                  <div key={b.id} className="relative flex items-end justify-center h-full flex-1 min-w-0">
                    <div
                      className={`relative flex items-end h-full w-full max-w-[52px] ${v > 0 ? 'cursor-pointer' : ''}`}
                      onClick={v > 0 ? () => openAssets(`Asset Age — ${b.label} (${b.stage})`, b.items) : undefined}
                    >
                      <span
                        className={`absolute inset-x-0 text-center text-[11px] font-bold tabular-nums animate-fade-up ${v > 0 ? 'text-slate-800' : 'text-slate-300'}`}
                        style={{ bottom: `calc(${pct}% + 5px)`, animationDelay: `${delay + 450}ms` }}
                      >
                        {mode === 'count' ? <CountUp value={v} delay={delay} /> : fmt(v)}
                      </span>
                      {v > 0 && (
                        <div
                          className={`w-full rounded-t-lg animate-bar-spring bar-shine ${b.bar} shadow-[0_4px_12px_-4px_rgba(15,23,42,0.25)]`}
                          style={{
                            height: `max(${pct}%, 6px)`,
                            animationDelay: `${delay}ms`,
                            ['--bar-delay' as string]: `${delay}ms`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-1.5">
          <div className="w-10 shrink-0" />
          <div className="flex-1 flex justify-around gap-3">
            {buckets.map((b) => (
              <span key={b.id} className="flex-1 min-w-0 text-center text-[11px] font-bold text-slate-800 leading-tight break-words line-clamp-2">
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
