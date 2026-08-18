'use client';

import { useState } from 'react';
import { createMarketingUserAction, toggleUserStatusAction } from '../actions';
import type { Profile, UserRole } from '@/lib/types/database';

interface PenggunaViewProps {
  initialProfiles: Profile[];
}

export default function PenggunaView({ initialProfiles }: PenggunaViewProps) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Form state tambah user
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('Password123!');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newMarketingCode, setNewMarketingCode] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('marketing');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleToggleActive = async (profile: Profile) => {
    const confirmMsg = profile.is_active
      ? `Nonaktifkan akun "${profile.full_name}"? Akun ini tidak akan bisa login, namun riwayat kunjungan tetap tersimpan utuh.`
      : `Aktifkan kembali akun "${profile.full_name}"?`;

    if (!confirm(confirmMsg)) return;

    const res = await toggleUserStatusAction(profile.id, profile.is_active);
    if (res.error) {
      alert(`Gagal: ${res.error}`);
    } else {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profile.id ? { ...p, is_active: !p.is_active } : p
        )
      );
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newEmail || !newFullName) {
      setFormError('Email dan Nama Lengkap wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createMarketingUserAction({
        email: newEmail,
        password: newPassword,
        full_name: newFullName,
        marketing_code: newMarketingCode,
        role: newRole,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        alert('Pengguna baru berhasil ditambahkan!');
        setIsAddModalOpen(false);
        setNewEmail('');
        setNewFullName('');
        setNewMarketingCode('');
        window.location.reload();
      }
    } catch (err: unknown) {
      setFormError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header Aksi */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Daftar Pengguna Sistem ({profiles.length})
          </h2>
          <p className="text-[11px] text-slate-400">
            Kelola staf marketing, kepala cabang, dan status keaktifan
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-3 py-2 bg-bkk-600 hover:bg-bkk-700 active:bg-bkk-800 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>+</span> Tambah Pengguna
        </button>
      </div>

      {/* Tabel / Kartu Daftar Pengguna */}
      <div className="space-y-2.5">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={`p-3.5 bg-white border rounded-2xl shadow-sm flex items-center justify-between gap-3 ${
              p.is_active ? 'border-slate-200' : 'border-slate-200 bg-slate-50/70 opacity-75'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    p.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : p.role === 'kacab'
                      ? 'bg-emerald-100 text-emerald-700'
                      : p.role === 'penagihan'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-bkk-100 text-bkk-700'
                  }`}
                >
                  {p.role === 'penagihan' ? 'Penagihan (AO)' : p.role}
                </span>
                {p.marketing_code && (
                  <span className="font-mono text-xs font-bold text-slate-700">
                    [{p.marketing_code}]
                  </span>
                )}
                <span
                  className={`w-2 h-2 rounded-full ${
                    p.is_active ? 'bg-emerald-500' : 'bg-red-400'
                  }`}
                ></span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 mt-1">
                {p.full_name}
              </h3>
              <p className="text-[11px] text-slate-400">
                Status: {p.is_active ? 'Aktif' : 'Nonaktif (Tidak dapat login)'}
              </p>
            </div>

            <button
              onClick={() => handleToggleActive(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                p.is_active
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              {p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>
        ))}
      </div>

      {/* Modal Tambah Pengguna Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Tambah Pengguna Baru
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs font-semibold px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-[11px]">
                  ⚠️ {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full min-h-[40px] px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Email Akun <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={newRole === 'penagihan' ? 'ao01@bkk.co.id' : 'marketing01@bkk.co.id'}
                  className="w-full min-h-[40px] px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Peran (Role) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full min-h-[40px] px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs"
                  >
                    <option value="marketing">Marketing (Pemasaran)</option>
                    <option value="penagihan">Penagihan (Account Officer)</option>
                    <option value="kacab">Kepala Cabang</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Kode Petugas
                  </label>
                  <input
                    type="text"
                    value={newMarketingCode}
                    onChange={(e) => setNewMarketingCode(e.target.value)}
                    placeholder={newRole === 'penagihan' ? 'AO01' : 'MKT01'}
                    className="w-full min-h-[40px] px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Kata Sandi Awal
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[44px] bg-bkk-600 hover:bg-bkk-700 active:bg-bkk-800 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer mt-3"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Pengguna Baru ✓'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
