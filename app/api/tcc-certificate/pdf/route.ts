import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import {
  buildTccCertificatePdfInputFromCert,
  resolveTccCertificateDownloadFile,
} from '@/lib/tcc-certificate-pdf';

function fileResponse(buffer: Buffer, fileName: string, contentType: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const certificateId = new URL(request.url).searchParams.get('certificateId');
  if (!certificateId) {
    return NextResponse.json({ error: 'certificateId is required.' }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const { data: cert, error } = await adminSupabase
    .from('certificates')
    .select(`
      id,
      certificate_number,
      expires_at,
      registration_number,
      client_id,
      type,
      clients (
        company_name,
        uuid_number,
        address,
        city,
        state,
        postal_code,
        country
      ),
      chemicals (
        chemical_name,
        cas_number,
        ec_number,
        tonnage_band
      ),
      tcc_applications (
        quantity_mt,
        export_date,
        tracking_id,
        registration_number,
        remarks,
        eu_importer_company_name,
        eu_importer_address,
        purchase_order_number,
        chemicals (
          chemical_name,
          cas_number,
          ec_number,
          tonnage_band
        )
      )
    `)
    .eq('id', certificateId)
    .eq('type', 'TCC')
    .single();

  if (error || !cert) {
    return NextResponse.json({ error: 'TCC certificate not found.' }, { status: 404 });
  }

  const isAdmin = session.role === 'MASTER_ADMIN' || session.role === 'SUPER_ADMIN';
  const isOwner = session.role === 'CLIENT' && session.clientId === cert.client_id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const input = buildTccCertificatePdfInputFromCert(cert as never);
    const file = await resolveTccCertificateDownloadFile(adminSupabase, input);
    return fileResponse(file.buffer, file.fileName, file.contentType);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Certificate download failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
