'use client';

import { ReactNode } from 'react';

export interface BarDatum {
  key: string;
  value: number;
  className: string;
  label?: ReactNode;
}

export interface BarGroup {
  id: string;
  label: string;
  bars: BarDatum[];
}

interface BarChartFrameProps {
  groups: BarGroup[];
  formatTick?: (value: number) => string;
  allowFractionalTicks?: boolean;
  barMaxWidth?: number;
  minHeight?: number;
  referenceLine?: { value: number; label: string };
  onBarClick?: (groupId: string, barKey: string) => void;
}

function niceStep(max: number, allowFraction: boolean): number {
  const raw = Math.max(max / 4, allowFraction ? 0.25 : 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 2.5, 3, 4, 5, 6, 8, 10].filter((s) => allowFraction || Number.isInteger(s * magnitude));
  return (steps.find((s) => s * magnitude >= raw) || 10) * magnitude;
}

export default function BarChartFrame({
  groups,
  formatTick = (v) => String(v),
  allowFractionalTicks = false,
  barMaxWidth = 52,
  minHeight = 150,
  referenceLine,
  onBarClick,
}: BarChartFrameProps) {
  const max = Math.max(0, referenceLine?.value ?? 0, ...groups.flatMap((g) => g.bars.map((b) => b.value)));
  const step = niceStep(max, allowFractionalTicks);
  const yMax = step * 4;
  const ticks = [4, 3, 2, 1, 0].map((n) => n * step);
  const grouped = groups.some((g) => g.bars.length > 1);

  return (
    <div className="flex-1 flex flex-col pt-4" style={{ minHeight }}>
      <div className="flex-1 flex gap-2 min-h-0">
        <div className="relative w-10 shrink-0 text-[10px] font-bold text-slate-600 tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${(1 - t / yMax) * 100}%` }}>
              {formatTick(t)}
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

          <div className={`absolute inset-0 flex items-end justify-around ${grouped ? 'gap-3' : 'gap-2'}`}>
            {groups.map((g, gi) => (
              <div key={g.id} className="flex items-end justify-center gap-1 h-full flex-1 min-w-0">
                {g.bars.map((b, bi) => {
                  const pct = b.value > 0 ? (b.value / yMax) * 100 : 0;
                  const delay = gi * 120 + bi * 60;
                  const clickable = Boolean(onBarClick && b.value > 0);
                  return (
                    <div
                      key={b.key}
                      className={`relative flex items-end h-full flex-1 min-w-0 ${clickable ? 'cursor-pointer' : ''}`}
                      style={{ maxWidth: barMaxWidth }}
                      onClick={clickable ? () => onBarClick!(g.id, b.key) : undefined}
                    >
                      <span
                        className={`absolute left-1/2 -translate-x-1/2 font-bold tabular-nums whitespace-nowrap animate-fade-up ${
                          grouped ? 'text-[10px]' : 'text-[11px]'
                        } ${b.value > 0 ? 'text-slate-800' : 'text-slate-300'}`}
                        style={{ bottom: `calc(${pct}% + 4px)`, animationDelay: `${delay + 450}ms` }}
                      >
                        {b.label ?? b.value}
                      </span>
                      {b.value > 0 ? (
                        <div
                          className={`w-full rounded-t-md animate-bar-spring bar-shine ${b.className} shadow-[0_4px_12px_-4px_rgba(15,23,42,0.25)]`}
                          style={{
                            height: `max(${pct}%, 6px)`,
                            animationDelay: `${delay}ms`,
                            ['--bar-delay' as string]: `${delay}ms`,
                          }}
                        />
                      ) : (
                        <div className="w-full h-[3px] rounded-t bg-slate-200" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {referenceLine && referenceLine.value > 0 && (
            <div
              className="absolute inset-x-0 border-t-2 border-dashed border-slate-500/70 pointer-events-none animate-fade-up"
              style={{ top: `${(1 - referenceLine.value / yMax) * 100}%`, animationDelay: '700ms' }}
            >
              <span className="absolute right-0 -top-[18px] rounded bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                {referenceLine.label}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-1.5">
        <div className="w-10 shrink-0" />
        <div className={`flex-1 flex justify-around ${grouped ? 'gap-3' : 'gap-2'}`}>
          {groups.map((g) => (
            <span key={g.id} className="flex-1 min-w-0 text-center text-[11px] font-bold text-slate-800 leading-tight break-words line-clamp-2" title={g.label}>
              {g.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
