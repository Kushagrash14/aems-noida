'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { uploadAttachment } from '@/lib/uploadClient';
import { Asset } from '@/types/database';
import {
  X,
  Search,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  User,
  Tag,
  CheckCircle2,
  Wrench,
  DollarSign,
} from 'lucide-react';

interface DamagedEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assets: Asset[];
}

export default function DamagedEntryModal({
  isOpen,
  onClose,
  onSuccess,
  assets,
}: DamagedEntryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  
  // Direct Un-registered Fields (used when selectedAssetId is empty)
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [reason, setReason] = useState('');

  // Lookups for direct onboarding
  const [locations, setLocations] = useState<any[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    Promise.all([
      fetch('/api/locations').then((r) => r.json()).catch(() => ({})),
      fetch('/api/plants').then((r) => r.json()).catch(() => ({})),
      fetch('/api/settings/departments').then((r) => r.json()).catch(() => ({})),
      fetch('/api/categories').then((r) => r.json()).catch(() => ({})),
    ]).then(([lRes, pRes, dRes, cRes]) => {
      if (lRes?.locations) setLocations(lRes.locations);
      if (pRes?.plants) setPlants(pRes.plants);
      if (dRes?.departments) setDepartments(dRes.departments);
      if (cRes?.categories) setCategories(cRes.categories);
    });
  }, []);

  // Auto-fetched custodian fields
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');

  // Attachments
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Active selected existing asset from DB
  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId) || null;
  }, [assets, selectedAssetId]);

  // Auto-fill custodian employee details when selectedAsset changes
  useEffect(() => {
    if (selectedAsset) {
      if (selectedAsset.assigned_employee) {
        setEmployeeId(selectedAsset.assigned_employee.emp_code || selectedAsset.assigned_employee.id);
        setEmployeeName(selectedAsset.assigned_employee.full_name || '');
        setEmployeeEmail(selectedAsset.assigned_employee.email || '');
      } else {
        setEmployeeId('UNASSIGNED');
        setEmployeeName('N/A (In Available Stock)');
        setEmployeeEmail('N/A');
      }
    } else {
      setEmployeeId('');
      setEmployeeName('');
      setEmployeeEmail('');
    }
  }, [selectedAsset]);

  // Filter existing assets by search term
  const filteredAssets = useMemo(() => {
    if (!searchTerm.trim()) return assets;
    const q = searchTerm.toLowerCase();
    return assets.filter(
      (a) =>
        a.asset_tag.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(q))
    );
  }, [assets, searchTerm]);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    e.target.value = '';
    uploadAttachment(file, file.name)
      .then((url) => setPhotoPaths((prev) => [...prev, url]))
      .catch((err: unknown) => setFormError(err instanceof Error ? err.message : 'Photo upload failed'));
  };

  // Handle Document Upload
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

    // If existing asset selected
    if (selectedAssetId) {
      if (!reason.trim()) {
        setFormError('Please describe the damage incident reason.');
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch('/api/damaged-scrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: selectedAssetId,
            reportType: 'damaged',
            reason: reason.trim(),
            severity: 'minor',
            photoPaths,
            documentUrl,
            employeeId,
            employeeName,
            employeeEmail,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to submit damaged entry');
        }

        onSuccess();
        onClose();
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'Error submitting damaged entry');
      } finally {
        setSubmitting(false);
      }
    } else {
      // Direct Un-registered Damaged Asset Onboarding
      const assetTitle = name.trim().toUpperCase() || `${manufacturer} ${model}`.trim().toUpperCase();
      if (!assetTitle) {
        setFormError('Please enter the Asset Name / Equipment Title.');
        return;
      }

      setSubmitting(true);
      try {
        const locId = locations[0]?.id || '11111111-1111-1111-1111-111111111101';
        const pltId = plants[0]?.id || '22222222-2222-2222-2222-222222222201';
        const deptId = departments[0]?.id || '33333333-3333-3333-3333-333333333301';
        const catId = categories[0]?.id || '44444444-4444-4444-4444-444444444401';

        // Step 1: Create Asset directly as damaged
        const assetRes = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: {
              asset_tag: '',
              name: assetTitle,
              model: model.trim().toUpperCase() || null,
              manufacturer: manufacturer.trim().toUpperCase() || null,
              serial_number: serialNumber.trim().toUpperCase() || null,
              category_id: catId,
              current_location_id: locId,
              current_plant_id: pltId,
              current_department_id: deptId,
              purchase_cost: purchaseCost ? parseFloat(purchaseCost) : null,
              status: 'damaged',
            },
          }),
        });

        const assetData = await assetRes.json();
        if (!assetRes.ok) throw new Error(assetData.error || 'Failed to register damaged asset');

        // Step 2: Log Incident Report for Damaged Module
        const reportRes = await fetch('/api/damaged-scrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: assetData.asset.id,
            reportType: 'damaged',
            reason: reason.trim() || 'Damaged Hardware Issue',
            severity: 'minor',
            photoPaths,
            documentUrl,
            employeeId: null,
            employeeName: null,
            employeeEmail: null,
          }),
        });

        if (!reportRes.ok) {
          const reportErr = await reportRes.json();
          throw new Error(reportErr.error || 'Failed to log damaged incident report');
        }

        onSuccess();
        onClose();
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'Error registering damaged asset');
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-5 overflow-hidden">
      <div className="max-w-3xl w-full max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-200 text-slate-900 overflow-hidden">
        {/* Sticky Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
                New Damaged Asset Entry
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register a damaged asset into the Damaged Module. Select an existing asset or fill details for direct onboarding.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* Section 1: Existing Asset Code Search */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Existing Registered Asset (Optional)
              </label>
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Type Asset Code (AST Tag) or Serial Number to auto-fetch..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all font-medium"
                />
              </div>

              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-all cursor-pointer font-medium"
              >
                <option value="">-- Direct Entry (Not Registered in Database) --</option>
                {filteredAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_tag} — {a.name} ({a.serial_number ? `SN: ${a.serial_number}` : 'No Serial'})
                  </option>
                ))}
              </select>
            </div>

            {/* Section 2: Auto-Fetched Card (If existing asset selected) */}
            {selectedAsset ? (
              <div className="bg-orange-50/60 rounded-2xl p-4 border border-orange-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-orange-200/60 pb-2">
                  <span className="text-[11px] font-black text-orange-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-orange-600" /> Auto-Fetched Registered Asset Details
                  </span>
                  <span className="text-[10px] font-mono text-orange-700 bg-white px-2.5 py-0.5 rounded-lg border border-orange-200 font-bold shadow-2xs">
                    {selectedAsset.asset_tag}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Asset Name</span>
                    <span className="font-bold text-slate-900">{selectedAsset.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Brand &amp; Model</span>
                    <span className="font-semibold text-slate-800">
                      {selectedAsset.manufacturer || 'N/A'} / {selectedAsset.model || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Serial Number</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedAsset.serial_number || 'N/A'}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-orange-200/60 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center gap-2 md:col-span-1">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 border border-orange-200 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Emp ID</span>
                      <span className="font-mono font-bold text-orange-800">{employeeId || 'N/A'}</span>
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
            ) : (
              /* Section 3: Direct Un-Registered Fields (If NO existing asset selected) */
              <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 space-y-3">
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block border-b border-slate-200/80 pb-2">
                  Direct Damaged Asset Registration (Unregistered Item)
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Asset Name / Equipment Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value.toUpperCase())}
                      placeholder="e.g. DELL LATITUDE LAPTOP (DAMAGED SCREEN)"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 uppercase font-medium shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Brand / Manufacturer
                    </label>
                    <input
                      type="text"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value.toUpperCase())}
                      placeholder="e.g. DELL, HP, LENOVO"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 uppercase font-medium shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Model Number
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value.toUpperCase())}
                      placeholder="e.g. LATITUDE 3420"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 uppercase font-medium shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Serial Number
                    </label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. SN-8894123"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 uppercase font-mono shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Purchase Cost (₹)
                    </label>
                    <div className="relative">
                      <DollarSign className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="number"
                        value={purchaseCost}
                        onChange={(e) => setPurchaseCost(e.target.value)}
                        placeholder="e.g. 45000"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 font-mono shadow-2xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Incident Description / Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Damage Description / Remarks
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Display glass cracked due to accidental drop, motherboard faulty..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white transition-all resize-none font-medium"
              />
            </div>

            {/* Photo Proof & Document Upload Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50 text-center hover:border-orange-400 hover:bg-orange-50/30 transition-all cursor-pointer group">
                <label className="cursor-pointer block">
                  <ImageIcon className="w-5 h-5 mx-auto text-slate-400 group-hover:text-orange-600 mb-1 transition-colors" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-orange-600 block transition-colors">Attach Image Proof</span>
                  <span className="text-[10px] text-slate-500 block">Photo of damaged item</span>
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
                  <span className="text-xs font-bold text-slate-800 group-hover:text-orange-600 block transition-colors">Attach Document</span>
                  <span className="text-[10px] text-slate-500 block">Inspection report / Bill (PDF)</span>
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
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Wrench className="w-4 h-4" />
              <span>{submitting ? 'Registering Damaged Asset...' : 'Save Damaged Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
