import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getSession } from '@/lib/auth/session';
import { getRcTemplatePreviewSample } from '@/lib/certificate-template-preview-data';
import { buildReachDocxData } from '@/lib/reach-pdf-data';
import {
  BUNDLED_RC_PREVIEW_PDF,
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

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'MASTER_ADMIN' && session.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sample = getRcTemplatePreviewSample();
    const docxBuffer = generateReachCertificateDocx(
      buildReachDocxData(sample.client, sample.chemical, sample.options)
    );

    try {
      const pdfBuffer = await convertReachDocxToPdf(docxBuffer);
      return pdfResponse(pdfBuffer, 'rc-template-preview.pdf');
    } catch {
      if (fs.existsSync(BUNDLED_RC_PREVIEW_PDF)) {
        return pdfResponse(fs.readFileSync(BUNDLED_RC_PREVIEW_PDF), 'rc-template-preview.pdf');
      }
      throw new Error(
        'PDF conversion is not available on this server. Install LibreOffice, set GOTENBERG_URL, or run: node scripts/generate-rc-template-preview-pdf.mjs'
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'RC template PDF preview failed.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
