import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getTccTemplatePreviewSample } from '@/lib/certificate-template-preview-data';
import { generateTccCertificateDocx } from '@/services/tcc-certificate-docx';

function docxResponse(buffer: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const docxBuffer = generateTccCertificateDocx(getTccTemplatePreviewSample());
    return docxResponse(docxBuffer, 'tcc-template-preview.docx');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'TCC template preview failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
