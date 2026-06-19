import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRcBranding } from '@/lib/certificate-template-config';
import {
  loadReachCertificateInputByCertificateId,
  loadReachCertificateInputByClientChemical,
  type LoadedReachCertificateInput,
} from '@/lib/reach-certificate-api-input';
import { buildReachHtmlData, type ReachCertificateHtmlData } from '@/lib/reach-certificate-html-data';
import type { ReachCertPdfInput } from '@/lib/reach-certificate-preview';
import {
  createReachPrintToken,
  type ReachPrintTokenPayload,
} from '@/lib/reach-certificate-print-token';
import { generateReachHtmlPdfWithPuppeteer } from '@/services/reach-certificate-puppeteer-pdf';
import { getActiveTemplate } from '@/services/db';

function resolvePdfRenderBaseUrl(): string {
  const configured =
    process.env.REACH_PDF_RENDER_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');

  if (configured) return configured;

  const port = process.env.PORT || '3000';
  return `http://127.0.0.1:${port}`;
}

function resolveAbsoluteAssetUrl(url: string | null, baseUrl: string): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  return `${baseUrl}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

function withAbsoluteAssetUrls(
  data: ReachCertificateHtmlData,
  baseUrl: string
): ReachCertificateHtmlData {
  return {
    ...data,
    logoUrl: resolveAbsoluteAssetUrl(data.logoUrl, baseUrl),
    signatureUrl: resolveAbsoluteAssetUrl(data.signatureUrl, baseUrl),
  };
}

export function toReachPrintTokenPayload(input: LoadedReachCertificateInput): ReachPrintTokenPayload {
  if (input.certificateId) {
    return { certificateId: input.certificateId };
  }
  return {
    clientId: input.clientId,
    chemicalId: input.chemicalId,
    registrationNumber: input.registrationNumber,
    issuedDate: input.issuedDate,
    validatedDate: input.validatedDate,
    tonnageBand: input.tonnageBand,
  };
}

export async function loadReachHtmlDataFromPrintToken(
  supabase: SupabaseClient,
  tokenPayload: ReachPrintTokenPayload
): Promise<ReachCertificateHtmlData | null> {
  const templateSettings = await getActiveTemplate(supabase);
  const branding = resolveRcBranding(templateSettings);
  const baseUrl = resolvePdfRenderBaseUrl();

  if (tokenPayload.certificateId) {
    const input = await loadReachCertificateInputByCertificateId(
      supabase,
      tokenPayload.certificateId
    );
    if (!input) return null;
    return withAbsoluteAssetUrls(
      buildReachHtmlData(input.client, input.chemical, {
        registrationNumber: input.registrationNumber,
        issuedDate: input.issuedDate,
        validatedDate: input.validatedDate,
        tonnageBand: input.tonnageBand,
        accentColor: branding.accent_color,
        logoUrl: branding.logo,
        signatureUrl: branding.signature_image,
        footerText: branding.footer_text,
      }),
      baseUrl
    );
  }

  if (!tokenPayload.clientId || !tokenPayload.chemicalId) return null;

  const input = await loadReachCertificateInputByClientChemical(supabase, {
    clientId: tokenPayload.clientId,
    chemicalId: tokenPayload.chemicalId,
    registrationNumber: tokenPayload.registrationNumber,
    issuedDate: tokenPayload.issuedDate,
    validatedDate: tokenPayload.validatedDate,
    tonnageBand: tokenPayload.tonnageBand,
  });

  if (!input) return null;

  return withAbsoluteAssetUrls(
    buildReachHtmlData(input.client, input.chemical, {
      registrationNumber: input.registrationNumber,
      issuedDate: input.issuedDate,
      validatedDate: input.validatedDate,
      tonnageBand: input.tonnageBand,
      accentColor: branding.accent_color,
      logoUrl: branding.logo,
      signatureUrl: branding.signature_image,
      footerText: branding.footer_text,
    }),
    baseUrl
  );
}

export async function loadReachHtmlDataForInput(
  supabase: SupabaseClient,
  input: LoadedReachCertificateInput | ReachCertPdfInput
): Promise<ReachCertificateHtmlData> {
  const templateSettings = await getActiveTemplate(supabase);
  const branding = resolveRcBranding(templateSettings);
  const baseUrl = resolvePdfRenderBaseUrl();

  return withAbsoluteAssetUrls(
    buildReachHtmlData(input.client, input.chemical, {
      registrationNumber: input.registrationNumber,
      issuedDate: input.issuedDate,
      validatedDate: input.validatedDate,
      tonnageBand: input.tonnageBand,
      accentColor: branding.accent_color,
      logoUrl: branding.logo,
      signatureUrl: branding.signature_image,
      footerText: branding.footer_text,
    }),
    baseUrl
  );
}

export async function generateReachCertificateHtmlPdf(
  input: LoadedReachCertificateInput
): Promise<Buffer> {
  const token = await createReachPrintToken(toReachPrintTokenPayload(input));
  const baseUrl = resolvePdfRenderBaseUrl();
  const printUrl = `${baseUrl}/reach-cert/print?token=${encodeURIComponent(token)}`;
  return generateReachHtmlPdfWithPuppeteer(printUrl);
}

export { resolvePdfRenderBaseUrl };
