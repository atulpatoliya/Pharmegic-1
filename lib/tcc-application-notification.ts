import type { SupabaseClient } from '@supabase/supabase-js';
import { buildTccSmtpConfig } from '@/lib/certificate-smtp-settings';
import { parseEmailList } from '@/lib/certificate-email-recipients';
import { sendTccApplicationNotificationEmail } from '@/services/email';

export type TccApplicationNotificationDetails = {
  clientCompanyName: string;
  chemicalName: string;
  quantityMt: number;
  exportDate: string;
  applicationId: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateTccNotificationEmails(raw?: string | null): string | null {
  const emails = parseEmailList(raw);
  for (const email of emails) {
    if (!isValidEmail(email)) {
      return `Invalid notification email: ${email}`;
    }
  }
  return null;
}

export async function notifyTccApplicationByEmail(
  adminSupabase: SupabaseClient,
  details: TccApplicationNotificationDetails
): Promise<void> {
  const { data: settings } = await adminSupabase
    .from('admin_settings')
    .select(
      'tcc_application_notification_emails, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from'
    )
    .eq('id', 1)
    .maybeSingle();

  const recipients = parseEmailList(settings?.tcc_application_notification_emails);
  if (recipients.length === 0) return;

  await sendTccApplicationNotificationEmail({
    to: recipients,
    smtpConfig: buildTccSmtpConfig(settings),
    ...details,
  });
}
