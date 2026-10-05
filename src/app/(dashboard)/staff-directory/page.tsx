'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Employee, Department, Asset, Location, Plant, User, UserScope } from '@/types/database';
import {
  Users,
  Search,
  Building,
  Building2,
  MapPin,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  UserMinus,
  RefreshCw,
  Plus,
  Mail,
  Phone,
  Briefcase,
  Layers,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  X,
  ExternalLink,
  Trash2,
  Edit3,
} from 'lucide-react';

function StaffDirectoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userScope, setUserScope] = useState<UserScope | null>(null);
  const [loading, setLoading] = useState(true);

  // Entities
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);

  // Navigation & Search State
  const [scopedSearch, setScopedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // IT Admin Hierarchical Filter State (Location -> Plant -> Department)
  const [filterLocationId, setFilterLocationId] = useState<string>('');
  const [filterPlantId, setFilterPlantId] = useState<string>('');
  const [filterDeptId, setFilterDeptId] = useState<string>('');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const [selectedProfileModal, setSelectedProfileModal] = useState<Employee | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delete & Inactive States
  const [deletingEmp, setDeletingEmp] = useState<Employee | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add / Edit Employee Modal State (Matching HR module)
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empCode, setEmpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [modalDeptId, setModalDeptId] = useState('');
  const [modalPlantId, setModalPlantId] = useState('');
  const [modalLocationId, setModalLocationId] = useState('');
  const [empStatus, setEmpStatus] = useState<'active' | 'inactive'>('active');
  const [submittingEmp, setSubmittingEmp] = useState(false);
  const [empModalError, setEmpModalError] = useState<string | null>(null);

  // Inline Quick Department Creator State & Handler
  const [showAddDeptInput, setShowAddDeptInput] = useState(false);
  const [inlineNewDeptName, setInlineNewDeptName] = useState('');
  const [savingInlineDept, setSavingInlineDept] = useState(false);

  // Auto-cascade Plant selection when Location changes in modal
  useEffect(() => {
    if (modalLocationId && plants.length > 0) {
      const valid = plants.filter((p) => p.location_id === modalLocationId);
      if (valid.length > 0 && !valid.some((p) => p.id === modalPlantId)) {
        setModalPlantId(valid[0].id);
      } else if (valid.length === 0) {
        setModalPlantId('');
      }
    }
  }, [modalLocationId, plants, modalPlantId]);

  // Open Add Modal
  const openAddModal = () => {
    setEditingEmployee(null);
    setEmpCode('');
    setFullName('');
    setEmail('');
    setPhone('');
    setDesignation('');
    const defaultLoc = filterLocationId || (locations[0]?.id || '');
    setModalLocationId(defaultLoc);
    const validPlants = defaultLoc ? plants.filter((p) => p.location_id === defaultLoc) : plants;
    setModalPlantId(filterPlantId || (validPlants[0]?.id || ''));
    setModalDeptId(filterDeptId || (departments[0]?.id || ''));
    setEmpStatus('active');
    setEmpModalError(null);
    setShowEmployeeModal(true);
  };

  // Open Edit Modal
  const openEditModal = (emp: Employee, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingEmployee(emp);
    setEmpCode(emp.emp_code || '');
    setFullName(emp.full_name || '');
    setEmail(emp.email || '');
    setPhone(emp.phone || '');
    setDesignation(emp.designation || '');
    setModalDeptId(emp.department_id || '');
    setModalPlantId(emp.plant_id || '');
    setModalLocationId(emp.location_id || '');
    setEmpStatus(emp.status === 'inactive' || (emp.status as string) === 'resigned' ? 'inactive' : 'active');
    setEmpModalError(null);
    setShowEmployeeModal(true);
  };

  // Listen for "+ Add Employee" button event dispatched from top Navbar
  useEffect(() => {
    const handleOpenAdd = () => {
      openAddModal();
    };
    window.addEventListener('aems:open-add-employee', handleOpenAdd);
    return () => window.removeEventListener('aems:open-add-employee', handleOpenAdd);
  }, [locations, plants, departments]);

  const handleSaveInlineDept = async () => {
    const name = inlineNewDeptName.trim().toUpperCase();
    if (!name) return;
    setSavingInlineDept(true);
    try {
      const res = await fetch('/api/settings/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code: `DEPT-${name.slice(0, 3).replace(/[^A-Z]/g, '') || 'GEN'}`,
          plant_id: modalPlantId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create department');
      const created: Department = data.department;
      setDepartments((prev) => [...prev, created]);
      setModalDeptId(created.id);
      setInlineNewDeptName('');
      setShowAddDeptInput(false);
      setNotification({
        type: 'success',
        message: `Department "${created.name}" created successfully!`,
      });
      setTimeout(() => setNotification(null), 3500);
    } catch (err: unknown) {
      setEmpModalError(err instanceof Error ? err.message : 'Error creating department');
    } finally {
      setSavingInlineDept(false);
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEmp(true);
    setEmpModalError(null);

    if (!modalLocationId || !modalPlantId || !modalDeptId) {
      setEmpModalError('Please select Location, Plant Unit, and Department.');
      setSubmittingEmp(false);
      return;
    }

    if (phone.trim() && phone.trim().length !== 10) {
      setEmpModalError('Mobile phone number must be exactly 10 digits');
      setSubmittingEmp(false);
      return;
    }

    try {
      const payload = {
        emp_code: empCode.trim().toUpperCase(),
        full_name: fullName.trim().toUpperCase(),
        email: email.trim().toLowerCase() || null,
        phone: phone.trim() || null,
        designation: designation.trim() || null,
        department_id: modalDeptId,
        plant_id: modalPlantId,
        location_id: modalLocationId,
        status: empStatus,
      };

      const url = '/api/employees';
      const method = editingEmployee ? 'PUT' : 'POST';
      const bodyPayload = editingEmployee ? { ...payload, id: editingEmployee.id } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save employee record');

      setNotification({
        type: 'success',
        message: editingEmployee
          ? `Employee profile "${fullName}" updated successfully!`
          : `Employee "${fullName}" added to directory successfully!`,
      });
      setShowEmployeeModal(false);
      if (selectedProfileModal && editingEmployee && selectedProfileModal.id === editingEmployee.id) {
        setSelectedProfileModal((prev) => (prev ? { ...prev, ...payload } : null));
      }
      fetchData();
      setTimeout(() => setNotification(null), 4000);
    } catch (err: unknown) {
      setEmpModalError(err instanceof Error ? err.message : 'Error saving employee');
    } finally {
      setSubmittingEmp(false);
    }
  };

  const handleToggleStatus = async (emp: Employee, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = emp.status === 'inactive' ? 'active' : 'inactive';
    try {
      const res = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: emp.id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      setNotification({
        type: 'success',
        message: `Employee "${emp.full_name}" is now marked as ${newStatus.toUpperCase()}`,
      });
      if (selectedProfileModal && selectedProfileModal.id === emp.id) {
        setSelectedProfileModal((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      fetchData();
      setTimeout(() => setNotification(null), 4000);
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error updating status',
      });
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deletingEmp) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/employees?id=${deletingEmp.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete employee');

      setNotification({
        type: 'success',
        message: `Employee "${deletingEmp.full_name}" deleted successfully. Assigned assets safely returned to stock.`,
      });
      const deletedId = deletingEmp.id;
      setDeletingEmp(null);
      if (selectedProfileModal?.id === deletedId) {
        setSelectedProfileModal(null);
      }
      fetchData();
      setTimeout(() => setNotification(null), 4000);
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error deleting employee',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Close filter popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    if (filterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterOpen]);

  // Fetch Session & Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [meRes, empsRes, assetsRes, deptsRes, locsRes, plantsRes] = await Promise.all([
        fetch('/api/auth/me').then((r) => r.json()).catch(() => null),
        fetch('/api/employees').then((r) => r.json()).catch(() => ({ employees: [] })),
        fetch('/api/assets').then((r) => r.json()).catch(() => ({ assets: [] })),
        fetch('/api/settings/departments').then((r) => r.json()).catch(() => ({ departments: [] })),
        fetch('/api/locations').then((r) => r.json()).catch(() => ({ locations: [] })),
        fetch('/api/plants').then((r) => r.json()).catch(() => ({ plants: [] })),
      ]);

      if (meRes?.user) {
        setCurrentUser(meRes.user);
        setUserScope(meRes.scope || null);
      }
      if (empsRes?.employees) setEmployees(empsRes.employees);
      if (assetsRes?.assets) setAssets(assetsRes.assets);
      if (deptsRes?.departments) setDepartments(deptsRes.departments);
      if (locsRes?.locations) setLocations(locsRes.locations);
      if (plantsRes?.plants) setPlants(plantsRes.plants);
    } catch (err) {
      console.error('Staff Directory load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Determine authorized Location, Plant, Department IDs for Admin
  const isGlobalITAdmin = currentUser?.role === 'it_admin';

  const authorizedLocationIds = useMemo(() => {
    if (isGlobalITAdmin) return null;
    const ids = new Set<string>();
    if (currentUser?.location_id) ids.add(currentUser.location_id);
    if (userScope?.location_ids) userScope.location_ids.forEach((id) => ids.add(id));
    return ids.size > 0 ? ids : null;
  }, [isGlobalITAdmin, currentUser, userScope]);

  const authorizedPlantIds = useMemo(() => {
    if (isGlobalITAdmin) return null;
    const ids = new Set<string>();
    if (currentUser?.plant_id) ids.add(currentUser.plant_id);
    if (userScope?.plant_ids) userScope.plant_ids.forEach((id) => ids.add(id));
    return ids.size > 0 ? ids : null;
  }, [isGlobalITAdmin, currentUser, userScope]);

  const authorizedDeptIds = useMemo(() => {
    if (isGlobalITAdmin) return null;
    const ids = new Set<string>();
    if (currentUser?.department_id) ids.add(currentUser.department_id);
    if (userScope?.department_ids) userScope.department_ids.forEach((id) => ids.add(id));
    return ids.size > 0 ? ids : null;
  }, [isGlobalITAdmin, currentUser, userScope]);

  // Cascading Plant and Department options for Filter
  const availablePlantsForFilter = useMemo(() => {
    if (!filterLocationId) return plants;
    return plants.filter((p) => p.location_id === filterLocationId);
  }, [plants, filterLocationId]);

  const availableDeptsForFilter = useMemo(() => {
    if (filterPlantId) {
      return departments.filter((d) => !d.plant_id || d.plant_id === filterPlantId);
    }
    if (filterLocationId) {
      const pIds = plants.filter((p) => p.location_id === filterLocationId).map((p) => p.id);
      return departments.filter((d) => !d.plant_id || pIds.includes(d.plant_id));
    }
    return departments;
  }, [departments, plants, filterLocationId, filterPlantId]);

  const handleLocationFilterChange = (locId: string) => {
    setFilterLocationId(locId);
    setFilterPlantId('');
    setFilterDeptId('');
  };

  const handlePlantFilterChange = (pltId: string) => {
    setFilterPlantId(pltId);
    setFilterDeptId('');
  };

  const handleDeptFilterChange = (dId: string) => {
    setFilterDeptId(dId);
  };

  const resetFilters = () => {
    setFilterLocationId('');
    setFilterPlantId('');
    setFilterDeptId('');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterLocationId) count++;
    if (filterPlantId) count++;
    if (filterDeptId) count++;
    return count;
  }, [filterLocationId, filterPlantId, filterDeptId]);

  // Filter Employees strictly into Admin's assigned scope OR IT Admin's selected filter
  const scopedEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (isGlobalITAdmin) {
        if (filterLocationId && emp.location_id !== filterLocationId) return false;
        if (filterPlantId && emp.plant_id !== filterPlantId) return false;
        if (filterDeptId && emp.department_id !== filterDeptId) return false;
        return true;
      }

      if (authorizedLocationIds && emp.location_id && !authorizedLocationIds.has(emp.location_id)) {
        return false;
      }
      if (authorizedPlantIds && emp.plant_id && !authorizedPlantIds.has(emp.plant_id)) {
        return false;
      }
      if (authorizedDeptIds && emp.department_id && !authorizedDeptIds.has(emp.department_id)) {
        return false;
      }
      return true;
    });
  }, [employees, isGlobalITAdmin, filterLocationId, filterPlantId, filterDeptId, authorizedLocationIds, authorizedPlantIds, authorizedDeptIds]);

  // Status Counts for ALL, ACTIVE, INACTIVE tabs
  const statusCounts = useMemo(() => {
    const list = scopedEmployees.filter((emp) => {
      if (!scopedSearch.trim()) return true;
      const q = scopedSearch.toLowerCase();
      const code = (emp.emp_code || '').toLowerCase();
      const name = (emp.full_name || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const desig = (emp.designation || '').toLowerCase();
      const dept = (emp.department?.name || '').toLowerCase();
      return code.includes(q) || name.includes(q) || email.includes(q) || desig.includes(q) || dept.includes(q);
    });

    return {
      all: list.length,
      active: list.filter((e) => e.status !== 'inactive').length,
      inactive: list.filter((e) => e.status === 'inactive').length,
    };
  }, [scopedEmployees, scopedSearch]);

  // Filtered scoped employees by search query & status
  const displayedScopedEmployees = useMemo(() => {
    return scopedEmployees.filter((emp) => {
      if (statusFilter === 'ACTIVE' && emp.status === 'inactive') return false;
      if (statusFilter === 'INACTIVE' && emp.status !== 'inactive') return false;

      if (scopedSearch.trim()) {
        const q = scopedSearch.toLowerCase();
        const code = (emp.emp_code || '').toLowerCase();
        const name = (emp.full_name || '').toLowerCase();
        const email = (emp.email || '').toLowerCase();
        const desig = (emp.designation || '').toLowerCase();
        const dept = (emp.department?.name || '').toLowerCase();
        return code.includes(q) || name.includes(q) || email.includes(q) || desig.includes(q) || dept.includes(q);
      }
      return true;
    });
  }, [scopedEmployees, scopedSearch, statusFilter]);

  // Asset Count Helper
  const getEmployeeAssets = (empId: string) => {
    return assets.filter(
      (a) => a.assigned_employee_id === empId || a.assigned_employee?.id === empId
    );
  };

  return (
    <div className="space-y-3 antialiased font-sans max-w-[1700px] mx-auto pb-16 px-1 sm:px-3 pt-2">
      {/* Notifications */}
      {notification && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3 text-xs shadow-xs animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Primary Action Bar (Clean Staff Directory View) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-blue-50 text-blue-800 px-3.5 py-1.5 rounded-xl border border-blue-200 text-xs font-bold shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Staff Directory ({scopedEmployees.length})</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAddModal}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-xs flex items-center gap-1.5 text-xs font-bold"
            title="Add New Employee"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Employee</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            className="self-end sm:self-auto p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh Staff Roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Staff Roster Content */}
      <div className="space-y-3 animate-in fade-in duration-150">
          {/* Top Controls: Search Bar + All/Active/Inactive Tabs + IT Admin Filter Button */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Bar for Employee Code & Name */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={scopedSearch}
                onChange={(e) => setScopedSearch(e.target.value)}
                placeholder="Search staff by Employee Code (e.g. EMP-01), Name, Designation, or Email..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
              />
              {scopedSearch && (
                <button
                  type="button"
                  onClick={() => setScopedSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
              {/* Status Segmented Buttons: All, Active, Inactive */}
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
                {(
                  [
                    { id: 'ALL', label: 'All', count: statusCounts.all },
                    { id: 'ACTIVE', label: 'Active', count: statusCounts.active },
                    { id: 'INACTIVE', label: 'Inactive', count: statusCounts.inactive },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === tab.id
                        ? 'bg-white text-slate-900 font-extrabold shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        statusFilter === tab.id
                          ? tab.id === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tab.id === 'INACTIVE'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                          : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Filter Button: ONLY FOR IT ADMIN */}
              {isGlobalITAdmin && (
                <div ref={filterRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setFilterOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                      filterOpen || activeFilterCount > 0
                        ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20 shadow-md'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <SlidersHorizontal className={`w-3.5 h-3.5 ${filterOpen || activeFilterCount > 0 ? 'text-white' : 'text-blue-600'}`} />
                    <span>Filter</span>
                    {activeFilterCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-white text-blue-700 font-extrabold text-[10px] flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Filter Popover Dropdown */}
                  {filterOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white border border-slate-200 text-slate-800 rounded-2xl p-4 shadow-xl z-50 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-extrabold tracking-wide uppercase text-slate-900">Filters</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeFilterCount > 0 && (
                            <button
                              type="button"
                              onClick={resetFilters}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setFilterOpen(false)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 text-xs">
                        {/* Location */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                            Location
                          </label>
                          <select
                            value={filterLocationId}
                            onChange={(e) => handleLocationFilterChange(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                          >
                            <option value="">All Locations</option>
                            {locations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Plant */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                            Plant
                          </label>
                          <select
                            value={filterPlantId}
                            onChange={(e) => handlePlantFilterChange(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                          >
                            <option value="">
                              {filterLocationId ? `All Plants at Location (${availablePlantsForFilter.length})` : 'All Plants'}
                            </option>
                            {availablePlantsForFilter.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Department */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                            Department
                          </label>
                          <select
                            value={filterDeptId}
                            onChange={(e) => handleDeptFilterChange(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                          >
                            <option value="">All Departments</option>
                            {availableDeptsForFilter.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} {d.code ? `(${d.code})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Employee Roster Cards Grid */}
          {displayedScopedEmployees.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-300" />
              <div className="text-sm font-bold text-slate-700">No staff records found in this view</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No employees matching your criteria were found in your assigned location and plant scope. If an employee belongs to another plant, switch to the "Find in Organization" tab to view or link them.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedScopedEmployees.map((emp) => {
                const assignedItems = getEmployeeAssets(emp.id);
                const isInactive = emp.status === 'inactive';

                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedProfileModal(emp)}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
                  >
                    <div>
                      {/* Top Badges & Actions */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {emp.emp_code}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                              isInactive
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {isInactive ? <UserMinus className="w-3 h-3 text-rose-600" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {emp.status?.toUpperCase() || 'ACTIVE'}
                          </span>

                          {/* Quick Toggle Status */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleStatus(emp, e)}
                            title={isInactive ? 'Activate Employee' : 'Mark as Inactive'}
                            className={`p-1 rounded-lg border transition-all cursor-pointer ${
                              isInactive
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 hover:bg-amber-100 text-slate-500 hover:text-amber-700 border-slate-200'
                            }`}
                          >
                            {isInactive ? <UserCheck className="w-3.5 h-3.5" /> : <UserMinus className="w-3.5 h-3.5" />}
                          </button>

                          {/* Quick Edit */}
                          <button
                            type="button"
                            onClick={(e) => openEditModal(emp, e)}
                            title="Edit Employee Profile"
                            className="p-1 rounded-lg bg-slate-50 hover:bg-blue-100 text-slate-400 hover:text-blue-700 border border-slate-200 transition-all cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Delete (Admin / IT Admin Only) */}
                          {(currentUser?.role === 'it_admin' || currentUser?.role === 'admin') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingEmp(emp);
                              }}
                              title="Delete Employee"
                              className="p-1 rounded-lg bg-slate-50 hover:bg-rose-100 text-slate-400 hover:text-rose-700 border border-slate-200 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Name & Designation */}
                      <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {emp.full_name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {emp.designation || 'Staff'} • {emp.department?.name || 'Department'}
                      </p>

                      {/* Location & Contact Meta */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                        {emp.plant?.name && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">Unit: {emp.plant.name}</span>
                          </div>
                        )}
                        {emp.email && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate font-mono">{emp.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Hardware Allocation Summary */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
                        <Laptop className="w-3.5 h-3.5 text-blue-600" />
                        <span>
                          {assignedItems.length === 0 ? 'No hardware assigned' : `${assignedItems.length} Assigned item(s)`}
                        </span>
                      </div>

                      <span className="text-[11px] font-bold text-blue-600 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* =================================================================== */}
      {/* MODAL: EMPLOYEE PROFILE & HARDWARE ASSETS ROSTER                    */}
      {/* =================================================================== */}
      {selectedProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedProfileModal(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm">
                  {selectedProfileModal.full_name?.charAt(0) || 'E'}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <span>{selectedProfileModal.full_name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/20 text-white">
                      {selectedProfileModal.emp_code}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {selectedProfileModal.designation || 'Staff'} • {selectedProfileModal.department?.name || 'Department'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProfileModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Placement & Status Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Location</span>
                  <strong className="text-slate-800">{selectedProfileModal.location?.name || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Plant Unit</span>
                  <strong className="text-slate-800">{selectedProfileModal.plant?.name || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Status</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedProfileModal.status === 'inactive'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedProfileModal.status?.toUpperCase() || 'ACTIVE'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Corporate Email</span>
                  <span className="text-slate-800 font-mono truncate block">{selectedProfileModal.email || '—'}</span>
                </div>
              </div>

              {/* Hardware Assets Allocated */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Assigned Hardware Assets</span>
                  <span className="text-slate-500 font-normal">
                    {getEmployeeAssets(selectedProfileModal.id).length} Asset(s)
                  </span>
                </h4>

                {getEmployeeAssets(selectedProfileModal.id).length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                    No hardware assets currently assigned to this employee.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getEmployeeAssets(selectedProfileModal.id).map((ast) => (
                      <div
                        key={ast.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Laptop className="w-4 h-4 text-blue-600 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900">{ast.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Tag: {ast.asset_tag} {ast.serial_number ? `| SN: ${ast.serial_number}` : ''}
                            </div>
                          </div>
                        </div>

                        <Link
                          href={`/assets/${ast.id}`}
                          className="px-2 py-1 rounded bg-white border border-slate-200 text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer with Inactivate & Delete Actions */}
            <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(selectedProfileModal)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    selectedProfileModal.status === 'inactive'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {selectedProfileModal.status === 'inactive' ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Activate Employee</span>
                    </>
                  ) : (
                    <>
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>Mark Inactive</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => openEditModal(selectedProfileModal)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Edit Profile</span>
                </button>

                {(currentUser?.role === 'it_admin' || currentUser?.role === 'admin') && (
                  <button
                    type="button"
                    onClick={() => setDeletingEmp(selectedProfileModal)}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProfileModal(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-white transition-colors cursor-pointer"
                >
                  Close
                </button>

                {selectedProfileModal.status === 'inactive' ? (
                  <button
                    type="button"
                    disabled
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold border border-slate-200 cursor-not-allowed flex items-center gap-1.5"
                    title="Cannot assign hardware assets to an inactive employee"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Cannot Assign (Inactive)</span>
                  </button>
                ) : (
                  <Link
                    href={`/assets/new?mode=assigned&employeeId=${selectedProfileModal.id}`}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Assign Hardware Asset</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DELETE CONFIRMATION MODAL                                           */}
      {/* =================================================================== */}
      {deletingEmp && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDeletingEmp(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Delete Employee</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {deletingEmp.full_name} ({deletingEmp.emp_code})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to delete this employee? Any hardware assets currently assigned to them will be automatically unlinked and safely returned to stock.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingEmp(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEmployee}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteLoading ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* ADD / EDIT EMPLOYEE MODAL (Matches HR Module)                      */}
      {/* =================================================================== */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingEmployee ? 'Edit Employee Profile' : 'Add New Employee'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingEmployee
                    ? `Updating details for ${editingEmployee.full_name} (${editingEmployee.emp_code})`
                    : 'Enter employee details to onboard into staff directory.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEmployeeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-sm font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {empModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{empModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Employee Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employee ID / Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EMP-01"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white uppercase"
                  />
                </div>

                {/* 2. Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value.toUpperCase())}
                    placeholder="e.g. RAMESH KUMAR"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white uppercase font-bold"
                  />
                </div>

                {/* 3. Corporate Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                    placeholder="e.g. ramesh@pgel.in"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white lowercase"
                  />
                </div>

                {/* 4. Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Phone (10 Digits)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>

                {/* 5. Location */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Location Unit *
                  </label>
                  <select
                    required
                    value={modalLocationId}
                    onChange={(e) => setModalLocationId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Select Location...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Plant Unit */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plant Unit *
                  </label>
                  <select
                    required
                    value={modalPlantId}
                    onChange={(e) => setModalPlantId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Select Plant Unit...</option>
                    {plants
                      .filter((p) => !modalLocationId || p.location_id === modalLocationId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 7. Department with Inline Add New */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Department *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddDeptInput((prev) => !prev)}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{showAddDeptInput ? 'Choose from list' : '+ Add New Department'}</span>
                    </button>
                  </div>

                  {showAddDeptInput ? (
                    <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 animate-in fade-in duration-150">
                      <input
                        type="text"
                        value={inlineNewDeptName}
                        onChange={(e) => setInlineNewDeptName(e.target.value.toUpperCase())}
                        placeholder="NEW DEPARTMENT NAME (e.g. QUALITY ASSURANCE)"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddDeptInput(false);
                            setInlineNewDeptName('');
                          }}
                          className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingInlineDept || !inlineNewDeptName.trim()}
                          onClick={handleSaveInlineDept}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                        >
                          {savingInlineDept ? 'Saving...' : 'Save Department'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      required
                      value={modalDeptId}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setShowAddDeptInput(true);
                        } else {
                          setModalDeptId(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="">Select Department...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                      <option value="__ADD_NEW__" className="font-bold text-blue-600 bg-blue-50">
                        + Add New Department...
                      </option>
                    </select>
                  )}
                </div>

                {/* 8. Designation */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Sr. Systems Engineer"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 9. Employment Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employment Status *
                  </label>
                  <select
                    value={empStatus}
                    onChange={(e) => setEmpStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEmp}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50 text-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{submittingEmp ? 'Saving...' : editingEmployee ? 'Update Profile' : 'Save Employee'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}

export default function StaffDirectoryPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400">Loading Staff Directory...</div>
      }
    >
      <StaffDirectoryContent />
    </Suspense>
  );
}
