-- Migration 0001_init.sql
-- Inisialisasi Skema SIKUMA (Bank BKK)

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABEL PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    marketing_code TEXT UNIQUE, -- contoh: MKT01 (hanya untuk role marketing)
    role TEXT NOT NULL CHECK (role IN ('marketing', 'kacab', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABEL VISITS
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_uuid TEXT NOT NULL UNIQUE,
    marketing_id UUID NOT NULL REFERENCES public.profiles(id),
    customer_name TEXT NOT NULL,
    visit_type TEXT NOT NULL CHECK (visit_type IN ('prospek_baru', 'nasabah_existing', 'penagihan', 'survei_jaminan', 'maintenance')),
    product TEXT NOT NULL CHECK (product IN ('tabungan', 'deposito', 'kredit', 'lainnya')),
    outcome TEXT NOT NULL CHECK (outcome IN ('berminat', 'follow_up', 'realisasi', 'tidak_berminat', 'tidak_ditemui')),
    potential_value NUMERIC(18,2),
    notes TEXT,
    captured_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy_m DOUBLE PRECISION NOT NULL,
    address TEXT,
    anomaly_flags TEXT[] NOT NULL DEFAULT '{}',
    is_late BOOLEAN NOT NULL DEFAULT false,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    verifier_note TEXT
);

-- 4. TABEL VISIT_PHOTOS
CREATE TABLE IF NOT EXISTS public.visit_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    bytes INTEGER,
    width INTEGER,
    height INTEGER,
    sha256 TEXT,
    sort_order SMALLINT NOT NULL DEFAULT 1
);

-- 5. TABEL AUDIT_LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. TABEL APP_SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- Inisialisasi Data Pengaturan Awal
INSERT INTO public.app_settings (key, value) VALUES
    ('target_kunjungan_harian', '4'::jsonb),
    ('jam_batas_unggah', '"21:00"'::jsonb),
    ('retensi_foto_bulan', '24'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 7. HELPER FUNCTIONS UNTUK RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_marketing_code()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT marketing_code FROM public.profiles WHERE id = auth.uid();
$$;

-- 8. TRIGGER: AUDIT LOG UNTUK VERIFIKASI VISITS & CEK KOLOM UPDATE
CREATE OR REPLACE FUNCTION public.handle_visit_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validasi hanya kolom verifikasi yang boleh diubah
    IF (OLD.client_uuid <> NEW.client_uuid OR
        OLD.marketing_id <> NEW.marketing_id OR
        OLD.customer_name <> NEW.customer_name OR
        OLD.visit_type <> NEW.visit_type OR
        OLD.product <> NEW.product OR
        OLD.outcome <> NEW.outcome OR
        OLD.potential_value IS DISTINCT FROM NEW.potential_value OR
        OLD.notes IS DISTINCT FROM NEW.notes OR
        OLD.captured_at <> NEW.captured_at OR
        OLD.lat <> NEW.lat OR
        OLD.lng <> NEW.lng OR
        OLD.accuracy_m <> NEW.accuracy_m OR
        OLD.address IS DISTINCT FROM NEW.address) THEN
        RAISE EXCEPTION 'Data kunjungan bersifat append-only. Hanya kolom status verifikasi yang boleh diubah.';
    END IF;

    -- Catat log audit verifikasi
    IF (OLD.verification_status <> NEW.verification_status OR
        OLD.verifier_note IS DISTINCT FROM NEW.verifier_note) THEN
        INSERT INTO public.audit_log (actor_id, action, entity, entity_id, payload)
        VALUES (
            auth.uid(),
            'VERIFY_VISIT',
            'visits',
            NEW.id::text,
            jsonb_build_object(
                'previous_status', OLD.verification_status,
                'new_status', NEW.verification_status,
                'verifier_note', NEW.verifier_note,
                'verified_at', NEW.verified_at
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_visit_update ON public.visits;
CREATE TRIGGER tr_visit_update
BEFORE UPDATE ON public.visits
FOR EACH ROW
EXECUTE FUNCTION public.handle_visit_update();

-- 9. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS pada semua tabel
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 9.1 RLS PROFILES
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
        public.get_auth_role() = 'admin'
    );

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE
    USING (
        public.get_auth_role() = 'admin'
    )
    WITH CHECK (
        public.get_auth_role() = 'admin'
    );

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles
    FOR DELETE
    USING (
        public.get_auth_role() = 'admin'
    );

-- 9.2 RLS VISITS
-- Marketing hanya boleh SELECT datanya sendiri. Kacab dan admin boleh SELECT semua.
DROP POLICY IF EXISTS "visits_select" ON public.visits;
CREATE POLICY "visits_select" ON public.visits
    FOR SELECT
    USING (
        (public.get_auth_role() = 'marketing' AND marketing_id = auth.uid())
        OR public.get_auth_role() IN ('kacab', 'admin')
    );

-- Marketing boleh INSERT hanya untuk dirinya sendiri.
DROP POLICY IF EXISTS "visits_insert" ON public.visits;
CREATE POLICY "visits_insert" ON public.visits
    FOR INSERT
    WITH CHECK (
        public.get_auth_role() = 'marketing' AND marketing_id = auth.uid()
    );

-- Hanya Kacab dan Admin yang boleh UPDATE (kolom dibatasi oleh trigger).
DROP POLICY IF EXISTS "visits_update" ON public.visits;
CREATE POLICY "visits_update" ON public.visits
    FOR UPDATE
    USING (
        public.get_auth_role() IN ('kacab', 'admin')
    )
    WITH CHECK (
        public.get_auth_role() IN ('kacab', 'admin')
    );

-- Dilarang DELETE kunjungan (kecuali service role untuk maintenance)
DROP POLICY IF EXISTS "visits_delete" ON public.visits;
CREATE POLICY "visits_delete" ON public.visits
    FOR DELETE
    USING (false);

-- 9.3 RLS VISIT_PHOTOS
-- Mengikuti hak akses visit induknya
DROP POLICY IF EXISTS "visit_photos_select" ON public.visit_photos;
CREATE POLICY "visit_photos_select" ON public.visit_photos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.visits v
            WHERE v.id = visit_photos.visit_id
        )
    );

DROP POLICY IF EXISTS "visit_photos_insert" ON public.visit_photos;
CREATE POLICY "visit_photos_insert" ON public.visit_photos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.visits v
            WHERE v.id = visit_photos.visit_id
            AND v.marketing_id = auth.uid()
        )
    );

-- 9.4 RLS AUDIT_LOG
-- Hanya kacab dan admin boleh membaca log audit
DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log
    FOR SELECT
    USING (
        public.get_auth_role() IN ('kacab', 'admin')
    );

-- 9.5 RLS APP_SETTINGS
-- Semua pengguna terautentikasi dapat membaca konfigurasi aplikasi
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select" ON public.app_settings
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "app_settings_write" ON public.app_settings;
CREATE POLICY "app_settings_write" ON public.app_settings
    FOR ALL
    USING (
        public.get_auth_role() = 'admin'
    )
    WITH CHECK (
        public.get_auth_role() = 'admin'
    );

-- 10. STORAGE BUCKET & STORAGE RLS POLICIES
-- Buat bucket privat 'kunjungan'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kunjungan', 'kunjungan', false, 10485760, ARRAY['image/jpeg', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg'];

-- Policy Storage: SELECT
-- Kacab dan Admin bisa membaca semua berkas
-- Marketing hanya bisa membaca berkas di path dengan kode marketing miliknya
-- Pola path: {tahun}/{bulan-2digit}/{marketing_code}_{nama_slug}/{YYYY-MM-DD}/{berkas}.jpg
DROP POLICY IF EXISTS "kunjungan_bucket_select" ON storage.objects;
CREATE POLICY "kunjungan_bucket_select" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'kunjungan'
        AND (
            public.get_auth_role() IN ('kacab', 'admin')
            OR (
                public.get_auth_role() = 'marketing'
                AND (storage.foldername(name))[3] LIKE (public.get_auth_marketing_code() || '_%')
            )
        )
    );

-- Policy Storage: INSERT
-- Marketing hanya bisa mengunggah ke prefix miliknya sendiri
DROP POLICY IF EXISTS "kunjungan_bucket_insert" ON storage.objects;
CREATE POLICY "kunjungan_bucket_insert" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'kunjungan'
        AND (
            public.get_auth_role() = 'admin'
            OR (
                public.get_auth_role() = 'marketing'
                AND (storage.foldername(name))[3] LIKE (public.get_auth_marketing_code() || '_%')
            )
        )
    );
