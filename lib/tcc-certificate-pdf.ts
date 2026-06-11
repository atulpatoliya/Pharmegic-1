import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildTccDocxData,
  generateTccPdfForApplication,
  type TccPdfApplication,
  type TccPdfChemical,
  type TccPdfClient,
} from '@/lib/tcc-pdf-data';

type TccCertPdfInput = {
  certificateNumber: string;
  client: TccPdfClient;
  chemical: TccPdfChemical;
  application: TccPdfApplication;
  registrationNumber?: string | null;
  validUntilDate: string;
  deliveryChallanNo?: string | null;
};

/** Always regenerates from the current TCC template so downloads match the live preview. */
export async function resolveTccCertificatePdfBuffer(
  _supabase: SupabaseClient,
  input: TccCertPdfInput
): Promise<Buffer> {
  return generateTccPdfForApplication({
    client: input.client,
    chemical: input.chemical,
    application: input.application,
    registrationNumber: input.registrationNumber,
    validUntilDate: input.validUntilDate,
    deliveryChallanNo: input.deliveryChallanNo,
  });
}

export function buildTccCertificatePdfInputFromCert(cert: {
  certificate_number: string;
  expires_at?: string | null;
  registration_number?: string | null;
  clients: TccPdfClient | TccPdfClient[];
  chemicals?: TccPdfChemical | TccPdfChemical[] | null;
  tcc_applications?:
    | (TccPdfApplication & { chemicals?: TccPdfChemical | TccPdfChemical[] | null })
    | (TccPdfApplication & { chemicals?: TccPdfChemical | TccPdfChemical[] | null })[]
    | null;
}): TccCertPdfInput {
  const applicationRaw = cert.tcc_applications;
  const application = Array.isArray(applicationRaw) ? applicationRaw[0] : applicationRaw;
  const client = Array.isArray(cert.clients) ? cert.clients[0] : cert.clients;
  const chemicalFromCert = cert.chemicals
    ? Array.isArray(cert.chemicals)
      ? cert.chemicals[0]
      : cert.chemicals
    : null;
  const chemicalFromApp = application?.chemicals
    ? Array.isArray(application.chemicals)
      ? application.chemicals[0]
      : application.chemicals
    : null;
  const chemical = chemicalFromCert || chemicalFromApp;

  if (!application || !chemical || !client) {
    throw new Error('TCC certificate data is incomplete.');
  }

  return {
    certificateNumber: cert.certificate_number,
    client,
    chemical,
    application,
    registrationNumber: cert.registration_number,
    validUntilDate: cert.expires_at?.split('T')[0] || application.export_date || '',
    deliveryChallanNo: application.tracking_id,
  };
}

export { buildTccDocxData };
