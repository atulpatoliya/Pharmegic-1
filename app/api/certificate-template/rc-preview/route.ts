import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/auth/session';
import { normalizeCertificateTemplateKey } from '@/lib/certificate-template-config';
import { getRcTemplatePreviewSample } from '@/lib/certificate-template-preview-data';
import { buildReachDocxData } from '@/lib/reach-pdf-data';
import { getActiveRcTemplateKey } from '@/services/db';
import { generateReachCertificateDocx } from '@/services/reach-certificate-docx';

function docxResponse(buffer: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

    return docxResponse(docxBuffer, `rc-template-${templateKey}-preview.docx`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'RC template preview failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
