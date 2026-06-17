export type CertificateTemplateKey = 'template_1' | 'template_2';

export const RC_TEMPLATE_OPTIONS: { value: CertificateTemplateKey; label: string; description: string }[] = [
  {
    value: 'template_1',
    label: 'Template 1',
    description: 'Current REACH certificate layout (CT_2026).',
  },
  {
    value: 'template_2',
    label: 'Template 2',
    description: 'EU REACH Registration Certificate layout.',
  },
];

export function normalizeCertificateTemplateKey(
  value: string | null | undefined
): CertificateTemplateKey {
  return value === 'template_2' ? 'template_2' : 'template_1';
}

export type CertificateBrandingFields = {
  logo: string | null;
  signature_image: string | null;
  accent_color: string;
  footer_text: string | null;
};

export type TemplateSettingsRecord = {
  id: string;
  logo?: string | null;
  accent_color?: string | null;
  footer_text?: string | null;
  signature_image?: string | null;
  rc_template_key?: string | null;
  tcc_template_key?: string | null;
  rc_logo?: string | null;
  rc_signature_image?: string | null;
  rc_accent_color?: string | null;
  rc_footer_text?: string | null;
  tcc_logo?: string | null;
  tcc_signature_image?: string | null;
  tcc_accent_color?: string | null;
  tcc_footer_text?: string | null;
};

export function resolveRcBranding(template: TemplateSettingsRecord | null): CertificateBrandingFields {
  return {
    logo: template?.rc_logo ?? template?.logo ?? null,
    signature_image: template?.rc_signature_image ?? template?.signature_image ?? null,
    accent_color: template?.rc_accent_color ?? template?.accent_color ?? '#064e3b',
    footer_text: template?.rc_footer_text ?? template?.footer_text ?? null,
  };
}

export function resolveTccBranding(template: TemplateSettingsRecord | null): CertificateBrandingFields {
  return {
    logo: template?.tcc_logo ?? template?.logo ?? null,
    signature_image: template?.tcc_signature_image ?? template?.signature_image ?? null,
    accent_color: template?.tcc_accent_color ?? template?.accent_color ?? '#064e3b',
    footer_text: template?.tcc_footer_text ?? template?.footer_text ?? null,
  };
}
