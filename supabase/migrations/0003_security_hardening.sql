-- ====================================================================
-- MIGRATION 0003: Perbaikan Keamanan — Policy Audit Log
-- Salin dan jalankan seluruh isi berkas ini di SQL Editor Supabase
-- ====================================================================

-- 1. Tambah policy INSERT untuk audit_log
-- Semua pengguna terautentikasi boleh menulis log audit
DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert" ON public.audit_log
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- 2. Reload schema cache
NOTIFY pgrst, 'reload schema';
