import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getSession } from '@/lib/auth/session';
import { getRcTemplatePreviewSample } from '@/lib/certificate-template-preview-data';
import { EU_REACH_TEMPLATE } from '@/lib/eu-reach-certificate-template';
import { buildReachDocxData } from '@/lib/reach-pdf-data';
import {
  BUNDLED_RC_PREVIEW_PDF,
  convertReachDocxToPdf,
  generateReachCertificateDocx,
} from '@/services/reach-certificate-docx';

function resolvePublicPreviewDocxUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) {
    return `${configured}/previews/eu-reach-certificate-sample.docx`;
  }
  return new URL('/previews/eu-reach-certificate-sample.docx', request.url).toString();
}

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

  try {
    // Word-generated bundled PDF preserves drawing/VML layout; LibreOffice often strips it.
    if (fs.existsSync(BUNDLED_RC_PREVIEW_PDF)) {
      return pdfResponse(fs.readFileSync(BUNDLED_RC_PREVIEW_PDF), 'rc-template-preview.pdf');
    }

    const sample = getRcTemplatePreviewSample();
    const docxBuffer = generateReachCertificateDocx(
      buildReachDocxData(sample.client, sample.chemical, sample.options)
    );

    try {
      const pdfBuffer = await convertReachDocxToPdf(docxBuffer);
      return pdfResponse(pdfBuffer, 'rc-template-preview.pdf');
    } catch {
      const publicDocx = EU_REACH_TEMPLATE.bundledPreviewDocx;
      if (fs.existsSync(publicDocx)) {
        return NextResponse.json({
          previewMode: 'docx',
          docxUrl: resolvePublicPreviewDocxUrl(request),
        });
      }
      throw new Error(
        'PDF conversion is not available on this server. Run: node scripts/generate-eu-reach-preview-pdf.mjs'
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'RC template PDF preview failed.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
