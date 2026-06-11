# Pharmegic Healthcare Portal — Setup Guide

This document describes the steps required to configure and run the Pharmegic Healthcare Portal locally and prepare it for production.

---

## 1. Database & Supabase Configuration

### Execute Schema SQL
1. Open your project in the **Supabase Dashboard**.
2. Navigate to the **SQL Editor** tab.
3. Open **`database.sql`** in your editor, copy its contents, paste them into the Supabase SQL Editor, and click **Run**.

> **Important:** `database.sql` is **safe to re-run** — it does **not** drop tables or delete your data. It only creates missing tables/columns and adds seed rows when they do not exist yet.
>
> Use **`database.reset.sql`** only for a **brand-new empty database** in local development. That file deletes all data.

4. This script will create or update:
   - All custom types and enums (`user_role`, `client_status`, `chemical_status`, `tcc_status`, `certificate_status`).
   - The required database tables (`clients`, `users`, `client_contacts`, `chemicals`, `tcc_applications`, `certificates`, `notifications`, `audit_logs`, `templates`, `client_chemicals`).
   - The automated PostgreSQL sync trigger linking `auth.users` to `public.users`.
   - The performance indexes and Row Level Security (RLS) policies.
   - The default branding template and initial chemical inventory for testing.

### Configure Storage Bucket (required for BO uploads & PDF certificates)
1. In the Supabase Dashboard, go to **Storage**.
2. Create a bucket named exactly **`certificates`** (if it does not exist).
3. Set the bucket to **Public** so clients and admins can open uploaded BO files and certificate PDFs.
4. The app will also try to create this bucket automatically on first upload (needs service role key in `.env`).

> If you see **"Bucket not found"** on TCC submit, the `certificates` storage bucket is missing — create it in Supabase Storage as above.

### Chemical Registry trash (if you see error `22P02` on `/admin/chemicals`)
Run this once in the Supabase SQL Editor (also included at the end of `database.sql`):

```sql
DO $$ BEGIN
    ALTER TYPE public.chemical_status ADD VALUE 'trashed';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
```

Without this, the Chemical Registry page may crash and "Move to Trash" will not work.

---

## 2. Environment Variables configuration

Create a `.env.local` file in the root directory and define the following variables:

```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE=your-service-role-key

# Portal Public App URL (used for QR verification links and auth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# SMTP Email Configuration
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM="Pharmegic Compliance Portal <noreply@pharmegic.com>"
```

> [!NOTE]
> If the SMTP credentials are not specified, the Nodemailer client will fallback to printing the email invitation link directly to the console during development.

---

## 3. Bootstrapping the Initial MASTER_ADMIN

To log in as the first administrator, you must create a Supabase Auth user with the `MASTER_ADMIN` role metadata. You can do this by executing the following PostgreSQL command in the Supabase SQL editor:

```sql
-- 1. Create a user via Supabase Auth Dashboard or sign up form, then run this to elevate their role:
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object('role', 'MASTER_ADMIN')
WHERE email = 'directoratulpatoliya@gmail.com';
```

Alternatively, you can sign up a user using the Supabase client-side API inside a scratch script, passing the role metadata:
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'directoratulpatoliya@gmail.com',
  password: 'Admin@1234',
  options: {
    data: {
      role: 'MASTER_ADMIN'
    }
  }
});
```

---

## 4. Certificate PDF conversion (production server — RC & TCC)

Certificate **preview** works in the browser (DOCX template). **PDF download** and **email attachments** require DOCX→PDF conversion on the server.

If PDF download shows a JSON error or downloads `.docx` instead of `.pdf`, the production server is missing a converter — complete one of the options below and redeploy/restart.

### Option A — LibreOffice (recommended on Linux/VPS)

```bash
# Ubuntu / Debian
sudo apt-get update && sudo apt-get install -y libreoffice-writer

# Verify
soffice --version
```

Restart the app after install.

### Option B — Gotenberg (Docker)

Run [Gotenberg](https://gotenberg.dev/) and set in `.env`:

```env
# Internal URL to your Gotenberg instance (recommended for VPS / Docker)
GOTENBERG_URL=http://127.0.0.1:3001
```

Example (Docker on the same server):

```bash
docker run -d --name gotenberg -p 3001:3000 gotenberg/gotenberg:8
```

Add `GOTENBERG_URL=http://127.0.0.1:3001` to your production `.env`, then restart the portal.

### Windows development

Microsoft Word or LibreOffice on the machine is used automatically for PDF generation.

> Place `CT_Draftr.docx` in the project root and run `node scripts/prepare-reach-template.mjs` to refresh `templates/CT_2026.docx`.

### TCC Certificate template

TCC certificates use `templates/TCC-Demo.docx` as the source design. Prepare the merge template with:

```bash
node scripts/prepare-tcc-template.mjs
```

This writes `templates/TCC_2026.docx`. Only client, chemical, and application fields are filled at issue time; the Word layout stays fixed.

Dynamic fields include: company name/address, chemical name, CAS/EC numbers, REACH registration number, tonnage band, UUID, export volume (MT), delivery challan, export date, and valid-until date.

---

## 5. Running the Application locally

1. Install project dependencies:
   ```bash
   npm install
   ```
2. Run the local Next.js development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:3000`.
4. Log in using your registered credentials.
