import { isLibreOfficeInstalled } from '@/services/reach-certificate-docx';
import { getGotenbergBaseUrls, isGotenbergReachable } from '@/lib/reach-gotenberg';

export type ReachPdfConverterStatus = {
  pdfConversionAvailable: boolean;
  gotenbergConfigured: boolean;
  gotenbergReachable: boolean;
  libreOfficeInstalled: boolean;
  gotenbergUrls: string[];
  platform: string;
  recommendedAction: string | null;
};

export async function resolveReachPdfConverterStatus(): Promise<ReachPdfConverterStatus> {
  const gotenbergUrls = getGotenbergBaseUrls();
  const libreOfficeInstalled = isLibreOfficeInstalled();
  const gotenbergReachable =
    gotenbergUrls.length > 0 ? await isGotenbergReachable() : false;
  const pdfConversionAvailable = gotenbergReachable || libreOfficeInstalled;

  let recommendedAction: string | null = null;
  if (!pdfConversionAvailable) {
    recommendedAction =
      'On the live server run: docker compose -f docker-compose.gotenberg.yml up -d && pm2 restart all. ' +
      'Or install LibreOffice: sudo bash scripts/setup-pdf-converter.sh';
  }

  return {
    pdfConversionAvailable,
    gotenbergConfigured: gotenbergUrls.length > 0,
    gotenbergReachable,
    libreOfficeInstalled,
    gotenbergUrls,
    platform: process.platform,
    recommendedAction,
  };
}
