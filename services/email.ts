import nodemailer from 'nodemailer';

interface SmtpConfig {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  smtp_cc_default?: string;
}

function buildTransporter(config?: SmtpConfig) {
  // Prefer DB config, fallback to env vars
  const host = config?.smtp_host || process.env.SMTP_HOST;
  const port = config?.smtp_port || parseInt(process.env.SMTP_PORT || '587', 10);
  const user = config?.smtp_user || process.env.SMTP_USER;
  const pass = config?.smtp_pass || process.env.SMTP_PASS;
  const from = config?.smtp_from || process.env.SMTP_FROM || 'Pharmegic Healthcare <noreply@pharmegic-portal.com>';

  if (!host || !user || !pass) {
    return { transporter: null, from };
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
    from,
  };
}

// ============================================================================
// GENERAL EMAIL
// ============================================================================
interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  smtpConfig?: SmtpConfig;
}

export async function sendEmail({ to, subject, html, cc, smtpConfig }: SendMailOptions) {
  const { transporter, from } = buildTransporter(smtpConfig);

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        cc: cc?.join(', '),
        subject,
        html,
      });
      console.log(`[SMTP] Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[SMTP] Failed:', msg);
      logFallbackEmail(to, subject);
      return { success: true, fallback: true, error: msg };
    }
  } else {
    logFallbackEmail(to, subject);
    return { success: true, fallback: true };
  }
}

// ============================================================================
// CERTIFICATE EMAIL (with PDF attachment)
// ============================================================================
interface SendCertificateEmailOptions {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  certificateNumber: string;
  companyName: string;
  chemicalName: string;
  pdfBuffer: Buffer;
  pdfFileName: string;
  smtpConfig?: SmtpConfig;
  certificateType?: 'TCC' | 'REACH';
}

export async function sendCertificateEmail({
  to,
  cc,
  bcc,
  subject,
  certificateNumber,
  companyName,
  chemicalName,
  pdfBuffer,
  pdfFileName,
  smtpConfig,
  certificateType = 'TCC',
}: SendCertificateEmailOptions) {
  const { transporter, from } = buildTransporter(smtpConfig);

  const html =
    certificateType === 'REACH'
      ? getReachCertificateEmailHtml(companyName, chemicalName, certificateNumber)
      : getCertificateEmailHtml(companyName, chemicalName, certificateNumber);

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        cc: cc?.filter(Boolean).join(', ') || undefined,
        bcc: bcc?.filter(Boolean).join(', ') || undefined,
        subject,
        html,
        attachments: [
          {
            filename: pdfFileName,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
      console.log(`[SMTP] Certificate email sent: ${info.messageId}`);
      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[SMTP] Certificate email failed:', msg);
      logFallbackEmail(to, subject);
      return { success: true, fallback: true, error: msg };
    }
  } else {
    logFallbackEmail(to, subject);
    return { success: true, fallback: true };
  }
}

function logFallbackEmail(to: string, subject: string) {
  console.log('========================================================================');
  console.log(`[EMAIL FALLBACK] TO: ${to} | SUBJECT: ${subject}`);
  console.log('Configure SMTP in Admin Settings to send real emails.');
  console.log('========================================================================');
}

function getCertificateEmailHtml(companyName: string, chemicalName: string, certNumber: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px; color: #334155; }
    .container { max-width: 580px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #064e3b; padding: 32px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.05em; }
    .header p { margin: 8px 0 0; font-size: 13px; opacity: 0.8; }
    .body { padding: 32px; }
    .cert-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .cert-number { font-size: 24px; font-weight: 900; color: #064e3b; letter-spacing: 0.1em; font-family: monospace; }
    .details { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .value { color: #0f172a; font-weight: 700; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PHARMEGIC HEALTHCARE</h1>
      <p>Tonnage Compliance Certificate Registry</p>
    </div>
    <div class="body">
      <p>Dear <strong>${companyName}</strong>,</p>
      <p>Your Tonnage Compliance Certificate (TCC) application has been <strong>approved</strong>. Please find the official certificate attached to this email.</p>
      <div class="cert-box">
        <div style="font-size:11px;color:#064e3b;font-weight:700;margin-bottom:6px;letter-spacing:0.1em;">CERTIFICATE NUMBER</div>
        <div class="cert-number">${certNumber}</div>
      </div>
      <div class="details">
        <div class="detail-row"><span class="label">Issued To</span><span class="value">${companyName}</span></div>
        <div class="detail-row"><span class="label">Chemical Substance</span><span class="value">${chemicalName}</span></div>
        <div class="detail-row"><span class="label">Status</span><span class="value" style="color:#16a34a;">✓ Active &amp; Valid</span></div>
      </div>
      <p style="font-size:13px;color:#64748b;">The PDF certificate is attached to this email. Please store it safely for compliance records. For verification, visit our public verification portal.</p>
    </div>
    <div class="footer">
      Pharmegic Healthcare Compliance Division | This is an automated compliance notification.
    </div>
  </div>
</body>
</html>`;
}

function getReachCertificateEmailHtml(
  companyName: string,
  chemicalName: string,
  certNumber: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px; color: #334155; }
    .container { max-width: 580px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #064e3b; padding: 32px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.05em; }
    .header p { margin: 8px 0 0; font-size: 13px; opacity: 0.8; }
    .body { padding: 32px; }
    .cert-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .cert-number { font-size: 24px; font-weight: 900; color: #064e3b; letter-spacing: 0.1em; font-family: monospace; }
    .details { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 600; }
    .value { color: #0f172a; font-weight: 700; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PHARMEGIC HEALTHCARE</h1>
      <p>REACH Compliance Certificate Registry</p>
    </div>
    <div class="body">
      <p>Dear <strong>${companyName}</strong>,</p>
      <p>Your <strong>REACH Compliance Certificate (RC)</strong> has been issued. Please find the official certificate attached to this email.</p>
      <div class="cert-box">
        <div style="font-size:11px;color:#064e3b;font-weight:700;margin-bottom:6px;letter-spacing:0.1em;">CERTIFICATE NUMBER</div>
        <div class="cert-number">${certNumber}</div>
      </div>
      <div class="details">
        <div class="detail-row"><span class="label">Issued To</span><span class="value">${companyName}</span></div>
        <div class="detail-row"><span class="label">Chemical Substance</span><span class="value">${chemicalName}</span></div>
        <div class="detail-row"><span class="label">Status</span><span class="value" style="color:#16a34a;">✓ Active &amp; Valid</span></div>
      </div>
      <p style="font-size:13px;color:#64748b;">The PDF certificate is attached. This RC certificate is required before applying for a Tonnage Compliance Certificate (TCC).</p>
    </div>
    <div class="footer">
      Pharmegic Healthcare Compliance Division | This is an automated compliance notification.
    </div>
  </div>
</body>
</html>`;
}
