-- ====================================================================
-- MIGRATION 0004: Perbaiki policy INSERT audit_log
-- Policy 0003 terlalu longgar (auth.uid() IS NOT NULL).
-- Ganti dengan policy yang memaksa actor_id = auth.uid().
-- Audit log bersifat immutable: tidak ada UPDATE/DELETE.
-- ====================================================================

-- Hapus policy lama dari migrasi 0003
DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;

-- Policy baru: user hanya boleh insert baris dengan actor_id milik sendiri
CREATE POLICY "audit_log_insert_own" ON public.audit_log
    FOR INSERT
    WITH CHECK (auth.uid() = actor_id);

NOTIFY pgrst, 'reload schema';
