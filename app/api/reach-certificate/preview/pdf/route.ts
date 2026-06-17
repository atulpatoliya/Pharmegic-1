import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { resolveReachCertificateDownloadFile } from '@/lib/reach-certificate-pdf';
import {
  loadReachCertificateInputByCertificateId,
  loadReachCertificateInputByClientChemical,
} from '@/lib/reach-certificate-api-input';

function inlinePdfResponse(buffer: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}

/** EU REACH preview — PDF from EU_REACH_CERTIFICATE.docx (same as print/download). */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const certificateId = searchParams.get('certificateId');
  const adminSupabase = createAdminClient();

  if (certificateId) {
    const input = await loadReachCertificateInputByCertificateId(adminSupabase, certificateId);
    if (!input) {
      return NextResponse.json({ error: 'RC certificate not found.' }, { status: 404 });
    }

    const isAdmin = session.role === 'MASTER_ADMIN' || session.role === 'SUPER_ADMIN';
    const isOwner = session.role === 'CLIENT' && session.clientId === input.clientId;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const file = await resolveReachCertificateDownloadFile(adminSupabase, input);
      return inlinePdfResponse(file.buffer, file.fileName);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Certificate PDF preview failed.';
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  if (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = searchParams.get('clientId');
  const chemicalId = searchParams.get('chemicalId');

  if (!clientId || !chemicalId) {
    return NextResponse.json(
      { error: 'certificateId or clientId and chemicalId are required.' },
      { status: 400 }
    );
  }

  const input = await loadReachCertificateInputByClientChemical(adminSupabase, {
    clientId,
    chemicalId,
    registrationNumber: searchParams.get('registrationNumber'),
    issuedDate: searchParams.get('issuedDate'),
    validatedDate: searchParams.get('validatedDate'),
    tonnageBand: searchParams.get('tonnageBand'),
  });

  if (!input) {
    return NextResponse.json({ error: 'Client substance not found.' }, { status: 404 });
  }

  try {
    const file = await resolveReachCertificateDownloadFile(adminSupabase, input);
    return inlinePdfResponse(file.buffer, file.fileName);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Certificate PDF preview failed.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
