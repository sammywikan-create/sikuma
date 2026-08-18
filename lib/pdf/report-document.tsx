/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import {
  formatIndonesianDate,
  formatIndonesianDateRange,
  formatIndonesianFullDateTime,
} from '@/lib/utils/pdf-date';
import { formatWIB } from '@/lib/utils/time';
import { formatRupiah } from '@/lib/utils/format';
import type { Visit, VisitPhoto, Profile } from '@/lib/types/database';

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 32,
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 4,
  },
  confidentialTag: {
    fontWeight: 'bold',
    color: '#dc2626',
    letterSpacing: 0.5,
  },

  // 1. Sampul
  coverContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  coverHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  bankName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0369a1',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  branchName: {
    fontSize: 9.5,
    color: '#475569',
    marginTop: 2,
    textAlign: 'center',
  },
  dividerLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#0284c7',
    marginTop: 8,
    marginBottom: 30,
  },
  coverTitleBlock: {
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 16,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitlePeriod: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dateRangeText: {
    fontSize: 10,
    color: '#334155',
    textAlign: 'center',
  },
  metaBlock: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    width: '85%',
    marginVertical: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    fontSize: 8,
  },
  metaLabel: {
    color: '#64748b',
  },
  metaValue: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  signatureBlock: {
    marginTop: 20,
    alignItems: 'center',
    width: 200,
  },
  signTitle: {
    fontSize: 8.5,
    color: '#64748b',
    marginBottom: 40,
  },
  signName: {
    fontSize: 9.5,
    fontWeight: 'bold',
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    paddingTop: 4,
    width: '100%',
    textAlign: 'center',
  },
  signRole: {
    fontSize: 7.5,
    color: '#64748b',
    marginTop: 2,
  },

  // 2. Page Titles & Tables
  pageHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  pageSubtitle: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 1.5,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
    minHeight: 20,
    paddingVertical: 3,
  },
  tableHeaderRow: {
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 7.5,
    color: '#334155',
  },
  tableCell: {
    paddingHorizontal: 4,
    fontSize: 7.5,
  },
  tableCellBold: {
    fontWeight: 'bold',
  },

  // 3. Album 2x2
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  albumItem: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 5,
    backgroundColor: '#ffffff',
  },
  photoBox: {
    width: '100%',
    height: 135,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  photoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  captionLine1: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 1,
  },
  captionLine2: {
    fontSize: 7,
    color: '#0369a1',
    marginBottom: 1,
  },
  captionLine3: {
    fontSize: 6.5,
    color: '#475569',
    marginBottom: 1,
  },
  captionLine4: {
    fontSize: 6,
    fontFamily: 'Courier',
    color: '#64748b',
  },

  // 4. Verification Sheet
  verifBox: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    minHeight: 140,
    marginBottom: 16,
  },
  verifHeading: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  verifLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    height: 22,
  },
});

export interface PDFReportData {
  bankName: string;
  branchName: string;
  reportType: 'harian' | 'mingguan' | 'bulanan';
  category?: 'semua' | 'pemasaran' | 'penagihan';
  startDate: string;
  endDate: string;
  printedAt: string;
  printedBy: string;
  kacabName: string;
  marketings: Profile[];
  visits: (Visit & {
    marketing?: Pick<Profile, 'full_name' | 'marketing_code'> | null;
    visit_photos: (VisitPhoto & { signedUrl?: string })[];
  })[];
  marketingSummaries: {
    marketing_id: string;
    marketing_name: string;
    marketing_code: string;
    total_visits: number;
    prospects: number;
    existing: number;
    collection: number;
    realization: number;
    potential_value: number;
    active_days: number;
    late_count: number;
    anomaly_count: number;
  }[];
}

const KOLEKTIBILITAS_LABEL: Record<string, string> = {
  kol_1: 'Kol 1 (Lancar)',
  kol_2: 'Kol 2 (DPK)',
  kol_3: 'Kol 3 (Kurang Lancar)',
  kol_4: 'Kol 4 (Diragukan)',
  kol_5: 'Kol 5 (Macet)',
};

export function ReportPDFDocument({ data }: { data: PDFReportData }) {
  const {
    bankName,
    branchName,
    reportType,
    category = 'semua',
    startDate,
    endDate,
    printedAt,
    printedBy,
    kacabName,
    visits,
    marketingSummaries,
  } = data;

  // Filter Kunjungan sesuai Kategori
  const marketingVisits = visits.filter((v) => v.visit_type !== 'penagihan');
  const collectionVisits = visits.filter((v) => v.visit_type === 'penagihan');

  const reportTitle =
    category === 'penagihan'
      ? 'LAPORAN PENAGIHAN ACCOUNT OFFICER (AO)'
      : category === 'pemasaran'
      ? 'LAPORAN KUNJUNGAN MARKETING'
      : 'LAPORAN REKAPITULASI KUNJUNGAN MARKETING & PENAGIHAN';

  // Kelompokkan Kunjungan per Marketing untuk Album
  const visitsByMarketing = new Map<string, typeof visits>();
  marketingSummaries.forEach((m) => {
    const mVisits = (
      category === 'penagihan'
        ? collectionVisits
        : category === 'pemasaran'
        ? marketingVisits
        : visits
    ).filter((v) => v.marketing_id === m.marketing_id);
    visitsByMarketing.set(m.marketing_id, mVisits);
  });

  return (
    <Document title={`${reportTitle} - Bank BKK`}>
      {/* ======================================================== */}
      {/* HALAMAN 1: SAMPUL                                         */}
      {/* ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverContainer}>
          <View style={styles.coverHeader}>
            <Text style={styles.bankName}>{bankName}</Text>
            <Text style={styles.branchName}>{branchName}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.coverTitleBlock}>
            <Text style={styles.mainTitle}>{reportTitle}</Text>
            <Text style={styles.subtitlePeriod}>
              PERIODE {reportType.toUpperCase()}
            </Text>
            <Text style={styles.dateRangeText}>
              {formatIndonesianDateRange(startDate, endDate)}
            </Text>
          </View>

          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Tanggal Cetak Dokumen</Text>
              <Text style={styles.metaValue}>{formatWIB(printedAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Dicetak Oleh</Text>
              <Text style={styles.metaValue}>{printedBy}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Total Catatan Aktivitas</Text>
              <Text style={styles.metaValue}>
                {category === 'penagihan'
                  ? `${collectionVisits.length} Penagihan Debitur`
                  : category === 'pemasaran'
                  ? `${marketingVisits.length} Kunjungan Pemasaran`
                  : `${visits.length} Kunjungan Lapangan`}
              </Text>
            </View>
          </View>

          <View style={styles.signatureBlock}>
            <Text style={styles.signTitle}>Mengetahui,</Text>
            <Text style={styles.signName}>{kacabName}</Text>
            <Text style={styles.signRole}>Kepala Cabang</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.confidentialTag}>INTERNAL - RAHASIA</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Halaman ${pageNumber} dari ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* ======================================================== */}
      {/* HALAMAN 2A: TABEL LAPORAN KUNJUNGAN MARKETING             */}
      {/* (Kolom: Nomor, Waktu, Marketing, Nasabah, Alamat, Tujuan, Ket) */}
      {/* ======================================================== */}
      {(category === 'pemasaran' || category === 'semua') && (
        <Page size="A4" orientation="landscape" style={[styles.page, { paddingHorizontal: 24 }]}>
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Laporan Kunjungan Marketing (Pemasaran Dana &amp; Kredit)</Text>
            <Text style={styles.pageSubtitle}>
              Periode: {formatIndonesianDateRange(startDate, endDate)} • Total: {marketingVisits.length} Kunjungan
            </Text>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <Text style={[styles.tableCell, { width: '4%', textAlign: 'center' }]}>No</Text>
              <Text style={[styles.tableCell, { width: '22%' }]}>Waktu (Hari &amp; Tanggal)</Text>
              <Text style={[styles.tableCell, { width: '13%' }]}>Marketing</Text>
              <Text style={[styles.tableCell, { width: '17%' }]}>Nama Calon Nasabah</Text>
              <Text style={[styles.tableCell, { width: '18%' }]}>Alamat</Text>
              <Text style={[styles.tableCell, { width: '12%' }]}>Tujuan Pemasaran</Text>
              <Text style={[styles.tableCell, { width: '14%' }]}>Keterangan</Text>
            </View>

            {marketingVisits.length === 0 ? (
              <View style={[styles.tableRow, { justifyContent: 'center', padding: 8 }]}>
                <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>
                  Tidak ada data kunjungan pemasaran pada periode ini.
                </Text>
              </View>
            ) : (
              marketingVisits.map((v, idx) => (
                <View key={v.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { width: '4%', textAlign: 'center' }]}>
                    {idx + 1}
                  </Text>
                  <Text style={[styles.tableCell, { width: '22%' }]}>
                    {formatIndonesianFullDateTime(v.captured_at)}
                  </Text>
                  <Text style={[styles.tableCell, { width: '13%' }]}>
                    {v.marketing?.full_name || 'Marketing'} ({v.marketing?.marketing_code || '-'})
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellBold, { width: '17%' }]}>
                    {v.customer_name}
                  </Text>
                  <Text style={[styles.tableCell, { width: '18%', color: '#475569' }]}>
                    {v.address || '-'}
                  </Text>
                  <Text style={[styles.tableCell, { width: '12%', color: '#0369a1', fontWeight: 'bold' }]}>
                    {v.product === 'kredit'
                      ? 'Kredit'
                      : v.product === 'tabungan'
                      ? 'Dana (Tabungan)'
                      : v.product === 'deposito'
                      ? 'Dana (Deposito)'
                      : 'Lainnya'}
                  </Text>
                  <Text style={[styles.tableCell, { width: '14%', color: '#334155' }]}>
                    {v.outcome.replace(/_/g, ' ')}
                    {v.potential_value ? ` • ${formatRupiah(v.potential_value)}` : ''}
                    {v.notes ? ` (${v.notes})` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.confidentialTag}>INTERNAL - RAHASIA</Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `Halaman ${pageNumber} dari ${totalPages}`
              }
            />
          </View>
        </Page>
      )}

      {/* ======================================================== */}
      {/* HALAMAN 2B: TABEL LAPORAN PENAGIHAN AO                   */}
      {/* (Kolom: Nomor, Waktu, AO, Debitur, Alamat, Baki Debet, Kolektibilitas, Ket) */}
      {/* ======================================================== */}
      {(category === 'penagihan' || category === 'semua') && (
        <Page size="A4" orientation="landscape" style={[styles.page, { paddingHorizontal: 24 }]}>
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Laporan Penagihan Account Officer (AO)</Text>
            <Text style={styles.pageSubtitle}>
              Periode: {formatIndonesianDateRange(startDate, endDate)} • Total: {collectionVisits.length} Penagihan
            </Text>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <Text style={[styles.tableCell, { width: '4%', textAlign: 'center' }]}>No</Text>
              <Text style={[styles.tableCell, { width: '21%' }]}>Waktu (Hari &amp; Tanggal)</Text>
              <Text style={[styles.tableCell, { width: '12%' }]}>AO</Text>
              <Text style={[styles.tableCell, { width: '16%' }]}>Nama Debitur</Text>
              <Text style={[styles.tableCell, { width: '16%' }]}>Alamat</Text>
              <Text style={[styles.tableCell, { width: '11%', textAlign: 'right' }]}>Baki Debet</Text>
              <Text style={[styles.tableCell, { width: '10%', textAlign: 'center' }]}>Kolektibilitas</Text>
              <Text style={[styles.tableCell, { width: '10%' }]}>Keterangan</Text>
            </View>

            {collectionVisits.length === 0 ? (
              <View style={[styles.tableRow, { justifyContent: 'center', padding: 8 }]}>
                <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>
                  Tidak ada data penagihan pada periode ini.
                </Text>
              </View>
            ) : (
              collectionVisits.map((v, idx) => (
                <View key={v.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { width: '4%', textAlign: 'center' }]}>
                    {idx + 1}
                  </Text>
                  <Text style={[styles.tableCell, { width: '21%' }]}>
                    {formatIndonesianFullDateTime(v.captured_at)}
                  </Text>
                  <Text style={[styles.tableCell, { width: '12%' }]}>
                    {v.marketing?.full_name || 'AO'} ({v.marketing?.marketing_code || '-'})
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellBold, { width: '16%' }]}>
                    {v.customer_name}
                  </Text>
                  <Text style={[styles.tableCell, { width: '16%', color: '#475569' }]}>
                    {v.address || '-'}
                  </Text>
                  <Text style={[styles.tableCell, { width: '11%', textAlign: 'right', fontWeight: 'bold' }]}>
                    {v.baki_debet ? formatRupiah(v.baki_debet) : v.potential_value ? formatRupiah(v.potential_value) : '-'}
                  </Text>
                  <Text style={[styles.tableCell, { width: '10%', textAlign: 'center', color: '#b45309', fontWeight: 'bold' }]}>
                    {v.kolektibilitas ? KOLEKTIBILITAS_LABEL[v.kolektibilitas] || v.kolektibilitas : 'Kol 1'}
                  </Text>
                  <Text style={[styles.tableCell, { width: '10%', color: '#334155' }]}>
                    {v.outcome.replace(/_/g, ' ')}
                    {v.notes ? ` (${v.notes})` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.confidentialTag}>INTERNAL - RAHASIA</Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `Halaman ${pageNumber} dari ${totalPages}`
              }
            />
          </View>
        </Page>
      )}

      {/* ======================================================== */}
      {/* HALAMAN 3+: ALBUM FOTO KISI 2x2 PER MARKETING            */}
      {/* ======================================================== */}
      {marketingSummaries.map((m) => {
        const mVisits = visitsByMarketing.get(m.marketing_id) || [];
        const photoItems: {
          visit: (typeof visits)[0];
          photo: (typeof visits)[0]['visit_photos'][0];
        }[] = [];

        mVisits.forEach((v) => {
          v.visit_photos?.forEach((p) => {
            photoItems.push({ visit: v, photo: p });
          });
        });

        if (photoItems.length === 0) return null;

        const photoPages: (typeof photoItems)[] = [];
        for (let i = 0; i < photoItems.length; i += 4) {
          photoPages.push(photoItems.slice(i, i + 4));
        }

        return (
          <React.Fragment key={m.marketing_id}>
            {photoPages.map((chunk, pageIdx) => (
              <Page key={`${m.marketing_id}_album_${pageIdx}`} size="A4" style={styles.page}>
                <View style={styles.pageHeader}>
                  <Text style={styles.pageTitle}>
                    Album Dokumentasi: {m.marketing_name} ({m.marketing_code})
                  </Text>
                  <Text style={styles.pageSubtitle}>
                    Lembar {pageIdx + 1} dari {photoPages.length} • Format Grid 2x2
                  </Text>
                </View>

                <View style={styles.albumGrid}>
                  {chunk.map(({ visit, photo }, pIdx) => (
                    <View key={`${photo.id}_${pIdx}`} style={styles.albumItem}>
                      <View style={styles.photoBox}>
                        {photo.signedUrl ? (
                          <Image src={photo.signedUrl} style={styles.photoImg} />
                        ) : (
                          <Text
                            style={{
                              color: '#94a3b8',
                              fontSize: 7.5,
                              textAlign: 'center',
                              marginVertical: 'auto',
                            }}
                          >
                            [Foto Ber-Watermark]
                          </Text>
                        )}
                      </View>

                      {/* Keterangan 4 Baris */}
                      <Text style={styles.captionLine1}>
                        {visit.customer_name} — {visit.visit_type.replace(/_/g, ' ')}
                      </Text>
                      <Text style={styles.captionLine2}>
                        {visit.visit_type === 'penagihan'
                          ? `Baki Debet: ${formatRupiah(visit.baki_debet || visit.potential_value || 0)} | ${KOLEKTIBILITAS_LABEL[visit.kolektibilitas || 'kol_1'] || 'Kol 1'}`
                          : `Hasil: ${visit.outcome.replace(/_/g, ' ')} | Produk: ${visit.product}`}
                      </Text>
                      <Text style={styles.captionLine3}>
                        {visit.address || 'Alamat lokasi tercatat'}
                      </Text>
                      <Text style={styles.captionLine4}>
                        {formatWIB(visit.captured_at)} • {visit.lat?.toFixed(5)}, {visit.lng?.toFixed(5)}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.footer} fixed>
                  <Text style={styles.confidentialTag}>INTERNAL - RAHASIA</Text>
                  <Text
                    render={({ pageNumber, totalPages }) =>
                      `Halaman ${pageNumber} dari ${totalPages}`
                    }
                  />
                </View>
              </Page>
            ))}
          </React.Fragment>
        );
      })}

      {/* ======================================================== */}
      {/* HALAMAN TERAKHIR: LEMBAR VERIFIKASI PENGESAHAN           */}
      {/* ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Lembar Pengesahan &amp; Verifikasi</Text>
          <Text style={styles.pageSubtitle}>
            Catatan dan persetujuan resmi Kepala Cabang
          </Text>
        </View>

        <View style={styles.verifBox}>
          <Text style={styles.verifHeading}>
            Catatan &amp; Evaluasi Kepala Cabang:
          </Text>
          <View style={styles.verifLine} />
          <View style={styles.verifLine} />
          <View style={styles.verifLine} />
          <View style={styles.verifLine} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: 30,
          }}
        >
          <View style={{ width: 220, alignItems: 'center' }}>
            <Text style={{ fontSize: 8.5, color: '#334155', marginBottom: 5 }}>
              Semarang, {formatIndonesianDate(new Date())}
            </Text>
            <Text style={{ fontSize: 8.5, color: '#64748b', marginBottom: 45 }}>
              Kepala Cabang,
            </Text>
            <Text style={styles.signName}>{kacabName}</Text>
            <Text style={styles.signRole}>PT BPR BKK (Perseroda)</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.confidentialTag}>INTERNAL - RAHASIA</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Halaman ${pageNumber} dari ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
