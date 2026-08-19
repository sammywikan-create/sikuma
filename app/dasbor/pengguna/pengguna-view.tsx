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
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newMarketingCode, setNewMarketingCode] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('marketing');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // State modal konfirmasi kata sandi
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [createdUserPassword, setCreatedUserPassword] = useState<string>('');
  const [createdUserName, setCreatedUserName] = useState<string>('');
  const [copiedPassword, setCopiedPassword] = useState<boolean>(false);

  const generateRandomPassword = () => {
    const pwd = crypto.randomUUID().slice(0, 16) + '!A';
    setNewPassword(pwd);
    setShowPassword(true);
  };

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
        password: newPassword || undefined,
        full_name: newFullName,
        marketing_code: newMarketingCode,
        role: newRole,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setIsAddModalOpen(false);

        // Tampilkan modal kata sandi sekali lihat
        setCreatedUserName(newFullName);
        setCreatedUserPassword(res.generatedPassword || newPassword);
        setShowPasswordModal(true);
        setCopiedPassword(false);

        setNewEmail('');
        setNewPassword('');
        setNewFullName('');
        setNewMarketingCode('');
      }
    } catch (err: unknown) {
      setFormError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(createdUserPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 3000);
    } catch {
      // Fallback jika clipboard API tidak tersedia
      setFormError('Gagal menyalin. Silakan salin secara manual.');
    }
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setCreatedUserPassword('');
    window.location.reload();
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
      <div className="space-y-2">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between p-3 rounded-2xl border shadow-sm ${
              p.is_active
                ? 'bg-white border-slate-200'
                : 'bg-slate-100 border-slate-300/60 opacity-70'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {p.full_name}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {p.marketing_code ? `${p.marketing_code} · ` : ''}
                {p.role === 'kacab'
                  ? 'Kepala Cabang'
                  : p.role === 'admin'
                  ? 'Admin'
                  : p.role === 'penagihan'
                  ? 'Penagihan'
                  : 'Marketing'}
              </p>
            </div>

            {p.role !== 'kacab' && p.role !== 'admin' ? (
              <button
                onClick={() => handleToggleActive(p)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  p.is_active
                    ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}
              >
                {p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-slate-400 px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200/80">
                🔒 Akun Utama
              </span>
            )}
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
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Kosongkan untuk sandi acak"
                      className="w-full min-h-[40px] px-3 py-2 pr-9 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
                      aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                    >
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="min-h-[40px] px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-[11px] border border-slate-200 whitespace-nowrap cursor-pointer"
                  >
                    🔑 Acak
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Jika dikosongkan, sandi acak akan dibuat otomatis.
                </p>
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

      {/* Modal Kata Sandi Sekali Lihat */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4 text-slate-900 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl font-bold mx-auto">
              ✓
            </div>

            <h3 className="text-sm font-bold text-slate-900">
              Pengguna Berhasil Dibuat
            </h3>
            <p className="text-[11px] text-slate-500">
              Akun untuk <strong>{createdUserName}</strong> telah aktif.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
              <p className="text-[11px] font-bold text-amber-700 mb-1.5">
                ⚠️ Kata sandi hanya ditampilkan SEKALI
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-white border border-amber-300 px-2.5 py-1.5 rounded-lg text-slate-900 break-all select-all">
                  {createdUserPassword}
                </code>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="min-h-[36px] px-3 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-lg text-[11px] border border-amber-300 cursor-pointer transition"
                >
                  {copiedPassword ? '✓ Tersalin' : '📋 Salin'}
                </button>
              </div>
              <p className="text-[10px] text-amber-600 mt-1.5">
                Catat atau salin kata sandi ini sekarang. Setelah menutup, kata sandi tidak bisa dilihat lagi.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClosePasswordModal}
              className="w-full min-h-[44px] bg-bkk-600 hover:bg-bkk-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              Tutup & Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
