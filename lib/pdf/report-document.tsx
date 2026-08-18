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
import { formatIndonesianDate, formatIndonesianDateRange } from '@/lib/utils/pdf-date';
import { formatWIB } from '@/lib/utils/time';
import { formatRupiah } from '@/lib/utils/format';
import type { Visit, VisitPhoto, Profile } from '@/lib/types/database';

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  // Universal Header / Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
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

  // 1. Cover Page
  coverContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  coverHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bankName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0369a1',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  branchName: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
    textAlign: 'center',
  },
  dividerLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#0284c7',
    marginTop: 10,
    marginBottom: 40,
  },
  coverTitleBlock: {
    alignItems: 'center',
    marginVertical: 40,
    paddingHorizontal: 20,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitlePeriod: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  dateRangeText: {
    fontSize: 11,
    color: '#334155',
    textAlign: 'center',
  },
  metaBlock: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    width: '80%',
    marginVertical: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    fontSize: 8.5,
  },
  metaLabel: {
    color: '#64748b',
  },
  metaValue: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  signatureBlock: {
    marginTop: 30,
    alignItems: 'center',
    width: 200,
  },
  signTitle: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 50,
  },
  signName: {
    fontSize: 10,
    fontWeight: 'bold',
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    paddingTop: 4,
    width: '100%',
    textAlign: 'center',
  },
  signRole: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },

  // 2. Table Page
  pageHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 6,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  pageSubtitle: {
    fontSize: 8.5,
    color: '#64748b',
    marginTop: 2,
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
    minHeight: 22,
  },
  tableHeaderRow: {
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 8,
    color: '#334155',
  },
  tableRowTotal: {
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    fontWeight: 'bold',
  },
  colMarketing: { width: '22%', paddingLeft: 6 },
  colVisits: { width: '8%', textAlign: 'center' },
  colProspect: { width: '8%', textAlign: 'center' },
  colExisting: { width: '8%', textAlign: 'center' },
  colTagihan: { width: '8%', textAlign: 'center' },
  colRealisasi: { width: '9%', textAlign: 'center' },
  colPotensi: { width: '17%', textAlign: 'right', paddingRight: 6 },
  colHari: { width: '6%', textAlign: 'center' },
  colLate: { width: '7%', textAlign: 'center' },
  colAnomaly: { width: '7%', textAlign: 'center' },

  // 3. Highlight / Insights Page
  highlightCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 4,
  },
  highlightGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  subCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
  },
  subCardLabel: {
    fontSize: 8,
    color: '#64748b',
  },
  subCardValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 2,
  },

  // 4. Marketing Section & Album
  sectionCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#0284c7',
    borderRadius: 12,
    padding: 30,
    marginVertical: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 10,
  },
  sectionBadge: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },

  // Album 2x2 Grid
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  albumItem: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 6,
    backgroundColor: '#ffffff',
  },
  photoBox: {
    width: '100%',
    height: 140,
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
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 1,
  },
  captionLine2: {
    fontSize: 7.5,
    color: '#0369a1',
    marginBottom: 1,
  },
  captionLine3: {
    fontSize: 7,
    color: '#475569',
    marginBottom: 1,
  },
  captionLine4: {
    fontSize: 6.5,
    fontFamily: 'Courier',
    color: '#64748b',
  },

  // 5. Verification Sheet
  verifBox: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 16,
    minHeight: 160,
    marginBottom: 20,
  },
  verifHeading: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  verifLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    height: 24,
  },
});

export interface PDFReportData {
  bankName: string;
  branchName: string;
  reportType: 'harian' | 'mingguan' | 'bulanan';
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

export function ReportPDFDocument({ data }: { data: PDFReportData }) {
  const {
    bankName,
    branchName,
    reportType,
    startDate,
    endDate,
    printedAt,
    printedBy,
    kacabName,
    visits,
    marketingSummaries,
  } = data;

  // Hitung Total Rekap
  const totalRow = marketingSummaries.reduce(
    (acc, m) => ({
      total_visits: acc.total_visits + m.total_visits,
      prospects: acc.prospects + m.prospects,
      existing: acc.existing + m.existing,
      collection: acc.collection + m.collection,
      realization: acc.realization + m.realization,
      potential_value: acc.potential_value + m.potential_value,
      late_count: acc.late_count + m.late_count,
      anomaly_count: acc.anomaly_count + m.anomaly_count,
    }),
    {
      total_visits: 0,
      prospects: 0,
      existing: 0,
      collection: 0,
      realization: 0,
      potential_value: 0,
      late_count: 0,
      anomaly_count: 0,
    }
  );

  // Cari Sorotan: Terbanyak & Tersedikit
  const sortedByVisits = [...marketingSummaries].sort(
    (a, b) => b.total_visits - a.total_visits
  );
  const mostActive = sortedByVisits[0];
  const leastActive = sortedByVisits[sortedByVisits.length - 1];

  // Kunjungan Beranomali
  const anomalyVisits = visits.filter(
    (v) => v.anomaly_flags && v.anomaly_flags.length > 0
  );

  // Kelompokkan Kunjungan per Marketing untuk Album
  const visitsByMarketing = new Map<string, typeof visits>();
  marketingSummaries.forEach((m) => {
    const mVisits = visits.filter((v) => v.marketing_id === m.marketing_id);
    visitsByMarketing.set(m.marketing_id, mVisits);
  });

  return (
    <Document title={`Laporan Kunjungan Marketing - ${data.reportType}`}>
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
            <Text style={styles.mainTitle}>LAPORAN KUNJUNGAN MARKETING</Text>
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
              <Text style={styles.metaLabel}>Total Kunjungan Terekam</Text>
              <Text style={styles.metaValue}>{visits.length} Kunjungan</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Total Realisasi Omzet Potensi</Text>
              <Text style={styles.metaValue}>
                {formatRupiah(totalRow.potential_value)}
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
      {/* HALAMAN 2: REKAP KINERJA PER MARKETING                   */}
      {/* ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Rekapitulasi Kinerja Marketing</Text>
          <Text style={styles.pageSubtitle}>
            Periode: {formatIndonesianDateRange(startDate, endDate)}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            <Text style={styles.colMarketing}>Marketing</Text>
            <Text style={styles.colVisits}>Kunj</Text>
            <Text style={styles.colProspect}>Prospek</Text>
            <Text style={styles.colExisting}>Exist</Text>
            <Text style={styles.colTagihan}>Tagih</Text>
            <Text style={styles.colRealisasi}>Realisasi</Text>
            <Text style={styles.colPotensi}>Potensi (Rp)</Text>
            <Text style={styles.colHari}>Hari</Text>
            <Text style={styles.colLate}>Lwt</Text>
            <Text style={styles.colAnomaly}>Anom</Text>
          </View>

          {marketingSummaries.map((m) => (
            <View key={m.marketing_id} style={styles.tableRow}>
              <Text style={styles.colMarketing}>
                {m.marketing_name} ({m.marketing_code})
              </Text>
              <Text style={styles.colVisits}>{m.total_visits}</Text>
              <Text style={styles.colProspect}>{m.prospects}</Text>
              <Text style={styles.colExisting}>{m.existing}</Text>
              <Text style={styles.colTagihan}>{m.collection}</Text>
              <Text style={styles.colRealisasi}>{m.realization}</Text>
              <Text style={styles.colPotensi}>
                {formatRupiah(m.potential_value)}
              </Text>
              <Text style={styles.colHari}>{m.active_days}</Text>
              <Text style={styles.colLate}>{m.late_count}</Text>
              <Text style={styles.colAnomaly}>{m.anomaly_count}</Text>
            </View>
          ))}

          {/* Baris Total */}
          <View style={[styles.tableRow, styles.tableRowTotal]}>
            <Text style={styles.colMarketing}>TOTAL</Text>
            <Text style={styles.colVisits}>{totalRow.total_visits}</Text>
            <Text style={styles.colProspect}>{totalRow.prospects}</Text>
            <Text style={styles.colExisting}>{totalRow.existing}</Text>
            <Text style={styles.colTagihan}>{totalRow.collection}</Text>
            <Text style={styles.colRealisasi}>{totalRow.realization}</Text>
            <Text style={styles.colPotensi}>
              {formatRupiah(totalRow.potential_value)}
            </Text>
            <Text style={styles.colHari}>-</Text>
            <Text style={styles.colLate}>{totalRow.late_count}</Text>
            <Text style={styles.colAnomaly}>{totalRow.anomaly_count}</Text>
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
      {/* HALAMAN 3: SOROTAN & ANOMALI                              */}
      {/* ======================================================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Sorotan Operasional &amp; Anomali</Text>
          <Text style={styles.pageSubtitle}>
            Evaluasi integritas pencatatan kunjungan
          </Text>
        </View>

        <View style={styles.highlightGrid}>
          <View style={styles.subCard}>
            <Text style={styles.subCardLabel}>Kunjungan Terbanyak</Text>
            <Text style={styles.subCardValue}>
              {mostActive?.marketing_name || '-'} ({mostActive?.total_visits || 0})
            </Text>
          </View>
          <View style={styles.subCard}>
            <Text style={styles.subCardLabel}>Kunjungan Tersedikit</Text>
            <Text style={styles.subCardValue}>
              {leastActive?.marketing_name || '-'} ({leastActive?.total_visits || 0})
            </Text>
          </View>
          <View style={styles.subCard}>
            <Text style={styles.subCardLabel}>Kunjungan Terlambat</Text>
            <Text style={styles.subCardValue}>
              {totalRow.late_count} Kunjungan
            </Text>
          </View>
        </View>

        <View style={styles.highlightCard}>
          <Text style={styles.cardTitle}>
            Daftar Temuan Kunjungan Beranomali ({anomalyVisits.length})
          </Text>
          {anomalyVisits.length === 0 ? (
            <Text style={{ fontSize: 8.5, color: '#64748b' }}>
              Tidak ditemukan indikasi anomali pada periode ini.
            </Text>
          ) : (
            anomalyVisits.slice(0, 10).map((av, idx) => (
              <View
                key={av.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 3,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f1f5f9',
                }}
              >
                <Text style={{ fontSize: 8, width: '45%' }}>
                  {idx + 1}. {av.customer_name} ({av.marketing?.full_name})
                </Text>
                <Text style={{ fontSize: 7.5, width: '25%', color: '#64748b' }}>
                  {formatWIB(av.captured_at)}
                </Text>
                <Text style={{ fontSize: 7.5, width: '30%', color: '#dc2626', fontWeight: 'bold' }}>
                  {av.anomaly_flags?.join(', ')}
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

      {/* ======================================================== */}
      {/* HALAMAN 4+: ALBUM FOTO PER MARKETING (GRID 2x2)          */}
      {/* ======================================================== */}
      {marketingSummaries.map((m) => {
        const mVisits = visitsByMarketing.get(m.marketing_id) || [];
        // Flatten photos with visit context
        const photoItems: {
          visit: (typeof visits)[0];
          photo: (typeof visits)[0]['visit_photos'][0];
        }[] = [];

        mVisits.forEach((v) => {
          v.visit_photos?.forEach((p) => {
            photoItems.push({ visit: v, photo: p });
          });
        });

        // Split photos into chunks of 4 (2x2 grid per page)
        const photoPages: (typeof photoItems)[] = [];
        for (let i = 0; i < photoItems.length; i += 4) {
          photoPages.push(photoItems.slice(i, i + 4));
        }

        return (
          <React.Fragment key={m.marketing_id}>
            {/* Halaman Pembatas Marketing */}
            <Page size="A4" style={styles.page}>
              <View style={styles.sectionCover}>
                <Text style={styles.sectionBadge}>
                  KODE: {m.marketing_code}
                </Text>
                <Text style={styles.sectionTitle}>{m.marketing_name}</Text>
                <Text
                  style={{
                    fontSize: 9,
                    color: '#64748b',
                    marginTop: 6,
                    textAlign: 'center',
                  }}
                >
                  Total Kunjungan: {m.total_visits} • Realisasi: {m.realization} • Potensi: {formatRupiah(m.potential_value)}
                </Text>
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

            {/* Halaman-Halaman Album Foto (4 Foto per Halaman) */}
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
                              fontSize: 8,
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
                        Hasil: {visit.outcome.replace(/_/g, ' ')} | Produk: {visit.product}
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
      {/* HALAMAN TERAKHIR: LEMBAR VERIFIKASI KEPALA CABANG        */}
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
            marginTop: 40,
          }}
        >
          <View style={{ width: 220, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: '#334155', marginBottom: 6 }}>
              Semarang, {formatIndonesianDate(new Date())}
            </Text>
            <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 50 }}>
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
