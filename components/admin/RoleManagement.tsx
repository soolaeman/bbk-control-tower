'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  RotateCcw,
  Save,
  UserPlus,
  Trash2,
  PlusCircle,
  Users,
  Shield,
  KeyRound,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import type { AppRoleDefinition, AppUserRecord, RolePermissions, UserRole } from '@/lib/types/auth';
import { ROLE_PERMISSIONS } from '@/lib/types/auth';

const OWNER_EMAIL = 'bukanbarukitchen@gmail.com';

const CAPABILITIES: Array<{
  label: string;
  viewKey: keyof RolePermissions;
  editKey?: keyof RolePermissions;
  desc: string;
}> = [
  { label: 'Executive Overview', viewKey: 'canViewOverview', editKey: 'canEditOverview', desc: 'Ringkasan finansial' },
  { label: 'Master Inventory', viewKey: 'canViewInventory', editKey: 'canEditInventory', desc: 'Katalog unit & harga' },
  { label: 'Sales & WA Pitch', viewKey: 'canViewSalesPitch', editKey: 'canEditSalesPitch', desc: 'Penawaran deal WA' },
  { label: 'Pipeline & QC Funnel', viewKey: 'canViewPipeline', editKey: 'canEditPipeline', desc: 'Alur QC & perbaikan' },
  { label: 'Invoices & Dokumen', viewKey: 'canViewInvoices', editKey: 'canEditInvoices', desc: 'Penagihan & Surat Jalan' },
  { label: 'Financials & Cashflow', viewKey: 'canViewFinancials', editKey: 'canEditFinancials', desc: 'Buku kas & laba kotor' },
  { label: 'Warehouse Intelligence', viewKey: 'canViewWarehouses', editKey: 'canEditWarehouses', desc: 'Data suplier & gudang' },
  { label: 'SEO & Schema', viewKey: 'canViewSEO', editKey: 'canEditSEO', desc: 'Meta tag & katalog publik' },
  { label: 'Social Distribution', viewKey: 'canViewSocial', editKey: 'canEditSocial', desc: 'Kanal sosmed & blast' },
];

export function RoleManagement() {
  const [roles, setRoles] = useState<AppRoleDefinition[]>([]);
  const [users, setUsers] = useState<AppUserRecord[]>([]);
  const [permissionsMatrix, setPermissionsMatrix] = useState<Record<string, RolePermissions>>({});
  const [loading, setLoading] = useState(true);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newUserRole, setNewUserRole] = useState('OPERATOR');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // New Role Modal State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [cloneTemplate, setCloneTemplate] = useState('OPERATOR');
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/roles');
      if (!res.ok) throw new Error('Gagal memuat data dari Turso DB');
      const data = await res.json();
      setRoles(data.roles || []);
      setUsers(data.users || []);
      setPermissionsMatrix(data.permissionsMatrix || {});
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal memuat data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const notifyChange = () => {
    window.dispatchEvent(new Event('bbk-role-permissions-changed'));
  };

  // Add User Handler
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      setIsAddingUser(true);
      setFeedback(null);
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_USER',
          email: newEmail.trim().toLowerCase(),
          name: newName.trim(),
          role: newUserRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mendaftarkan pengguna');

      setFeedback({ type: 'success', message: `Pengguna ${newEmail} berhasil didaftarkan!` });
      setNewEmail('');
      setNewName('');
      await loadData();
      notifyChange();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsAddingUser(false);
    }
  };

  // Change User Role Handler
  const handleUpdateUserRole = async (email: string, role: string) => {
    try {
      setFeedback(null);
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_USER_ROLE',
          email,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui role');

      setFeedback({ type: 'success', message: `Role untuk ${email} diubah menjadi ${role}` });
      await loadData();
      notifyChange();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Toggle User Active Status
  const handleToggleUserStatus = async (email: string, currentActive: boolean) => {
    try {
      setFeedback(null);
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_USER_STATUS',
          email,
          isActive: !currentActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status');

      setFeedback({
        type: 'success',
        message: `Akun ${email} sekarang ${!currentActive ? 'Aktif' : 'Dinonaktifkan'}`,
      });
      await loadData();
      notifyChange();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Delete User Handler
  const handleDeleteUser = async (email: string) => {
    if (!confirm(`Hapus akses untuk email ${email}? Staf tidak akan bisa login lagi.`)) return;

    try {
      setFeedback(null);
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_USER',
          email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus pengguna');

      setFeedback({ type: 'success', message: `Akses pengguna ${email} telah dihapus.` });
      await loadData();
      notifyChange();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Create Custom Role Handler
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleId.trim() || !newRoleName.trim()) return;

    try {
      setIsCreatingRole(true);
      setFeedback(null);

      // Inherit permissions from template
      const basePerms = permissionsMatrix[cloneTemplate] || ROLE_PERMISSIONS.VIEWER;

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_ROLE',
          id: newRoleId.trim().toUpperCase(),
          name: newRoleName.trim(),
          description: newRoleDesc.trim(),
          permissions: basePerms,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat role');

      setFeedback({ type: 'success', message: `Role custom ${newRoleName} berhasil dibuat!` });
      setShowRoleModal(false);
      setNewRoleId('');
      setNewRoleName('');
      setNewRoleDesc('');
      await loadData();
      notifyChange();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsCreatingRole(false);
    }
  };

  // Delete Custom Role Handler
  const handleDeleteRole = async (roleId: string) => {
    if (!confirm(`Hapus role ${roleId}? Staf yang memegang role ini akan otomatis dialihkan ke VIEWER.`)) return;

    try {
      setFeedback(null);
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_ROLE',
          id: roleId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus role');

      setFeedback({ type: 'success', message: `Role ${roleId} berhasil dihapus.` });
      await loadData();
      notifyChange();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Toggle Matrix Permission Checkbox
  const togglePermission = (roleId: string, key: keyof RolePermissions, value: boolean) => {
    if (roleId === 'ADMIN') return; // Locked

    setPermissionsMatrix((prev) => {
      const currentRolePerms = prev[roleId] || { ...ROLE_PERMISSIONS.VIEWER };
      return {
        ...prev,
        [roleId]: {
          ...currentRolePerms,
          [key]: value,
        },
      };
    });
  };

  const toggleView = (
    roleId: string,
    viewKey: keyof RolePermissions,
    editKey: keyof RolePermissions | undefined,
    currentVal: boolean
  ) => {
    if (roleId === 'ADMIN') return;
    const nextVal = !currentVal;
    setPermissionsMatrix((prev) => {
      const currentRolePerms = prev[roleId] || { ...ROLE_PERMISSIONS.VIEWER };
      const updated: RolePermissions = {
        ...currentRolePerms,
        [viewKey]: nextVal,
      };
      // If View is disabled, Edit must also be disabled
      if (!nextVal && editKey) {
        (updated as any)[editKey] = false;
      }
      return {
        ...prev,
        [roleId]: updated,
      };
    });
  };

  const toggleEdit = (
    roleId: string,
    viewKey: keyof RolePermissions,
    editKey: keyof RolePermissions,
    currentVal: boolean
  ) => {
    if (roleId === 'ADMIN') return;
    const nextVal = !currentVal;
    setPermissionsMatrix((prev) => {
      const currentRolePerms = prev[roleId] || { ...ROLE_PERMISSIONS.VIEWER };
      const updated: RolePermissions = {
        ...currentRolePerms,
        [editKey]: nextVal,
      };
      // If Edit is enabled, View must also be enabled
      if (nextVal) {
        (updated as any)[viewKey] = true;
      }
      return {
        ...prev,
        [roleId]: updated,
      };
    });
  };

  // Save Permissions Matrix to Turso DB with legacy sync bridge
  const handleSaveMatrix = async () => {
    try {
      setSavingMatrix(true);
      setFeedback(null);

      // Synchronize legacy keys to keep older UI components & APIs functional
      const enrichedMatrix: Record<string, RolePermissions> = {};
      Object.entries(permissionsMatrix).forEach(([roleId, perms]) => {
        enrichedMatrix[roleId] = {
          ...perms,
          canViewFinanceReports: Boolean(perms.canViewOverview || perms.canViewFinancials || perms.canViewFinanceReports),
          canManageInvoices: Boolean(perms.canViewInvoices || perms.canEditInvoices || perms.canManageInvoices),
          canViewFloorPrice: Boolean(perms.canViewInventory || perms.canViewFloorPrice),
          canViewDealPrice: Boolean(perms.canViewSalesPitch || perms.canViewDealPrice),
          canViewSupplierData: Boolean(perms.canViewWarehouses || perms.canViewSupplierData),
          canManageSocialMedia: Boolean(perms.canViewSocial || perms.canEditSocial || perms.canManageSocialMedia),
        };
      });

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_PERMISSIONS_MATRIX',
          matrix: enrichedMatrix,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan matriks hak akses');

      setFeedback({
        type: 'success',
        message: 'Matriks hak akses modular berhasil disimpan ke Turso Cloud DB SSOT!',
      });
      notifyChange();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingMatrix(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#141417]">
        <div className="flex items-center gap-3 text-sm text-slate-400 font-mono">
          <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
          <span>Sinkronisasi Data Roles & Pengguna Turso SSOT...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner & Header */}
      <div className="rounded-2xl border border-emerald-900/40 bg-[#141417] p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 rounded-xl border border-emerald-800/60 bg-emerald-950/60 p-2.5 shadow-inner">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Roles & Manajemen Tim</h2>
                <span className="rounded-md bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  TURSO SSOT
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400 max-w-2xl">
                Owner-only control panel. Daftarkan email Google anggota tim, buat role custom baru, dan kelola izin
                modul operasional secara real-time langsung tersimpan ke Cloud Database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-mono font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRoleModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950/60 hover:from-emerald-500 hover:to-teal-500 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>+ Buat Role Baru</span>
            </button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {feedback && (
          <div
            className={`mt-4 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-medium transition-all ${
              feedback.type === 'success'
                ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-300'
                : 'border-rose-800/80 bg-rose-950/40 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* SECTION 1: DIREKTORI PENGGUNA & UNDANGAN GOOGLE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Direktori Anggota Tim Terdaftar</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {users.length} Pengguna Terdaftar ({users.filter((u) => u.isActive).length} Aktif)
          </span>
        </div>

        {/* Fast Registration Card */}
        <form
          onSubmit={handleAddUser}
          className="rounded-2xl border border-white/[0.08] bg-[#141417] p-4 sm:p-5 shadow-lg space-y-4"
        >
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <UserPlus className="h-4 w-4 text-emerald-400" />
            <span>Daftarkan Akun Google Staf Baru</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-center">
            <div className="sm:col-span-5">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Email Google (Gmail / Workspace)
              </label>
              <input
                type="email"
                required
                placeholder="contoh: staf.finance@gmail.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Nama Staf (Opsional)
              </label>
              <input
                type="text"
                placeholder="Nama Lengkap"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Role Ditugaskan
              </label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-mono font-bold text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 pt-4 sm:pt-4">
              <button
                type="submit"
                disabled={isAddingUser}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 px-4 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-md"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{isAddingUser ? 'Mendaftarkan...' : '+ Daftarkan'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Users Table */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#141417] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-white/[0.08] bg-white/[0.02]">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-400">Pengguna</th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-400">Role Aktif</th>
                  <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-400">Status Akses</th>
                  <th className="px-5 py-3 text-right text-[10px] font-mono uppercase tracking-widest text-slate-400">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {users.map((u) => {
                  const isOwner = u.email.toLowerCase() === OWNER_EMAIL;
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.015] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-white font-mono shrink-0">
                            {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>{u.name || u.email.split('@')[0]}</span>
                              {isOwner && (
                                <span className="rounded bg-emerald-950 border border-emerald-700/80 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-300">
                                  OWNER
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {isOwner ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 text-xs font-mono font-bold text-emerald-400">
                            <Shield className="h-3.5 w-3.5" />
                            ADMIN
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateUserRole(u.email, e.target.value)}
                            className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1 text-xs font-mono font-semibold text-slate-200 hover:border-emerald-500 focus:border-emerald-500 focus:outline-none"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isOwner ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Aktif Permanen
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u.email, u.isActive)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold transition-colors ${
                              u.isActive
                                ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-300 hover:bg-emerald-900/60'
                                : 'bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900/60'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            {u.isActive ? 'Aktif' : 'Nonaktif'}
                          </button>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {isOwner ? (
                          <span className="text-[10px] font-mono text-slate-500">Superadmin Terkunci</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.email)}
                            className="rounded-lg border border-rose-900/40 bg-rose-950/30 p-1.5 text-rose-400 hover:bg-rose-900/50 hover:text-white transition-colors"
                            title="Hapus Akses Staf"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 2: DAFTAR ROLES SISTEM & CUSTOM */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Daftar Roles Sistem & Custom</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">{roles.length} Role Terdaftar</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-white/[0.08] bg-[#141417] p-4 flex flex-col justify-between space-y-3 hover:border-emerald-800/40 transition-colors shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white">{r.name}</h4>
                    <span className="font-mono text-[10px] text-emerald-400 font-bold">{r.id}</span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider ${
                      r.isSystem
                        ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                        : 'bg-indigo-950/80 border border-indigo-800 text-indigo-300'
                    }`}
                  >
                    {r.isSystem ? 'SYSTEM' : 'CUSTOM'}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  {r.description || 'Tidak ada deskripsi.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] font-mono text-slate-500">
                <span>
                  {users.filter((u) => u.role.toUpperCase() === r.id.toUpperCase()).length} Staf Menggunakan
                </span>
                {!r.isSystem && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRole(r.id)}
                    className="text-rose-400 hover:text-rose-300 transition-colors font-bold"
                  >
                    Hapus Role
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: MATRIKS HAK AKSES OPERASIONAL (PERMISSIONS MATRIX) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Matriks Hak Akses Modul Operasional</h3>
              <p className="text-[11px] text-slate-400">
                Atur akses Lihat (View) dan Edit per role. Tersimpan permanen di Turso DB.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveMatrix}
              disabled={savingMatrix}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950/60 hover:bg-emerald-500 disabled:opacity-50 transition-all"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{savingMatrix ? 'Menyimpan ke Turso...' : 'Simpan Perubahan Matriks'}</span>
            </button>
          </div>
        </div>

        {/* Matrix Table Responsive */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#141417] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="border-b border-white/[0.08] bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3.5 text-[10px] font-mono uppercase tracking-widest text-slate-400 w-48">
                    Role
                  </th>
                  {CAPABILITIES.map((cap) => (
                    <th
                      key={cap.label}
                      colSpan={2}
                      className="border-l border-white/[0.06] px-3 py-3 text-center text-[10px] font-mono uppercase tracking-wider text-slate-300"
                    >
                      <div>{cap.label}</div>
                      <div className="text-[9px] text-slate-500 font-normal tracking-normal">{cap.desc}</div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-white/[0.05] bg-white/[0.01]">
                  <th />
                  {CAPABILITIES.flatMap((cap) => [
                    <th key={cap.label + '-v'} className="border-l border-white/[0.06] px-2 py-1.5 text-center text-[9px] font-mono text-slate-400">
                      Lihat
                    </th>,
                    <th key={cap.label + '-e'} className="px-2 py-1.5 text-center text-[9px] font-mono text-slate-400">
                      Edit
                    </th>,
                  ])}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {roles.map((r) => {
                  const isOwner = r.id === 'ADMIN';
                  const perms = isOwner
                    ? ROLE_PERMISSIONS.ADMIN
                    : permissionsMatrix[r.id] || ROLE_PERMISSIONS.VIEWER;

                  return (
                    <tr key={r.id} className="hover:bg-white/[0.015] transition-colors">
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-mono text-xs font-bold text-white">{r.name}</div>
                        <div className="font-mono text-[10px] text-emerald-400">{r.id}</div>
                        {isOwner && (
                          <span className="mt-1.5 inline-block rounded bg-emerald-950 border border-emerald-700 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-300">
                            FULL ACCESS
                          </span>
                        )}
                      </td>

                      {CAPABILITIES.flatMap((cap) => {
                        const canView = isOwner ? true : Boolean(perms[cap.viewKey]);
                        const canEdit = isOwner ? true : cap.editKey ? Boolean(perms[cap.editKey]) : false;

                        return [
                          <td key={cap.label + '-v'} className="border-l border-white/[0.06] px-2 py-3 text-center">
                            <button
                              type="button"
                              disabled={isOwner}
                              onClick={() => toggleView(r.id, cap.viewKey, cap.editKey, canView)}
                              className={`rounded-lg p-1.5 transition-colors ${
                                isOwner
                                  ? 'cursor-not-allowed opacity-50'
                                  : 'hover:bg-white/10 active:scale-95'
                              }`}
                              title={isOwner ? 'Owner selalu memiliki hak akses' : 'Toggle hak lihat'}
                            >
                              {canView ? (
                                <Check className="mx-auto h-4 w-4 text-emerald-400" />
                              ) : (
                                <X className="mx-auto h-4 w-4 text-slate-600" />
                              )}
                            </button>
                          </td>,
                          <td key={cap.label + '-e'} className="px-2 py-3 text-center">
                            {cap.editKey ? (
                              <button
                                type="button"
                                disabled={isOwner}
                                onClick={() => toggleEdit(r.id, cap.viewKey, cap.editKey!, canEdit)}
                                className={`rounded-lg p-1.5 transition-colors ${
                                  isOwner
                                    ? 'cursor-not-allowed opacity-50'
                                    : 'hover:bg-white/10 active:scale-95'
                                }`}
                                title={isOwner ? 'Owner selalu memiliki hak akses' : 'Toggle hak edit'}
                              >
                                {canEdit ? (
                                  <Check className="mx-auto h-4 w-4 text-emerald-400" />
                                ) : (
                                  <X className="mx-auto h-4 w-4 text-slate-600" />
                                )}
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-700">—</span>
                            )}
                          </td>,
                        ];
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          * Catatan: Mengaktifkan Edit otomatis mengaktifkan Lihat. Mematikan Lihat otomatis mematikan Edit. Perubahan disimpan langsung ke Turso Cloud DB SSOT.
        </p>
      </section>

      {/* CREATE CUSTOM ROLE MODAL */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141417] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Buat Role Custom Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Kode Role (Huruf Besar & Underscore)
                </label>
                <input
                  type="text"
                  required
                  placeholder="contoh: TEKNISI_QC"
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs font-mono font-bold text-emerald-400 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Nama Tampilan Role
                </label>
                <input
                  type="text"
                  required
                  placeholder="contoh: Teknisi QC & Chiller"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Deskripsi Peran
                </label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan tanggung jawab role ini..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Salin Hak Akses Awal Dari Template:
                </label>
                <select
                  value={cloneTemplate}
                  onChange={(e) => setCloneTemplate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-mono font-bold text-white focus:border-emerald-500 focus:outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRole}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 shadow-md"
                >
                  {isCreatingRole ? 'Menyimpan...' : 'Simpan Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
