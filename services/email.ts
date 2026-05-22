import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || 'Pharmegic Healthcare <noreply@pharmegic-portal.com>';

// Create transporter only if parameters are fully provided, otherwise fallback to logging
const isSmtpConfigured = !!(smtpHost && smtpUser && smtpPass);

let transporter: nodemailer.Transporter | null = null;

if (isSmtpConfigured) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // True for 465, false for 587 or other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendMailOptions) {
  if (isSmtpConfigured && transporter) {
    try {
      const info = await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        html,
      });
      console.log(`[SMTP] Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('[SMTP] Failed to send email via SMTP:', error);
      // fallback to log
      logFallbackEmail(to, subject, html);
      return { success: true, fallback: true, error: error.message };
    }
  } else {
    logFallbackEmail(to, subject, html);
    return { success: true, fallback: true };
  }
}

function logFallbackEmail(to: string, subject: string, html: string) {
  console.log('========================================================================');
  console.log(`[EMAIL FALLBACK LOGGER]`);
  console.log(`TO:      ${to}`);
  console.log(`FROM:    ${smtpFrom}`);
  console.log(`SUBJECT: ${subject}`);
  console.log('------------------------------------------------------------------------');
  // Strip CSS tags for terminal readability if needed, or just dump the html
  console.log(`BODY (HTML): \n${html.substring(0, 1000)}... (truncated for logs)`);
  console.log('========================================================================');
}
