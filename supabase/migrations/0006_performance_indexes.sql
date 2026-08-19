-- ====================================================================
-- MIGRATION 0006: Performance Indexes for Filtering, Search, & Pagination
-- Stage 5 Performance Optimization for SIKUMA PT BPR BKK
-- ====================================================================

-- 1. Indeks komposit untuk kueri riwayat dan agregasi per marketing
CREATE INDEX IF NOT EXISTS idx_visits_marketing_captured
    ON public.visits (marketing_id, captured_at DESC);

-- 2. Indeks untuk sorting kronologis dan rentang tanggal cepat di Dasbor
CREATE INDEX IF NOT EXISTS idx_visits_captured_at_desc
    ON public.visits (captured_at DESC);

-- 3. Indeks untuk filter status verifikasi (pending, verified, rejected)
CREATE INDEX IF NOT EXISTS idx_visits_verification_status
    ON public.visits (verification_status);

-- 4. Indeks GIN untuk filter array anomaly_flags cepat
CREATE INDEX IF NOT EXISTS idx_visits_anomaly_flags_gin
    ON public.visits USING GIN (anomaly_flags);

-- 5. Indeks foreign key visit_photos untuk relasi JOIN cepat
CREATE INDEX IF NOT EXISTS idx_visit_photos_visit_id
    ON public.visit_photos (visit_id);

-- 6. Indeks audit_log untuk pencarian urutan log audit terbaru
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_desc
    ON public.audit_log (created_at DESC);

NOTIFY pgrst, 'reload schema';
