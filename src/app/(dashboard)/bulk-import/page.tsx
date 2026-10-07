'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Table,
  Check,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import type { User } from '@/types/database';

interface ColumnMapping {
  asset_tag: string;
  sap_asset_code: string;
  name: string;
  category: string;
  serial_number: string;
  location: string;
  plant: string;
  department: string;
  purchase_date: string;
  purchase_cost: string;
  po_number: string;
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
}

export default function BulkImportPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch((err) => console.error('Failed to load user auth in bulk import:', err))
      .finally(() => setLoadingAuth(false));
  }, []);

  // Column Mapping
  const [mapping, setMapping] = useState<ColumnMapping>({
    asset_tag: '',
    sap_asset_code: '',
    name: '',
    category: '',
    serial_number: '',
    location: '',
    plant: '',
    department: '',
    purchase_date: '',
    purchase_cost: '',
    po_number: '',
    invoice_number: '',
    invoice_date: '',
    vendor_name: '',
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    setError(null);
    setFile(uploaded);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

        if (!data || data.length < 2) {
          setError('The uploaded sheet is empty or contains no data rows.');
          return;
        }

        const rawHeaders = (data[0] || []).map(String);
        setHeaders(rawHeaders);

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        setRawRows(rows);

        // Smart auto-mapper: matches column names case-insensitively
        const autoMap: ColumnMapping = {
          asset_tag: rawHeaders.find((h) => /tag|asset.*id|barcode/i.test(h)) || '',
          sap_asset_code: rawHeaders.find((h) => /sap/i.test(h)) || '',
          name: rawHeaders.find((h) => /name|title|description/i.test(h)) || '',
          category: rawHeaders.find((h) => /cat/i.test(h)) || '',
          serial_number: rawHeaders.find((h) => /serial|sn/i.test(h)) || '',
          location: rawHeaders.find((h) => /loc/i.test(h)) || '',
          plant: rawHeaders.find((h) => /plant|unit/i.test(h)) || '',
          department: rawHeaders.find((h) => /dept|department/i.test(h)) || '',
          purchase_date: rawHeaders.find((h) => /purchase.*date|purchased/i.test(h)) || '',
          purchase_cost: rawHeaders.find((h) => /cost|price|amount/i.test(h)) || '',
          po_number: rawHeaders.find((h) => /po/i.test(h)) || '',
          invoice_number: rawHeaders.find((h) => /invoice.*no|inv.*no|invoice.*num/i.test(h)) || '',
          invoice_date: rawHeaders.find((h) => /invoice.*date/i.test(h)) || '',
          vendor_name: rawHeaders.find((h) => /vendor|supplier/i.test(h)) || '',
        };

        setMapping(autoMap);
        setStep(2);
      } catch (err) {
        setError('Failed to parse Excel workbook. Please upload a standard .xlsx or .csv file.');
      }
    };
    reader.readAsBinaryString(uploaded);
  };

  const executeImport = async () => {
    if (!mapping.asset_tag || !mapping.name) {
      setError('Asset Tag and Asset Name mappings are required.');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      // Map raw rows to normalized entity payload
      const payloadRows = rawRows.map((r) => ({
        asset_tag: r[mapping.asset_tag],
        sap_asset_code: mapping.sap_asset_code ? r[mapping.sap_asset_code] : null,
        name: r[mapping.name],
        category: mapping.category ? r[mapping.category] : null,
        serial_number: mapping.serial_number ? r[mapping.serial_number] : null,
        location: mapping.location ? r[mapping.location] : null,
        plant: mapping.plant ? r[mapping.plant] : null,
        department: mapping.department ? r[mapping.department] : null,
        purchase_date: mapping.purchase_date ? r[mapping.purchase_date] : null,
        purchase_cost: mapping.purchase_cost ? r[mapping.purchase_cost] : null,
        po_number: mapping.po_number ? r[mapping.po_number] : null,
        invoice_number: mapping.invoice_number ? r[mapping.invoice_number] : null,
        invoice_date: mapping.invoice_date ? r[mapping.invoice_date] : null,
        vendor_name: mapping.vendor_name ? r[mapping.vendor_name] : null,
      }));

      const res = await fetch('/api/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payloadRows }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Bulk import failed');
      }

      setImportResult(data.results);
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error executing import');
    } finally {
      setImporting(false);
    }
  };

  if (!loadingAuth && currentUser && currentUser.role !== 'it_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Bulk Excel Import is strictly restricted to IT Administrators. Facility Admins and Users cannot perform bulk imports.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Bulk Excel Asset Import Engine</h1>
        <p className="text-xs text-slate-400">
          Upload spreadsheets, interactively map columns, and ingest directly into normalized Postgres tables
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="glass-panel rounded-2xl p-8 border border-slate-800 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Select Excel or CSV Spreadsheet</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
            Supports legacy v1 exports, SAP asset lists, vendor invoices, or plant audit inventories (.xlsx, .csv).
          </p>

          <label className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Choose Spreadsheet File</span>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING UI */}
      {step === 2 && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Map Sheet Headers to Normalized Database Columns
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Loaded {rawRows.length} rows from file: <span className="text-white font-mono">{file?.name}</span>
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Upload Different File
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Required Fields */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Mandatory Identification Fields
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Asset Tag Column *
                </label>
                <select
                  value={mapping.asset_tag}
                  onChange={(e) => setMapping({ ...mapping, asset_tag: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select Sheet Column --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Asset Name / Description Column *
                </label>
                <select
                  value={mapping.name}
                  onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select Sheet Column --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Asset Code (According to SAP) Column
                </label>
                <select
                  value={mapping.sap_asset_code}
                  onChange={(e) => setMapping({ ...mapping, sap_asset_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Ignore / Not in Sheet --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Serial Number Column
                </label>
                <select
                  value={mapping.serial_number}
                  onChange={(e) => setMapping({ ...mapping, serial_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Ignore / Not in Sheet --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Relational Lookup Columns */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Relational Lookup Mappings
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category Column</label>
                <select
                  value={mapping.category}
                  onChange={(e) => setMapping({ ...mapping, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Match Default Category --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Department Column</label>
                <select
                  value={mapping.department}
                  onChange={(e) => setMapping({ ...mapping, department: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Match Default Department --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Purchase Cost Column</label>
                <select
                  value={mapping.purchase_cost}
                  onChange={(e) => setMapping({ ...mapping, purchase_cost: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Ignore / Not in Sheet --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Invoice Number Column</label>
                <select
                  value={mapping.invoice_number}
                  onChange={(e) => setMapping({ ...mapping, invoice_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Ignore / Not in Sheet --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Invoice Date Column</label>
                <select
                  value={mapping.invoice_date}
                  onChange={(e) => setMapping({ ...mapping, invoice_date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Ignore / Not in Sheet --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sample Preview Table */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Preview Mapped Data (First 3 Rows)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2">Asset Tag</th>
                    <th className="px-3 py-2">SAP Asset Code</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {rawRows.slice(0, 3).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono text-white">
                        {String(r[mapping.asset_tag] || '—')}
                      </td>
                      <td className="px-3 py-2 font-mono text-purple-400">
                        {String(r[mapping.sap_asset_code] || '—')}
                      </td>
                      <td className="px-3 py-2">
                        {String(r[mapping.name] || '—')}
                      </td>
                      <td className="px-3 py-2">
                        {String(r[mapping.category] || '—')}
                      </td>
                      <td className="px-3 py-2">
                        {String(r[mapping.department] || '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={importing}
              onClick={executeImport}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs px-6 py-3 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{importing ? 'Processing & Ingesting...' : `Import ${rawRows.length} Assets`}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RESULTS SUMMARY */}
      {step === 3 && importResult && (
        <div className="glass-panel rounded-2xl p-8 border border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white">Batch Import Completed</h2>
          <p className="text-xs text-slate-300">
            Successfully normalized and committed <span className="text-emerald-400 font-bold">{importResult.imported}</span> assets to the Postgres database.
          </p>

          {importResult.errors.length > 0 && (
            <div className="max-w-md mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-left">
              <p className="text-xs font-bold text-rose-400 mb-2">
                Skipped Rows ({importResult.errors.length}):
              </p>
              <ul className="text-[11px] text-rose-300 space-y-1 max-h-36 overflow-y-auto">
                {importResult.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4">
            <a
              href="/assets"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <span>View Ingested Assets in Directory</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
