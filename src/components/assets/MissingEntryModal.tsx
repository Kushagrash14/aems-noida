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
  HelpCircle,
  Phone,
  Mail,
  Building,
} from 'lucide-react';

interface MissingEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assets: Asset[];
}

export default function MissingEntryModal({
  isOpen,
  onClose,
  onSuccess,
  assets,
}: MissingEntryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');

  // Asset Form Fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');

  // Missing Custodian / Employee Fields
  const [missingEmployeeName, setMissingEmployeeName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');

  // Incident Details & Attachments
  const [reason, setReason] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  // Active selected existing asset from DB
  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.id === selectedAssetId) || null;
  }, [assets, selectedAssetId]);

  // Auto-fill all fields when an existing asset is selected
  useEffect(() => {
    if (selectedAsset) {
      setName(selectedAsset.name || '');
      setBrand(selectedAsset.manufacturer || '');
      setModel(selectedAsset.model || '');
      setSerialNumber(selectedAsset.serial_number || '');

      if (selectedAsset.assigned_employee) {
        setMissingEmployeeName(selectedAsset.assigned_employee.full_name || '');
        setEmail(selectedAsset.assigned_employee.email || '');
        setContactNumber(
          (selectedAsset.assigned_employee as any).phone ||
          (selectedAsset.assigned_employee as any).contact_number ||
          ''
        );
      } else {
        setMissingEmployeeName('');
        setEmail('');
        setContactNumber('');
      }
    } else {
      // Direct Entry Mode: reset to blank for manual input
      setName('');
      setBrand('');
      setModel('');
      setSerialNumber('');
      setMissingEmployeeName('');
      setContactNumber('');
      setEmail('');
    }
  }, [selectedAsset]);

  // Filter existing assets by search term
  const filteredAssets = useMemo(() => {
    const available = assets.filter((a) => a.status !== 'scrapped');
    if (!searchTerm.trim()) return available;
    const q = searchTerm.toLowerCase();
    return available.filter(
      (a) =>
        a.asset_tag.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(q)) ||
        (a.assigned_employee?.full_name && a.assigned_employee.full_name.toLowerCase().includes(q))
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

  // Handle Document Upload (e.g. Police FIR / Complaint copy)
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

    const assetTitle = name.trim().toUpperCase() || (selectedAsset ? selectedAsset.name : '');
    if (!assetTitle) {
      setFormError('Asset Name is required. Please select an existing asset or type the asset name.');
      return;
    }

    if (!reason.trim()) {
      setFormError('Please enter the missing incident details / FIR remarks.');
      return;
    }

    setSubmitting(true);
    try {
      let targetAssetId = selectedAssetId;

      // Direct Unregistered Entry: Step 1 create asset
      if (!targetAssetId) {
        const locId = locations[0]?.id || '11111111-1111-1111-1111-111111111101';
        const pltId = plants[0]?.id || '22222222-2222-2222-2222-222222222201';
        const deptId = departments[0]?.id || '33333333-3333-3333-3333-333333333301';
        const catId = categories[0]?.id || '44444444-4444-4444-4444-444444444401';

        const createRes = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: {
              asset_tag: '',
              name: assetTitle,
              model: model.trim().toUpperCase() || null,
              manufacturer: brand.trim().toUpperCase() || null,
              serial_number: serialNumber.trim().toUpperCase() || null,
              category_id: catId,
              current_location_id: locId,
              current_plant_id: pltId,
              current_department_id: deptId,
              status: 'damaged', // Normalizes to 'missing' once missing report is created
            },
          }),
        });

        const createdData = await createRes.json();
        if (!createRes.ok) throw new Error(createdData.error || 'Failed to create asset for missing entry');
        targetAssetId = createdData.asset.id;
      }

      // Step 2: Log Missing Incident Report with Custodian Details
      const combinedPhotos = [...photoPaths];
      if (contactNumber.trim()) {
        combinedPhotos.push(`CONTACT:${contactNumber.trim()}`);
      }

      const reportRes = await fetch('/api/damaged-scrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: targetAssetId,
          reportType: 'missing',
          reason: reason.trim(),
          severity: 'minor',
          photoPaths: combinedPhotos,
          documentUrl: documentUrl || null,
          employeeId: selectedAsset?.assigned_employee?.emp_code || null,
          employeeName: missingEmployeeName.trim() || null,
          employeeEmail: email.trim() || null,
        }),
      });

      if (!reportRes.ok) {
        const reportErr = await reportRes.json();
        throw new Error(reportErr.error || 'Failed to submit missing incident report');
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aems:asset-updated'));
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error submitting missing entry');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3 sm:p-5 overflow-hidden">
      <div className="max-w-2xl w-full max-h-[92vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-200 text-slate-900 overflow-hidden">
        {/* Sticky Fixed Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-slate-900">
                Report Missing / Lost Asset
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {selectedAsset ? 'Existing registered asset selected (auto-filled below)' : 'Enter asset & missing custodian details'}
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
              <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* Section 1: Choose Existing Asset or Direct Entry */}
            <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  Select Existing System Asset (Optional)
                </label>
                {selectedAsset && (
                  <button
                    type="button"
                    onClick={() => setSelectedAssetId('')}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Clear (Switch to Direct Manual Entry)
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Asset Tag, Name, Serial or Custodian..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-all font-medium shadow-2xs"
                />
              </div>

              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium cursor-pointer shadow-2xs"
              >
                <option value="">-- Direct Entry (Item not registered in database) --</option>
                {filteredAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_tag} — {a.name} ({a.manufacturer || ''} {a.model || ''} {a.serial_number ? `SN: ${a.serial_number}` : ''})
                    {a.assigned_employee ? ` | Custodian: ${a.assigned_employee.full_name}` : ''}
                  </option>
                ))}
              </select>

              {selectedAsset && (
                <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-700 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Auto-filled from {selectedAsset.asset_tag} ({selectedAsset.name})</span>
                </div>
              )}
            </div>

            {/* Section 2: Asset Hardware Specifications */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-600" /> Asset Hardware Information
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
                    placeholder="e.g. DELL LATITUDE LAPTOP, APPLE MACBOOK AIR"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white uppercase font-medium transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value.toUpperCase())}
                    placeholder="e.g. DELL, HP, APPLE, LENOVO"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white uppercase font-medium transition-all"
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
                    placeholder="e.g. LATITUDE 3420, T14"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white uppercase font-medium transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. 5CD234891, SN-99824"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white uppercase font-mono transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Missing Employee / Custodian Details */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" /> Custodian Details (Employee from whom asset went missing)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Missing Employee Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={missingEmployeeName}
                      onChange={(e) => setMissingEmployeeName(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Contact Number
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="e.g. +91 9876543210"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-mono transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Employee Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. rajesh@pgel.in"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Incident Details / Remarks / FIR */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Missing Incident Reason / Remarks *
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Laptop bag lost during commute near factory gate. Police complaint/FIR lodged at local PS..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all resize-none font-medium"
              />
            </div>

            {/* Section 5: Photo Proof & Document Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50 text-center hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer group">
                <label className="cursor-pointer block">
                  <ImageIcon className="w-5 h-5 mx-auto text-slate-400 group-hover:text-amber-600 mb-1 transition-colors" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-amber-600 block transition-colors">Attach Photo Proof</span>
                  <span className="text-[10px] text-slate-500 block">Asset photo or last known evidence</span>
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

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50/50 text-center hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer group">
                <label className="cursor-pointer block">
                  <FileText className="w-5 h-5 mx-auto text-slate-400 group-hover:text-amber-600 mb-1 transition-colors" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-amber-600 block transition-colors">Attach Police FIR / PDF</span>
                  <span className="text-[10px] text-slate-500 block">FIR Copy, Police Acknowledgment (PDF)</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={handleDocumentUpload}
                    className="hidden"
                  />
                </label>
                {documentUrl && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-emerald-600 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> FIR Document Attached
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
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <HelpCircle className="w-4 h-4" />
              <span>{submitting ? 'Reporting Missing Asset...' : 'Save Missing Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
