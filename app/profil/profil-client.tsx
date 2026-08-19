'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { changePasswordAction, type PasswordFormState } from './actions';

export default function ProfilPageClient({ role }: { role: string }) {
  const [state, formAction, isPending] = useActionState<PasswordFormState, FormData>(
    changePasswordAction,
    null
  );

  const backUrl = role === 'marketing' ? '/kunjungan' : role === 'penagihan' ? '/penagihan' : '/dasbor';

  return (
    <main className="min-h-screen bg-slate-50 p-4 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 pb-4 border-b border-slate-200 mb-5">
        <Link
          href={backUrl}
          className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 shadow-sm"
        >
          ←
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Ganti Password</h1>
          <p className="text-xs text-slate-400">Perbarui kata sandi akun Anda</p>
        </div>
      </header>

      {/* Success Message */}
      {state?.success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-emerald-700">✅ Password berhasil diubah!</p>
          <p className="text-xs text-emerald-600 mt-1">
            Password baru Anda sudah aktif. Gunakan password baru untuk login berikutnya.
          </p>
          <Link
            href={backUrl}
            className="inline-block mt-3 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-4 py-2 rounded-lg transition"
          >
            ← Kembali
          </Link>
        </div>
      )}

      {/* Error Message */}
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-red-700">⚠️ {state.error}</p>
        </div>
      )}

      {/* Form Ganti Password */}
      {!state?.success && (
        <form action={formAction} className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
            <div>
              <label
                htmlFor="current_password"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Password Lama
              </label>
              <input
                id="current_password"
                name="current_password"
                type="password"
                required
                minLength={6}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-bkk-500 focus:border-bkk-500"
                placeholder="Masukkan password lama"
              />
            </div>

            <div>
              <label
                htmlFor="new_password"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Password Baru
              </label>
              <input
                id="new_password"
                name="new_password"
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-bkk-500 focus:border-bkk-500"
                placeholder="Minimal 8 karakter"
              />
              <p className="text-[11px] text-slate-400 mt-1">Minimal 8 karakter</p>
            </div>

            <div>
              <label
                htmlFor="confirm_password"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Konfirmasi Password Baru
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-bkk-500 focus:border-bkk-500"
                placeholder="Ketik ulang password baru"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={`w-full py-3 rounded-xl text-sm font-bold text-white shadow-md transition cursor-pointer ${
              isPending
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-bkk-600 hover:bg-bkk-700 active:scale-[0.98]'
            }`}
          >
            {isPending ? '⏳ Menyimpan...' : '🔒 Simpan Password Baru'}
          </button>
        </form>
      )}
    </main>
  );
}
