'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Asset } from '@/types/database';

export type TrendMode = 'monthly' | 'yearly';

export interface TrendPeriod {
  key: string;
  label: string;
  start: number;
  end: number;
}

export interface TrendSeries {
  key: string;
  color: string;
  values: number[];
  area?: boolean;
}

interface TrendFrameProps {
  labels: string[];
  series: TrendSeries[];
  bars?: { values: number[]; className: string };
  pointLabels?: 'all' | 'last' | 'none';
  zeroBased?: boolean;
  minHeight?: number;
  onColumnClick?: (index: number) => void;
  onPointClick?: (seriesKey: string, index: number) => void;
}

export function assetDate(a: Asset): number {
  const t = new Date(a.purchase_date || a.created_at).getTime();
  return isNaN(t) ? NaN : t;
}

export function buildPeriods(mode: TrendMode): TrendPeriod[] {
  const now = new Date();
  if (mode === 'yearly') {
    return [4, 3, 2, 1, 0].map((k) => {
      const year = now.getFullYear() - k;
      return { key: String(year), label: String(year), start: new Date(year, 0, 1).getTime(), end: new Date(year + 1, 0, 1).getTime() };
    });
  }
  return Array.from({ length: 12 }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const month = start.toLocaleString('en-US', { month: 'short' });
    return {
      key: `${start.getFullYear()}-${start.getMonth()}`,
      label: start.getMonth() === 0 ? `${month} '${String(start.getFullYear()).slice(2)}` : month,
      start: start.getTime(),
      end: end.getTime(),
    };
  });
}

function niceStep(max: number): number {
  const raw = Math.max(max / 4, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 2.5, 3, 4, 5, 6, 8, 10].filter((s) => Number.isInteger(s * magnitude));
  return (steps.find((s) => s * magnitude >= raw) || 10) * magnitude;
}

const BAR_BAND = 0.34;

export default function TrendFrame({
  labels,
  series,
  bars,
  pointLabels = 'last',
  zeroBased = true,
  minHeight = 160,
  onColumnClick,
  onPointClick,
}: TrendFrameProps) {
  const gradientId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = labels.length;
  const allValues = series.flatMap((s) => s.values);
  const dataMax = Math.max(0, ...allValues);
  const dataMin = zeroBased ? 0 : Math.min(dataMax, ...allValues);
  let step = niceStep(dataMax - dataMin);
  let yMin = Math.floor(dataMin / step) * step;
  while (yMin + step * 4 < dataMax) {
    step = niceStep(step * 4.5);
    yMin = Math.floor(dataMin / step) * step;
  }
  const yMax = yMin + step * 4;
  const ticks = [4, 3, 2, 1, 0].map((k) => yMin + k * step);
  const barMax = bars ? Math.max(1, ...bars.values) : 1;

  const x = (i: number) => ((i + 0.5) / n) * 100;
  const y = (v: number) => (1 - (v - yMin) / (yMax - yMin)) * 100;
  const px = (i: number) => (x(i) / 100) * size.w;
  const py = (v: number) => (y(v) / 100) * size.h;

  return (
    <div className="flex-1 flex flex-col pt-4" style={{ minHeight }}>
      <div className="flex-1 flex gap-2 min-h-0">
        <div className="relative w-10 shrink-0 text-[10px] font-bold text-slate-600 tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${y(t)}%` }}>
              {t}
            </span>
          ))}
        </div>

        <div ref={plotRef} className="relative flex-1 min-w-0">
          <div className="absolute inset-0 pointer-events-none">
            {ticks.map((t) => (
              <div
                key={t}
                className={`absolute inset-x-0 border-t ${t === 0 ? 'border-slate-300' : 'border-dashed border-slate-200'}`}
                style={{ top: `${y(t)}%` }}
              />
            ))}
          </div>

          {bars && (
            <div className="absolute inset-0 flex items-end pointer-events-none">
              {bars.values.map((v, i) => (
                <div key={labels[i]} className="relative flex-1 flex items-end justify-center h-full">
                  {v > 0 && (
                    <>
                      <span
                        className="absolute text-[9px] font-bold text-slate-500 tabular-nums animate-fade-up"
                        style={{ bottom: `calc(${(v / barMax) * BAR_BAND * 100}% + 3px)`, animationDelay: `${i * 50 + 500}ms` }}
                      >
                        +{v}
                      </span>
                      <div
                        className={`w-[42%] max-w-[16px] rounded-t animate-bar-spring ${bars.className}`}
                        style={{
                          height: `${(v / barMax) * BAR_BAND * 100}%`,
                          animationDelay: `${i * 50}ms`,
                          ['--bar-delay' as string]: `${i * 50}ms`,
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {size.w > 0 && (
          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox={`0 0 ${size.w} ${size.h}`}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${gradientId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {series.map((s) => {
              const line = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i)},${py(v)}`).join(' ');
              return (
                <g key={s.key}>
                  {s.area && (
                    <path
                      d={`${line} L${px(n - 1)},${size.h} L${px(0)},${size.h} Z`}
                      fill={`url(#${gradientId}-${s.key})`}
                      className="animate-area"
                    />
                  )}
                  <path
                    d={line}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    className="animate-line"
                  />
                </g>
              );
            })}
          </svg>
          )}

          {onColumnClick && (
            <div className="absolute inset-0 flex">
              {labels.map((l, i) => (
                <div key={l} className="flex-1 h-full cursor-pointer" onClick={() => onColumnClick(i)} />
              ))}
            </div>
          )}

          {series.map((s) =>
            s.values.map((v, i) => {
              const showLabel = pointLabels === 'all' || (pointLabels === 'last' && i === n - 1);
              return (
                <div
                  key={`${s.key}-${i}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 ${onPointClick ? 'cursor-pointer p-1.5' : 'pointer-events-none'}`}
                  style={{ left: `${x(i)}%`, top: `${y(v)}%` }}
                  onClick={onPointClick ? () => onPointClick(s.key, i) : undefined}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-white border-2 animate-dot"
                    style={{ borderColor: s.color, animationDelay: `${600 + i * 60}ms` }}
                  />
                  {showLabel && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 bottom-full text-[10px] font-extrabold tabular-nums whitespace-nowrap animate-fade-up"
                      style={{ color: s.color, animationDelay: `${900 + i * 60}ms` }}
                    >
                      {v}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-1.5">
        <div className="w-10 shrink-0" />
        <div className="flex-1 flex">
          {labels.map((l) => (
            <span key={l} className="flex-1 min-w-0 text-center text-[10px] font-bold text-slate-700 leading-tight break-words line-clamp-2">
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
