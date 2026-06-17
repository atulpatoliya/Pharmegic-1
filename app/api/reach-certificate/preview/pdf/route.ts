import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import {
  getLastDateOfYear,
  getTodayDateString,
  REACH_CERTIFICATE_TYPE,
} from '@/lib/reach-certificate';
import { resolveReachCertificatePreview } from '@/lib/reach-certificate-preview';

function inlinePdfResponse(buffer: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Live EU REACH preview for pending/issued RC certificates (inline PDF, full template). */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const chemicalId = searchParams.get('chemicalId');

  if (!clientId || !chemicalId) {
    return NextResponse.json({ error: 'clientId and chemicalId are required.' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  const [{ data: client }, { data: chemical }, { data: clientChem }, { data: existingCert }] =
    await Promise.all([
      adminSupabase
        .from('clients')
        .select('id, company_name, uuid_number, address, city, state, postal_code, country')
        .eq('id', clientId)
        .single(),
      adminSupabase
        .from('chemicals')
        .select('id, chemical_name, cas_number, ec_number, tonnage_band')
        .eq('id', chemicalId)
        .single(),
      adminSupabase
        .from('client_chemicals')
        .select('id, validity_date, status')
        .eq('client_id', clientId)
        .eq('chemical_id', chemicalId)
        .eq('status', 'active')
        .maybeSingle(),
      adminSupabase
        .from('certificates')
        .select('certificate_number, registration_number, issued_at, expires_at, tonnage_band')
        .eq('client_id', clientId)
        .eq('chemical_id', chemicalId)
        .eq('type', REACH_CERTIFICATE_TYPE)
        .order('issued_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!client || !chemical || !clientChem) {
    return NextResponse.json({ error: 'Client substance not found.' }, { status: 404 });
  }

  const registrationNumber =
    searchParams.get('registrationNumber')?.trim() ||
    existingCert?.registration_number?.trim() ||
    '—';

  const issuedDate =
    searchParams.get('issuedDate') ||
    (existingCert?.issued_at ? existingCert.issued_at.split('T')[0] : getTodayDateString());

  const validatedDate =
    searchParams.get('validatedDate') ||
    (existingCert?.expires_at
      ? existingCert.expires_at.split('T')[0]
      : clientChem.validity_date?.split('T')[0] || getLastDateOfYear());

  const tonnageBand =
    searchParams.get('tonnageBand')?.trim() ||
    existingCert?.tonnage_band ||
    chemical.tonnage_band;

  const certNumber = existingCert?.certificate_number || `RC-preview-${chemicalId.slice(0, 8)}`;

  try {
    const result = await resolveReachCertificatePreview(adminSupabase, {
      certificateNumber: certNumber,
      registrationNumber,
      issuedDate,
      validatedDate,
      client,
      chemical,
      tonnageBand,
    });

    if (result.mode === 'pdf') {
      return inlinePdfResponse(result.buffer, result.fileName);
    }

    return NextResponse.json({
      previewMode: 'docx',
      docxUrl: result.docxUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Certificate PDF preview failed.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
