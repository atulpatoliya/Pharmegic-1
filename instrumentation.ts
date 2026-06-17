export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { resolveReachPdfConverterStatus } = await import('@/lib/reach-pdf-converter-status');
  const status = await resolveReachPdfConverterStatus();

  if (status.pdfConversionAvailable) {
    console.info(
      `[RC PDF] Converter ready (gotenberg=${status.gotenbergReachable}, libreOffice=${status.libreOfficeInstalled})`
    );
    return;
  }

  console.warn('[RC PDF] Converter NOT available on this server.');
  console.warn(`[RC PDF] ${status.recommendedAction ?? 'Run: bash scripts/setup-live-pdf.sh'}`);
}
