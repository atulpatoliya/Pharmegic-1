import { NextResponse } from 'next/server';
import { isReachPdfConversionAvailable } from '@/services/reach-certificate-docx';
import { getGotenbergBaseUrls, isGotenbergReachable } from '@/lib/reach-gotenberg';

export async function GET() {
  const gotenbergUrls = getGotenbergBaseUrls();
  const gotenbergReachable = gotenbergUrls.length > 0 ? await isGotenbergReachable() : false;

  return NextResponse.json({
    pdfConversionAvailable: isReachPdfConversionAvailable(),
    gotenbergConfigured: gotenbergUrls.length > 0,
    gotenbergReachable,
    gotenbergUrls,
    platform: process.platform,
  });
}
