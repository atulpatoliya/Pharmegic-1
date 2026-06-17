import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { normalizeCertificateTemplateKey } from '@/lib/certificate-template-config';
import { getRcTemplatePreviewSample } from '@/lib/certificate-template-preview-data';
import { buildReachDocxData } from '@/lib/reach-pdf-data';
import { getActiveRcTemplateKey } from '@/services/db';
import {
  convertReachDocxToPdf,
  generateReachCertificateDocx,
} from '@/services/reach-certificate-docx';

function pdfResponse(buffer: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const templateParam = searchParams.get('templateKey');
  const adminSupabase = createAdminClient();
  const templateKey = templateParam
    ? normalizeCertificateTemplateKey(templateParam)
    : await getActiveRcTemplateKey(adminSupabase);

  try {
    const sample = getRcTemplatePreviewSample(templateKey);
    const docxBuffer = generateReachCertificateDocx(
      buildReachDocxData(sample.client, sample.chemical, sample.options, templateKey),
      templateKey
    );
    const pdfBuffer = await convertReachDocxToPdf(docxBuffer);

    return pdfResponse(pdfBuffer, `rc-template-${templateKey}-preview.pdf`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'RC template PDF preview failed.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
