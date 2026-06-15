import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { generateTccCertificateDocx } from '@/services/tcc-certificate-docx';
import {
  buildTccApplicationPreviewInput,
  buildTccCertificatePdfInputFromCert,
  buildTccDocxData,
} from '@/lib/tcc-certificate-pdf';

function docxResponse(buffer: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const certificateId = searchParams.get('certificateId');
  const applicationId = searchParams.get('applicationId');
  const adminSupabase = createAdminClient();

  if (certificateId) {
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
      tcc_applications!certificates_tcc_application_id_fkey (
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
      const docxBuffer = generateTccCertificateDocx(buildTccDocxData(input));
      return docxResponse(docxBuffer, `${cert.certificate_number}.docx`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'DOCX generation failed.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (applicationId) {
    if (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const input = await buildTccApplicationPreviewInput(adminSupabase, applicationId);
      const docxBuffer = generateTccCertificateDocx(buildTccDocxData(input));
      return docxResponse(docxBuffer, 'tcc-application-preview.docx');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'DOCX generation failed.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: 'certificateId or applicationId is required.' },
    { status: 400 }
  );
}
