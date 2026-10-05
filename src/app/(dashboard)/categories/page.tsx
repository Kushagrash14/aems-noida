'use client';

import { useState, useEffect } from 'react';
import { Category, CategoryFormField, FieldType } from '@/types/database';
import {
  Sliders,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Folder,
  Layers,
  X,
  Building,
  AlertTriangle,
} from 'lucide-react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [fields, setFields] = useState<CategoryFormField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // New Category Modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catLoading, setCatLoading] = useState(false);

  // New Field Form
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [fieldLoading, setFieldLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Delete Confirm Modals (Replaces native browser window.confirm popup)
  const [deletingCatTarget, setDeletingCatTarget] = useState<Category | null>(null);
  const [deletingFieldTarget, setDeletingFieldTarget] = useState<CategoryFormField | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data?.categories) {
        setCategories(data.categories);
        if (!selectedCategory && data.categories.length > 0) {
          setSelectedCategory(data.categories[0]);
        }
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  };

  const fetchFields = async (categoryId: string) => {
    setLoadingFields(true);
    try {
      const res = await fetch(`/api/categories/${categoryId}/fields`);
      const data = await res.json();
      if (data?.fields) {
        setFields(data.fields);
      }
    } catch (err) {
      console.error('Fetch fields error:', err);
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchFields(selectedCategory.id);
    }
  }, [selectedCategory]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName.trim(),
          code: newCatCode.trim().toUpperCase(),
          description: newCatDesc.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category');

      setShowCatModal(false);
      setNewCatName('');
      setNewCatCode('');
      setNewCatDesc('');
      fetchCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Category creation failed');
    } finally {
      setCatLoading(false);
    }
  };

  // Open custom modal for category deletion
  const triggerDeleteCategory = (cat: Category, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingCatTarget(cat);
  };

  // Execute category deletion after user confirms in custom React modal
  const confirmDeleteCategory = async () => {
    if (!deletingCatTarget) return;
    setDeletingInProgress(true);

    try {
      const res = await fetch(`/api/categories?id=${deletingCatTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete category');

      setCategories((prev) => {
        const updated = prev.filter((c) => c.id !== deletingCatTarget.id);
        if (selectedCategory?.id === deletingCatTarget.id) {
          setSelectedCategory(updated.length > 0 ? updated[0] : null);
        }
        return updated;
      });
      setDeletingCatTarget(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeletingInProgress(false);
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;
    setFieldLoading(true);
    setError(null);

    try {
      const optionsArray =
        newFieldType === 'select'
          ? newFieldOptions
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : null;

      const res = await fetch(`/api/categories/${selectedCategory.id}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: newFieldName.trim(),
          field_label: newFieldLabel.trim(),
          field_type: newFieldType,
          options: optionsArray,
          is_required: newFieldRequired,
          placeholder: newFieldPlaceholder.trim() || null,
          display_order: fields.length + 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add custom field');

      setShowFieldModal(false);
      setNewFieldName('');
      setNewFieldLabel('');
      setNewFieldType('text');
      setNewFieldOptions('');
      setNewFieldRequired(false);
      setNewFieldPlaceholder('');
      fetchFields(selectedCategory.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Field addition failed');
    } finally {
      setFieldLoading(false);
    }
  };

  // Open custom modal for field deletion
  const triggerDeleteField = (field: CategoryFormField) => {
    setDeletingFieldTarget(field);
  };

  // Execute field deletion after user confirms in custom React modal
  const confirmDeleteField = async () => {
    if (!selectedCategory || !deletingFieldTarget) return;
    setDeletingInProgress(true);

    try {
      const res = await fetch(
        `/api/categories/${selectedCategory.id}/fields?fieldId=${deletingFieldTarget.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setFields((prev) => prev.filter((f) => f.id !== deletingFieldTarget.id));
        setDeletingFieldTarget(null);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete field');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete field');
    } finally {
      setDeletingInProgress(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Departments &amp; Dynamic Entry Form Engine
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Define custom field schemas per department equipment classification without changing database code
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCatModal(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories List (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 px-1">
            Departments Directory ({categories.length})
          </h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {categories.map((c) => {
              const isSelected = selectedCategory?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCategory(c)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? 'border-2 border-blue-600 bg-blue-50/70 text-slate-900 shadow-2xs'
                      : 'border border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-black text-xs text-slate-900">{c.name}</div>
                    <div className="inline-block font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      {c.code}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    <button
                      type="button"
                      onClick={(e) => triggerDeleteCategory(c, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title={`Delete ${c.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Fields Inspector (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
          {selectedCategory ? (
            <>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900">{selectedCategory.name}</h2>
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      {selectedCategory.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {selectedCategory.description || 'No description provided'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerDeleteCategory(selectedCategory)}
                    className="flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3.5 py-2 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete Department</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFieldModal(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Field</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Fields Table */}
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                  Configured Dynamic Fields ({fields.length})
                </h3>

                {loadingFields ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-2">
                    <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                    <span className="text-xs text-slate-400 font-semibold">Loading fields...</span>
                  </div>
                ) : fields.length === 0 ? (
                  <div className="p-8 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-slate-500 text-xs font-semibold">
                    No custom fields defined yet for {selectedCategory.name}. Click &ldquo;Add Custom Field&rdquo; to inject dynamic attributes into the registration wizard.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {fields.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900">{f.field_label}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded border border-slate-300">
                              {f.field_name}
                            </span>
                            <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                              {f.field_type}
                            </span>
                            {f.is_required && (
                              <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                Mandatory
                              </span>
                            )}
                          </div>
                          {f.options && f.options.length > 0 && (
                            <p className="text-[11px] text-slate-500 font-medium">
                              Choices: {f.options.join(', ')}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => triggerDeleteField(f)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove Field"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs font-semibold">
              Select a department on the left to inspect and configure its custom form fields.
            </div>
          )}
        </div>
      </div>

      {/* CREATE CATEGORY MODAL */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <Building className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Register New Department
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCatModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Solar Inverters, Tooling & Die"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Unique Code *
                </label>
                <input
                  type="text"
                  required
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value)}
                  placeholder="e.g. DEPT-SOLAR"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-800 uppercase focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Description of assets under this department..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={catLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <span>{catLoading ? 'Creating...' : 'Create Department'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CUSTOM FIELD MODAL */}
      {showFieldModal && selectedCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <Sliders className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Add Field to {selectedCategory.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFieldModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddField} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Field Display Label *
                </label>
                <input
                  type="text"
                  required
                  value={newFieldLabel}
                  onChange={(e) => {
                    setNewFieldLabel(e.target.value);
                    if (!newFieldName) {
                      setNewFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    }
                  }}
                  placeholder="e.g. Tank Capacity (Liters)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Internal Database Key *
                </label>
                <input
                  type="text"
                  required
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="e.g. tank_capacity_liters"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Field Type *
                  </label>
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="text">Text Input</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Dropdown Select</option>
                    <option value="boolean">Boolean (Yes/No)</option>
                    <option value="textarea">Multi-line Text</option>
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFieldRequired}
                      onChange={(e) => setNewFieldRequired(e.target.checked)}
                      className="h-4 w-4 rounded bg-slate-50 border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Mandatory Field</span>
                  </label>
                </div>
              </div>

              {newFieldType === 'select' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select Options (Comma-separated) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                    placeholder="Option 1, Option 2, Option 3"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Placeholder Text
                </label>
                <input
                  type="text"
                  value={newFieldPlaceholder}
                  onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                  placeholder="e.g. Enter numerical value"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFieldModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fieldLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <span>{fieldLoading ? 'Adding...' : 'Save Field'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CATEGORY CONFIRMATION MODAL */}
      {deletingCatTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Delete Department
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingCatTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <p className="font-bold text-slate-900">
                Are you sure you want to delete department &ldquo;{deletingCatTarget.name}&rdquo; ({deletingCatTarget.code})?
              </p>
              <p className="text-[11px] text-rose-700 font-medium">
                All configured dynamic fields and schemas for this department will also be permanently removed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingCatTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                disabled={deletingInProgress}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingInProgress ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE FIELD CONFIRMATION MODAL */}
      {deletingFieldTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Remove Custom Field
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingFieldTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <p className="font-bold text-slate-900">
                Remove custom field &ldquo;{deletingFieldTarget.field_label}&rdquo;?
              </p>
              <p className="text-[11px] text-rose-700 font-medium">
                Existing stored values for this field will remain archived in the normalized table.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingFieldTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteField}
                disabled={deletingInProgress}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingInProgress ? 'Removing...' : 'Confirm Remove'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
