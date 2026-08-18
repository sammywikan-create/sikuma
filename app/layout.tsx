import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SyncProvider } from '@/components/offline/sync-provider';
import OfflineStatusBanner from '@/components/offline/offline-status-banner';
import RegisterServiceWorker from '@/components/pwa/register-sw';

export const metadata: Metadata = {
  title: 'SIKUMA — Sistem Kunjungan Marketing (Bank BKK)',
  description: 'Aplikasi pencatatan kunjungan marketing resmi Bank BKK',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SIKUMA BKK',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#092C4C',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isSimulate = process.env.NEXT_PUBLIC_DEV_SIMULATE === '1';

  return (
    <html lang="id">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center selection:bg-bkk-200">
        <SyncProvider>
          <RegisterServiceWorker />
          {isSimulate && (
            <div className="w-full bg-red-600 text-white text-xs md:text-sm font-bold text-center py-1.5 px-4 tracking-wider uppercase sticky top-0 z-50 shadow-md">
              ⚠️ MODE SIMULASI AKTIF (Kamera &amp; GPS Simulasi)
            </div>
          )}
          <div className="w-full max-w-md min-h-screen flex flex-col bg-white shadow-xl">
            <OfflineStatusBanner />
            {children}
          </div>
        </SyncProvider>
      </body>
    </html>
  );
}
