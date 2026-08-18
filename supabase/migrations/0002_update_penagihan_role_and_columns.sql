-- ====================================================================
-- MIGRATION 0002: Pembaruan Role Penagihan, Kolom Baki Debet, Realtime, & Storage
-- Salin dan jalankan seluruh isi berkas ini di SQL Editor Supabase Anda
-- ====================================================================

-- 1. Perbarui batasan (CHECK constraint) role pada tabel profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('marketing', 'penagihan', 'kacab', 'admin'));

-- 2. Tambahkan kolom baki_debet dan kolektibilitas pada tabel visits (jika belum ada)
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS baki_debet NUMERIC(18,2);
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS kolektibilitas TEXT 
    CHECK (kolektibilitas IN ('kol_1', 'kol_2', 'kol_3', 'kol_4', 'kol_5'));

-- 3. Perbarui RLS Policies agar Kepala Cabang dan Petugas Penagihan beroperasi lancar

-- 3.1 PROFILES
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT
    USING (
        auth.uid() = id OR public.get_auth_role() IN ('kacab', 'admin')
    );

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
    FOR INSERT
    WITH CHECK (
        public.get_auth_role() IN ('kacab', 'admin')
    );

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE
    USING (
        public.get_auth_role() IN ('kacab', 'admin')
    )
    WITH CHECK (
        public.get_auth_role() IN ('kacab', 'admin')
    );

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles
    FOR DELETE
    USING (
        public.get_auth_role() IN ('kacab', 'admin')
    );

-- 3.2 VISITS
DROP POLICY IF EXISTS "visits_select" ON public.visits;
CREATE POLICY "visits_select" ON public.visits
    FOR SELECT
    USING (
        (public.get_auth_role() IN ('marketing', 'penagihan') AND marketing_id = auth.uid())
        OR public.get_auth_role() IN ('kacab', 'admin')
    );

DROP POLICY IF EXISTS "visits_insert" ON public.visits;
CREATE POLICY "visits_insert" ON public.visits
    FOR INSERT
    WITH CHECK (
        public.get_auth_role() IN ('marketing', 'penagihan') AND marketing_id = auth.uid()
    );

-- 3.3 VISIT_PHOTOS
DROP POLICY IF EXISTS "visit_photos_select" ON public.visit_photos;
CREATE POLICY "visit_photos_select" ON public.visit_photos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.visits v
            WHERE v.id = visit_photos.visit_id
            AND (
                (public.get_auth_role() IN ('marketing', 'penagihan') AND v.marketing_id = auth.uid())
                OR public.get_auth_role() IN ('kacab', 'admin')
            )
        )
    );

DROP POLICY IF EXISTS "visit_photos_insert" ON public.visit_photos;
CREATE POLICY "visit_photos_insert" ON public.visit_photos
    FOR INSERT
    WITH CHECK (
        public.get_auth_role() IN ('marketing', 'penagihan') AND EXISTS (
            SELECT 1 FROM public.visits v
            WHERE v.id = visit_photos.visit_id
            AND v.marketing_id = auth.uid()
        )
    );

-- 3.4 STORAGE — izinkan penagihan mengunggah dan membaca foto
DROP POLICY IF EXISTS "kunjungan_bucket_select" ON storage.objects;
CREATE POLICY "kunjungan_bucket_select" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'kunjungan'
        AND (
            public.get_auth_role() IN ('kacab', 'admin')
            OR (
                public.get_auth_role() IN ('marketing', 'penagihan')
                AND (storage.foldername(name))[3] LIKE (public.get_auth_marketing_code() || '_%')
            )
        )
    );

DROP POLICY IF EXISTS "kunjungan_bucket_insert" ON storage.objects;
CREATE POLICY "kunjungan_bucket_insert" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'kunjungan'
        AND (
            public.get_auth_role() = 'admin'
            OR (
                public.get_auth_role() IN ('marketing', 'penagihan')
                AND (storage.foldername(name))[3] LIKE (public.get_auth_marketing_code() || '_%')
            )
        )
    );

-- 4. Aktifkan Realtime Publikasi Supabase untuk tabel visits & profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'visits'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END $$;

-- 5. Pastikan semua akun kacab dan admin selalu aktif
UPDATE public.profiles SET is_active = true WHERE role IN ('kacab', 'admin');

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
