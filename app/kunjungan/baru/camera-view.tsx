'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { applyWatermarkAndCompress, type ProcessedPhotoResult } from '@/lib/utils/watermark';
import {
  saveCurrentDraft,
  clearCurrentDraft,
  enqueueVisit,
  type DraftPhoto,
} from '@/lib/storage/db';
import { formatThousandSeparator, parseThousandSeparator, formatRupiah } from '@/lib/utils/format';
import { useSync } from '@/components/offline/sync-provider';
import type { VisitType, ProductType, OutcomeType, KolektibilitasType } from '@/lib/types/database';

interface CameraViewProps {
  profile: {
    full_name: string;
    marketing_code: string | null;
    role: string;
  };
  isSimulate: boolean;
}

interface GPSState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  address: string;
  isLoading: boolean;
  error?: string;
  isLocked: boolean; // Akurasi > 100m
  isLowAccuracy: boolean; // 50m < Akurasi <= 100m
}

export default function CameraView({ profile, isSimulate }: CameraViewProps) {
  const { isOnline, isMemoryFull, refreshQueueStatus } = useSync();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // State Kamera & Izin
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // State GPS
  const [gps, setGps] = useState<GPSState>({
    lat: isSimulate ? -7.005 : null,
    lng: isSimulate ? 110.438 : null,
    accuracy: isSimulate ? 10 : null,
    address: isSimulate ? 'Jl. Pemuda No. 142, Sekayu, Kec. Semarang Tengah, Kota Semarang' : '',
    isLoading: !isSimulate,
    isLocked: false,
    isLowAccuracy: false,
  });

  // State Foto yang sudah diambil (1-3 foto)
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [activePreviewPhoto, setActivePreviewPhoto] = useState<DraftPhoto | null>(null);

  // Anomaly flags
  const [anomalyFlags, setAnomalyFlags] = useState<string[]>([]);

  // State Formulir Kunjungan
  const [customerName, setCustomerName] = useState<string>('');
  const [visitType, setVisitType] = useState<VisitType>(
    profile.role === 'penagihan' ? 'penagihan' : 'prospek_baru'
  );
  const [product, setProduct] = useState<ProductType>(
    profile.role === 'penagihan' ? 'kredit' : 'tabungan'
  );
  const [outcome, setOutcome] = useState<OutcomeType>('berminat');
  const [potentialValueRaw, setPotentialValueRaw] = useState<string>('');
  const [bakiDebetRaw, setBakiDebetRaw] = useState<string>('');
  const [kolektibilitas, setKolektibilitas] = useState<'kol_1' | 'kol_2' | 'kol_3' | 'kol_4' | 'kol_5'>('kol_1');
  const [notes, setNotes] = useState<string>('');

  // State Pengiriman & Konfirmasi
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedVisit, setSubmittedVisit] = useState<{
    visitId: string;
    customerName: string;
    visitType: string;
    product: string;
    outcome: string;
    potentialValue: number | null;
    photoCount: number;
    anomalyFlags: string[];
    isOfflineQueued: boolean;
  } | null>(null);

  // 1. Fetch Reverse Geocoding
  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.address) {
          setGps((prev) => ({ ...prev, address: data.address }));
        }
      }
    } catch {
      // Abaikan jika offline
    }
  }, []);

  // 2. Monitoring Geolocation (watchPosition)
  useEffect(() => {
    if (isSimulate) {
      setGps({
        lat: -7.005,
        lng: 110.438,
        accuracy: 10,
        address: 'Jl. Pemuda No. 142, Sekayu, Kec. Semarang Tengah, Kota Semarang',
        isLoading: false,
        isLocked: false,
        isLowAccuracy: false,
      });
      return;
    }

    if (!navigator.geolocation) {
      setGps((prev) => ({
        ...prev,
        isLoading: false,
        isLocked: true,
        error: 'Perangkat tidak mendukung GPS Geolocation.',
      }));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const isLocked = accuracy > 100;
        const isLowAccuracy = accuracy > 50 && accuracy <= 100;

        setGps((prev) => ({
          ...prev,
          lat: latitude,
          lng: longitude,
          accuracy,
          isLoading: false,
          isLocked,
          isLowAccuracy,
          error: undefined,
        }));

        if (isLowAccuracy) {
          setAnomalyFlags((prev) =>
            prev.includes('akurasi_rendah') ? prev : [...prev, 'akurasi_rendah']
          );
        }

        fetchAddress(latitude, longitude);
      },
      (err) => {
        let msg = 'Gagal memperoleh koordinat lokasi.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Izin lokasi ditolak. Harap izinkan akses lokasi di peramban Anda.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Waktu permintaan GPS habis. Pastikan GPS aktif.';
        }
        setGps((prev) => ({
          ...prev,
          isLoading: false,
          isLocked: true,
          error: msg,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isSimulate, fetchAddress]);

  // 3. Inisialisasi Kamera (getUserMedia)
  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (!isSimulate) {
            setHasCameraPermission(false);
            setCameraError('Kamera tidak didukung di peramban ini.');
            return;
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setHasCameraPermission(true);
        setCameraError(null);
      } catch (err: unknown) {
        if (!active) return;
        const e = err as Error;

        if (isSimulate) {
          setHasCameraPermission(true);
        } else {
          setHasCameraPermission(false);
          if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            setCameraError('Izin kamera ditolak oleh pengguna.');
          } else {
            setCameraError(`Gagal mengakses kamera (${e.name || 'Error'}).`);
          }
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isSimulate]);

  // 4. Render Frame Mock Simulasi
  const generateSimulatedFrame = (): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 1280, 960);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.5, '#334155');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 960);

      ctx.fillStyle = '#475569';
      ctx.fillRect(200, 250, 880, 500);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(300, 350, 200, 300);
      ctx.fillRect(780, 350, 200, 300);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(560, 420, 160, 330);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TOKO MAJU JAYA (SIMULASI KUNJUNGAN NASABAH)', 640, 180);
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Kamera & Lokasi Simulasi Bank BKK', 640, 220);
    }
    return canvas;
  };

  // 5. Ambil Foto & Bakar Watermark
  const handleCapture = async () => {
    if (photos.length >= 3 || gps.isLocked || isCapturing || isMemoryFull) return;

    try {
      setIsCapturing(true);

      const lat = gps.lat ?? -7.005;
      const lng = gps.lng ?? 110.438;
      const accuracy = gps.accuracy ?? 10;
      const address = gps.address || 'Semarang Tengah, Kota Semarang';

      let sourceImage: CanvasImageSource;
      let sourceWidth = 1280;
      let sourceHeight = 960;

      if (videoRef.current && videoRef.current.videoWidth > 0) {
        sourceImage = videoRef.current;
        sourceWidth = videoRef.current.videoWidth;
        sourceHeight = videoRef.current.videoHeight;
      } else {
        sourceImage = generateSimulatedFrame();
      }

      const result: ProcessedPhotoResult = await applyWatermarkAndCompress(
        sourceImage,
        sourceWidth,
        sourceHeight,
        {
          marketingCode: profile.marketing_code || 'MKT01',
          marketingName: profile.full_name || 'Marketing Bank BKK',
          lat,
          lng,
          accuracy,
          address,
          capturedAt: new Date(),
        }
      );

      const newPhoto: DraftPhoto = {
        id: `photo_${Date.now()}_${photos.length + 1}`,
        dataUrl: result.dataUrl,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        captured_at: new Date().toISOString(),
        lat,
        lng,
        accuracy_m: accuracy,
        address,
        sha256: result.sha256,
        sort_order: photos.length + 1,
      };

      const updatedPhotos = [...photos, newPhoto];
      setPhotos(updatedPhotos);
      setActivePreviewPhoto(newPhoto);

      // Simpan juga ke draft IndexedDB
      await saveCurrentDraft({
        client_uuid: `draft_${Date.now()}`,
        captured_at: newPhoto.captured_at,
        lat: newPhoto.lat,
        lng: newPhoto.lng,
        accuracy_m: newPhoto.accuracy_m,
        address: newPhoto.address,
        anomaly_flags: anomalyFlags,
        photos: updatedPhotos,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error capture:', err);
      alert('Gagal memproses watermark foto.');
    } finally {
      setIsCapturing(false);
    }
  };

  // 6. Hapus Foto
  const handleDeletePhoto = (photoId: string) => {
    const filtered = photos
      .filter((p) => p.id !== photoId)
      .map((p, idx) => ({ ...p, sort_order: idx + 1 }));
    setPhotos(filtered);
    if (activePreviewPhoto?.id === photoId) {
      setActivePreviewPhoto(filtered[filtered.length - 1] || null);
    }
  };

  // 7. Kirim Data Kunjungan (Online Langsung / Offline Enqueue)
  const handleSubmitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (photos.length === 0) {
      setSubmitError('Wajib mengambil minimal 1 foto kunjungan.');
      return;
    }

    if (!customerName.trim()) {
      setSubmitError('Nama nasabah / calon nasabah wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);

      const primaryPhoto = photos[0];
      const potentialNum = parseThousandSeparator(potentialValueRaw);
      const bakiDebetNum = parseThousandSeparator(bakiDebetRaw);
      const clientUuid = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Jika offline langsung simpan ke IndexedDB Queue
      if (!isOnline) {
        await enqueueVisit({
          client_uuid: clientUuid,
          customer_name: customerName.trim(),
          visit_type: visitType,
          product,
          outcome,
          potential_value: potentialNum,
          baki_debet: bakiDebetNum,
          kolektibilitas: visitType === 'penagihan' ? kolektibilitas : null,
          notes: notes.trim() || null,
          captured_at: primaryPhoto.captured_at,
          lat: primaryPhoto.lat,
          lng: primaryPhoto.lng,
          accuracy_m: primaryPhoto.accuracy_m,
          address: primaryPhoto.address || null,
          photos,
          status: 'pending',
          retry_count: 0,
          last_error: null,
          created_at: new Date().toISOString(),
        });

        await clearCurrentDraft();
        await refreshQueueStatus();

        setSubmittedVisit({
          visitId: clientUuid,
          customerName: customerName.trim(),
          visitType,
          product,
          outcome,
          potentialValue: potentialNum,
          photoCount: photos.length,
          anomalyFlags,
          isOfflineQueued: true,
        });
        return;
      }

      // Jika online, coba kirim ke API server
      try {
        const payload = {
          client_uuid: clientUuid,
          customer_name: customerName.trim(),
          visit_type: visitType,
          product,
          outcome,
          potential_value: potentialNum,
          baki_debet: bakiDebetNum,
          kolektibilitas: visitType === 'penagihan' ? kolektibilitas : null,
          notes: notes.trim() || null,
          captured_at: primaryPhoto.captured_at,
          lat: primaryPhoto.lat,
          lng: primaryPhoto.lng,
          accuracy_m: primaryPhoto.accuracy_m,
          address: primaryPhoto.address,
          photos: photos.map((p) => ({
            dataUrl: p.dataUrl,
            bytes: p.bytes,
            width: p.width,
            height: p.height,
            sha256: p.sha256,
            sort_order: p.sort_order,
          })),
        };

        const res = await fetch('/api/kunjungan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Gagal menyimpan data kunjungan ke server.');
        }

        await clearCurrentDraft();

        setSubmittedVisit({
          visitId: data.visitId,
          customerName: customerName.trim(),
          visitType,
          product,
          outcome,
          potentialValue: potentialNum,
          photoCount: photos.length,
          anomalyFlags: data.anomaly_flags || [],
          isOfflineQueued: false,
        });
      } catch (networkErr: unknown) {
        // Fallback jika jaringan tiba-tiba gagal saat fetch
        console.warn('Gagal kirim online, menyimpan ke antrean offline:', networkErr);

        await enqueueVisit({
          client_uuid: clientUuid,
          customer_name: customerName.trim(),
          visit_type: visitType,
          product,
          outcome,
          potential_value: potentialNum,
          notes: notes.trim() || null,
          captured_at: primaryPhoto.captured_at,
          lat: primaryPhoto.lat,
          lng: primaryPhoto.lng,
          accuracy_m: primaryPhoto.accuracy_m,
          address: primaryPhoto.address || null,
          photos,
          status: 'pending',
          retry_count: 0,
          last_error: (networkErr as Error).message || 'Gagal jaringan saat kirim',
          created_at: new Date().toISOString(),
        });

        await clearCurrentDraft();
        await refreshQueueStatus();

        setSubmittedVisit({
          visitId: clientUuid,
          customerName: customerName.trim(),
          visitType,
          product,
          outcome,
          potentialValue: potentialNum,
          photoCount: photos.length,
          anomalyFlags,
          isOfflineQueued: true,
        });
      }
    } catch (err: unknown) {
      console.error('Error saat submit kunjungan:', err);
      setSubmitError((err as Error).message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 8. Reset & Catat Kunjungan Berikutnya
  const handleNextVisit = () => {
    setSubmittedVisit(null);
    setPhotos([]);
    setCustomerName('');
    setVisitType('prospek_baru');
    setProduct('tabungan');
    setOutcome('berminat');
    setPotentialValueRaw('');
    setNotes('');
    setSubmitError(null);
  };

  // Tampilan Layar Konfirmasi (Online vs Offline Kejujuran Status)
  if (submittedVisit) {
    return (
      <div className="flex-1 flex flex-col p-6 bg-slate-50 justify-center items-center min-h-screen text-slate-900">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-xl text-center">
          {submittedVisit.isOfflineQueued ? (
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-3xl font-bold mx-auto mb-4">
              💾
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl font-bold mx-auto mb-4">
              ✓
            </div>
          )}

          <h2 className="text-xl font-bold text-slate-900 mb-1">
            {submittedVisit.isOfflineQueued
              ? 'Tersimpan di Memori HP (Offline)'
              : 'Kunjungan Berhasil Terkirim!'}
          </h2>

          <p className="text-xs text-slate-500 mb-6">
            {submittedVisit.isOfflineQueued
              ? 'Data dan foto ber-watermark tersimpan aman di HP. Akan otomatis dikirim ke server saat terhubung internet.'
              : 'Data kunjungan dan foto ber-watermark telah diterima oleh server pusat.'}
          </p>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left text-xs space-y-2.5 mb-6">
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Nama Nasabah</span>
              <span className="font-semibold text-slate-800">{submittedVisit.customerName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Jenis Kunjungan</span>
              <span className="font-semibold text-slate-800 capitalize">
                {submittedVisit.visitType.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Produk &amp; Hasil</span>
              <span className="font-semibold text-slate-800 capitalize">
                {submittedVisit.product} ({submittedVisit.outcome.replace(/_/g, ' ')})
              </span>
            </div>
            {submittedVisit.potentialValue && (
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Potensi Nilai</span>
                <span className="font-semibold text-emerald-700">
                  {formatRupiah(submittedVisit.potentialValue)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Foto Tersimpan</span>
              <span className="font-semibold text-bkk-700">{submittedVisit.photoCount} Foto</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleNextVisit}
              className="w-full min-h-[48px] bg-bkk-600 hover:bg-bkk-700 active:bg-bkk-800 text-white font-semibold rounded-xl text-sm shadow-sm smooth-transition cursor-pointer"
            >
              Catat Kunjungan Berikutnya 📷
            </button>
            <Link
              href={profile.role === 'penagihan' ? '/penagihan' : '/kunjungan'}
              className="block w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs smooth-transition text-center"
            >
              Kembali ke Beranda {profile.role === 'penagihan' ? 'Penagihan' : 'Kunjungan'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-white min-h-screen">
      {/* 1. Header Bar */}
      <header className="p-3 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between z-10 sticky top-0">
        <Link
          href={profile.role === 'penagihan' ? '/penagihan' : '/kunjungan'}
          className="text-xs font-semibold text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 active:bg-slate-700 smooth-transition"
        >
          ← Batal
        </Link>
        <div className="text-center">
          <h1 className="text-sm font-bold tracking-tight">
            {profile.role === 'penagihan' ? 'Catat Penagihan' : 'Kunjungan Baru'}
          </h1>
          <p className="text-[11px] text-slate-400">
            {profile.marketing_code || (profile.role === 'penagihan' ? 'AO' : 'MKT')} • {photos.length}/3 Foto
          </p>
        </div>
        <div className="w-16"></div>
      </header>

      {/* Peringatan Memori Penuh (>= 50MB) */}
      {isMemoryFull && (
        <div className="p-3 bg-red-600 text-white text-xs font-bold text-center">
          ⚠️ MEMORI ANTREAN PENUH (&gt;= 50 MB) • Pengambilan foto dikunci. Harap cari jaringan untuk sinkronisasi.
        </div>
      )}

      {/* 2. Status GPS Bar */}
      <div className="px-3.5 py-2 bg-slate-950/80 border-b border-slate-800 text-xs">
        {gps.isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 py-0.5">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>
            <span>Mencari koordinat GPS presisi tinggi...</span>
          </div>
        ) : gps.error ? (
          <div className="text-red-400 flex items-start gap-1.5 py-0.5">
            <span className="font-bold">⚠️</span>
            <span>{gps.error}</span>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    gps.isLocked
                      ? 'bg-red-500 animate-pulse'
                      : gps.isLowAccuracy
                      ? 'bg-yellow-400'
                      : 'bg-emerald-400'
                  }`}
                ></span>
                <span className="font-mono text-[11px] text-slate-200">
                  {gps.lat?.toFixed(6)}, {gps.lng?.toFixed(6)}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  gps.isLocked
                    ? 'bg-red-950 text-red-300 border border-red-800'
                    : gps.isLowAccuracy
                    ? 'bg-yellow-950 text-yellow-300 border border-yellow-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                Akurasi: {Math.round(gps.accuracy || 0)}m
              </span>
            </div>
            {gps.address && (
              <p className="text-[11px] text-slate-400 truncate leading-tight">
                📍 {gps.address}
              </p>
            )}
          </div>
        )}

        {/* Peringatan Akurasi Terkunci (> 100m) */}
        {gps.isLocked && (
          <div className="mt-2 p-2.5 bg-red-950/90 border border-red-800 rounded-xl text-[11px] text-red-200 leading-snug">
            <p className="font-bold text-red-300 mb-0.5">⚠️ Akurasi Lokasi Rendah (&gt; 100m)</p>
            Tombol foto terkunci. Saran: Keluar dari ruangan atau aktifkan mode lokasi presisi tinggi di HP Anda.
          </div>
        )}
      </div>

      {/* 3. Area Pratinjau Kamera / Live Viewfinder */}
      <div className="relative flex flex-col items-center justify-center bg-black overflow-hidden aspect-[4/3] max-h-[280px]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover ${
            hasCameraPermission ? 'block' : 'hidden'
          }`}
        />

        {hasCameraPermission && (!videoRef.current || videoRef.current.videoWidth === 0) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-900">
            <div className="w-12 h-12 rounded-xl bg-bkk-950 border border-bkk-600 text-bkk-400 flex items-center justify-center text-xl mb-2">
              📷
            </div>
            <p className="text-xs font-semibold text-slate-200">
              Live Preview Kamera Simulasi
            </p>
          </div>
        )}

        {hasCameraPermission === false && (
          <div className="p-4 text-center max-w-xs">
            <h3 className="text-sm font-bold text-white mb-1">
              Izin Kamera Diperlukan
            </h3>
            <p className="text-[11px] text-slate-300 mb-2">
              {cameraError || 'Aplikasi membutuhkan izin akses kamera.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-bkk-600 text-white font-semibold rounded-lg text-xs"
            >
              Muat Ulang
            </button>
          </div>
        )}

        {/* Shutter Button Overlay */}
        {hasCameraPermission && (
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center z-10">
            <button
              id="shutter-button"
              type="button"
              onClick={handleCapture}
              disabled={gps.isLocked || photos.length >= 3 || isCapturing || isMemoryFull}
              className={`w-14 h-14 rounded-full border-3 border-white flex items-center justify-center p-1 smooth-transition shadow-2xl ${
                gps.isLocked || photos.length >= 3 || isCapturing || isMemoryFull
                  ? 'opacity-40 cursor-not-allowed border-slate-600'
                  : 'active:scale-95 cursor-pointer bg-black/40 hover:bg-black/60'
              }`}
            >
              <div
                className={`w-full h-full rounded-full ${
                  isCapturing
                    ? 'bg-bkk-400 animate-pulse'
                    : photos.length >= 3
                    ? 'bg-slate-700'
                    : 'bg-white'
                }`}
              ></div>
            </button>
          </div>
        )}
      </div>

      {/* 4. Galeri Thumbnail Foto (1 - 3 Foto) */}
      <div className="p-3 bg-slate-950 border-y border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">
            Foto Kunjungan ({photos.length}/3) <span className="text-red-400">*</span>
          </span>
          <span className="text-[10px] text-slate-500">
            {photos.length === 0 ? 'Wajib minimal 1 foto' : 'Maksimal 3 foto'}
          </span>
        </div>

        {photos.length === 0 ? (
          <div className="py-4 border-2 border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
            Belum ada foto. Tekan tombol rana di atas untuk mengambil foto.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 aspect-[4/3]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.dataUrl}
                  alt={`Foto kunjungan ${idx + 1}`}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setActivePreviewPhoto(photo)}
                />
                <span className="absolute top-1 left-1 bg-black/75 text-[10px] font-bold px-1.5 py-0.5 rounded text-white">
                  #{idx + 1}
                </span>
                <span className="absolute bottom-1 left-1 bg-black/75 text-[9px] px-1 py-0.5 rounded text-slate-300">
                  {Math.round(photo.bytes / 1024)} KB
                </span>
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(photo.id)}
                  title="Hapus foto"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/90 text-white flex items-center justify-center text-xs font-bold hover:bg-red-500 shadow-md"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Formulir Data Kunjungan */}
      <form onSubmit={handleSubmitVisit} className="p-4 bg-slate-900 space-y-4 pb-12">
        <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">
          Detail Kunjungan Nasabah
        </h2>

        {submitError && (
          <div className="p-3 bg-red-950/90 border border-red-800 text-red-200 text-xs rounded-xl flex items-start gap-2">
            <span className="font-bold">✕</span>
            <span>{submitError}</span>
          </div>
        )}

        {/* Nama Nasabah / Debitur */}
        <div>
          <label htmlFor="customer_name" className="block text-xs font-medium text-slate-300 mb-1.5">
            {visitType === 'penagihan' ? 'Nama Debitur *' : 'Nama Calon Nasabah / Usaha *'}
          </label>
          <input
            id="customer_name"
            type="text"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={
              visitType === 'penagihan'
                ? 'Contoh: Bpk. Sutrisno (Debitur)'
                : 'Contoh: Toko Berkah / Bpk. Sutrisno'
            }
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-base smooth-transition"
          />
        </div>

        {/* Jenis Kunjungan & Tujuan Pemasaran / Produk */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="visit_type" className="block text-xs font-medium text-slate-300 mb-1.5">
              Jenis Kunjungan <span className="text-red-400">*</span>
            </label>
            <select
              id="visit_type"
              value={visitType}
              onChange={(e) => setVisitType(e.target.value as VisitType)}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-bkk-500 text-sm smooth-transition"
            >
              <option value="prospek_baru">Prospek Baru (Pemasaran)</option>
              <option value="nasabah_existing">Nasabah Existing</option>
              <option value="penagihan">Penagihan (AO)</option>
              <option value="survei_jaminan">Survei Jaminan</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <label htmlFor="product" className="block text-xs font-medium text-slate-300 mb-1.5">
              {visitType === 'penagihan' ? 'Fasilitas Kredit' : 'Tujuan Pemasaran'} <span className="text-red-400">*</span>
            </label>
            <select
              id="product"
              value={product}
              onChange={(e) => setProduct(e.target.value as ProductType)}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-bkk-500 text-sm smooth-transition"
            >
              <option value="kredit">Kredit</option>
              <option value="tabungan">Dana - Tabungan</option>
              <option value="deposito">Dana - Deposito</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </div>
        </div>

        {/* Field Khusus Penagihan: Baki Debet & Kolektibilitas */}
        {visitType === 'penagihan' ? (
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
            <div>
              <label htmlFor="baki_debet" className="block text-xs font-medium text-slate-300 mb-1.5">
                Baki Debet (Rp)
              </label>
              <input
                id="baki_debet"
                type="text"
                inputMode="numeric"
                value={bakiDebetRaw}
                onChange={(e) => setBakiDebetRaw(formatThousandSeparator(e.target.value))}
                placeholder="0"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-base smooth-transition"
              />
            </div>

            <div>
              <label htmlFor="kolektibilitas" className="block text-xs font-medium text-slate-300 mb-1.5">
                Kolektibilitas
              </label>
              <select
                id="kolektibilitas"
                value={kolektibilitas}
                onChange={(e) => setKolektibilitas(e.target.value as KolektibilitasType)}
                className="w-full min-h-[44px] px-2.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-bkk-500 text-xs smooth-transition"
              >
                <option value="kol_1">Kol 1 (Lancar)</option>
                <option value="kol_2">Kol 2 (DPK)</option>
                <option value="kol_3">Kol 3 (Kurang Lancar)</option>
                <option value="kol_4">Kol 4 (Diragukan)</option>
                <option value="kol_5">Kol 5 (Macet)</option>
              </select>
            </div>
          </div>
        ) : null}

        {/* Hasil Kunjungan & Nilai Potensi */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="outcome" className="block text-xs font-medium text-slate-300 mb-1.5">
              Hasil Pertemuan <span className="text-red-400">*</span>
            </label>
            <select
              id="outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as OutcomeType)}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-bkk-500 text-sm smooth-transition"
            >
              <option value="berminat">Berminat / Janji Bayar</option>
              <option value="follow_up">Follow Up</option>
              <option value="realisasi">Realisasi / Bayar Lunas</option>
              <option value="tidak_berminat">Tidak Berminat / Menolak</option>
              <option value="tidak_ditemui">Tidak Ditemui</option>
            </select>
          </div>

          <div>
            <label htmlFor="potential_value" className="block text-xs font-medium text-slate-300 mb-1.5">
              {visitType === 'penagihan' ? 'Nominal Bayar (Rp)' : 'Nilai Potensi (Rp)'}
            </label>
            <input
              id="potential_value"
              type="text"
              inputMode="numeric"
              value={potentialValueRaw}
              onChange={(e) => setPotentialValueRaw(formatThousandSeparator(e.target.value))}
              placeholder="0"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-base smooth-transition"
            />
          </div>
        </div>

        {/* Catatan Kunjungan */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="notes" className="text-xs font-medium text-slate-300">
              Catatan Kunjungan
            </label>
            <span className="text-[11px] text-slate-500">
              {notes.length}/300
            </span>
          </div>
          <textarea
            id="notes"
            rows={3}
            maxLength={300}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tambahkan catatan hasil diskusi atau tindak lanjut..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-bkk-500 text-sm smooth-transition"
          />
        </div>

        {/* Tombol Simpan & Kirim Kunjungan */}
        <button
          id="btn-kirim-kunjungan"
          type="submit"
          disabled={isSubmitting || photos.length === 0}
          className="w-full min-h-[50px] bg-bkk-600 hover:bg-bkk-500 active:bg-bkk-700 disabled:opacity-50 text-white font-bold rounded-xl text-base shadow-lg shadow-bkk-600/30 smooth-transition flex items-center justify-center cursor-pointer mt-4"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              {isOnline ? 'Mengirim ke Server...' : 'Menyimpan ke HP...'}
            </span>
          ) : !isOnline ? (
            'Simpan Kunjungan ke HP (Offline) 💾'
          ) : (
            'Kirim Kunjungan Sekarang ✓'
          )}
        </button>
      </form>

      {/* 6. Modal Preview Foto */}
      {activePreviewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                Pratinjau Foto #{activePreviewPhoto.sort_order}
              </h3>
              <p className="text-xs text-slate-400">
                Ukuran: {Math.round(activePreviewPhoto.bytes / 1024)} KB ({activePreviewPhoto.width}x{activePreviewPhoto.height} px)
              </p>
            </div>
            <button
              onClick={() => setActivePreviewPhoto(null)}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white"
            >
              Tutup ✕
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-hidden my-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePreviewPhoto.dataUrl}
              alt="Pratinjau foto ber-watermark"
              className="max-w-full max-h-[75vh] object-contain rounded-lg border border-slate-800 shadow-2xl"
            />
          </div>

          <div className="pt-3 flex justify-between items-center text-xs text-slate-400">
            <span>Watermark permanen dibakar ke foto.</span>
            <button
              onClick={() => {
                handleDeletePhoto(activePreviewPhoto.id);
                setActivePreviewPhoto(null);
              }}
              className="text-red-400 hover:text-red-300 font-semibold"
            >
              Hapus Foto Ini
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
