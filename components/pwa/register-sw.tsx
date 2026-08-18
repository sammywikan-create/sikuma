'use client';

import { useEffect } from 'react';

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service Worker terdaftar dengan scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('Gagal mendaftarkan Service Worker:', err);
        });
    }
  }, []);

  return null;
}
