'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { uploadAttachment } from '@/lib/uploadClient';
import { Asset, DamageScrapReport } from '@/types/database';
import {
  X,
  Search,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  User,
  Tag,
  CheckCircle2,
} from 'lucide-react';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assets: Asset[];
  initialAssetId?: string;
  initialReportType?: 'damaged' | 'missing' | 'scrap';
  editingReport?: DamageScrapReport | null;
}

export default function IncidentReportModal({
  isOpen,
  onClose,
  onSuccess,
  assets,
  initialAssetId = '',
  initialReportType = 'damaged',
  editingReport = null,
}: IncidentReportModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssetId || (assets[0]?.id ?? ''));
  const [reportType, setReportType] = useState<'damaged' | 'missing' | 'scrap'>(initialReportType);
  const [reason, setReason] = useState('');
  const [mounted, setMounted] = useState(false);

  const isMissingMode = reportType === 'missing';
  const isDamagedMode = reportType === 'damaged';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-fetched fields
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');

  // Attachment states
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync when initial props or editing report changes
  useEffect(() => {
    if (editingReport) {
      setSelectedAssetId(editingReport.asset_id);
      setReportType(editingReport.report_type);
      setReason(editingReport.reason);
      setPhotoPaths(editingReport.photo_paths || []);
      setDocumentUrl(editingReport.document_url || '');
      setEmployeeId(editingReport.employee_id || '');
      setEmployeeName(editingReport.employee_name || '');
      setEmployeeEmail(editingReport.employee_email || '');
    } else {
      if (initialAssetId) setSelectedAssetId(initialAssetId);
      if (initialReportType) setReportType(initialReportType);
    }
  }, [editingReport, initialAssetId, initialReportType]);

  // Active selected asset
  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId) || null;
  }, [assets, selectedAssetId]);

  // Auto-fill custodian employee details when asset changes
  useEffect(() => {
    if (editingReport) return;
    if (selectedAsset?.assigned_employee) {
      setEmployeeId(selectedAsset.assigned_employee.emp_code || selectedAsset.assigned_employee.id);
      setEmployeeName(selectedAsset.assigned_employee.full_name || '');
      setEmployeeEmail(selectedAsset.assigned_employee.email || '');
    } else {
      setEmployeeId('UNASSIGNED');
      setEmployeeName('N/A (In Available Stock)');
      setEmployeeEmail('N/A');
    }
  }, [selectedAsset, editingReport]);

  // Handle Tag / Serial Search with status restrictions
  const filteredAssets = useMemo(() => {
    // If reporting missing: exclude already missing, damaged, scrapped
    // If reporting damaged: exclude already damaged, missing, scrapped
    const available = assets.filter((a) => {
      if (editingReport && a.id === editingReport.asset_id) return true;
      if (isMissingMode) {
        return a.status !== 'missing' && a.status !== 'damaged' && a.status !== 'scrapped';
      }
      if (isDamagedMode) {
        return a.status !== 'damaged' && a.status !== 'missing' && a.status !== 'scrapped';
      }
      return a.status !== 'scrapped' && a.status !== 'missing';
    });

    if (!searchTerm.trim()) return available;
    const q = searchTerm.toLowerCase();
    return available.filter(
      (a) =>
        a.asset_tag.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(q))
    );
  }, [assets, searchTerm, isMissingMode, isDamagedMode, editingReport]);

  // Handle photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    e.target.value = '';
    uploadAttachment(file, file.name)
      .then((url) => setPhotoPaths((prev) => [...prev, url]))
      .catch((err: unknown) => setFormError(err instanceof Error ? err.message : 'Photo upload failed'));
  };

  // Handle document upload
  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    e.target.value = '';
    uploadAttachment(file, file.name)
      .then((url) => setDocumentUrl(url))
      .catch((err: unknown) => setFormError(err instanceof Error ? err.message : 'Document upload failed'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedAssetId || !reason.trim()) {
      setFormError('Please select an asset and enter reason/description.');
      return;
    }
    setSubmitting(true);

    try {
      if (editingReport) {
        const res = await fetch('/api/damaged-scrap', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportId: editingReport.id,
            reason,
            photoPaths,
            documentUrl,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update entry');
        }
      } else {
        const res = await fetch('/api/damaged-scrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: selectedAssetId,
            reportType,
            reason,
            photoPaths,
            documentUrl,
            employeeId,
            employeeName,
            employeeEmail,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to save entry');
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving entry');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-5 overflow-hidden">
      <div className="max-w-3xl w-full max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-200 text-slate-900 overflow-hidden">
        {/* Sticky Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border shrink-0 ${
                isMissingMode
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-orange-50 text-orange-600 border-orange-200'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-900">
                {editingReport
                  ? `Edit ${isMissingMode ? 'Missing' : 'Damaged'} Entry — ${editingReport.asset?.asset_tag || ''}`
                  : `New ${isMissingMode ? 'Missing Asset' : 'Damaged Asset'} Entry`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select an Asset Code / Serial Number to auto-fill the Employee ID, Name, Email and Asset Details.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}
            {/* 1. Asset Code / Serial Number Input & Search */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Asset Code (AST Tag) or Serial Number *
              </label>
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Type Asset Code or Serial Number to search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all font-medium"
                />
              </div>

              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                disabled={Boolean(editingReport)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all disabled:opacity-60 cursor-pointer font-medium"
              >
                <option value="">-- Select Asset Code / Serial Number --</option>
                {filteredAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_tag} — {a.name} ({a.serial_number ? `SN: ${a.serial_number}` : 'No Serial'})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Automatic Fetched Employee & Asset Details Card */}
            {selectedAsset && (
              <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-orange-600" /> Auto-Fetched Asset Details
                  </span>
                  <span className="text-[10px] font-mono text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 font-bold shadow-2xs">
                    {selectedAsset.asset_tag}
                  </span>
                </div>

                {/* Asset Specs Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Asset Name / Title</span>
                    <span className="font-bold text-slate-900">{selectedAsset.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Category &amp; Model</span>
                    <span className="font-semibold text-slate-800">
                      {selectedAsset.category?.name || 'General'} / {selectedAsset.model || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Serial Number</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedAsset.serial_number || 'N/A'}</span>
                  </div>
                </div>

                {/* Auto-Fetched Employee Details */}
                <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center gap-2 md:col-span-1">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Employee ID</span>
                      <span className="font-mono font-bold text-slate-900">{employeeId || 'N/A'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Employee Name</span>
                    <span className="font-bold text-slate-900">{employeeName || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Employee Email</span>
                    <span className="font-mono text-slate-700 text-[11px] truncate block">{employeeEmail || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Reason / Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Incident Reason / Description *
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter details of damage or missing incident..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all resize-none font-medium"
              />
            </div>

            {/* 4. Image Upload & Document Attach Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50 text-center hover:border-orange-400 hover:bg-orange-50/30 transition-all cursor-pointer group">
                <label className="cursor-pointer block">
                  <ImageIcon className="w-5 h-5 mx-auto text-slate-400 group-hover:text-orange-600 mb-1 transition-colors" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-orange-600 block transition-colors">Image Upload</span>
                  <span className="text-[10px] text-slate-500 block">Attach photo proof</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                {photoPaths.length > 0 && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-emerald-600 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Photo Attached ({photoPaths.length})
                  </div>
                )}
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50 text-center hover:border-orange-400 hover:bg-orange-50/30 transition-all cursor-pointer group">
                <label className="cursor-pointer block">
                  <FileText className="w-5 h-5 mx-auto text-slate-400 group-hover:text-orange-600 mb-1 transition-colors" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-orange-600 block transition-colors">Document Attach</span>
                  <span className="text-[10px] text-slate-500 block">Attach PDF / FIR document</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleDocumentUpload}
                    className="hidden"
                  />
                </label>
                {documentUrl && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-emerald-600 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Document Attached
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Fixed Footer */}
          <div className="flex items-center justify-end gap-2.5 p-4 sm:px-6 border-t border-slate-100 bg-slate-50/80 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-6 py-2.5 rounded-xl text-white text-xs font-black transition-all shadow-sm cursor-pointer disabled:opacity-50 ${
                isMissingMode
                  ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                  : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
              }`}
            >
              {submitting ? 'Saving Entry...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
