'use client';

import { TrendMode } from './TrendFrame';

export default function TrendModeToggle({ mode, onChange }: { mode: TrendMode; onChange: (mode: TrendMode) => void }) {
  return (
    <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-[11px] font-bold shadow-sm shrink-0">
      {(['monthly', 'yearly'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-2.5 py-0.5 rounded cursor-pointer ${mode === m ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
        >
          {m === 'monthly' ? 'Monthly' : 'Yearly'}
        </button>
      ))}
    </div>
  );
}
