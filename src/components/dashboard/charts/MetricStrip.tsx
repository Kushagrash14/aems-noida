'use client';

import { CountUp } from './useCountUp';

export interface MetricItem {
  label: string;
  value: number;
  display?: string;
  suffix?: string;
  className: string;
}

export function formatShortRupee(value: number): string {
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (value >= 10000000) return `₹${trim(value / 10000000)}Cr`;
  if (value >= 100000) return `₹${trim(value / 100000)}L`;
  if (value >= 1000) return `₹${Math.round(value / 1000)}K`;
  return `₹${Math.round(value)}`;
}

export default function MetricStrip({ items }: { items: MetricItem[] }) {
  return (
    <div
      className="grid divide-x divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/70"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((m, i) => (
        <div key={m.label} className="px-2.5 py-1.5 min-w-0">
          <div className="text-[9px] font-medium uppercase tracking-wide text-slate-400 leading-tight break-words">{m.label}</div>
          <div className={`text-base font-semibold leading-tight tabular-nums whitespace-nowrap ${m.className}`}>
            {m.display ?? <CountUp value={m.value} delay={i * 80} suffix={m.suffix} />}
          </div>
        </div>
      ))}
    </div>
  );
}
