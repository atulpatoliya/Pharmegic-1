import { isLibreOfficeInstalled } from '@/services/reach-certificate-docx';
import { getGotenbergBaseUrls, isGotenbergReachable, isVercelHosting } from '@/lib/reach-gotenberg';

export type ReachPdfConverterStatus = {
  pdfConversionAvailable: boolean;
  gotenbergConfigured: boolean;
  gotenbergReachable: boolean;
  libreOfficeInstalled: boolean;
  gotenbergUrls: string[];
  platform: string;
  hosting: 'vercel' | 'vps' | 'local';
  recommendedAction: string | null;
};

export async function resolveReachPdfConverterStatus(): Promise<ReachPdfConverterStatus> {
  const gotenbergUrls = getGotenbergBaseUrls();
  const libreOfficeInstalled = isLibreOfficeInstalled();
  const gotenbergReachable =
    gotenbergUrls.length > 0 ? await isGotenbergReachable() : false;
  const pdfConversionAvailable = gotenbergReachable || libreOfficeInstalled;
  const hosting = isVercelHosting() ? 'vercel' : process.platform === 'linux' ? 'vps' : 'local';

  let recommendedAction: string | null = null;
  if (!pdfConversionAvailable) {
    if (hosting === 'vercel') {
      recommendedAction =
        'Portal is on Vercel. Deploy Gotenberg on Render (render-gotenberg.yaml), copy the public URL, ' +
        'add GOTENBERG_URL in Vercel → Project → Settings → Environment Variables, then Redeploy.';
    } else {
      recommendedAction =
        'Run on the server: bash scripts/deploy-live.sh  (or: docker compose -f docker-compose.gotenberg.yml up -d && pm2 restart all)';
    }
  }

  return {
    pdfConversionAvailable,
    gotenbergConfigured: Boolean(process.env.GOTENBERG_URL?.trim()),
    gotenbergReachable,
    libreOfficeInstalled,
    gotenbergUrls,
    platform: process.platform,
    hosting,
    recommendedAction,
  };
}
