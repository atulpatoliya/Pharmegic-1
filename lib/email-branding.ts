export function resolveEmailLogoUrl(templateLogo?: string | null): string {
  const trimmed = templateLogo?.trim();
  if (trimmed && (trimmed.startsWith('data:') || trimmed.startsWith('http'))) {
    return trimmed;
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/pharmegic-logo.png`;
}

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildEmailShell(options: {
  subtitle?: string;
  bodyHtml: string;
  logoUrl?: string | null;
}): string {
  const logoSrc = resolveEmailLogoUrl(options.logoUrl);
  const subtitle = options.subtitle
    ? `<p style="margin:12px 0 0;font-size:13px;color:#d1fae5;font-weight:600;">${escapeEmailHtml(options.subtitle)}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px; color: #334155; }
    .container { max-width: 580px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #064e3b; padding: 28px 32px; text-align: center; }
    .body { padding: 32px; }
    .detail { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; }
    .detail p { margin: 6px 0; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin: 24px 0 8px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    .cert-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .cert-number { font-size: 24px; font-weight: 900; color: #064e3b; letter-spacing: 0.1em; font-family: monospace; }
    .details { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .value { color: #0f172a; font-weight: 700; }
    .quota-verified { background: #ecfdf5; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #047857; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoSrc}" alt="Pharmegic Healthcare" style="max-height:48px;max-width:220px;object-fit:contain;display:inline-block;" />
      ${subtitle}
    </div>
    <div class="body">
      ${options.bodyHtml}
    </div>
    <div class="footer">
      Pharmegic Healthcare Compliance Division | This is an automated compliance notification.
    </div>
  </div>
</body>
</html>`;
}

export function formatEmailDate(dateRaw?: string | null): string {
  if (!dateRaw?.trim()) return '—';
  const parsed = new Date(`${dateRaw.split('T')[0]}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateRaw;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
