export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { resolveReachPdfConverterStatus } = await import('@/lib/reach-pdf-converter-status');
  const status = await resolveReachPdfConverterStatus();

  if (status.htmlPdfEnabled && status.htmlPdfRenderUrl) {
    console.info(
      `[RC PDF] HTML → PDF ready (renderUrl=${status.htmlPdfRenderUrl}, serverless=${status.htmlPdfUsesServerlessChromium})`
    );
    return;
  }

  console.warn('[RC PDF] HTML → PDF not fully configured.');
  if (status.recommendedAction) {
    console.warn(`[RC PDF] ${status.recommendedAction}`);
  }
}
