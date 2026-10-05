'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Employee, Department, Asset, Location, Plant, User } from '@/types/database';
import {
  Users,
  Plus,
  Mail,
  Phone,
  Building,
  CheckCircle2,
  AlertCircle,
  Laptop,
  UserCheck,
  UserMinus,
  MapPin,
  ArrowLeft,
  Edit3,
  Trash2,
  Download,
  Clock,
  FileText,
  X,
  Search,
  MoreVertical,
} from 'lucide-react';

type ProfileTab = 'overview' | 'assets' | 'history' | 'documents';

function EmployeesPageContent() {
  const searchParams = useSearchParams();

  // Read URL search params updated live from top Navbar
  const searchQuery = searchParams.get('search') || '';
  const selectedLocation = searchParams.get('locationId') || '';
  const selectedPlant = searchParams.get('plantId') || '';
  const selectedDepartment = searchParams.get('deptId') || '';
  const selectedStatus = searchParams.get('status') || 'ALL';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [, setCurrentUser] = useState<User | null>(null);
  const [, setLoading] = useState(true);

  // Selected Employee for Profile View
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>('overview');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'code'>('recent');

  // KPI Clickable Popup Modal State
  const [kpiModal, setKpiModal] = useState<'total' | 'assigned' | 'active' | 'inactive' | null>(null);
  const [kpiSearch, setKpiSearch] = useState('');

  // Custom Delete Employee Confirmation Modal State
  const [deletingEmpTarget, setDeletingEmpTarget] = useState<Employee | null>(null);
  const [isDeletingEmp, setIsDeletingEmp] = useState(false);

  // Employee Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empCode, setEmpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [plantId, setPlantId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [empStatus, setEmpStatus] = useState<'active' | 'inactive'>('active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Inline Quick Department Creator State & Handler
  const [showAddDeptInput, setShowAddDeptInput] = useState(false);
  const [inlineNewDeptName, setInlineNewDeptName] = useState('');
  const [savingInlineDept, setSavingInlineDept] = useState(false);

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
          plant_id: plantId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create department');
      const created: Department = data.department;
      setDepartments((prev) => [...prev, created]);
      setDepartmentId(created.id);
      setInlineNewDeptName('');
      setShowAddDeptInput(false);
      setSuccess(`Department "${created.name}" created successfully!`);
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating department');
    } finally {
      setSavingInlineDept(false);
    }
  };

  // Auto-cascade Plant selection when Location changes in modal
  useEffect(() => {
    if (locationId && plants.length > 0) {
      const valid = plants.filter((p) => p.location_id === locationId);
      if (valid.length > 0 && !valid.some((p) => p.id === plantId)) {
        setPlantId(valid[0].id);
      } else if (valid.length === 0) {
        setPlantId('');
      }
    }
  }, [locationId, plants, plantId]);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, assetRes, deptRes, locRes, plantRes, meRes] = await Promise.all([
        fetch('/api/employees').then((r) => r.json()),
        fetch('/api/assets').then((r) => r.json()),
        fetch('/api/settings/departments').then((r) => r.json()),
        fetch('/api/locations').then((r) => r.json()),
        fetch('/api/plants').then((r) => r.json()),
        fetch('/api/auth/me').then((r) => r.json()).catch(() => null),
      ]);

      if (empRes?.employees) setEmployees(empRes.employees);
      if (assetRes?.assets) setAssets(assetRes.assets);
      if (deptRes?.departments) setDepartments(deptRes.departments);
      if (locRes?.locations) setLocations(locRes.locations);
      if (plantRes?.plants) setPlants(plantRes.plants);
      if (meRes?.user) setCurrentUser(meRes.user);
    } catch (err) {
      console.error('Error fetching HR directory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Listen for "+ Add Employee" button event dispatched from top Navbar
  useEffect(() => {
    const handleOpenAdd = () => {
      openAddModal();
    };
    window.addEventListener('aems:open-add-employee', handleOpenAdd);
    return () => window.removeEventListener('aems:open-add-employee', handleOpenAdd);
  }, [locations, plants, departments]);

  // Filtered Plants based on selected Location for Add/Edit Modal
  const availablePlantsForModal = useMemo(() => {
    if (!locationId) return plants;
    return plants.filter((p) => p.location_id === locationId);
  }, [plants, locationId]);

  // Open Add Modal
  const openAddModal = () => {
    setEditingEmployee(null);
    setEmpCode('');
    setFullName('');
    setEmail('');
    setPhone('');
    setDesignation('');
    const defaultLoc = selectedLocation || (locations[0]?.id || '');
    setLocationId(defaultLoc);
    const validPlants = defaultLoc ? plants.filter((p) => p.location_id === defaultLoc) : plants;
    setPlantId(selectedPlant || (validPlants[0]?.id || ''));
    setDepartmentId(selectedDepartment || '');
    setEmpStatus('active');
    setShowModal(true);
  };

  // Open Edit Modal
  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpCode(emp.emp_code || '');
    setFullName(emp.full_name || '');
    setEmail(emp.email || '');
    setPhone(emp.phone || '');
    setDesignation(emp.designation || '');
    setDepartmentId(emp.department_id || '');
    setPlantId(emp.plant_id || '');
    setLocationId(emp.location_id || '');
    setEmpStatus(emp.status === 'inactive' || (emp.status as string) === 'resigned' ? 'inactive' : 'active');
    setShowModal(true);
  };

  // Handle Save (Create / Update)
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!locationId || !plantId || !departmentId) {
      setError('Please select Location, Plant Unit, and Department. Every employee must be assigned to a specific Location & Plant.');
      setSubmitting(false);
      return;
    }

    if (phone.trim() && phone.trim().length !== 10) {
      setError('Mobile phone number must be exactly 10 digits');
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        emp_code: empCode.trim().toUpperCase(),
        full_name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        designation: designation.trim() || null,
        department_id: departmentId,
        plant_id: plantId,
        location_id: locationId,
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

      setSuccess(`Employee record saved successfully for ${fullName}`);
      setShowModal(false);
      setTimeout(() => setSuccess(null), 3500);
      fetchData();

      if (selectedEmployee && selectedEmployee.id === editingEmployee?.id) {
        setSelectedEmployee({ ...selectedEmployee, ...payload });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving employee');
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger Delete Confirmation Modal
  const handleDeleteEmployee = (emp: Employee) => {
    setDeletingEmpTarget(emp);
  };

  // Confirm Delete Employee
  const confirmDeleteEmployee = async () => {
    if (!deletingEmpTarget) return;
    setIsDeletingEmp(true);
    try {
      const res = await fetch(`/api/employees?id=${deletingEmpTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove employee');
      }

      setEmployees((prev) => prev.filter((e) => e.id !== deletingEmpTarget.id));
      setSuccess(`Employee "${deletingEmpTarget.full_name}" removed.`);
      setTimeout(() => setSuccess(null), 3500);
      if (selectedEmployee?.id === deletingEmpTarget.id) setSelectedEmployee(null);
      setDeletingEmpTarget(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
      setTimeout(() => setError(null), 3500);
    } finally {
      setIsDeletingEmp(false);
    }
  };

  // Map of Assigned Assets indexed by employee ID, emp_code, or assigned_to_id
  const assignedAssetsMap = useMemo(() => {
    const map = new Map<string, Asset[]>();
    assets.forEach((ast) => {
      const keys = new Set<string>();
      if (ast.assigned_employee_id) keys.add(ast.assigned_employee_id);
      if (ast.assigned_employee?.id) keys.add(ast.assigned_employee.id);
      if (ast.assigned_employee?.emp_code) keys.add(ast.assigned_employee.emp_code);

      keys.forEach((key) => {
        if (!map.has(key)) map.set(key, []);
        if (!map.get(key)!.some((a) => a.id === ast.id)) {
          map.get(key)!.push(ast);
        }
      });
    });
    return map;
  }, [assets]);

  // Helper to fetch all assets assigned to a given employee
  const getEmployeeAssets = (emp: Employee): Asset[] => {
    const set = new Map<string, Asset>();
    if (emp.id && assignedAssetsMap.has(emp.id)) {
      assignedAssetsMap.get(emp.id)!.forEach((a) => set.set(a.id, a));
    }
    if (emp.emp_code && assignedAssetsMap.has(emp.emp_code)) {
      assignedAssetsMap.get(emp.emp_code)!.forEach((a) => set.set(a.id, a));
    }
    return Array.from(set.values());
  };

  // Statistics KPI counts
  const totalEmployeesCount = employees.length;
  const activeStaffCount = employees.filter((e) => e.status !== 'inactive').length;
  const inactiveStaffCount = employees.filter((e) => e.status === 'inactive').length;
  const totalAssignedAssetsCount = assets.filter(
    (ast) => !!(ast.assigned_employee_id || ast.assigned_employee?.id || ast.assigned_employee?.emp_code)
  ).length;

  // Filtered Directory Employees based on URL params from top Navbar
  const filteredEmployees = useMemo(() => {
    return employees
      .filter((e) => {
        if (selectedLocation) {
          const locMatch = e.location_id === selectedLocation || e.location?.id === selectedLocation;
          if (!locMatch && locations.some((l) => l.id === selectedLocation)) return false;
        }
        if (selectedPlant) {
          const pltMatch = e.plant_id === selectedPlant || e.plant?.id === selectedPlant;
          if (!pltMatch && plants.some((p) => p.id === selectedPlant)) return false;
        }
        if (selectedDepartment) {
          const deptMatch = e.department_id === selectedDepartment || e.department?.id === selectedDepartment;
          if (!deptMatch && departments.some((d) => d.id === selectedDepartment)) return false;
        }
        if (selectedStatus !== 'ALL') {
          if (selectedStatus === 'ACTIVE' && e.status === 'inactive') return false;
          if (selectedStatus === 'INACTIVE' && e.status !== 'inactive') return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const name = (e.full_name || '').toLowerCase();
          const code = (e.emp_code || '').toLowerCase();
          const mail = (e.email || '').toLowerCase();
          const desig = (e.designation || '').toLowerCase();
          return name.includes(q) || code.includes(q) || mail.includes(q) || desig.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.full_name.localeCompare(b.full_name);
        if (sortBy === 'code') return a.emp_code.localeCompare(b.emp_code);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [employees, selectedLocation, selectedPlant, selectedDepartment, selectedStatus, searchQuery, sortBy, locations, plants, departments]);

  // Selected Employee Assets for Profile View
  const selectedEmpAssets = useMemo(() => {
    if (!selectedEmployee) return [];
    return assignedAssetsMap.get(selectedEmployee.id) || [];
  }, [selectedEmployee, assignedAssetsMap]);

  // Data for KPI Modal Popups
  const kpiModalData = useMemo(() => {
    if (!kpiModal) return { title: '', badge: '', type: 'employees' as const, items: [] };
    const q = kpiSearch.toLowerCase().trim();

    if (kpiModal === 'assigned') {
      const assignedList = assets.filter((a) => {
        const empId = a.assigned_employee_id || a.assigned_employee?.id;
        if (!empId) return false;
        if (!q) return true;
        const tag = (a.asset_tag || '').toLowerCase();
        const name = (a.name || '').toLowerCase();
        const model = (a.model || '').toLowerCase();
        const emp = a.assigned_employee || employees.find((e) => e.id === empId);
        const empName = (emp?.full_name || '').toLowerCase();
        const empCode = (emp?.emp_code || '').toLowerCase();
        return tag.includes(q) || name.includes(q) || model.includes(q) || empName.includes(q) || empCode.includes(q);
      });
      return {
        title: 'Assigned Hardware Assets Roster',
        badge: `${assignedList.length} Items`,
        type: 'assets' as const,
        items: assignedList,
      };
    }

    let empList = employees;
    if (kpiModal === 'active') {
      empList = employees.filter((e) => e.status !== 'inactive');
    } else if (kpiModal === 'inactive') {
      empList = employees.filter((e) => e.status === 'inactive');
    }

    if (q) {
      empList = empList.filter((e) => {
        const name = (e.full_name || '').toLowerCase();
        const code = (e.emp_code || '').toLowerCase();
        const mail = (e.email || '').toLowerCase();
        const desig = (e.designation || '').toLowerCase();
        const dept = (e.department?.name || '').toLowerCase();
        return name.includes(q) || code.includes(q) || mail.includes(q) || desig.includes(q) || dept.includes(q);
      });
    }

    const titleMap = {
      total: 'Total Registered Employees',
      active: 'Active Staff Roster',
      inactive: 'Inactive Employee Records',
    };

    return {
      title: titleMap[kpiModal],
      badge: `${empList.length} Records`,
      type: 'employees' as const,
      items: empList,
    };
  }, [kpiModal, kpiSearch, assets, employees]);

  return (
    <div className="space-y-2.5 antialiased font-sans max-w-[1700px] mx-auto pb-16 px-1 sm:px-2 pt-3">
      {/* Notifications */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-700 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="font-semibold">{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE B: EMPLOYEE PROFILE DETAILED VIEW                              */}
      {/* =================================================================== */}
      {selectedEmployee ? (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Top Bar Navigation & Actions */}
          <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Back to Employee Directory"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <div>
                <h1 className="text-sm font-black text-slate-900 tracking-tight">Employee Profile</h1>
                <p className="text-[10px] text-slate-500">Overview and assigned hardware</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => openEditModal(selectedEmployee)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteEmployee(selectedEmployee)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Hero Employee Identity Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center font-extrabold text-lg shadow-md border-2 border-slate-100">
                    {selectedEmployee.full_name[0].toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono font-bold">
                      {selectedEmployee.emp_code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${
                        selectedEmployee.status === 'inactive'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {selectedEmployee.status === 'inactive' ? (
                        <UserMinus className="w-3 h-3 text-rose-600" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      )}
                      {selectedEmployee.status || 'ACTIVE'}
                    </span>
                  </div>

                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    {selectedEmployee.full_name}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedEmployee.designation || 'EXE'} • {selectedEmployee.department?.name || 'Department'}
                  </p>

                  <div className="flex items-center gap-2 pt-1 flex-wrap text-xs text-slate-600">
                    {selectedEmployee.email && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-mono font-medium">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {selectedEmployee.email}
                      </span>
                    )}
                    {selectedEmployee.phone && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-mono font-medium">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {selectedEmployee.phone}
                      </span>
                    )}
                    {selectedEmployee.location?.name && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-mono font-medium uppercase">
                        <MapPin className="w-3 h-3 text-blue-600" />
                        {selectedEmployee.location.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Summary Badges */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center min-w-[100px]">
                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    <span>ASSIGNED</span>
                    <Laptop className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="text-lg font-black text-slate-900">{selectedEmpAssets.length}</div>
                  <div className="text-[9px] text-slate-500">Active items</div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center min-w-[100px]">
                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    <span>HISTORY</span>
                    <Clock className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="text-lg font-black text-slate-900">{selectedEmpAssets.length}</div>
                  <div className="text-[9px] text-slate-500">Transactions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 pt-1 rounded-xl shadow-2xs">
            <div className="flex items-center gap-5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveProfileTab('overview')}
                className={`py-2.5 flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                  activeProfileTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveProfileTab('assets')}
                className={`py-2.5 flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                  activeProfileTab === 'assets'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active Assets ({selectedEmpAssets.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveProfileTab('history')}
                className={`py-2.5 flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                  activeProfileTab === 'history'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Activity History</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveProfileTab('documents')}
                className={`py-2.5 flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                  activeProfileTab === 'documents'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Documents</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-blue-600 cursor-pointer py-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>

          {/* Profile Tab Details */}
          {activeProfileTab === 'overview' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Department & Organization */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider pb-1.5 border-b border-slate-100 flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    <span>DEPARTMENT &amp; ORGANIZATION</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="text-slate-400 font-semibold">Main Department</span>
                    <span className="font-bold text-slate-800">{selectedEmployee.department?.name || 'N/A'}</span>

                    <span className="text-slate-400 font-semibold">Designation</span>
                    <span className="font-bold text-slate-800">{selectedEmployee.designation || 'N/A'}</span>

                    <span className="text-slate-400 font-semibold">Plant Code</span>
                    <span className="font-mono font-bold text-blue-600">{selectedEmployee.plant?.code || 'N/A'}</span>

                    <span className="text-slate-400 font-semibold">Primary Location</span>
                    <span className="font-bold text-slate-800 uppercase">{selectedEmployee.location?.name || 'N/A'}</span>
                  </div>
                </div>

                {/* Column 2: Contact & Status */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider pb-1.5 border-b border-slate-100 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>CONTACT &amp; STATUS</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="text-slate-400 font-semibold">Corporate Email</span>
                    <span className="font-mono font-bold text-slate-800 truncate">{selectedEmployee.email || 'N/A'}</span>

                    <span className="text-slate-400 font-semibold">Phone Number</span>
                    <span className="font-mono font-bold text-slate-800">{selectedEmployee.phone || 'N/A'}</span>

                    <span className="text-slate-400 font-semibold">Employment Status</span>
                    <div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          selectedEmployee.status === 'inactive'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {selectedEmployee.status?.toUpperCase() || 'ACTIVE'}
                      </span>
                    </div>

                    <span className="text-slate-400 font-semibold">Hardware Allocation</span>
                    <button
                      type="button"
                      onClick={() => setActiveProfileTab('assets')}
                      className="text-left text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      {selectedEmpAssets.length} Active Asset(s)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeProfileTab === 'assets' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Assigned Hardware Assets ({selectedEmpAssets.length})
                </h3>
              </div>

              {selectedEmpAssets.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No hardware assets currently assigned to this employee.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 text-[10px]">
                      <tr>
                        <th className="px-3.5 py-2">Asset Tag &amp; Code</th>
                        <th className="px-3.5 py-2">Equipment Name &amp; Model</th>
                        <th className="px-3.5 py-2">Category</th>
                        <th className="px-3.5 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedEmpAssets.map((ast) => (
                        <tr key={ast.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3.5 py-2 font-mono font-bold text-blue-600">{ast.asset_tag}</td>
                          <td className="px-3.5 py-2">
                            <div className="font-bold text-slate-900">{ast.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{ast.model || 'N/A'}</div>
                          </td>
                          <td className="px-3.5 py-2">{ast.category?.name || 'Equipment'}</td>
                          <td className="px-3.5 py-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              IN USE
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeProfileTab === 'history' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Asset Handover &amp; Assignment Logs</h3>
              <div className="space-y-2.5">
                {selectedEmpAssets.map((ast) => (
                  <div key={ast.id} className="flex items-start gap-2.5 bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900">Assigned {ast.name} ({ast.asset_tag})</div>
                      <div className="text-[10px] text-slate-500">Recorded on {new Date(ast.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeProfileTab === 'documents' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs text-center text-xs text-slate-400">
              No employee document attachments uploaded yet.
            </div>
          )}
        </div>
      ) : (
        /* =================================================================== */
        /* MODE A: HR DASHBOARD & EMPLOYEE DIRECTORY                           */
        /* =================================================================== */
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* Sticky 4 Clickable Metric Stat Cards Grid */}
          <div className="sticky top-0 z-20 bg-[#F5F4F0]/95 pt-0 pb-2 backdrop-blur-md shadow-2xs">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Card 1: TOTAL EMPLOYEES */}
              <div
                onClick={() => {
                  setKpiSearch('');
                  setKpiModal('total');
                }}
                className="bg-white hover:bg-amber-50/50 rounded-xl border border-slate-200/90 hover:border-amber-300 p-2.5 sm:p-3 shadow-2xs flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group"
                title="Click to open Total Employees Roster popup"
              >
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5 group-hover:text-amber-700">
                    TOTAL EMPLOYEES
                  </span>
                  <span className="text-lg sm:text-xl font-black text-slate-900">{totalEmployeesCount}</span>
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center font-bold shadow-2xs group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              {/* Card 2: ASSETS ASSIGNED */}
              <div
                onClick={() => {
                  setKpiSearch('');
                  setKpiModal('assigned');
                }}
                className="bg-white hover:bg-blue-50/50 rounded-xl border border-slate-200/90 hover:border-blue-300 p-2.5 sm:p-3 shadow-2xs flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group"
                title="Click to open Assigned Hardware Assets popup"
              >
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5 group-hover:text-blue-700">
                    ASSETS ASSIGNED
                  </span>
                  <span className="text-lg sm:text-xl font-black text-slate-900">{totalAssignedAssetsCount}</span>
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-600 text-white shadow-2xs flex items-center justify-center font-bold group-hover:bg-blue-700 transition-colors">
                  <Laptop className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              {/* Card 3: ACTIVE STAFF */}
              <div
                onClick={() => {
                  setKpiSearch('');
                  setKpiModal('active');
                }}
                className="bg-[#E6F4EA] hover:bg-[#D8F3E0] rounded-xl border border-[#C6F6D5] hover:border-emerald-400 p-2.5 sm:p-3 shadow-2xs flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group"
                title="Click to open Active Staff List popup"
              >
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#047857] block mb-0.5">
                    ACTIVE STAFF
                  </span>
                  <span className="text-lg sm:text-xl font-black text-slate-900">{activeStaffCount}</span>
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#10B981] text-white shadow-2xs flex items-center justify-center font-bold group-hover:bg-[#059669] transition-colors">
                  <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>

              {/* Card 4: INACTIVE RECORDS */}
              <div
                onClick={() => {
                  setKpiSearch('');
                  setKpiModal('inactive');
                }}
                className="bg-[#FCE8E6] hover:bg-[#FCD5D1] rounded-xl border border-[#FECDD3] hover:border-rose-400 p-2.5 sm:p-3 shadow-2xs flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group"
                title="Click to open Inactive Records popup"
              >
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#DC2626] block mb-0.5">
                    INACTIVE RECORDS
                  </span>
                  <span className="text-lg sm:text-xl font-black text-slate-900">{inactiveStaffCount}</span>
                </div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#DC2626] text-white shadow-2xs flex items-center justify-center font-bold group-hover:bg-rose-700 transition-colors">
                  <UserMinus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Employee Directory Section Header */}
          <div className="pt-0.5">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">Employee Directory</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {filteredEmployees.length} records
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                <span>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'code')}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="recent">Recently Active</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="code">Employee Code</option>
                </select>
              </div>
            </div>
          </div>

          {/* Employee Card Row Items */}
          <div className="space-y-1.5">
            {filteredEmployees.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                No employees found matching filter criteria.
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const empAssetsList = getEmployeeAssets(emp);
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition-all cursor-pointer shadow-2xs group"
                  >
                    {/* Avatar & Emp Identity */}
                    <div className="flex items-center gap-2.5 min-w-[230px]">
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs border border-slate-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {emp.full_name[0].toUpperCase()}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                            emp.status === 'inactive' ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 text-xs tracking-tight truncate" title={emp.full_name}>
                          {emp.full_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                          <span className="font-bold text-slate-700">{emp.emp_code}</span> • {emp.email || 'no mail'}
                        </div>
                      </div>
                    </div>

                    {/* Department & Location */}
                    <div className="min-w-[170px] text-xs space-y-0.5">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="text-slate-400">🔒</span>
                        <span>{emp.designation || emp.department?.name || 'N/A'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="text-slate-400">📍</span>
                        <span>{emp.plant?.name || emp.location?.name || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Assigned Assets Badges */}
                    <div className="min-w-[190px]">
                      <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                        ASSIGNED ASSETS
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {empAssetsList.length === 0 ? (
                          <span className="text-slate-400 italic text-[11px]">no assets assigned</span>
                        ) : (
                          empAssetsList.map((ast) => (
                            <span
                              key={ast.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] text-[10px] font-bold shadow-2xs"
                            >
                              <Laptop className="w-3 h-3" />
                              <span>{ast.category?.name || ast.name || 'Laptop'}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Status Badge & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-white text-[10px] font-black tracking-wider uppercase shadow-2xs ${
                          emp.status === 'inactive' ? 'bg-rose-600' : 'bg-[#10B981]'
                        }`}
                      >
                        {emp.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(emp);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                        title="Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: KPI STATS POPUP (CLICKABLE CARDS DETAILS)                  */}
      {/* =================================================================== */}
      {kpiModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setKpiModal(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                {kpiModal === 'assigned' ? (
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                    <Laptop className="w-4 h-4" />
                  </div>
                ) : kpiModal === 'active' ? (
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                    <UserCheck className="w-4 h-4" />
                  </div>
                ) : kpiModal === 'inactive' ? (
                  <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white">
                    <UserMinus className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white">
                    <Users className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span>{kpiModalData.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                      {kpiModalData.badge}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300 font-medium">
                    {kpiModal === 'assigned'
                      ? 'Detailed roster of hardware laptops and desktops currently assigned'
                      : 'Real-time corporate HR directory overview'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setKpiModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="relative max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={kpiSearch}
                  onChange={(e) => setKpiSearch(e.target.value)}
                  placeholder={
                    kpiModal === 'assigned'
                      ? 'Search asset tag, model, employee...'
                      : 'Search employee name, code, department...'
                  }
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
            </div>

            {/* Modal Content Table / List */}
            <div className="overflow-y-auto p-3 sm:p-4 flex-1">
              {kpiModalData.type === 'assets' ? (
                (kpiModalData.items as Asset[]).length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">No assigned assets matching search.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2 rounded-l-lg">Asset Tag</th>
                          <th className="px-3 py-2">Asset Details</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Assigned Custodian</th>
                          <th className="px-3 py-2 rounded-r-lg text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(kpiModalData.items as Asset[]).map((ast) => {
                          const empId = ast.assigned_employee_id || ast.assigned_employee?.id;
                          const emp = ast.assigned_employee || employees.find((e) => e.id === empId);
                          return (
                            <tr key={ast.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 font-mono font-bold text-blue-600">{ast.asset_tag}</td>
                              <td className="px-3 py-2">
                                <div className="font-bold text-slate-900">{ast.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{ast.model || 'N/A'}</div>
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-600">{ast.category?.name || 'IT Hardware'}</td>
                              <td className="px-3 py-2">
                                {emp ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedEmployee(emp);
                                      setKpiModal(null);
                                    }}
                                    className="text-left group cursor-pointer"
                                  >
                                    <div className="font-bold text-slate-900 group-hover:text-blue-600 group-hover:underline">
                                      {emp.full_name}
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-400">{emp.emp_code}</div>
                                  </button>
                                ) : (
                                  <span className="text-slate-400 italic">Unassigned</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                  IN USE
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (kpiModalData.items as Employee[]).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No employees found in this view.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2 rounded-l-lg">Code</th>
                        <th className="px-3 py-2">Employee Name</th>
                        <th className="px-3 py-2">Department</th>
                        <th className="px-3 py-2">Location</th>
                        <th className="px-3 py-2">Assigned Laptops</th>
                        <th className="px-3 py-2 rounded-r-lg text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(kpiModalData.items as Employee[]).map((emp) => {
                        const empAssetsList = getEmployeeAssets(emp);
                        return (
                          <tr
                            key={emp.id}
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setKpiModal(null);
                            }}
                            className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                          >
                            <td className="px-3 py-2 font-mono font-bold text-blue-600">{emp.emp_code}</td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-slate-900">{emp.full_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{emp.email || 'no email'}</div>
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-700">
                              {emp.designation || emp.department?.name || 'N/A'}
                            </td>
                            <td className="px-3 py-2 text-slate-600 font-medium">
                              {emp.plant?.name || emp.location?.name || 'N/A'}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">
                                <Laptop className="w-3 h-3" />
                                <span>{empAssetsList.length}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  emp.status === 'inactive'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {emp.status === 'inactive' ? 'INACTIVE' : 'ACTIVE'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
              <span className="text-slate-500 font-medium">
                Click any employee row to open full profile &amp; hardware assignment overview.
              </span>
              <button
                type="button"
                onClick={() => setKpiModal(null)}
                className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD / EDIT EMPLOYEE                                         */}
      {/* =================================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{editingEmployee ? 'Edit Employee Record' : 'Register New Employee'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employee Code *</label>
                  <input
                    type="text"
                    required
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    placeholder="Enter Employee Code"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-blue-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter Full Name"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Corporate Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter Email Address"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                    placeholder="Enter 10-digit Phone Number"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Location *</label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Select Location...</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plant Unit *</label>
                  <select
                    value={plantId}
                    onChange={(e) => setPlantId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Select Plant Unit...</option>
                    {availablePlantsForModal.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-700">Department *</label>
                    <button
                      type="button"
                      onClick={() => setShowAddDeptInput((prev) => !prev)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add New</span>
                    </button>
                  </div>

                  {showAddDeptInput ? (
                    <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 space-y-2 animate-in fade-in duration-150">
                      <input
                        type="text"
                        value={inlineNewDeptName}
                        onChange={(e) => setInlineNewDeptName(e.target.value.toUpperCase())}
                        placeholder="New Dept Name"
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
                          {savingInlineDept ? 'Saving...' : 'Save Dept'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={departmentId}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setShowAddDeptInput(true);
                        } else {
                          setDepartmentId(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
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

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="Enter Designation"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employment Status *</label>
                  <select
                    value={empStatus}
                    onChange={(e) => setEmpStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: DELETE EMPLOYEE CONFIRMATION                                */}
      {/* =================================================================== */}
      {deletingEmpTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Employee</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove employee <strong className="text-slate-900">{deletingEmpTarget.full_name}</strong> (
              <span className="font-mono">{deletingEmpTarget.emp_code}</span>)?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingEmpTarget(null)}
                disabled={isDeletingEmp}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteEmployee}
                disabled={isDeletingEmp}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeletingEmp ? 'Deleting...' : 'Delete Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 text-xs">Loading HR Directory...</div>}>
      <EmployeesPageContent />
    </Suspense>
  );
}
