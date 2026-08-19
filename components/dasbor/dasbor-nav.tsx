'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DasborNavProps {
  role: 'kacab' | 'admin';
  anomalyCount?: number;
}

export default function DasborNav({ role, anomalyCount = 0 }: DasborNavProps) {
  const pathname = usePathname();

  const links = [
    { href: '/dasbor', label: '📊 Ringkasan Dasbor', exact: true },
    {
      href: '/dasbor/anomali',
      label: `⚠️ Anomali ${anomalyCount > 0 ? `(${anomalyCount})` : ''}`,
      exact: false,
    },
    { href: '/dasbor/kinerja', label: '🏆 Kinerja Petugas', exact: false },
    { href: '/dasbor/pengguna', label: '👥 Kelola Pengguna', exact: false },
    ...(role === 'admin'
      ? [
          { href: '/dasbor/retensi', label: '🗄️ Retensi Data', exact: false },
          { href: '/dasbor/pengaturan', label: '⚙️ Pengaturan Sistem', exact: false },
        ]
      : []),
  ];

  return (
    <nav className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl overflow-x-auto text-xs font-semibold mb-4 border border-slate-200 shadow-inner">
      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
              isActive
                ? 'bg-white text-bkk-700 shadow-sm font-bold border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
