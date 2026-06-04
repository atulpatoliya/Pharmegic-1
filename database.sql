-- PHARMEGIC HEALTHCARE DATABASE SCHEMA (MASTER VERSION)
-- PostgreSQL schema for Supabase — Custom Auth (no Supabase Auth)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DROP EXISTING OBJECTS
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_changed ON auth.users;
DROP TRIGGER IF EXISTS trg_sync_clients_columns ON public.clients;
DROP TRIGGER IF EXISTS trg_sync_chemicals_columns ON public.chemicals;
DROP TRIGGER IF EXISTS trg_sync_tcc_applications_columns ON public.tcc_applications;
DROP TRIGGER IF EXISTS trg_sync_certificates_columns ON public.certificates;

DROP TABLE IF EXISTS public.internal_notes CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.quota_transactions CASCADE;
DROP TABLE IF EXISTS public.templates CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.tcc_applications CASCADE;
DROP TABLE IF EXISTS public.client_chemicals CASCADE;
DROP TABLE IF EXISTS public.client_permissions CASCADE;
DROP TABLE IF EXISTS public.chemicals CASCADE;
DROP TABLE IF EXISTS public.client_contacts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.admin_settings CASCADE;

DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.client_status CASCADE;
DROP TYPE IF EXISTS public.chemical_status CASCADE;
DROP TYPE IF EXISTS public.tcc_status CASCADE;
DROP TYPE IF EXISTS public.certificate_status CASCADE;

-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE public.user_role AS ENUM ('SUPER_ADMIN', 'MASTER_ADMIN', 'CLIENT');
CREATE TYPE public.client_status AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE public.chemical_status AS ENUM ('active', 'inactive');
CREATE TYPE public.tcc_status AS ENUM ('pending', 'approved', 'rejected', 'changes_required', 'expired');
CREATE TYPE public.certificate_status AS ENUM ('active', 'expired', 'revoked');

-- ============================================================================
-- 1. ADMIN SETTINGS (Singleton)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    full_name TEXT DEFAULT 'Admin User',
    mobile_number TEXT DEFAULT '',
    email TEXT DEFAULT 'directoratulpatoliya@gmail.com',
    cc_emails TEXT DEFAULT '',
    bcc_emails TEXT DEFAULT '',
    timezone TEXT DEFAULT 'UTC',
    profile_image TEXT,
    -- SMTP Settings
    smtp_host TEXT DEFAULT '',
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT DEFAULT '',
    smtp_pass TEXT DEFAULT '',
    smtp_from TEXT DEFAULT '',
    smtp_cc_default TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- ============================================================================
-- 2. CLIENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Company Profile
    company_name TEXT NOT NULL,
    legal_name TEXT,
    uuid_number TEXT UNIQUE,
    registration_number TEXT,
    owner_name TEXT,

    -- Location
    address TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Turkey',

    -- Primary Contact
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    primary_contact_first_name TEXT,
    primary_contact_last_name TEXT,
    cc_emails TEXT,
    cc_phones TEXT,

    -- System
    status public.client_status DEFAULT 'pending'
);

-- ============================================================================
-- 3. USERS TABLE (Custom Auth — NOT linked to Supabase Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'CLIENT',
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    is_disabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 4. CLIENT CONTACTS (Secondary)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 5. CHEMICALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chemicals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chemical_name TEXT NOT NULL,
    cas_number TEXT UNIQUE NOT NULL,
    ec_number TEXT,
    tonnage_band TEXT,
    available_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (available_quantity >= 0),
    exported_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (exported_quantity >= 0),
    validity_date DATE,
    status public.chemical_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 6. CLIENT CHEMICALS (Authorized Chemicals per Client — with quota)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_chemicals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    chemical_id UUID NOT NULL REFERENCES public.chemicals(id) ON DELETE CASCADE,
    available_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (available_quantity >= 0),
    validity_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(client_id, chemical_id)
);

-- ============================================================================
-- 7. TCC APPLICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tcc_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id TEXT UNIQUE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    chemical_id UUID NOT NULL REFERENCES public.chemicals(id) ON DELETE CASCADE,
    client_chemical_id UUID REFERENCES public.client_chemicals(id) ON DELETE SET NULL,
    quantity_mt NUMERIC(12, 2) NOT NULL CHECK (quantity_mt > 0),
    export_date DATE,
    kkdik_reg_no TEXT,
    remarks TEXT,
    status public.tcc_status DEFAULT 'pending',
    rejection_reason TEXT,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 8. CERTIFICATES TABLE (with mail tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_number TEXT UNIQUE NOT NULL,
    tcc_application_id UUID REFERENCES public.tcc_applications(id) ON DELETE CASCADE UNIQUE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'TCC',
    file_url TEXT,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    status public.certificate_status DEFAULT 'active',
    -- Mail tracking
    mail_sent BOOLEAN NOT NULL DEFAULT false,
    mail_sent_at TIMESTAMP WITH TIME ZONE,
    mail_sent_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    mail_resend_count INTEGER NOT NULL DEFAULT 0,
    last_resend_at TIMESTAMP WITH TIME ZONE,
    last_resend_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 9. QUOTA TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quota_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    chemical_id UUID NOT NULL REFERENCES public.chemicals(id) ON DELETE CASCADE,
    tcc_application_id UUID REFERENCES public.tcc_applications(id) ON DELETE SET NULL,
    quantity_mt NUMERIC(12, 2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deduct', 'restore', 'assign')),
    performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 10. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 11. ACTIVITY LOGS TABLE (per client timeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 12. AUDIT LOGS (general system audit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 13. INTERNAL NOTES (admin-only notes per client)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.internal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 14. TEMPLATES TABLE (Certificate Branding)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logo TEXT,
    accent_color TEXT DEFAULT '#064e3b' NOT NULL,
    footer_text TEXT,
    signature_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_client_id ON public.users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON public.client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_chemicals_cas ON public.chemicals(cas_number);
CREATE INDEX IF NOT EXISTS idx_client_chemicals_client ON public.client_chemicals(client_id);
CREATE INDEX IF NOT EXISTS idx_tcc_applications_client_id ON public.tcc_applications(client_id);
CREATE INDEX IF NOT EXISTS idx_tcc_applications_status ON public.tcc_applications(status);
CREATE INDEX IF NOT EXISTS idx_certificates_client_id ON public.certificates(client_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON public.certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_activity_logs_client ON public.activity_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_quota_transactions_client ON public.quota_transactions(client_id);

-- ============================================================================
-- AUTO-UPDATE updated_at TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_client_chemicals_updated_at
    BEFORE UPDATE ON public.client_chemicals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tcc_applications_updated_at
    BEFORE UPDATE ON public.tcc_applications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_internal_notes_updated_at
    BEFORE UPDATE ON public.internal_notes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcc_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Since we use custom JWT sessions (not Supabase Auth), all DB access
-- goes through the service-role admin client on the server.
-- RLS policies below are for defence-in-depth using service_role bypass.

-- Allow service_role full access to all tables (server-side API uses admin client)
-- All client-facing queries use the anon key but are handled server-side.

CREATE POLICY "Service role full access" ON public.admin_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.client_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.chemicals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.client_chemicals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.tcc_applications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.certificates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.quota_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.activity_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.internal_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Default admin settings
INSERT INTO public.admin_settings (id, full_name, email)
VALUES (1, 'Admin User', 'directoratulpatoliya@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- Default branding template
INSERT INTO public.templates (id, logo, accent_color, footer_text, signature_image)
VALUES (
  'd4e30b6f-6c18-472e-8d8a-36fb644b9b94',
  null,
  '#064e3b',
  'Pharmegic Healthcare Compliance Division. For verification, scan the QR code.',
  null
) ON CONFLICT DO NOTHING;

-- Seed chemicals
INSERT INTO public.chemicals (chemical_name, cas_number, ec_number, tonnage_band, validity_date, available_quantity, exported_quantity, status)
VALUES
('Ethylene Glycol Monoethyl Ether', '110-80-5', '203-804-1', '10-100 tonnes', '2027-12-31', 150.00, 25.50, 'active'),
('N-Methyl-2-pyrrolidone (NMP)', '872-50-4', '212-828-1', '100-1000 tonnes', '2028-06-30', 800.00, 120.00, 'active'),
('Trichloroethylene', '79-01-6', '201-167-4', '1-10 tonnes', '2026-12-31', 8.50, 1.20, 'active'),
('Dimethylformamide (DMF)', '68-12-2', '200-679-5', '100-1000 tonnes', '2027-09-15', 500.00, 0.00, 'active')
ON CONFLICT (cas_number) DO NOTHING;

-- Seed initial administration credentials
-- Password hash corresponds to 'Admin@1234' with 12 bcrypt salt rounds
INSERT INTO public.users (email, password_hash, role, is_disabled)
VALUES 
('atul.patoliya@gmail.com', '$2b$12$nFbwz4f2OVFV.oISYd028emI1rdc58Zoi5BxRnfXtbaKFa9D3u9pm', 'SUPER_ADMIN', false),
('directoratulpatoliya@gmail.com', '$2b$12$oe./N.URUVDKV90AQARTieIOl0MmvZ68jX9skCUtEtTK6ppWHnxOq', 'MASTER_ADMIN', false)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

