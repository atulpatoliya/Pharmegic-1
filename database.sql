-- PHARMEGIC HEALTHCARE DATABASE SCHEMA (COMBINED UNIFIED VERSION)
-- PostgreSQL schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DROP EXISTING TABLES AND TYPES TO ENSURE CLEAN INSTALLATION
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_changed ON auth.users;

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

-- Create Enums
CREATE TYPE public.user_role AS ENUM ('MASTER_ADMIN', 'CLIENT', 'STAFF');
CREATE TYPE public.client_status AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE public.chemical_status AS ENUM ('active', 'inactive');
CREATE TYPE public.tcc_status AS ENUM ('pending', 'approved', 'rejected', 'modification_requested');
CREATE TYPE public.certificate_status AS ENUM ('active', 'expired', 'revoked');

-- 1. ADMIN SETTINGS TABLE (Singleton pattern)
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    full_name TEXT DEFAULT 'Admin User',
    mobile_number TEXT DEFAULT '',
    email TEXT DEFAULT 'directoratulpatoliya@gmail.com',
    cc_emails TEXT DEFAULT '',
    bcc_emails TEXT DEFAULT '',
    timezone TEXT DEFAULT 'UTC',
    profile_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- 2. CLIENTS TABLE (Combined)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Company Profile (Mapped)
    name TEXT,
    company_name TEXT,
    uuid UUID UNIQUE DEFAULT gen_random_uuid(),
    uuid_number TEXT UNIQUE,
    registration_number TEXT,
    legal_name TEXT,
    
    -- Location
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT,
    
    -- Contacts
    email TEXT UNIQUE NOT NULL,
    email2 TEXT,
    email3 TEXT,
    phone TEXT,
    phone1 TEXT,
    phone2 TEXT,
    phone3 TEXT,
    owner_name TEXT,
    contact_person TEXT,
    
    -- System
    status TEXT DEFAULT 'pending',
    auth_user_id UUID
);

-- 3. USERS TABLE (Linked to Supabase Auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY, -- References auth.users(id)
    email TEXT NOT NULL UNIQUE,
    role public.user_role DEFAULT 'CLIENT'::public.user_role NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add ForeignKey constraints to clients if not exist
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS fk_clients_auth_user;
ALTER TABLE public.clients ADD CONSTRAINT fk_clients_auth_user FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. CLIENT CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.client_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    person_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. CHEMICALS TABLE (Combined)
CREATE TABLE IF NOT EXISTS public.chemicals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    chemical_name TEXT,
    cas_number TEXT UNIQUE,
    ec_number TEXT,
    description TEXT,
    tonnage_band TEXT,
    validity_date DATE,
    available_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (available_quantity >= 0),
    exported_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (exported_quantity >= 0),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CLIENT PERMISSIONS (Authorized Chemicals & Quotas - from alternative schema)
CREATE TABLE IF NOT EXISTS public.client_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    chemical_id UUID REFERENCES public.chemicals(id) ON DELETE CASCADE,
    tonnage_band TEXT NOT NULL,
    annual_quota_mt NUMERIC NOT NULL,
    exported_mt NUMERIC DEFAULT 0,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Pending Renewal', 'Expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, chemical_id)
);

-- 7. CLIENT CHEMICALS MAPPING TABLE (from original schema)
CREATE TABLE IF NOT EXISTS public.client_chemicals (
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    chemical_id UUID NOT NULL REFERENCES public.chemicals(id) ON DELETE CASCADE,
    PRIMARY KEY (client_id, chemical_id)
);

-- 8. TCC APPLICATIONS TABLE (Combined)
CREATE TABLE IF NOT EXISTS public.tcc_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id TEXT UNIQUE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    chemical_id UUID NOT NULL REFERENCES public.chemicals(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.client_permissions(id) ON DELETE SET NULL,
    quantity_mt NUMERIC(12, 2) NOT NULL CHECK (quantity_mt > 0),
    expected_export_date DATE,
    export_date DATE,
    kkdik_registration_number TEXT,
    kkdik_reg_no TEXT,
    status TEXT DEFAULT 'pending',
    rejection_reason TEXT,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. CERTIFICATES TABLE (Combined)
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_number TEXT UNIQUE NOT NULL,
    tcc_application_id UUID REFERENCES public.tcc_applications(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.tcc_applications(id) ON DELETE CASCADE UNIQUE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'TCC',
    file_url TEXT,
    pdf_url TEXT,
    issued_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. TEMPLATES TABLE (Certificate Branding Layout)
CREATE TABLE IF NOT EXISTS public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logo TEXT, -- Storage URL or base64
    accent_color TEXT DEFAULT '#064e3b' NOT NULL,
    footer_text TEXT,
    signature_image TEXT, -- Storage URL or base64
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_client_chemicals_ids ON public.client_chemicals(client_id, chemical_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_users_client_id ON public.users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON public.client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_chemicals_cas ON public.chemicals(cas_number);
CREATE INDEX IF NOT EXISTS idx_tcc_applications_client_id ON public.tcc_applications(client_id);
CREATE INDEX IF NOT EXISTS idx_tcc_applications_status ON public.tcc_applications(status);
CREATE INDEX IF NOT EXISTS idx_certificates_client_id ON public.certificates(client_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read);


-- ============================================================================
-- COLUMNS SYNC TRIGGERS (Ensures compatibility between both database designs)
-- ============================================================================

-- 1. Clients Sync
CREATE OR REPLACE FUNCTION public.sync_clients_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync company_name and name
    IF NEW.company_name IS NOT NULL AND (OLD.company_name IS NULL OR NEW.company_name <> OLD.company_name) THEN
        NEW.name := NEW.company_name;
    ELSIF NEW.name IS NOT NULL AND (OLD.name IS NULL OR NEW.name <> OLD.name) THEN
        NEW.company_name := NEW.name;
    END IF;

    -- Sync uuid and uuid_number
    IF NEW.uuid IS NOT NULL AND (OLD.uuid IS NULL OR NEW.uuid <> OLD.uuid) THEN
        NEW.uuid_number := NEW.uuid::text;
    ELSIF NEW.uuid_number IS NOT NULL AND (OLD.uuid_number IS NULL OR NEW.uuid_number <> OLD.uuid_number) THEN
        BEGIN
            NEW.uuid := NEW.uuid_number::uuid;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- Sync owner_name and contact_person
    IF NEW.owner_name IS NOT NULL AND (OLD.owner_name IS NULL OR NEW.owner_name <> OLD.owner_name) THEN
        NEW.contact_person := NEW.owner_name;
    ELSIF NEW.contact_person IS NOT NULL AND (OLD.contact_person IS NULL OR NEW.contact_person <> OLD.contact_person) THEN
        NEW.owner_name := NEW.contact_person;
    END IF;

    -- Sync phone and phone1
    IF NEW.phone IS NOT NULL AND (OLD.phone IS NULL OR NEW.phone <> OLD.phone) THEN
        NEW.phone1 := NEW.phone;
    ELSIF NEW.phone1 IS NOT NULL AND (OLD.phone1 IS NULL OR NEW.phone1 <> OLD.phone1) THEN
        NEW.phone := NEW.phone1;
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_clients_columns ON public.clients;
CREATE TRIGGER trg_sync_clients_columns
    BEFORE INSERT OR UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.sync_clients_columns();


-- 2. Chemicals Sync
CREATE OR REPLACE FUNCTION public.sync_chemicals_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.chemical_name IS NOT NULL AND (OLD.chemical_name IS NULL OR NEW.chemical_name <> OLD.chemical_name) THEN
        NEW.name := NEW.chemical_name;
    ELSIF NEW.name IS NOT NULL AND (OLD.name IS NULL OR NEW.name <> OLD.name) THEN
        NEW.chemical_name := NEW.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_chemicals_columns ON public.chemicals;
CREATE TRIGGER trg_sync_chemicals_columns
    BEFORE INSERT OR UPDATE ON public.chemicals
    FOR EACH ROW EXECUTE FUNCTION public.sync_chemicals_columns();


-- 3. TCC Applications Sync
CREATE OR REPLACE FUNCTION public.sync_tcc_applications_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync export_date and expected_export_date
    IF NEW.export_date IS NOT NULL AND (OLD.export_date IS NULL OR NEW.export_date <> OLD.export_date) THEN
        NEW.expected_export_date := NEW.export_date;
    ELSIF NEW.expected_export_date IS NOT NULL AND (OLD.expected_export_date IS NULL OR NEW.expected_export_date <> OLD.expected_export_date) THEN
        NEW.export_date := NEW.expected_export_date;
    END IF;

    -- Sync kkdik_reg_no and kkdik_registration_number
    IF NEW.kkdik_reg_no IS NOT NULL AND (OLD.kkdik_reg_no IS NULL OR NEW.kkdik_reg_no <> OLD.kkdik_reg_no) THEN
        NEW.kkdik_registration_number := NEW.kkdik_reg_no;
    ELSIF NEW.kkdik_registration_number IS NOT NULL AND (OLD.kkdik_registration_number IS NULL OR NEW.kkdik_registration_number <> OLD.kkdik_registration_number) THEN
        NEW.kkdik_reg_no := NEW.kkdik_registration_number;
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_tcc_applications_columns ON public.tcc_applications;
CREATE TRIGGER trg_sync_tcc_applications_columns
    BEFORE INSERT OR UPDATE ON public.tcc_applications
    FOR EACH ROW EXECUTE FUNCTION public.sync_tcc_applications_columns();


-- 4. Certificates Sync
CREATE OR REPLACE FUNCTION public.sync_certificates_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync tcc_application_id and application_id
    IF NEW.application_id IS NOT NULL AND (OLD.application_id IS NULL OR NEW.application_id <> OLD.application_id) THEN
        NEW.tcc_application_id := NEW.application_id;
    ELSIF NEW.tcc_application_id IS NOT NULL AND (OLD.tcc_application_id IS NULL OR NEW.tcc_application_id <> OLD.tcc_application_id) THEN
        NEW.application_id := NEW.tcc_application_id;
    END IF;

    -- Sync file_url and pdf_url
    IF NEW.file_url IS NOT NULL AND (OLD.file_url IS NULL OR NEW.file_url <> OLD.file_url) THEN
        NEW.pdf_url := NEW.file_url;
    ELSIF NEW.pdf_url IS NOT NULL AND (OLD.pdf_url IS NULL OR NEW.pdf_url <> OLD.pdf_url) THEN
        NEW.file_url := NEW.pdf_url;
    END IF;

    -- Sync issued_at and issued_date
    IF NEW.issued_at IS NOT NULL AND (OLD.issued_at IS NULL OR NEW.issued_at <> OLD.issued_at) THEN
        NEW.issued_date := NEW.issued_at::date;
    ELSIF NEW.issued_date IS NOT NULL AND (OLD.issued_date IS NULL OR NEW.issued_date <> OLD.issued_date) THEN
        NEW.issued_at := NEW.issued_date::timestamp with time zone;
    END IF;

    -- Sync expires_at and expiry_date
    IF NEW.expires_at IS NOT NULL AND (OLD.expires_at IS NULL OR NEW.expires_at <> OLD.expires_at) THEN
        NEW.expiry_date := NEW.expires_at::date;
    ELSIF NEW.expiry_date IS NOT NULL AND (OLD.expiry_date IS NULL OR NEW.expiry_date <> OLD.expiry_date) THEN
        NEW.expires_at := NEW.expiry_date::timestamp with time zone;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_certificates_columns ON public.certificates;
CREATE TRIGGER trg_sync_certificates_columns
    BEFORE INSERT OR UPDATE ON public.certificates
    FOR EACH ROW EXECUTE FUNCTION public.sync_certificates_columns();


-- ============================================================================
-- AUTH SYNC TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_auth_user_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_role public.user_role;
    v_client_id UUID;
BEGIN
    BEGIN
        v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'CLIENT'::public.user_role);
    EXCEPTION WHEN OTHERS THEN
        v_role := 'CLIENT'::public.user_role;
    END;

    BEGIN
        IF NEW.raw_user_meta_data->>'client_id' IS NOT NULL THEN
            v_client_id := (NEW.raw_user_meta_data->>'client_id')::UUID;
        ELSE
            v_client_id := NULL;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_client_id := NULL;
    END;

    INSERT INTO public.users (id, email, role, client_id)
    VALUES (NEW.id, NEW.email, v_role, v_client_id)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = COALESCE(v_role, public.users.role),
        client_id = COALESCE(v_client_id, public.users.client_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_changed ON auth.users;
CREATE TRIGGER on_auth_user_changed
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_changes();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcc_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_chemicals ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the current user is a MASTER_ADMIN or STAFF
CREATE OR REPLACE FUNCTION public.is_admin_or_staff(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = user_id AND role IN ('MASTER_ADMIN', 'STAFF')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Settings Policies
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.admin_settings;
CREATE POLICY "Authenticated users can read settings" ON public.admin_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.admin_settings;
CREATE POLICY "Authenticated users can update settings" ON public.admin_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can insert settings" ON public.admin_settings;
CREATE POLICY "Authenticated users can insert settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (true);

-- Clients Policies
DROP POLICY IF EXISTS "Admins can do everything on clients" ON public.clients;
CREATE POLICY "Admins can do everything on clients" ON public.clients FOR ALL USING (public.is_admin_or_staff(auth.uid())) WITH CHECK (public.is_admin_or_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view their own organization" ON public.clients;
CREATE POLICY "Clients can view their own organization" ON public.clients FOR SELECT USING (id = (SELECT client_id FROM public.users WHERE id = auth.uid()) OR auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Clients can view their own profile" ON public.clients;
CREATE POLICY "Clients can view their own profile" ON public.clients FOR SELECT USING (auth_user_id = auth.uid() OR id = (SELECT client_id FROM public.users WHERE id = auth.uid()));

-- Users Policies
DROP POLICY IF EXISTS "Admins can do everything on users" ON public.users;
CREATE POLICY "Admins can do everything on users" ON public.users FOR ALL USING (public.is_admin_or_staff(auth.uid())) WITH CHECK (public.is_admin_or_staff(auth.uid()));

DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (id = auth.uid());

-- Client Contacts Policies
DROP POLICY IF EXISTS "Admins can do everything on contacts" ON public.client_contacts;
CREATE POLICY "Admins can do everything on contacts" ON public.client_contacts FOR ALL USING (public.is_admin_or_staff(auth.uid())) WITH CHECK (public.is_admin_or_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can manage their contacts" ON public.client_contacts;
CREATE POLICY "Clients can manage their contacts" ON public.client_contacts FOR ALL USING (client_id = (SELECT client_id FROM public.users WHERE id = auth.uid())) WITH CHECK (client_id = (SELECT client_id FROM public.users WHERE id = auth.uid()));

-- Chemicals Policies
DROP POLICY IF EXISTS "Admins can do everything on chemicals" ON public.chemicals;
CREATE POLICY "Admins can do everything on chemicals" ON public.chemicals FOR ALL USING (public.is_admin_or_staff(auth.uid())) WITH CHECK (public.is_admin_or_staff(auth.uid()));

DROP POLICY IF EXISTS "All authenticated users can select chemicals" ON public.chemicals;
CREATE POLICY "All authenticated users can select chemicals" ON public.chemicals FOR SELECT USING (auth.role() = 'authenticated');

-- Client Permissions Policies (Alternative Schema)
DROP POLICY IF EXISTS "Clients can view their own permissions" ON public.client_permissions;
CREATE POLICY "Clients can view their own permissions" ON public.client_permissions FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() OR id = (SELECT client_id FROM public.users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Admins can manage client permissions" ON public.client_permissions;
CREATE POLICY "Admins can manage client permissions" ON public.client_permissions FOR ALL USING (public.is_admin_or_staff(auth.uid()));

-- TCC Applications Policies
DROP POLICY IF EXISTS "Admins can do everything on applications" ON public.tcc_applications;
CREATE POLICY "Admins can do everything on applications" ON public.tcc_applications FOR ALL USING (public.is_admin_or_staff(auth.uid())) WITH CHECK (public.is_admin_or_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view their own applications" ON public.tcc_applications;
CREATE POLICY "Clients can view their own applications" ON public.tcc_applications FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() OR id = (SELECT client_id FROM public.users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Clients can view their own TCC apps" ON public.tcc_applications;
CREATE POLICY "Clients can view their own TCC apps" ON public.tcc_applications FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() OR id = (SELECT client_id FROM public.users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Clients can insert their own TCC apps" ON public.tcc_applications;
CREATE POLICY "Clients can insert their own TCC apps" ON public.tcc_applications FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() OR id = (SELECT client_id FROM public.users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Clients can insert applications for their own company" ON public.tcc_applications;
CREATE POLICY "Clients can insert applications for their own company" ON public.tcc_applications FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() OR id = (SELECT client_id FROM public.users WHERE id = auth.uid())) AND status = 'pending');

DROP POLICY IF EXISTS "Clients can update pending applications" ON public.tcc_applications;
CREATE POLICY "Clients can update pending applications" ON public.tcc_applications FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() OR id = (SELECT client_id FROM public.users WHERE id = auth.uid())) AND status IN ('pending', 'modification_requested'));

-- Certificates Policies
DROP POLICY IF EXISTS "Admins can do everything on certificates" ON public.certificates;
CREATE POLICY "Admins can do everything on certificates" ON public.certificates FOR ALL USING (public.is_admin_or_staff(auth.uid())) WITH CHECK (public.is_admin_or_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view their own certificates" ON public.certificates;
CREATE POLICY "Clients can view their own certificates" ON public.certificates FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() OR id = (SELECT client_id FROM public.users WHERE id = auth.uid())));

-- Notifications Policies
DROP POLICY IF EXISTS "Users can manage their notifications" ON public.notifications;
CREATE POLICY "Users can manage their notifications" ON public.notifications FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Audit Logs Policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin_or_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Templates Policies
DROP POLICY IF EXISTS "Admins can do everything on templates" ON public.templates;
CREATE POLICY "Admins can do everything on templates" ON public.templates FOR ALL USING (public.is_admin_or_staff(auth.uid())) WITH CHECK (public.is_admin_or_staff(auth.uid()));

DROP POLICY IF EXISTS "All authenticated users can read templates" ON public.templates;
CREATE POLICY "All authenticated users can read templates" ON public.templates FOR SELECT USING (auth.role() = 'authenticated');

-- Client Chemicals Policies
DROP POLICY IF EXISTS "Admins can do everything on client_chemicals" ON public.client_chemicals;
CREATE POLICY "Admins can do everything on client_chemicals" ON public.client_chemicals FOR ALL USING (public.is_admin_or_staff(auth.uid())) WITH CHECK (public.is_admin_or_staff(auth.uid()));

DROP POLICY IF EXISTS "Clients can view their authorized chemicals" ON public.client_chemicals;
CREATE POLICY "Clients can view their authorized chemicals" ON public.client_chemicals FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid() OR id = (SELECT client_id FROM public.users WHERE id = auth.uid())));


-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Seed Default Settings
INSERT INTO public.admin_settings (id, full_name, email)
VALUES (1, 'Admin User', 'directoratulpatoliya@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Branding Template
INSERT INTO public.templates (id, logo, accent_color, footer_text, signature_image)
VALUES (
  'd4e30b6f-6c18-472e-8d8a-36fb644b9b94',
  null,
  '#064e3b',
  'Pharmegic Healthcare Compliance Division. For verification, scan the QR code.',
  null
) ON CONFLICT DO NOTHING;

-- Seed Mock Chemicals
INSERT INTO public.chemicals (chemical_name, name, cas_number, ec_number, tonnage_band, validity_date, available_quantity, exported_quantity, status)
VALUES
('Ethylene Glycol Monoethyl Ether', 'Ethylene Glycol Monoethyl Ether', '110-80-5', '203-804-1', '10-100 tonnes', '2027-12-31', 150.00, 25.50, 'active'),
('N-Methyl-2-pyrrolidone (NMP)', 'N-Methyl-2-pyrrolidone (NMP)', '872-50-4', '212-828-1', '100-1000 tonnes', '2028-06-30', 800.00, 120.00, 'active'),
('Trichloroethylene', 'Trichloroethylene', '79-01-6', '201-167-4', '1-10 tonnes', '2026-12-31', 8.50, 1.20, 'active'),
('Dimethylformamide (DMF)', 'Dimethylformamide (DMF)', '68-12-2', '200-679-5', '100-1000 tonnes', '2027-09-15', 500.00, 0.00, 'active')
ON CONFLICT (cas_number) DO NOTHING;
