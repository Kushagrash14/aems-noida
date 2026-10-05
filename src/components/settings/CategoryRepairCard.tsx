'use client';

import { useState } from 'react';
import { Wrench, Search, CheckCircle2, Loader2 } from 'lucide-react';

interface RepairRow {
  id: string;
  asset_tag: string;
  name: string;
  from: string;
  to: string;
}

export default function CategoryRepairCard() {
  const [rows, setRows] = useState<RepairRow[] | null>(null);
  const [busy, setBusy] = useState<'scan' | 'fix' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = async (method: 'GET' | 'POST') => {
    setBusy(method === 'GET' ? 'scan' : 'fix');
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/assets/repair-categories', { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      if (method === 'GET') {
        setRows(data.fixed);
        setMessage(
          data.fixed.length === 0
            ? `Scanned ${data.scanned} assets — no wrongly categorised Laptop/Desktop entries found.`
            : `${data.fixed.length} Laptop/Desktop entries are saved under a wrong asset type.`
        );
      } else {
        setRows([]);
        setMessage(`Fixed ${data.fixed.length} entries. They now appear only under Laptop / Desktop.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-600" />
            Fix Laptop / Desktop Asset Types
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Laptops/Desktops saved under Camera/NVR, the generic &quot;IT&quot; type or another unrelated type show up in the wrong
            filters. Scan to preview, then fix to move them to LAPTOP / DESKTOP.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => call('GET')}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            {busy === 'scan' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Scan
          </button>
          <button
            type="button"
            onClick={() => call('POST')}
            disabled={busy !== null || !rows || rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {busy === 'fix' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Fix {rows && rows.length > 0 ? `(${rows.length})` : ''}
          </button>
        </div>
      </div>

      {message && <p className="text-xs font-semibold text-emerald-700">{message}</p>}
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      {rows && rows.length > 0 && (
        <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Asset Tag</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Current Type</th>
                <th className="text-left px-3 py-2">New Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-1.5 font-mono">{r.asset_tag}</td>
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="px-3 py-1.5 text-rose-600 font-semibold">{r.from}</td>
                  <td className="px-3 py-1.5 text-emerald-700 font-bold">{r.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
