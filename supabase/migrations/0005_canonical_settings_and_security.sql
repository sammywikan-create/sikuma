-- ====================================================================
-- MIGRATION 0005: Canonical Settings, Photo Hash Check, and Explicit RLS
-- Idempotent migration for SIKUMA Stage 2
-- ====================================================================

-- 1. NORMALISASI DAN KONSISTENSI APP_SETTINGS
DO $$
BEGIN
    -- Konversi retensi_foto_bulan ke retensi_foto_hari jika masih ada
    IF EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'retensi_foto_bulan') THEN
        INSERT INTO public.app_settings (key, value)
        VALUES ('retensi_foto_hari', '730'::jsonb)
        ON CONFLICT (key) DO NOTHING;

        DELETE FROM public.app_settings WHERE key = 'retensi_foto_bulan';
    END IF;
END $$;

-- Pastikan seluruh himpunan kunci kanonik terisi dengan nilai baku
INSERT INTO public.app_settings (key, value) VALUES
    ('target_kunjungan_harian', '4'::jsonb),
    ('target_penagihan_harian', '5'::jsonb),
    ('jam_batas_unggah', '"21:00"'::jsonb),
    ('retensi_foto_hari', '730'::jsonb),
    ('nama_aplikasi', '"SIKUMA - BANK BKK"'::jsonb),
    ('nama_cabang', '"KANTOR CABANG UTAMA SEMARANG"'::jsonb),
    ('nama_kepala_cabang', '"Budi Santoso, S.E."'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- 2. FUNGSI PENGECEKAN DUPLIKASI FOTO LINTAS PENGGUNA (SECURITY DEFINER)
-- Fungsi ini hanya mengembalikan hash sha256 yang sudah terdaftar tanpa membocorkan pemilik/data kunjungan
CREATE OR REPLACE FUNCTION public.check_photo_hash_exists(hashes text[])
RETURNS TABLE(sha256 text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT DISTINCT vp.sha256
    FROM public.visit_photos vp
    WHERE vp.sha256 IS NOT NULL
      AND vp.sha256 = ANY(hashes);
$$;

-- Berikan hak eksekusi hanya kepada authenticated users
REVOKE ALL ON FUNCTION public.check_photo_hash_exists(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_photo_hash_exists(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_photo_hash_exists(text[]) TO service_role;


-- 3. EKSPLISITASI RLS VISIT_PHOTOS_SELECT
-- Pemilik kunjungan (marketing/penagihan) atau Kepala Cabang / Admin
DROP POLICY IF EXISTS "visit_photos_select" ON public.visit_photos;
CREATE POLICY "visit_photos_select" ON public.visit_photos
    FOR SELECT
    USING (
        (public.get_auth_role() IN ('marketing', 'penagihan') AND EXISTS (
            SELECT 1 FROM public.visits v
            WHERE v.id = visit_photos.visit_id
            AND v.marketing_id = auth.uid()
        ))
        OR public.get_auth_role() IN ('kacab', 'admin')
    );


-- 4. PENEGASAN STORAGE IMMUTABILITY
-- Hapus kemungkinan policy update pada bucket kunjungan (berkas bersifat append-only)
DROP POLICY IF EXISTS "kunjungan_bucket_update" ON storage.objects;

NOTIFY pgrst, 'reload schema';
