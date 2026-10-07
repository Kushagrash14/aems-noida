'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Department, Category, CategoryFormField, FieldType, User, Location, Plant, AuditLog } from '@/types/database';
import { formatDateTime } from '@/lib/utils';
import {
  Settings,
  Building,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Shield,
  Save,
  Plus,
  Trash2,
  Sliders,
  Lock,
  Check,
  FileText,
  Sparkles,
  RefreshCw,
  Info,
  ShieldCheck,
  Search,
  Download,
  AlertTriangle,
  Clock,
  Key,
  FileSpreadsheet,
  Upload,
  ArrowRight,
  Edit3,
  Filter,
  X,
  ChevronRight,
  ChevronDown,
  Mail,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SmartMailModule from '@/components/settings/SmartMailModule';
import CategoryRepairCard from '@/components/settings/CategoryRepairCard';
import { auditActorLabel, describeAuditLog, isHistoricalLog } from '@/lib/auditDescribe';

type SettingsTab = 'users' | 'location_plant' | 'entry_form' | 'bulk_import' | 'security_audit' | 'smart_mail';

function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isStrictItAdmin = currentUser?.role === 'it_admin';
  const isFacilityAdmin = currentUser?.role === 'admin';
  const canManageUsers = isStrictItAdmin || isFacilityAdmin;
  // Plant/Location/Forms/Audit tabs are strictly reserved for IT Root Admin
  const isItRootAdmin = isStrictItAdmin;

  // Sync tab with URL query parameter (force 'users' for facility admins)
  useEffect(() => {
    if (isFacilityAdmin) {
      setActiveTab('users');
      return;
    }
    const t = searchParams.get('tab');
    if (
      t === 'users' ||
      t === 'location_plant' ||
      t === 'entry_form' ||
      t === 'bulk_import' ||
      t === 'security_audit' ||
      t === 'smart_mail'
    ) {
      setActiveTab(t);
    }
  }, [searchParams, isFacilityAdmin]);

  const switchTab = (tab: SettingsTab) => {
    if (isFacilityAdmin && tab !== 'users') {
      return; // Admins can only view the users tab
    }
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url.toString());
    }
  };

  // ---------------------------------------------------------------------------
  // INITIAL & REFRESH DATA FETCH
  // ---------------------------------------------------------------------------
  const fetchSettings = async () => {
    try {
      const [locRes, plantsRes, deptRes, usersRes, meRes, catsRes] = await Promise.all([
        fetch('/api/locations').then((r) => r.json()),
        fetch('/api/plants').then((r) => r.json()),
        fetch('/api/settings/departments').then((r) => r.json()),
        fetch('/api/users').then((r) => r.json()),
        fetch('/api/auth/me').then((r) => r.json()),
        fetch('/api/categories').then((r) => r.json()),
      ]);

      if (locRes?.locations) setLocations(locRes.locations);
      if (plantsRes?.plants) setPlants(plantsRes.plants);
      if (deptRes?.departments) setDepartments(deptRes.departments);
      if (usersRes?.users) setUsers(usersRes.users);
      if (meRes?.user) setCurrentUser(meRes.user);

      if (catsRes?.categories?.length) {
        setCategories(catsRes.categories);
        if (!selectedCategory) {
          setSelectedCategory(catsRes.categories[0]);
        }
      }
    } catch (err) {
      console.error('Fetch settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // ---------------------------------------------------------------------------
  // TAB 1: USER MANAGEMENT STATES & HANDLERS
  // ---------------------------------------------------------------------------
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Form states for Add / Edit User
  const [userEmpCode, setUserEmpCode] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userRole, setUserRole] = useState<'it_admin' | 'admin' | 'hr' | 'user'>('user');
  const [userLocationId, setUserLocationId] = useState('');
  const [userPlantId, setUserPlantId] = useState('');
  const [userPlantIds, setUserPlantIds] = useState<string[]>([]);
  const [userDeptId, setUserDeptId] = useState('');
  const [userSubDept, setUserSubDept] = useState('');
  const [userCanEdit, setUserCanEdit] = useState(true);
  const [userModalError, setUserModalError] = useState<string | null>(null);

  // Filter plants for user modal based on selected location
  const availablePlantsForUser = useMemo(() => {
    if (!userLocationId) return plants;
    return plants.filter((p) => p.location_id === userLocationId);
  }, [plants, userLocationId]);

  const openAddUserModal = () => {
    setUserEmpCode('');
    setUserName('');
    setUserEmail('');
    setUserPhone('');
    setUserRole(isFacilityAdmin ? 'user' : 'it_admin');
    setUserLocationId(isFacilityAdmin ? (currentUser?.location_id || '') : '');
    const initialPlantIds = isFacilityAdmin
      ? (currentUser?.scope?.plant_ids && currentUser.scope.plant_ids.length > 0
          ? currentUser.scope.plant_ids
          : (currentUser?.plant_id ? [currentUser.plant_id] : []))
      : [];
    setUserPlantId(initialPlantIds[0] || (isFacilityAdmin ? (currentUser?.plant_id || '') : ''));
    setUserPlantIds(initialPlantIds);
    setUserDeptId(isFacilityAdmin ? (currentUser?.department_id || '') : '');
    setUserSubDept(isFacilityAdmin ? (currentUser?.sub_department || '') : '');
    setUserCanEdit(true);
    setUserModalError(null);
    setShowAddUserModal(true);
  };

  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    setUserEmpCode(u.emp_code || '');
    setUserName(u.full_name || '');
    setUserEmail(u.email || '');
    setUserPhone(u.phone || '');
    setUserRole(u.role);
    const initialPlantIds = u.scope?.plant_ids && u.scope.plant_ids.length > 0
      ? u.scope.plant_ids
      : (u.plant_id ? [u.plant_id] : []);
    setUserPlantId(u.plant_id || initialPlantIds[0] || '');
    setUserPlantIds(initialPlantIds);
    setUserLocationId(initialPlantIds.length > 1 ? '' : (u.location_id || u.scope?.location_ids?.[0] || ''));
    setUserDeptId(u.department_id || u.scope?.department_ids?.[0] || '');
    setUserSubDept(u.sub_department || u.scope?.sub_department || '');
    setUserCanEdit(u.scope?.can_edit ?? true);
    setUserModalError(null);
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) {
      setError('Access Denied: Only Administrators can create user accounts');
      return;
    }

    const resolvedRole = isFacilityAdmin ? 'user' : userRole;
    const isItAdmin = resolvedRole === 'it_admin';
    const effectivePlantIds = isItAdmin
      ? null
      : (userPlantIds.length > 0 ? userPlantIds : (userPlantId ? [userPlantId] : (currentUser?.plant_id ? [currentUser.plant_id] : null)));

    if (!isItAdmin && (!effectivePlantIds || effectivePlantIds.length === 0)) {
      setUserModalError('Please select at least one Production Plant for this user.');
      return;
    }

    const primaryPlantId = isItAdmin ? null : (effectivePlantIds?.[0] || null);
    const primaryPlant = plants.find((p) => p.id === primaryPlantId);
    const resolvedLoc = isFacilityAdmin
      ? (currentUser?.location_id || userLocationId || null)
      : (isItAdmin ? null : (userLocationId || primaryPlant?.location_id || null));
    const derivedLocIds = isItAdmin
      ? null
      : (effectivePlantIds && effectivePlantIds.length > 0
          ? Array.from(new Set(effectivePlantIds.map((pid) => plants.find((p) => p.id === pid)?.location_id).filter(Boolean) as string[]))
          : (resolvedLoc ? [resolvedLoc] : null));
    const effectiveLoc = resolvedLoc || (derivedLocIds && derivedLocIds.length > 0 ? derivedLocIds[0] : null);
    const resolvedDept = isFacilityAdmin ? (currentUser?.department_id || userDeptId || null) : (isItAdmin ? null : (userDeptId || null));

    setSavingUser(true);
    setUserModalError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_code: userEmpCode.trim() || null,
          full_name: userName.trim(),
          email: userEmail.trim(),
          phone: userPhone.trim() || null,
          role: resolvedRole,
          location_id: effectiveLoc,
          plant_id: primaryPlantId,
          department_id: resolvedDept,
          sub_department: isItAdmin ? null : (userSubDept.trim() || 'None'),
          can_edit: isItAdmin ? true : userCanEdit,
          location_ids: isItAdmin ? null : (derivedLocIds && derivedLocIds.length > 0 ? derivedLocIds : (effectiveLoc ? [effectiveLoc] : null)),
          plant_ids: effectivePlantIds,
          department_ids: isItAdmin ? null : (resolvedDept ? [resolvedDept] : null),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register user');

      setSuccess(`User account created successfully for ${userName} (${userEmpCode || userEmail})`);
      setShowAddUserModal(false);
      setUserModalError(null);
      setTimeout(() => setSuccess(null), 3500);
      fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setUserModalError(msg);
      setError(msg);
      setTimeout(() => setError(null), 3500);
    } finally {
      setSavingUser(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!canManageUsers) {
      setError('Access Denied: Only Administrators can modify user accounts');
      return;
    }

    const resolvedRole = isFacilityAdmin ? 'user' : userRole;
    const isItAdmin = resolvedRole === 'it_admin';
    const effectivePlantIds = isItAdmin
      ? null
      : (userPlantIds.length > 0 ? userPlantIds : (userPlantId ? [userPlantId] : null));

    if (!isItAdmin && (!effectivePlantIds || effectivePlantIds.length === 0)) {
      setUserModalError('Please select at least one Production Plant for this user.');
      return;
    }

    const primaryPlantId = isItAdmin ? null : (effectivePlantIds?.[0] || null);
    const primaryPlant = plants.find((p) => p.id === primaryPlantId);
    const resolvedLoc = isFacilityAdmin ? (currentUser?.location_id || userLocationId || null) : (isItAdmin ? null : (userLocationId || primaryPlant?.location_id || null));
    const derivedLocIds = isItAdmin
      ? null
      : (effectivePlantIds && effectivePlantIds.length > 0
          ? Array.from(new Set(effectivePlantIds.map((pid) => plants.find((p) => p.id === pid)?.location_id).filter(Boolean) as string[]))
          : (resolvedLoc ? [resolvedLoc] : null));
    const effectiveLoc = resolvedLoc || (derivedLocIds && derivedLocIds.length > 0 ? derivedLocIds[0] : null);
    const resolvedDept = isFacilityAdmin ? (currentUser?.department_id || userDeptId || null) : (isItAdmin ? null : (userDeptId || null));

    setSavingUser(true);
    setUserModalError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          emp_code: userEmpCode.trim() || null,
          full_name: userName.trim(),
          email: userEmail.trim(),
          phone: userPhone.trim() || null,
          targetRole: resolvedRole,
          location_id: effectiveLoc,
          plant_id: primaryPlantId,
          department_id: resolvedDept,
          sub_department: isItAdmin ? null : (userSubDept.trim() || 'None'),
          can_edit: isItAdmin ? true : userCanEdit,
          location_ids: isItAdmin ? null : (derivedLocIds && derivedLocIds.length > 0 ? derivedLocIds : (effectiveLoc ? [effectiveLoc] : null)),
          plant_ids: effectivePlantIds,
          department_ids: isItAdmin ? null : (resolvedDept ? [resolvedDept] : null),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      setSuccess(`User ${userName} updated successfully`);
      setEditingUser(null);
      setUserModalError(null);
      setTimeout(() => setSuccess(null), 3500);
      fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setUserModalError(msg);
      setError(msg);
      setTimeout(() => setError(null), 3500);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (!isStrictItAdmin) {
      setError('Access Denied: Only IT Administrators can delete users');
      return;
    }

    if (userToDelete.id === currentUser?.id) {
      setError('You cannot delete your own administrative account.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete user "${userToDelete.full_name}" (${userToDelete.email})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users?userId=${userToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      setSuccess(`User ${userToDelete.full_name} has been removed.`);
      setTimeout(() => setSuccess(null), 3500);
      fetchSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
      setTimeout(() => setError(null), 3500);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users;
    const q = userSearchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.emp_code?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, userSearchQuery]);

  const [structureSearchQuery, setStructureSearchQuery] = useState('');

  const filteredLocations = useMemo(() => {
    if (!structureSearchQuery.trim()) return locations;
    const q = structureSearchQuery.toLowerCase().trim();
    return locations.filter((loc) => {
      const locMatch = loc.name.toLowerCase().includes(q) || (loc.code && loc.code.toLowerCase().includes(q));
      const childPlants = plants.filter((p) => p.location_id === loc.id);
      const plantMatch = childPlants.some((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
      const locDepts = departments.filter((d) => childPlants.some((p) => p.id === d.plant_id));
      const deptMatch = locDepts.some((d) => d.name.toLowerCase().includes(q) || (d.sub_department && d.sub_department.toLowerCase().includes(q)));
      return locMatch || plantMatch || deptMatch;
    });
  }, [locations, plants, departments, structureSearchQuery]);

  // ---------------------------------------------------------------------------
  // TAB 2: LOCATION, PLANT & INTEGRATED DEPT STATES & HANDLERS
  // ---------------------------------------------------------------------------
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [savingPlantModal, setSavingPlantModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [addEntityTab, setAddEntityTab] = useState<'location' | 'plant' | 'department' | 'full_flow'>('location');

  // Add Plant & Location Modal inputs
  const [locationMode, setLocationMode] = useState<'existing' | 'new'>('existing');
  const [modalLocationId, setModalLocationId] = useState('');
  const [modalNewLocName, setModalNewLocName] = useState('');
  const [modalNewLocCode, setModalNewLocCode] = useState('');
  const [modalNewLocAddress, setModalNewLocAddress] = useState('');
  const [modalPlantLocId, setModalPlantLocId] = useState('');
  const [modalPlantName, setModalPlantName] = useState('');
  const [modalPlantCode, setModalPlantCode] = useState('');
  const [modalDeptPlantId, setModalDeptPlantId] = useState('');
  const [modalDeptName, setModalDeptName] = useState('');
  const [modalDeptCode, setModalDeptCode] = useState('');
  const [modalSubDept, setModalSubDept] = useState('');

  // Editing items
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [editPlantName, setEditPlantName] = useState('');
  const [editPlantCode, setEditPlantCode] = useState('');

  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocCode, setEditLocCode] = useState('');
  const [editLocAddress, setEditLocAddress] = useState('');

  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editSubDept, setEditSubDept] = useState('');

  const openAddPlantModal = (
    initialTab: 'location' | 'plant' | 'department' | 'full_flow' | React.MouseEvent = 'location',
    targetLocId?: string,
    targetPlantId?: string
  ) => {
    const activeTab = typeof initialTab === 'string' ? initialTab : 'location';
    setAddEntityTab(activeTab);
    setModalError(null);
    setLocationMode(locations.length > 0 ? 'existing' : 'new');

    const selectedLocId = targetLocId || locations[0]?.id || '';
    setModalLocationId(selectedLocId);
    setModalPlantLocId(selectedLocId);

    const validPlants = selectedLocId ? plants.filter((p) => p.location_id === selectedLocId) : plants;
    const selectedPlantId = targetPlantId || validPlants[0]?.id || plants[0]?.id || '';
    setModalDeptPlantId(selectedPlantId);

    setModalNewLocName('');
    setModalNewLocCode('');
    setModalNewLocAddress('');
    setModalPlantName('');
    setModalPlantCode('');
    setModalDeptName('');
    setModalDeptCode('');
    setModalSubDept('');
    setShowAddPlantModal(true);
  };

  const handleSavePlantLocationFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isItRootAdmin) {
      setError('Access Denied: Only Administrators can configure locations and plants');
      return;
    }

    setSavingPlantModal(true);
    setModalError(null);
    try {
      if (addEntityTab === 'location') {
        if (!modalNewLocName.trim()) throw new Error('Location Name is required');
        const code = modalNewLocCode.trim() || `LOC-${modalNewLocName.slice(0, 3).toUpperCase()}`;
        const res = await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: modalNewLocName.trim(),
            code,
            address: modalNewLocAddress.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create location');
        if (data.location) setLocations((prev) => [...prev, data.location]);
        setSuccess(`Location "${modalNewLocName}" created successfully!`);
      } else if (addEntityTab === 'plant') {
        if (!modalPlantLocId) throw new Error('Please select a Location');
        if (!modalPlantName.trim()) throw new Error('Plant Name is required');
        const code = modalPlantCode.trim() || `PLT-${modalPlantName.slice(0, 3).toUpperCase()}`;
        const res = await fetch('/api/plants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location_id: modalPlantLocId,
            name: modalPlantName.trim(),
            code,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create plant');
        if (data.plant) setPlants((prev) => [...prev, data.plant]);
        setSuccess(`Production Plant "${modalPlantName}" created successfully!`);
      } else if (addEntityTab === 'department') {
        if (!modalDeptPlantId) throw new Error('Please select a Production Plant');
        if (!modalDeptName.trim()) throw new Error('Department Name is required');
        const deptCode = `DEPT-${modalDeptName.trim().slice(0, 3).toUpperCase()}`;
        const res = await fetch('/api/settings/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: modalDeptName.trim(),
            code: deptCode,
            plant_id: modalDeptPlantId,
            sub_department: modalSubDept.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create department');
        if (data.department) setDepartments((prev) => [...prev, data.department]);
        setSuccess(`Operating Department "${modalDeptName}" created successfully!`);
      } else {
        // Full Unified Flow
        let resolvedLocId = modalLocationId;
        if (locationMode === 'new') {
          if (!modalNewLocName.trim()) throw new Error('Location Name is required');
          const locRes = await fetch('/api/locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: modalNewLocName.trim(),
              code: modalNewLocCode.trim() || `LOC-${modalNewLocName.slice(0, 3).toUpperCase()}`,
              address: modalNewLocAddress.trim() || null,
            }),
          });
          const locData = await locRes.json();
          if (!locRes.ok) throw new Error(locData.error || 'Failed to create location');
          resolvedLocId = locData.location.id;
          if (locData.location) setLocations((prev) => [...prev, locData.location]);
        }

        if (!resolvedLocId) throw new Error('Please select a Location');
        if (!modalPlantName.trim()) throw new Error('Plant Name is required');

        const plantCode = modalPlantCode.trim() || `PLT-${modalPlantName.slice(0, 3).toUpperCase()}`;
        const plantRes = await fetch('/api/plants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location_id: resolvedLocId,
            name: modalPlantName.trim(),
            code: plantCode,
          }),
        });
        const plantData = await plantRes.json();
        if (!plantRes.ok) throw new Error(plantData.error || 'Failed to create plant');
        const createdPlantId = plantData.plant.id;
        if (plantData.plant) setPlants((prev) => [...prev, plantData.plant]);

        if (modalDeptName.trim()) {
          const deptCode = `DEPT-${modalDeptName.trim().slice(0, 3).toUpperCase()}`;
          const deptRes = await fetch('/api/settings/departments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: modalDeptName.trim(),
              code: deptCode,
              plant_id: createdPlantId,
              sub_department: modalSubDept.trim() || null,
            }),
          });
          const deptData = await deptRes.json();
          if (deptData.department) setDepartments((prev) => [...prev, deptData.department]);
        }
        setSuccess(`Location, Plant "${modalPlantName}", and Operating Department created successfully!`);
      }

      setShowAddPlantModal(false);
      setTimeout(() => setSuccess(null), 3500);
      fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      setModalError(msg);
      setError(msg);
      setTimeout(() => setError(null), 3500);
    } finally {
      setSavingPlantModal(false);
    }
  };

  const handleUpdatePlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlant || !isItRootAdmin) return;
    try {
      const res = await fetch(`/api/plants/${editingPlant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editPlantName.trim(),
          code: editPlantCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update plant');

      setSuccess(`Plant updated to "${editPlantName}"`);
      setEditingPlant(null);
      setTimeout(() => setSuccess(null), 3500);
      fetchSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleDeletePlant = async (plant: Plant) => {
    if (!isItRootAdmin) {
      setError('Access Denied: Only IT Administrators can remove plants');
      return;
    }
    if (!confirm(`Are you sure you want to delete Plant "${plant.name}" (${plant.code})?`)) return;

    // Optimistic instant UI update
    setPlants((prev) => prev.filter((p) => p.id !== plant.id));

    try {
      const res = await fetch(`/api/plants/${plant.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        fetchSettings();
        throw new Error(data.error || 'Failed to delete plant');
      }

      setSuccess(`Plant "${plant.name}" has been removed.`);
      setTimeout(() => setSuccess(null), 3500);
      fetchSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation || !isItRootAdmin) return;
    try {
      const res = await fetch(`/api/locations/${editingLocation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editLocName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update location');

      setSuccess(`Location updated to "${editLocName}"`);
      setEditingLocation(null);
      setTimeout(() => setSuccess(null), 3500);
      fetchSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleDeleteLocation = async (loc: Location) => {
    if (!isItRootAdmin) {
      setError('Access Denied: Only IT Administrators can remove locations');
      return;
    }
    if (!confirm(`Are you sure you want to delete Location "${loc.name}"? All associated plants and departments will also be removed.`)) return;

    // Optimistic instant UI update: remove location immediately from local state
    setLocations((prev) => prev.filter((l) => l.id !== loc.id));

    try {
      const res = await fetch(`/api/locations/${loc.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        fetchSettings();
        throw new Error(data.error || 'Failed to delete location');
      }

      setSuccess(`Location "${loc.name}" has been removed.`);
      setTimeout(() => setSuccess(null), 3500);
      fetchSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept || !isItRootAdmin) return;
    try {
      const res = await fetch('/api/settings/departments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: editingDept.id,
          name: editDeptName.trim(),
          sub_department: editSubDept.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update department');

      setSuccess(`Department updated to "${editDeptName}"`);
      setEditingDept(null);
      setTimeout(() => setSuccess(null), 3500);
      fetchSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleDeleteDepartment = async (dept: Department) => {
    if (!isItRootAdmin) {
      setError('Access Denied: Only IT Administrators can remove departments');
      return;
    }
    if (!confirm(`Are you sure you want to delete Department "${dept.name}"?`)) return;

    // Optimistic instant UI update
    setDepartments((prev) => prev.filter((d) => d.id !== dept.id));

    try {
      const res = await fetch(`/api/settings/departments?departmentId=${dept.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        fetchSettings();
        throw new Error(data.error || 'Failed to delete department');
      }

      setSuccess(`Department "${dept.name}" has been removed.`);
      setTimeout(() => setSuccess(null), 3500);
      fetchSettings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
      setTimeout(() => setError(null), 3500);
    }
  };



  const handleAdminChange = async (deptId: string, adminUserId: string) => {
    if (!isItRootAdmin) {
      setError('Access Denied: Only IT Administrators can assign department lead admins');
      return;
    }
    try {
      const res = await fetch('/api/settings/departments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: deptId, adminUserId }),
      });

      if (res.ok) {
        setSuccess('Department lead admin updated successfully');
        setTimeout(() => setSuccess(null), 3000);
        fetchSettings();
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to update department');
      }
    } catch {
      setError('Request error updating department lead');
    }
  };

  // ---------------------------------------------------------------------------
  // TAB 3: ENTRY FORM CONFIGURATION (PRESERVED AS REQUESTED)
  // ---------------------------------------------------------------------------
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [fields, setFields] = useState<CategoryFormField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDesignerModal, setShowDesignerModal] = useState(false);
  const [newlyAddedFieldId, setNewlyAddedFieldId] = useState<string | null>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCategory) return;
    async function loadFields() {
      setLoadingFields(true);
      try {
        const res = await fetch(`/api/categories/${selectedCategory?.id}/fields`);
        const data = await res.json();
        if (data.fields) setFields(data.fields);
      } catch (err) {
        console.error('Error fetching fields:', err);
      } finally {
        setLoadingFields(false);
      }
    }
    loadFields();
  }, [selectedCategory]);

  const handleToggleRequired = async (field: CategoryFormField) => {
    if (!isStrictItAdmin || !selectedCategory) return;
    setTogglingId(field.id);
    const newRequired = !field.is_required;

    try {
      const res = await fetch(`/api/categories/${selectedCategory.id}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId: field.id,
          updates: { is_required: newRequired },
        }),
      });

      if (res.ok) {
        setFields((prev) =>
          prev.map((f) => (f.id === field.id ? { ...f, is_required: newRequired } : f))
        );
        setSuccess(`Field "${field.field_label}" is now ${newRequired ? 'MANDATORY (* Required)' : 'OPTIONAL'}.`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to update requirement level');
      }
    } catch {
      setError('Network error updating field');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteField = async (fieldId: string, label: string) => {
    if (!isStrictItAdmin || !selectedCategory) return;
    if (!confirm(`Delete field "${label}"?`)) return;

    try {
      const res = await fetch(`/api/categories/${selectedCategory.id}/fields?fieldId=${fieldId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFields((prev) => prev.filter((f) => f.id !== fieldId));
        setSuccess(`Field "${label}" deleted.`);
        setTimeout(() => setSuccess(null), 3500);
      }
    } catch {
      setError('Network error');
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStrictItAdmin || !selectedCategory) return;
    const calculatedName = fieldName.trim()
      ? fieldName.trim().toLowerCase().replace(/\s+/g, '_')
      : fieldLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');

    let parsedOptions: string[] | null = null;
    if (fieldType === 'select') {
      parsedOptions = fieldOptions.split(',').map((s) => s.trim()).filter(Boolean);
    }

    setSavingField(true);
    try {
      const res = await fetch(`/api/categories/${selectedCategory.id}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: calculatedName,
          field_label: fieldLabel.trim(),
          field_type: fieldType,
          options: parsedOptions,
          is_required: fieldRequired,
          placeholder: fieldPlaceholder.trim() || null,
          display_order: fields.length + 1,
        }),
      });

      const data = await res.json();
      if (res.ok && data.field) {
        setFields((prev) => [...prev, data.field]);
        setNewlyAddedFieldId(data.field.id);
        setSuccess(`New field "${fieldLabel}" created and added live to ${selectedCategory.name} template!`);
        setShowAddModal(false);
        setFieldLabel('');
        setFieldName('');
        setFieldOptions('');
        setFieldPlaceholder('');
        setFieldRequired(false);
        setTimeout(() => setSuccess(null), 3500);
      }
    } catch {
      setError('Request failed');
    } finally {
      setSavingField(false);
    }
  };

  // ---------------------------------------------------------------------------
  // TAB 4: BULK EXCEL ASSET IMPORT
  // ---------------------------------------------------------------------------
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRawRows, setImportRawRows] = useState<Record<string, unknown>[]>([]);
  const [importMapping, setImportMapping] = useState<{
    asset_tag: string;
    name: string;
    category: string;
    serial_number: string;
    location: string;
    plant: string;
    department: string;
    purchase_date: string;
    purchase_cost: string;
    po_number: string;
    vendor_name: string;
  }>({
    asset_tag: '',
    name: '',
    category: '',
    serial_number: '',
    location: '',
    plant: '',
    department: '',
    purchase_date: '',
    purchase_cost: '',
    po_number: '',
    vendor_name: '',
  });
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    setBulkImportError(null);
    setImportFile(uploaded);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

        if (!data || data.length < 2) {
          setBulkImportError('The uploaded sheet is empty or contains no data rows.');
          return;
        }

        const rawHeaders = (data[0] || []).map(String);
        setImportHeaders(rawHeaders);

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        setImportRawRows(rows);

        setImportMapping({
          asset_tag: rawHeaders.find((h) => /tag|asset.*id|barcode|asset_tag|asset code/i.test(h)) || '',
          name: rawHeaders.find((h) => /name|title|description|asset_name/i.test(h)) || '',
          category: rawHeaders.find((h) => /cat|category/i.test(h)) || '',
          serial_number: rawHeaders.find((h) => /serial|sn|s\/n/i.test(h)) || '',
          location: rawHeaders.find((h) => /loc|location/i.test(h)) || '',
          plant: rawHeaders.find((h) => /plant|unit/i.test(h)) || '',
          department: rawHeaders.find((h) => /dept|department/i.test(h)) || '',
          purchase_date: rawHeaders.find((h) => /date|purchased/i.test(h)) || '',
          purchase_cost: rawHeaders.find((h) => /cost|price|amount/i.test(h)) || '',
          po_number: rawHeaders.find((h) => /po|po_number|order/i.test(h)) || '',
          vendor_name: rawHeaders.find((h) => /vendor|supplier/i.test(h)) || '',
        });

        setImportStep(2);
      } catch {
        setBulkImportError('Failed to parse Excel workbook. Please upload a valid .xlsx or .csv file.');
      }
    };
    reader.readAsBinaryString(uploaded);
  };

  const executeBulkImport = async () => {
    if (!importMapping.asset_tag || !importMapping.name) {
      setBulkImportError('Asset Tag and Asset Name mappings are required.');
      return;
    }

    setIsImporting(true);
    setBulkImportError(null);

    try {
      const payloadRows = importRawRows.map((r) => ({
        asset_tag: r[importMapping.asset_tag],
        name: r[importMapping.name],
        category: importMapping.category ? r[importMapping.category] : null,
        serial_number: importMapping.serial_number ? r[importMapping.serial_number] : null,
        location: importMapping.location ? r[importMapping.location] : null,
        plant: importMapping.plant ? r[importMapping.plant] : null,
        department: importMapping.department ? r[importMapping.department] : null,
        purchase_date: importMapping.purchase_date ? r[importMapping.purchase_date] : null,
        purchase_cost: importMapping.purchase_cost ? r[importMapping.purchase_cost] : null,
        po_number: importMapping.po_number ? r[importMapping.po_number] : null,
        vendor_name: importMapping.vendor_name ? r[importMapping.vendor_name] : null,
      }));

      const res = await fetch('/api/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payloadRows }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk import failed');

      setImportResult(data.results);
      setImportStep(3);
      setSuccess(`Import completed! ${data.results.imported} assets registered.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setBulkImportError(err instanceof Error ? err.message : 'Error executing bulk import');
    } finally {
      setIsImporting(false);
    }
  };

  const resetBulkImport = () => {
    setImportFile(null);
    setImportHeaders([]);
    setImportRawRows([]);
    setImportStep(1);
    setImportResult(null);
    setBulkImportError(null);
  };

  // ---------------------------------------------------------------------------
  // TAB 5: SECURITY AUDIT STATES & MULTI-DIMENSIONAL FILTERS
  // ---------------------------------------------------------------------------
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditCategory, setAuditCategory] = useState<string>('');
  const [auditRisk, setAuditRisk] = useState<string>('');
  const [auditLocationId, setAuditLocationId] = useState<string>('');
  const [auditPlantId, setAuditPlantId] = useState<string>('');
  const [auditDeptId, setAuditDeptId] = useState<string>('');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditUserId, setAuditUserId] = useState<string>('');
  const [auditFrom, setAuditFrom] = useState<string>('');
  const [auditTo, setAuditTo] = useState<string>('');
  const [auditIncludeHistory, setAuditIncludeHistory] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  const availablePlantsForAudit = useMemo(() => {
    if (!auditLocationId) return plants;
    return plants.filter((p) => p.location_id === auditLocationId);
  }, [plants, auditLocationId]);

  const buildAuditParams = () => {
    const params = new URLSearchParams();
    if (auditCategory) params.set('category', auditCategory);
    if (auditRisk) params.set('risk', auditRisk);
    if (auditLocationId) params.set('locationId', auditLocationId);
    if (auditPlantId) params.set('plantId', auditPlantId);
    if (auditDeptId) params.set('departmentId', auditDeptId);
    if (auditSearch) params.set('search', auditSearch);
    if (auditUserId) params.set('userId', auditUserId);
    if (auditFrom) params.set('from', auditFrom);
    if (auditTo) params.set('to', auditTo);
    if (!auditIncludeHistory) params.set('history', '0');
    return params;
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const params = buildAuditParams();
      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      if (data?.logs) {
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'security_audit') {
      fetchAuditLogs();
    }
  }, [activeTab, auditCategory, auditRisk, auditLocationId, auditPlantId, auditDeptId, auditUserId, auditFrom, auditTo, auditIncludeHistory]);

  const handleExportCsv = () => {
    const params = buildAuditParams();
    params.set('export', 'csv');
    window.open(`/api/audit?${params.toString()}`, '_blank');
  };

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return {
          label: 'Critical',
          className: 'bg-rose-500/10 text-rose-600 border border-rose-200 font-bold',
        };
      case 'warning':
        return {
          label: 'Warning',
          className: 'bg-amber-500/10 text-amber-700 border border-amber-200 font-bold',
        };
      default:
        return {
          label: 'Normal',
          className: 'bg-slate-100 text-slate-500 border border-slate-200',
        };
    }
  };

  // Restrict standard users from accessing settings
  if (currentUser && currentUser.role === 'user') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              You do not have administrative permission to view or configure system settings. If you need elevated access, please contact your IT Administrator.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 antialiased font-sans max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            {isFacilityAdmin ? (
              <>
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>Facility User Management</span>
              </>
            ) : (
              <>
                <Settings className="w-5 h-5 text-blue-600" />
                <span>Settings &amp; Administration Hub</span>
              </>
            )}
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.2">
            {isFacilityAdmin
              ? 'Create and manage authorized floor users for your assigned plant and operating department'
              : 'Manage system users, physical plants & locations, custom form fields, and audit logs'}
          </p>
        </div>

        {/* Centralized Navigation Tabs */}
        <div className="bg-slate-50 p-0.5 rounded-xl border border-slate-200/80 flex items-center gap-0.5 overflow-x-auto">
          <button
            onClick={() => switchTab('users')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>User Management</span>
          </button>

          {isStrictItAdmin && (
            <>
              <button
                onClick={() => switchTab('location_plant')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'location_plant'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Plant or Location</span>
              </button>

              <button
                onClick={() => switchTab('entry_form')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'entry_form'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Entry Form</span>
              </button>

              <button
                onClick={() => switchTab('bulk_import')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'bulk_import'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Bulk Excel Import</span>
              </button>

              <button
                onClick={() => switchTab('security_audit')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'security_audit'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Security Audit</span>
              </button>

              <button
                onClick={() => switchTab('smart_mail')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'smart_mail'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Smart Mail</span>
              </button>
            </>
          )}
        </div>
      </div>

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

      {activeTab === 'smart_mail' && isStrictItAdmin && <SmartMailModule locations={locations} plants={plants} />}

      {/* ========================================================================= */}
      {/* TAB 1: USER MANAGEMENT                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header Toolbar */}
            <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>User Directory &amp; Governance</span>
                  {isFacilityAdmin && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      Facility Scope: Your Department Only
                    </span>
                  )}
                  {!canManageUsers && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      View-Only
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {isFacilityAdmin
                    ? 'Authorized user accounts for your assigned facility and department'
                    : 'Role assignments (IT ADMIN, ADMIN, USER) with location, plant, department & sub-dept boundaries'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search name, emp code, mail..."
                    className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white w-48 sm:w-56 font-medium"
                  />
                </div>

                {canManageUsers ? (
                  <button
                    type="button"
                    onClick={openAddUserModal}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Register New User</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 italic bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    Registration reserved for Administrators
                  </span>
                )}
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Emp Code</th>
                    <th className="px-3.5 py-2.5">User Identity &amp; Mail</th>
                    <th className="px-3.5 py-2.5">Assigned Role</th>
                    <th className="px-3.5 py-2.5">Location &amp; Plant</th>
                    <th className="px-3.5 py-2.5">Department &amp; Sub Dept</th>
                    <th className="px-3.5 py-2.5">Mode</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No users found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const userLoc = locations.find((l) => l.id === u.location_id);
                      const userPlt = plants.find((p) => p.id === u.plant_id);
                      const userDept = departments.find((d) => d.id === u.department_id);

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600">
                            {u.emp_code || <span className="text-slate-300 font-normal">PG-NONE</span>}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="font-bold text-slate-900">{u.full_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold border uppercase ${
                                u.role === 'it_admin'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : u.role === 'admin'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {u.role === 'it_admin' ? 'IT ADMIN' : u.role === 'admin' ? 'ADMIN' : 'USER'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            {u.role === 'it_admin' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                  <ShieldCheck className="w-3 h-3 text-blue-600" /> All Locations &amp; Plants
                                </span>
                                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Enterprise Scope</div>
                              </div>
                            ) : (
                              <>
                                <div className="font-semibold text-slate-800">
                                  {userLoc?.name || (u.scope?.location_ids?.length ? `${u.scope.location_ids.length} Location(s)` : 'All Locations')}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {u.scope?.plant_ids && u.scope.plant_ids.length > 1 ? (
                                    <span
                                      className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[10px]"
                                      title={plants.filter((p) => u.scope?.plant_ids?.includes(p.id)).map((p) => p.name).join(', ')}
                                    >
                                      {u.scope.plant_ids.length} Plants: {plants.filter((p) => u.scope?.plant_ids?.includes(p.id)).map((p) => p.code || p.name).join(', ')}
                                    </span>
                                  ) : (
                                    userPlt?.name || 'All Plants'
                                  )}
                                </div>
                              </>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {u.role === 'it_admin' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                  <Check className="w-3 h-3 text-blue-600" /> All Departments
                                </span>
                                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Global Access</div>
                              </div>
                            ) : (
                              <>
                                <div className="font-semibold text-slate-800">
                                  {userDept?.name || (u.scope?.department_ids?.length ? `${u.scope.department_ids.length} Dept(s)` : 'All Departments')}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Sub: {u.sub_department || 'None'}
                                </div>
                              </>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {u.role === 'it_admin' ? (
                              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                Full Admin Access
                              </span>
                            ) : u.scope?.can_edit === false ? (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200">
                                View Only
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                Full Edit
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canManageUsers ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditUserModal(u)}
                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 font-bold transition-all cursor-pointer shadow-2xs"
                                    title="Edit User Details"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  {isStrictItAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u)}
                                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 font-bold transition-all cursor-pointer shadow-2xs"
                                      title="Delete User Account"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Locked</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LOCATION & PLANT (WITH INTEGRATED DEPARTMENTS DIRECTORY TABLE)     */}
      {/* ========================================================================= */}
      {activeTab === 'location_plant' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header Toolbar */}
            <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Location &amp; Plant Governance</span>
                  {!isItRootAdmin && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      View-Only (IT Admin writes only)
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Hierarchical structure: Locations → Plants → Department &amp; Sub Dept
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={structureSearchQuery}
                    onChange={(e) => setStructureSearchQuery(e.target.value)}
                    placeholder="Search location, plant, dept..."
                    className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white w-48 sm:w-56 font-medium"
                  />
                </div>

                {isItRootAdmin ? (
                  <button
                    type="button"
                    onClick={() => openAddPlantModal('location')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Location / Plant / Dept</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 italic bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    Configuration reserved for IT Admin
                  </span>
                )}
              </div>
            </div>

            {/* Location & Plant Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">Location Name</th>
                    <th className="px-4 py-3.5">Plants</th>
                    <th className="px-4 py-3.5">Department &amp; Sub Dept</th>
                    <th className="px-4 py-3.5">Capacity</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLocations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No locations found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredLocations.map((loc) => {
                      const childPlants = plants.filter((p) => p.location_id === loc.id);
                      const locDepts = departments.filter((d) => !d.plant_id || childPlants.some((p) => p.id === d.plant_id));

                      return (
                        <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* LOCATION NAME */}
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-start gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                <MapPin className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 text-xs">{loc.name}</div>
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono font-bold uppercase">
                                  LOCATION
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* PRODUCTION PLANTS */}
                          <td className="px-4 py-4 align-top">
                            {childPlants.length === 0 ? (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 italic text-[11px]">No plants attached</span>
                                {isItRootAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => openAddPlantModal('plant', loc.id)}
                                    className="text-blue-600 hover:text-blue-800 text-[11px] font-bold cursor-pointer underline"
                                  >
                                    + Add Plant
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {childPlants.map((plant) => (
                                  <div key={plant.id} className="flex items-center justify-between bg-slate-50/90 border border-slate-200/80 p-2 rounded-lg">
                                    <div className="flex items-center gap-1.5">
                                      <Building className="w-3.5 h-3.5 text-slate-500" />
                                      <span className="font-bold text-slate-900">{plant.name}</span>
                                      <span className="font-mono text-[9px] bg-slate-200/80 text-slate-700 px-1 py-0.2 rounded font-bold">
                                        {plant.code}
                                      </span>
                                    </div>
                                    {isItRootAdmin && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => openAddPlantModal('department', loc.id, plant.id)}
                                          className="text-[10px] font-bold text-blue-600 hover:bg-blue-100 bg-blue-50 px-1.5 py-0.5 rounded transition-all cursor-pointer border border-blue-200"
                                          title="Add Department under Plant"
                                        >
                                          + Dept
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingPlant(plant);
                                            setEditPlantName(plant.name);
                                            setEditPlantCode(plant.code);
                                          }}
                                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                          title="Edit Plant"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeletePlant(plant)}
                                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                          title="Delete Plant"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* DEPARTMENTS & SUB DEPTS */}
                          <td className="px-4 py-4 align-top">
                            {childPlants.length === 0 ? (
                              <span className="text-slate-300">—</span>
                            ) : locDepts.length === 0 ? (
                              <span className="text-slate-400 italic text-[11px]">No departments configured</span>
                            ) : (
                              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                {locDepts.map((d) => {
                                  const parentPlant = childPlants.find((p) => p.id === d.plant_id);
                                  return (
                                    <div key={d.id} className="flex items-center justify-between bg-slate-50 border border-slate-200/60 p-1.5 rounded-md">
                                      <div>
                                        <div className="font-bold text-slate-800 text-[11px]">
                                          {d.name} <span className="text-[9px] font-normal text-slate-400">({parentPlant ? parentPlant.name : 'Corporate / Global'})</span>
                                        </div>
                                        {d.sub_department && (
                                          <span className="inline-block text-[9px] bg-slate-200/60 text-slate-600 px-1 rounded font-medium">
                                            Sub: {d.sub_department}
                                          </span>
                                        )}
                                      </div>
                                      {isItRootAdmin && (
                                        <div className="flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingDept(d);
                                              setEditDeptName(d.name);
                                              setEditSubDept(d.sub_department || '');
                                            }}
                                            className="text-slate-400 hover:text-blue-600 cursor-pointer p-0.5"
                                            title="Edit Department"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteDepartment(d)}
                                            className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                                            title="Delete Department"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* CAPACITY BADGES */}
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-700">
                                <Building className="w-3 h-3" />
                                {childPlants.length} Plant(s)
                              </span>
                              <br />
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-700">
                                <ShieldCheck className="w-3 h-3" />
                                {locDepts.length} Dept(s)
                              </span>
                            </div>
                          </td>

                          {/* ACTIONS */}
                          <td className="px-4 py-4 text-right align-top">
                            <div className="flex items-center justify-end gap-1.5">
                              {isItRootAdmin ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingLocation(loc);
                                      setEditLocName(loc.name);
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 font-bold transition-all cursor-pointer shadow-2xs"
                                    title="Edit Location"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLocation(loc)}
                                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 font-bold transition-all cursor-pointer shadow-2xs"
                                    title="Delete Location"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">View Only</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ENTRY FORM (KEPT READY FOR CONVERSATION)                           */}
      {/* ========================================================================= */}
      {activeTab === 'entry_form' && (
        <div className="space-y-5">
          {isStrictItAdmin && <CategoryRepairCard />}
          {!isStrictItAdmin && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Read-Only Mode: IT Administrator Access Required
                </h3>
                <p className="text-xs text-amber-700 mt-1">
                  Only users with the exact <span className="font-bold">IT Admin (`it_admin`)</span> role can add new fields, edit dropdown options, or toggle mandatory requirements for department entry forms. General admins have view-only access.
                </p>
              </div>
            </div>
          )}

          {/* Master Form Customizer Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex-1 max-w-md">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Department
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCategory?.id || ''}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value);
                      if (cat) setSelectedCategory(cat);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer uppercase"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                <button
                  type="button"
                  disabled={!isStrictItAdmin}
                  onClick={() => setShowDesignerModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Custom Field (Design Entry Form)</span>
                </button>
              </div>
            </div>

            <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-slate-700">
                  Customizing entry form fields for: <span className="font-bold text-blue-900">{selectedCategory?.name}</span> ({fields.length} dynamic fields configured)
                </span>
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Live sync with Step 2 of Asset Registration Wizard
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Field Label &amp; Database Key</th>
                    <th className="px-4 py-3">Input Type</th>
                    <th className="px-4 py-3">Placeholder / Options</th>
                    <th className="px-4 py-3 text-center">Requirement Level</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingFields ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        Loading form configuration...
                      </td>
                    </tr>
                  ) : fields.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No custom fields configured for this department yet. Click <strong>+ Add Custom Field</strong> above.
                      </td>
                    </tr>
                  ) : (
                    fields.map((f, idx) => (
                      <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">{f.field_label}</div>
                          <div className="font-mono text-[10px] text-slate-400">{f.field_name}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] uppercase font-bold border border-slate-200">
                            {f.field_type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate">
                          {f.options && f.options.length > 0 ? (
                            <span className="text-[11px]">Options: {f.options.join(', ')}</span>
                          ) : f.placeholder ? (
                            <span className="italic text-[11px] text-slate-400">"{f.placeholder}"</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            disabled={!isStrictItAdmin || togglingId === f.id}
                            onClick={() => handleToggleRequired(f)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                              f.is_required
                                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {togglingId === f.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin inline mr-1" />
                            ) : f.is_required ? (
                              <span className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                                Mandatory (* Required)
                              </span>
                            ) : (
                              <span>Optional</span>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            disabled={!isStrictItAdmin}
                            onClick={() => handleDeleteField(f.id, f.field_label)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Delete Field"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: BULK EXCEL ASSET IMPORT                                            */}
      {/* ========================================================================= */}
      {activeTab === 'bulk_import' && (
        <div className="space-y-4">
          {bulkImportError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold">{bulkImportError}</span>
            </div>
          )}

          {importStep === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h2 className="text-base font-bold text-slate-900 mb-1">
                  Upload Excel (.xlsx, .xls) or CSV File
                </h2>
                <p className="text-xs text-slate-500">
                  Bulk ingest legacy enterprise inventories, vendor dispatches, SAP asset exports, or audit lists. Columns will be automatically matched.
                </p>
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer">
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
            </div>
          )}

          {importStep === 2 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Map Spreadsheet Columns to Database Schema
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Found <strong>{importRawRows.length}</strong> records in <span className="font-mono text-blue-600 font-semibold">{importFile?.name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetBulkImport}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer underline"
                >
                  Upload Different File
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetBulkImport}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isImporting || !importMapping.asset_tag || !importMapping.name}
                  onClick={executeBulkImport}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isImporting ? 'Ingesting Assets...' : `Import ${importRawRows.length} Assets`}</span>
                </button>
              </div>
            </div>
          )}

          {importStep === 3 && importResult && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Batch Ingestion Completed</h2>
              <p className="text-xs text-slate-600">
                Successfully committed <span className="text-emerald-600 font-bold">{importResult.imported}</span> assets to the enterprise registry.
              </p>
              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={resetBulkImport}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Import Another File
                </button>
                <a
                  href="/assets"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <span>View in Asset Directory</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SECURITY AUDIT (MULTI-DIMENSIONAL FILTERS & DEEP TRACKING)         */}
      {/* ========================================================================= */}
      {activeTab === 'security_audit' && (
        <div className="space-y-4">
          {/* Master Multi-Dimensional Filter Bar (Compact) */}
          <div className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700 flex items-center gap-1 shrink-0 text-xs mr-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>Audit Filters:</span>
              </span>

              {/* Location Filter */}
              <select
                value={auditLocationId}
                onChange={(e) => {
                  setAuditLocationId(e.target.value);
                  setAuditPlantId('');
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>

              {/* Plant Filter */}
              <select
                value={auditPlantId}
                onChange={(e) => setAuditPlantId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Plants</option>
                {availablePlantsForAudit.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Department Filter */}
              <select
                value={auditDeptId}
                onChange={(e) => setAuditDeptId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* User Filter */}
              <select
                value={auditUserId}
                onChange={(e) => setAuditUserId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 cursor-pointer max-w-48"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </option>
                ))}
              </select>

              {/* Operation Type Filter */}
              <select
                value={auditCategory}
                onChange={(e) => setAuditCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Operations</option>
                <option value="session">Login / Logout</option>
                <option value="data_change">Data Changes</option>
              </select>

              {/* Date Range */}
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                From
                <input
                  type="date"
                  value={auditFrom}
                  onChange={(e) => setAuditFrom(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </label>
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                To
                <input
                  type="date"
                  value={auditTo}
                  onChange={(e) => setAuditTo(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </label>

              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={auditIncludeHistory}
                  onChange={(e) => setAuditIncludeHistory(e.target.checked)}
                  className="accent-blue-600"
                />
                Include old entries
              </label>

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAuditLogs()}
                  placeholder="Asset tag, Emp ID, Action, IP..."
                  className="w-44 pl-2.5 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
                />
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Audit Trail Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 uppercase tracking-wider">
                Full Immutable Activity Trail ({auditLogs.length} Events Logged)
              </span>
              <span className="text-[11px] text-slate-400">
                Every login, entry, edit, assignment &amp; deletion — with user, date &amp; time. &quot;Old entry&quot; = created before audit logging.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User &amp; Emp ID</th>
                    <th className="px-4 py-3">Operation / Action</th>
                    <th className="px-4 py-3">Location &amp; Plant</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3">Session / Target</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                  {loadingAudit ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        Fetching live security audit trail...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No audit events match your selected filters.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const risk = getRiskBadge(log.risk_level);
                      const isLogin = log.action.includes('LOGIN');
                      const isDelete = log.action.includes('DELETE');

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                            {formatDateTime(log.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">
                              {auditActorLabel(log)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {[log.user?.email, log.emp_code || log.user?.emp_code].filter(Boolean).join(' · ') || 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-md">
                            <div className="text-[12px] font-semibold text-slate-800 mb-1 break-words">
                              {describeAuditLog(log)}
                              {isHistoricalLog(log) && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold uppercase align-middle">
                                  Old entry
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-extrabold uppercase border ${
                                isLogin
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isDelete
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">
                              {log.location_name || 'Location HQ'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {log.plant_name || log.department_name || 'General System'}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                            {log.ip_address || '127.0.0.1'}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-500">
                            <div>{log.session_duration ? `Active: ${log.session_duration}` : (log.target_table ? `Table: ${log.target_table}` : 'Session')}</div>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] ${risk.className}`}>
                              {risk.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedAuditLog(log)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-blue-600 cursor-pointer shadow-2xs"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 1: REGISTER NEW USER (IT ADMIN STRICT)                        */}
      {/* ========================================================================= */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-black text-slate-900">Register System User</h3>
                  <p className="text-xs text-slate-500">Add credentials, employee ID, and plant/department scopes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            {userModalError && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-semibold">{userModalError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterUser} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employee ID <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={userEmpCode}
                    onChange={(e) => setUserEmpCode(e.target.value)}
                    placeholder="e.g. PG-1049 (optional)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mail ID *
                  </label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="e.g. user@pgel.in"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Role *
                  </label>
                  {isFacilityAdmin ? (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                        <span>USER</span>
                      </div>
                      <span className="text-[9px] bg-blue-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">Locked</span>
                    </div>
                  ) : (
                    <select
                      value={userRole}
                      onChange={(e) => {
                        const newRole = e.target.value as any;
                        setUserRole(newRole);
                        if (newRole === 'it_admin') {
                          setUserLocationId('');
                          setUserPlantId('');
                          setUserDeptId('');
                          setUserSubDept('');
                          setUserCanEdit(true);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="it_admin">IT ADMIN</option>
                      <option value="admin">ADMIN</option>
                      <option value="user">USER</option>
                    </select>
                  )}
                </div>
              </div>

              {isFacilityAdmin ? (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-blue-600" />
                      <span>Assigned Facility &amp; Department Scope</span>
                    </span>
                    <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded uppercase">Your Facility</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Location</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {locations.find((l) => l.id === userLocationId)?.name || 'Facility Location'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Plant</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {plants.find((p) => p.id === userPlantId)?.name || 'Production Plant'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Department</span>
                      <span className="font-bold text-blue-700 truncate block">
                        {departments.find((d) => d.id === userDeptId)?.name || 'Operating Dept'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Sub Department (Optional)
                    </label>
                    <input
                      type="text"
                      value={userSubDept}
                      onChange={(e) => setUserSubDept(e.target.value)}
                      placeholder="e.g. Line 1, Shift B, or None"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>
              ) : userRole === 'it_admin' ? (
                <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl flex items-start gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg text-white shadow-xs shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                        Automatic Global Access (Enterprise-Wide)
                      </h4>
                      <span className="text-[9px] bg-blue-600 text-white font-extrabold px-1.5 py-0.2 rounded uppercase">
                        Unrestricted
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed mt-1 font-medium">
                      <strong>IT Admin</strong> automatically has full unrestricted access to <strong>all Locations, all Production Plants, and all Departments</strong> across PG Electroplast. Specific Location, Plant, or Department assignment is not required.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Location (Filter)
                      </label>
                      <select
                        value={userLocationId}
                        onChange={(e) => {
                          setUserLocationId(e.target.value);
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">-- All Locations / Any --</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} ({loc.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Department *
                      </label>
                      <select
                        required
                        value={userDeptId}
                        onChange={(e) => setUserDeptId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">-- Select Department --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sub Department (or "None")
                    </label>
                    <input
                      type="text"
                      value={userSubDept}
                      onChange={(e) => setUserSubDept(e.target.value)}
                      placeholder="e.g. Line 3 or None"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-blue-600" />
                        <span>Assigned Production Plant(s) *</span>
                        {userPlantIds.length > 0 && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                            {userPlantIds.length} Selected
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = availablePlantsForUser.map((p) => p.id);
                            setUserPlantIds(allIds);
                            if (allIds.length > 0) setUserPlantId(allIds[0]);
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300 text-xs">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUserPlantIds([]);
                            setUserPlantId('');
                          }}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/70 max-h-44 overflow-y-auto">
                      {availablePlantsForUser.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">
                          No plants found for this selection.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          {availablePlantsForUser.map((p) => {
                            const isChecked = userPlantIds.includes(p.id) || userPlantId === p.id;
                            const plantLoc = locations.find((l) => l.id === p.location_id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  let next: string[];
                                  if (isChecked) {
                                    next = userPlantIds.filter((id) => id !== p.id);
                                    if (userPlantId === p.id) {
                                      setUserPlantId(next[0] || '');
                                    }
                                  } else {
                                    next = [...userPlantIds.filter((id) => id !== p.id), p.id];
                                    if (!userPlantId) setUserPlantId(p.id);
                                  }
                                  setUserPlantIds(next);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition border cursor-pointer ${
                                  isChecked
                                    ? 'bg-blue-50 border-blue-400 text-blue-900 font-medium shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition ${
                                    isChecked
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isChecked && (
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  )}
                                </div>
                                <div className="truncate min-w-0">
                                  <div className="truncate font-semibold text-xs leading-tight">
                                    {p.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {p.code} {plantLoc && !userLocationId ? `• ${plantLoc.name}` : ''}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {userPlantIds.length === 0 && (
                      <p className="text-[11px] text-amber-600 font-medium">
                        * Please select at least one plant. For multi-plant admin, select all plants they manage.
                      </p>
                    )}
                  </div>
                </>
              )}

              {userRole !== 'it_admin' && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userCanEdit}
                      onChange={(e) => setUserCanEdit(e.target.checked)}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Permission Mode: Full Edit Access Allowed</span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingUser ? 'Saving...' : 'Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 2: EDIT USER ACCOUNT & SCOPES (IT ADMIN STRICT)               */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Edit User &amp; Scopes: {editingUser.full_name}
                </h3>
                <p className="text-xs text-slate-500">{editingUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            {userModalError && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-semibold">{userModalError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={userEmpCode}
                    onChange={(e) => setUserEmpCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mail ID *
                  </label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Role
                  </label>
                  {isFacilityAdmin ? (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                        <span>USER</span>
                      </div>
                      <span className="text-[9px] bg-blue-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">Locked</span>
                    </div>
                  ) : (
                    <select
                      value={userRole}
                      onChange={(e) => {
                        const newRole = e.target.value as any;
                        setUserRole(newRole);
                        if (newRole === 'it_admin') {
                          setUserLocationId('');
                          setUserPlantId('');
                          setUserDeptId('');
                          setUserSubDept('');
                          setUserCanEdit(true);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="it_admin">IT ADMIN</option>
                      <option value="admin">ADMIN</option>
                      <option value="user">USER</option>
                    </select>
                  )}
                </div>
              </div>

              {isFacilityAdmin ? (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-blue-600" />
                      <span>Assigned Facility &amp; Department Scope</span>
                    </span>
                    <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded uppercase">Your Facility</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Location</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {locations.find((l) => l.id === userLocationId)?.name || 'Facility Location'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Plant</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {plants.find((p) => p.id === userPlantId)?.name || 'Production Plant'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Department</span>
                      <span className="font-bold text-blue-700 truncate block">
                        {departments.find((d) => d.id === userDeptId)?.name || 'Operating Dept'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Sub Department
                    </label>
                    <input
                      type="text"
                      value={userSubDept}
                      onChange={(e) => setUserSubDept(e.target.value)}
                      placeholder="e.g. Line 1, Shift B, or None"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>
              ) : userRole === 'it_admin' ? (
                <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl flex items-start gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg text-white shadow-xs shrink-0 mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                        Automatic Global Access (Enterprise-Wide)
                      </h4>
                      <span className="text-[9px] bg-blue-600 text-white font-extrabold px-1.5 py-0.2 rounded uppercase">
                        Unrestricted
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed mt-1 font-medium">
                      <strong>IT Admin</strong> automatically has full unrestricted access to <strong>all Locations, all Production Plants, and all Departments</strong> across PG Electroplast. Specific Location, Plant, or Department assignment is not required.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Location (Filter)
                      </label>
                      <select
                        value={userLocationId}
                        onChange={(e) => {
                          setUserLocationId(e.target.value);
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">-- All Locations / Any --</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Department
                      </label>
                      <select
                        value={userDeptId}
                        onChange={(e) => setUserDeptId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">-- All / Unrestricted --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sub Department
                    </label>
                    <input
                      type="text"
                      value={userSubDept}
                      onChange={(e) => setUserSubDept(e.target.value)}
                      placeholder="e.g. None"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-blue-600" />
                        <span>Assigned Production Plant(s)</span>
                        {userPlantIds.length > 0 && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                            {userPlantIds.length} Selected
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = availablePlantsForUser.map((p) => p.id);
                            setUserPlantIds(allIds);
                            if (allIds.length > 0) setUserPlantId(allIds[0]);
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300 text-xs">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUserPlantIds([]);
                            setUserPlantId('');
                          }}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/70 max-h-44 overflow-y-auto">
                      {availablePlantsForUser.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">
                          No plants found for this selection.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          {availablePlantsForUser.map((p) => {
                            const isChecked = userPlantIds.includes(p.id) || userPlantId === p.id;
                            const plantLoc = locations.find((l) => l.id === p.location_id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  let next: string[];
                                  if (isChecked) {
                                    next = userPlantIds.filter((id) => id !== p.id);
                                    if (userPlantId === p.id) {
                                      setUserPlantId(next[0] || '');
                                    }
                                  } else {
                                    next = [...userPlantIds.filter((id) => id !== p.id), p.id];
                                    if (!userPlantId) setUserPlantId(p.id);
                                  }
                                  setUserPlantIds(next);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition border cursor-pointer ${
                                  isChecked
                                    ? 'bg-blue-50 border-blue-400 text-blue-900 font-medium shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition ${
                                    isChecked
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isChecked && (
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  )}
                                </div>
                                <div className="truncate min-w-0">
                                  <div className="truncate font-semibold text-xs leading-tight">
                                    {p.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {p.code} {plantLoc && !userLocationId ? `• ${plantLoc.name}` : ''}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {userPlantIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {plants
                          .filter((p) => userPlantIds.includes(p.id))
                          .map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-medium"
                            >
                              {p.name}
                              <button
                                type="button"
                                onClick={() => {
                                  const next = userPlantIds.filter((id) => id !== p.id);
                                  setUserPlantIds(next);
                                  if (userPlantId === p.id) setUserPlantId(next[0] || '');
                                }}
                                className="hover:text-red-500 cursor-pointer ml-0.5"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {userRole !== 'it_admin' && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userCanEdit}
                      onChange={(e) => setUserCanEdit(e.target.checked)}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Permission Mode: Full Edit Access Allowed</span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingUser ? 'Updating...' : 'Save User Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 3: ADD PLANT / LOCATION / DEPARTMENT                         */}
      {/* ========================================================================= */}
      {showAddPlantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Add Entity</h3>
                  <p className="text-xs text-slate-500">
                    Add new Location, Production Plant, or Operating Department
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPlantModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Alert Error if any */}
            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Selection Tabs: 3 Individual Options + Full Flow */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setAddEntityTab('location')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  addEntityTab === 'location'
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>1. Location</span>
              </button>

              <button
                type="button"
                onClick={() => setAddEntityTab('plant')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  addEntityTab === 'plant'
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>2. Plant</span>
              </button>

              <button
                type="button"
                onClick={() => setAddEntityTab('department')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  addEntityTab === 'department'
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>3. Dept</span>
              </button>

              <button
                type="button"
                onClick={() => setAddEntityTab('full_flow')}
                className={`py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  addEntityTab === 'full_flow'
                    ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>⚡ Full Flow</span>
              </button>
            </div>

            <form onSubmit={handleSavePlantLocationFlow} className="space-y-4">
              {/* MODE 1: LOCATION ONLY */}
              {addEntityTab === 'location' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>Add New Location</span>
                  </span>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Location Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={modalNewLocName}
                      onChange={(e) => setModalNewLocName(e.target.value)}
                      placeholder="e.g. Pune"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* MODE 2: PLANT ONLY */}
              {addEntityTab === 'plant' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-blue-600" />
                    <span>Add New Production Plant</span>
                  </span>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Select Parent Location *
                    </label>
                    <select
                      value={modalPlantLocId}
                      onChange={(e) => setModalPlantLocId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Plant Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={modalPlantName}
                        onChange={(e) => {
                          setModalPlantName(e.target.value);
                          if (!modalPlantCode) {
                            setModalPlantCode(`PLT-${e.target.value.slice(0, 3).toUpperCase()}`);
                          }
                        }}
                        placeholder="e.g. Molding Plant 4"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Plant Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={modalPlantCode}
                        onChange={(e) => setModalPlantCode(e.target.value)}
                        placeholder="e.g. PLT-MP4"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 3: DEPARTMENT ONLY */}
              {addEntityTab === 'department' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Add Operating Department</span>
                  </span>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Select Parent Production Plant *
                    </label>
                    <select
                      value={modalDeptPlantId}
                      onChange={(e) => setModalDeptPlantId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {plants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Department Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={modalDeptName}
                      onChange={(e) => setModalDeptName(e.target.value)}
                      placeholder="e.g. Quality Assurance / Maintenance / IT"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sub-Department (Optional)
                    </label>
                    <input
                      type="text"
                      value={modalSubDept}
                      onChange={(e) => setModalSubDept(e.target.value)}
                      placeholder="e.g. Line 2, Calibration, or Hardware"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* MODE 4: FULL UNIFIED FLOW */}
              {addEntityTab === 'full_flow' && (
                <div className="space-y-3">
                  {/* STEP 1: LOCATION */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>Step 1: Location</span>
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <label className="flex items-center gap-1 text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="locMode"
                            checked={locationMode === 'existing'}
                            onChange={() => setLocationMode('existing')}
                            className="text-blue-600 focus:ring-0"
                          />
                          <span>Select Existing</span>
                        </label>
                        <label className="flex items-center gap-1 text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="locMode"
                            checked={locationMode === 'new'}
                            onChange={() => setLocationMode('new')}
                            className="text-blue-600 focus:ring-0"
                          />
                          <span>+ Create New</span>
                        </label>
                      </div>
                    </div>

                    {locationMode === 'existing' ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Choose Location *
                        </label>
                        <select
                          value={modalLocationId}
                          onChange={(e) => setModalLocationId(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name} ({loc.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          New Location Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={modalNewLocName}
                          onChange={(e) => setModalNewLocName(e.target.value)}
                          placeholder="e.g. Pune"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* STEP 2: PLANT DETAILS */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-blue-600" />
                      <span>Step 2: Plant Information</span>
                    </span>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Plant Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={modalPlantName}
                          onChange={(e) => {
                            setModalPlantName(e.target.value);
                            if (!modalPlantCode) {
                              setModalPlantCode(`PLT-${e.target.value.slice(0, 3).toUpperCase()}`);
                            }
                          }}
                          placeholder="e.g. PGEL"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Plant Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={modalPlantCode}
                          onChange={(e) => setModalPlantCode(e.target.value)}
                          placeholder="e.g. PLT-U3"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* STEP 3: INTEGRATED DEPARTMENT & SUB-DEPT */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Step 3: Operating Department &amp; Sub-Department</span>
                    </span>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Department Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={modalDeptName}
                        onChange={(e) => setModalDeptName(e.target.value)}
                        placeholder="e.g. Information Technology"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sub-Department (Optional)
                      </label>
                      <input
                        type="text"
                        value={modalSubDept}
                        onChange={(e) => setModalSubDept(e.target.value)}
                        placeholder="e.g. Server Room, Line 3, or None"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPlantModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlantModal}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingPlantModal
                    ? 'Saving...'
                    : addEntityTab === 'location'
                    ? '+ Add Location'
                    : addEntityTab === 'plant'
                    ? '+ Add Plant'
                    : addEntityTab === 'department'
                    ? '+ Add Department'
                    : 'Save Full Hierarchy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 4: EDIT PLANT (IT ADMIN ONLY)                                  */}
      {/* ========================================================================= */}
      {editingPlant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Edit Plant</h3>
              <button
                type="button"
                onClick={() => setEditingPlant(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePlant} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Plant Name *
                </label>
                <input
                  type="text"
                  required
                  value={editPlantName}
                  onChange={(e) => setEditPlantName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Plant Code *
                </label>
                <input
                  type="text"
                  required
                  value={editPlantCode}
                  onChange={(e) => setEditPlantCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPlant(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Update Plant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 5: EDIT LOCATION (IT ADMIN ONLY)                               */}
      {/* ========================================================================= */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Edit Location</h3>
              <button
                type="button"
                onClick={() => setEditingLocation(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateLocation} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  required
                  value={editLocName}
                  onChange={(e) => setEditLocName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLocation(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Update Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 6: EDIT DEPARTMENT (IT ADMIN ONLY)                            */}
      {/* ========================================================================= */}
      {editingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Edit Department</h3>
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateDepartment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={editDeptName}
                  onChange={(e) => setEditDeptName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sub-Department (Optional)
                </label>
                <input
                  type="text"
                  value={editSubDept}
                  onChange={(e) => setEditSubDept(e.target.value)}
                  placeholder="e.g. Server Room, Line 3, or None"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Update Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 6: AUDIT LOG INSPECT DETAILS                                   */}
      {/* ========================================================================= */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>Audit Event: {selectedAuditLog.action}</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {formatDateTime(selectedAuditLog.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Actor</span>
                  <span className="font-bold text-slate-800">
                    {selectedAuditLog.user?.full_name || 'System Actor'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Emp Code / Email</span>
                  <span className="font-mono text-slate-700">
                    {selectedAuditLog.emp_code || selectedAuditLog.user?.emp_code || selectedAuditLog.user?.email || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Role</span>
                  <span className="font-mono font-bold text-blue-700 uppercase">
                    {selectedAuditLog.user_role}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">IP Address</span>
                  <span className="font-mono text-slate-700">
                    {selectedAuditLog.ip_address || '127.0.0.1'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                  Change Payload / Mutation Diff
                </span>
                <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-48">
                  {JSON.stringify(selectedAuditLog.changes || { note: 'No data payload modifications attached' }, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 7: ADD CUSTOM FIELD MODAL (IT ADMIN ONLY)                     */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Add Custom Field to {selectedCategory?.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Define a new technical attribute and set whether it is mandatory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddField} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Field Label *
                </label>
                <input
                  type="text"
                  required
                  value={fieldLabel}
                  onChange={(e) => {
                    setFieldLabel(e.target.value);
                    if (!fieldName) {
                      setFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    }
                  }}
                  placeholder="e.g. Tank Capacity (Liters)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Database Field Name (Auto-Generated)
                </label>
                <input
                  type="text"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="e.g. tank_capacity_liters"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-600 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Input Type *
                  </label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value as FieldType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="text">Text Input</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Dropdown Select</option>
                    <option value="boolean">Boolean (Yes/No)</option>
                    <option value="textarea">Multi-line Text</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldRequired}
                      onChange={(e) => setFieldRequired(e.target.checked)}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Mandatory (* Required)</span>
                  </label>
                </div>
              </div>

              {fieldType === 'select' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dropdown Choices (Comma-separated) *
                  </label>
                  <input
                    type="text"
                    required
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    placeholder="e.g. 500L, 1000L, 2000L"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Placeholder / Help Hint
                </label>
                <input
                  type="text"
                  value={fieldPlaceholder}
                  onChange={(e) => setFieldPlaceholder(e.target.value)}
                  placeholder="e.g. Specify in liters"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingField}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingField ? 'Saving Field...' : 'Save Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POPUP MODAL 8: INTERACTIVE LIVE ENTRY FORM DESIGNER (IT ADMIN ONLY)       */}
      {/* ========================================================================= */}
      {showDesignerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-50 rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-black text-slate-900 tracking-tight">
                      Live Entry Form Designer — {selectedCategory?.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                      ✨ Live Step 2 Preview
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time Step 2 Registration Form Preview. Click <strong>+ Add Custom Field</strong> above to insert fields live.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!isStrictItAdmin}
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Field to Template</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDesignerModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Template Body Preview (Replicating Step 2 Layout) */}
            <div className="p-4 sm:p-6 sm:px-8 overflow-y-auto flex-1 bg-[#f8f9fa] font-sans">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 max-w-5xl mx-auto">
                <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-blue-950 font-medium shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Active Department Template: <strong className="font-bold text-blue-900">{selectedCategory?.name}</strong>. Dynamic fields added here will appear directly in <strong>Step 2 Asset Registration</strong>.
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-blue-100/80 text-blue-800 text-[11px] font-bold shrink-0 hidden sm:inline">
                    {fields.length} Custom Field(s) Configured
                  </span>
                </div>

                {/* Section 1: BASE IDENTIFICATION */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span>1. Base Identification</span>
                    <span className="text-[10px] font-bold text-slate-400 normal-case tracking-normal">Standard Template Fields</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 opacity-75">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Manufacturer / Brand <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <input type="text" disabled value="e.g. LENOVO, DELL, HP" className="w-full bg-slate-100/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-500 font-medium cursor-not-allowed pr-8" />
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Model Name / Number <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <input type="text" disabled value="e.g. THINKPAD P16 / LATITUDE 5440" className="w-full bg-slate-100/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-500 font-medium cursor-not-allowed pr-8" />
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">System Serial Number</label>
                      <input type="text" disabled value="e.g. SN-981249A-2026" className="w-full bg-slate-100/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-500 font-medium cursor-not-allowed" />
                    </div>
                  </div>

                  {/* Acquisition Condition Toggle Cards Preview */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Acquisition Condition <span className="text-rose-500">*</span></label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-80">
                      <div className="flex items-center justify-between p-3 rounded-2xl border-2 border-blue-500 bg-blue-50/40 text-xs font-bold text-blue-900 cursor-not-allowed">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">✓</div>
                          <span>New Purchase (Fresh Procurement)</span>
                        </div>
                        <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-bold">Default</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-500 cursor-not-allowed">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border border-slate-300"></div>
                          <span>Existing Asset (Legacy Ingestion)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: COMMERCIAL PO & WARRANTY */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span>2. Commercial, Purchase Order &amp; Warranty</span>
                    <span className="text-[10px] font-bold text-slate-400 normal-case tracking-normal">Standard Financial Fields</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 opacity-75">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Vendor Name</label>
                      <input type="text" disabled value="e.g. REDINGTON INDIA LTD" className="w-full bg-slate-100/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-500 font-medium cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">PO Number <span className="text-amber-600 font-bold">* (PO Linked)</span></label>
                      <input type="text" disabled value="PO-2026-88192" className="w-full bg-amber-50/50 border border-amber-300 rounded-xl px-3.5 py-2 text-xs text-amber-900 font-semibold cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Purchase Cost (₹)</label>
                      <input type="text" disabled value="85,000.00" className="w-full bg-slate-100/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-500 font-medium cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Purchase Date</label>
                      <input type="text" disabled value="2026-03-15" className="w-full bg-slate-100/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-500 font-medium cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Warranty Expiry Date</label>
                      <input type="text" disabled value="2029-03-15" className="w-full bg-slate-100/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-500 font-medium cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">AMC / CMC Expiry Date</label>
                      <input type="text" disabled value="Optional (e.g. 2030-03-15)" className="w-full bg-slate-100/90 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-500 font-medium cursor-not-allowed" />
                    </div>
                  </div>
                </div>

                {/* Section 5: TECHNICAL SPECIFICATIONS & DYNAMIC DEPARTMENT ATTRIBUTES */}
                <div className="space-y-5 pt-4 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          5. Department Specifications &amp; Dynamic Custom Attributes
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                          {selectedCategory?.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Fields configured in this section are dynamically rendered into Step 2 for <strong>{selectedCategory?.name}</strong> assets.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!isStrictItAdmin}
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add Custom Field Here</span>
                    </button>
                  </div>

                  {fields.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/70 p-8 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div className="max-w-md mx-auto space-y-1">
                        <p className="text-sm font-bold text-slate-900">
                          No Custom Fields Configured for {selectedCategory?.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Click <strong>"+ Add Custom Field Here"</strong> above to create custom technical specifications (e.g. RAM Capacity, Processor, Software License, IP Address, Calibration Date).
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fields.map((f, idx) => (
                        <div
                          key={f.id}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            f.id === newlyAddedFieldId
                              ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/50 shadow-md animate-in fade-in slide-in-from-top-2 duration-300'
                              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono font-bold flex items-center justify-center">
                                #{idx + 1}
                              </span>
                              <label className="text-xs font-bold text-slate-900">
                                {f.field_label}{' '}
                                {f.is_required && <span className="text-rose-500 font-bold">*</span>}
                              </label>
                              {f.id === newlyAddedFieldId && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider animate-pulse">
                                  ✨ NEWLY ADDED
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Toggle Required Button */}
                              <button
                                type="button"
                                disabled={!isStrictItAdmin || togglingId === f.id}
                                onClick={() => handleToggleRequired(f)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                                  f.is_required
                                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                                }`}
                                title="Click to toggle Mandatory status"
                              >
                                {f.is_required ? 'Required *' : 'Optional'}
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                disabled={!isStrictItAdmin}
                                onClick={() => handleDeleteField(f.id, f.field_label)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-100/60 transition-colors cursor-pointer"
                                title="Delete Field from Template"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Live Control Preview */}
                          <div>
                            {f.field_type === 'select' ? (
                              <div className="relative">
                                <select disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-700 font-medium cursor-not-allowed appearance-none">
                                  <option>{f.placeholder || `Select ${f.field_label}...`}</option>
                                  {f.options?.map((opt, oIdx) => (
                                    <option key={oIdx} value={opt}>{opt}</option>
                                  ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                              </div>
                            ) : f.field_type === 'textarea' ? (
                              <textarea disabled rows={2} placeholder={f.placeholder || `Enter ${f.field_label}...`} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-700 font-medium cursor-not-allowed" />
                            ) : (
                              <input type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'} disabled placeholder={f.placeholder || `Enter ${f.field_label}...`} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-700 font-medium cursor-not-allowed" />
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                            <span>Key: <code className="text-slate-600">{f.field_name}</code></span>
                            <span className="uppercase font-bold text-slate-500 px-1.5 py-0.5 rounded bg-slate-100">{f.field_type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
              <span className="text-slate-500 font-semibold">
                Changes persist instantly into PostgreSQL database.
              </span>
              <button
                type="button"
                onClick={() => setShowDesignerModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Close Designer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500 font-semibold text-sm">Loading Settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
