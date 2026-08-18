'use client';

import { useActionState } from 'react';
import { loginAction } from './actions';

export default function MasukPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <main className="flex-1 flex flex-col justify-center px-6 py-10">
      {/* Header & Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-bkk-600 text-white font-black text-2xl shadow-lg shadow-bkk-600/30 mb-4 tracking-wider">
          BKK
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          SIKUMA
        </h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">
          Sistem Kunjungan Marketing Bank BKK
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">
          Masuk ke Akun Anda
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Masukkan email dan kata sandi yang telah didaftarkan oleh admin.
        </p>

        {state?.error && (
          <div
            id="login-error-alert"
            role="alert"
            className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2.5"
          >
            <span className="font-bold text-red-500">✕</span>
            <span className="leading-snug">{state.error}</span>
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nama@bkk.co.id"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-bkk-600 focus:border-transparent text-base smooth-transition"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Kata Sandi
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-bkk-600 focus:border-transparent text-base smooth-transition"
            />
          </div>

          <button
            id="submit-login"
            type="submit"
            disabled={isPending}
            className="w-full min-h-[48px] mt-2 bg-bkk-600 hover:bg-bkk-700 active:bg-bkk-800 disabled:opacity-60 text-white font-semibold rounded-xl text-base shadow-sm smooth-transition flex items-center justify-center cursor-pointer"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  ></path>
                </svg>
                Memproses...
              </span>
            ) : (
              'Masuk'
            )}
          </button>
        </form>
      </div>

      {/* Petunjuk Pasang PWA di Android */}
      <div className="mt-6 p-3.5 bg-slate-100/90 border border-slate-200 rounded-2xl text-xs space-y-1.5 text-slate-600">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <span>📲</span> Pasang di Layar Utama HP (Android)
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Agar nyaman dipakai di lapangan seperti aplikasi native: buka Chrome, ketuk menu titik tiga (<strong className="text-slate-700">⋮</strong>) di kanan atas, lalu pilih <strong className="text-slate-700">&quot;Tambahkan ke Layar Utama&quot;</strong>.
        </p>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400">
        Hak Cipta © {new Date().getFullYear()} Bank BKK. Seluruh hak cipta dilindungi.
      </footer>
    </main>
  );
}
