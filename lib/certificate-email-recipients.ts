export function parseEmailList(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

export function uniqueEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  return emails.filter((email) => {
    const key = email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildCertificateRecipients(params: {
  primaryEmail: string;
  contactEmails?: string[];
  adminCcEmails?: string | null;
  adminBccEmails?: string | null;
}) {
  const cc = uniqueEmails([
    ...(params.contactEmails || []).filter(Boolean),
    ...parseEmailList(params.adminCcEmails),
  ]);
  const bcc = uniqueEmails(parseEmailList(params.adminBccEmails));

  return {
    to: params.primaryEmail,
    cc,
    bcc,
  };
}
