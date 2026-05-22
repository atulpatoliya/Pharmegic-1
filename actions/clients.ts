'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClientWizard, updateClient, deleteClient } from '@/services/db';
import { sendEmail } from '@/services/email';
import { getInvitationEmail } from '@/emails/templates';
import { clientWizardSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

export async function createClientAction(prevState: any, data: any) {
  // Validate input
  const parsed = clientWizardSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message,
    };
  }

  const userSupabase = await createClient();

  // Verify caller is admin/staff
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user || (user.user_metadata?.role !== 'MASTER_ADMIN' && user.user_metadata?.role !== 'STAFF')) {
    return { success: false, error: 'Unauthorized. Admins only.' };
  }

  try {
    // 1. Create client organization, contacts and mapping in DB
    const client = await createClientWizard(userSupabase, parsed.data);

    // 2. Generate Supabase Auth invitation link using the service role admin client
    const adminSupabase = createAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.generateLink({
      type: 'invite',
      email: parsed.data.profile.email,
      options: {
        redirectTo: `${appUrl}/reset-password`,
        data: {
          role: 'CLIENT',
          client_id: client.id,
        },
      },
    });

    if (inviteError) {
      console.error('[AUTH INVITE ERROR] Failed to generate link:', inviteError);
      return {
        success: true,
        message: 'Client organization created in DB, but Auth invitation link generation failed.',
        clientId: client.id,
      };
    }

    const inviteLink = inviteData.properties.action_link;

    // 3. Send custom styled SMTP invitation email
    const emailHtml = getInvitationEmail(client.company_name, inviteLink, inviteLink);
    await sendEmail({
      to: parsed.data.profile.email,
      subject: 'Welcome to Pharmegic Healthcare Portal',
      html: emailHtml,
    });

    revalidatePath('/admin/clients');
    return {
      success: true,
      message: 'Client created and invitation email successfully dispatched.',
      clientId: client.id,
    };
  } catch (err: any) {
    console.error('[CLIENT CREATE ACTION ERROR]:', err);
    return {
      success: false,
      error: err.message || 'An unexpected error occurred.',
    };
  }
}

export async function updateClientAction(clientId: string, profile: any, chemicalIds?: string[]) {
  const userSupabase = await createClient();

  // Verify permissions
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user || (user.user_metadata?.role !== 'MASTER_ADMIN' && user.user_metadata?.role !== 'STAFF')) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    await updateClient(userSupabase, clientId, profile, chemicalIds);
    revalidatePath('/admin/clients');
    return { success: true, message: 'Client profile updated successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update client.' };
  }
}

export async function deleteClientAction(clientId: string) {
  const userSupabase = await createClient();

  // Verify permissions
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'MASTER_ADMIN') {
    return { success: false, error: 'Unauthorized. Admins only.' };
  }

  try {
    // 1. Fetch client to find the associated user email for auth deletion
    const { data: client } = await userSupabase
      .from('clients')
      .select('email')
      .eq('id', clientId)
      .single();

    // 2. Perform DB Deletions (Cascades automatically)
    await deleteClient(userSupabase, clientId);

    // 3. Delete user from auth if exists
    if (client?.email) {
      const adminSupabase = createAdminClient();
      const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
      const match = authUsers.users.find((u) => u.email === client.email);
      if (match) {
        await adminSupabase.auth.admin.deleteUser(match.id);
      }
    }

    revalidatePath('/admin/clients');
    return { success: true, message: 'Client and all associated files deleted successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete client.' };
  }
}
