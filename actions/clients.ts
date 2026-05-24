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
    const emailRes = await sendEmail({
      to: parsed.data.profile.email,
      subject: 'Welcome to Pharmegic Healthcare Portal',
      html: emailHtml,
    });

    revalidatePath('/admin/clients');
    return {
      success: true,
      message: emailRes.fallback
        ? 'Client created. SMTP not configured/failed. (Invite link printed to server console).'
        : 'Client created and invitation email successfully dispatched.',
      clientId: client.id,
      inviteLink: emailRes.fallback ? inviteLink : undefined,
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
    // 1. Fetch current client data to check if email has changed
    const { data: oldClient, error: oldClientError } = await userSupabase
      .from('clients')
      .select('email, auth_user_id')
      .eq('id', clientId)
      .single();

    if (oldClientError) throw oldClientError;

    const finalProfile = { ...profile };

    if (oldClient && oldClient.email !== profile.email) {
      // Check for email collision in the database
      const { data: duplicateClient } = await userSupabase
        .from('clients')
        .select('id')
        .eq('email', profile.email)
        .neq('id', clientId)
        .maybeSingle();

      if (duplicateClient) {
        return { success: false, error: 'This email address is already in use by another client.' };
      }

      const adminSupabase = createAdminClient();

      if (oldClient.auth_user_id) {
        const { error: authUpdateError } = await adminSupabase.auth.admin.updateUserById(
          oldClient.auth_user_id,
          { email: profile.email }
        );
        if (authUpdateError) {
          console.error('[AUTH EMAIL UPDATE ERROR]:', authUpdateError);
          return { success: false, error: 'Failed to update client authentication email: ' + authUpdateError.message };
        }
      } else {
        // If auth_user_id is not set, search by old email and link it
        const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
        const match = authUsers.users.find((u) => u.email === oldClient.email);
        if (match) {
          const { error: authUpdateError } = await adminSupabase.auth.admin.updateUserById(
            match.id,
            { email: profile.email }
          );
          if (authUpdateError) {
            console.error('[AUTH EMAIL UPDATE ERROR]:', authUpdateError);
            return { success: false, error: 'Failed to update client authentication email: ' + authUpdateError.message };
          }
          finalProfile.auth_user_id = match.id;
        }
      }
    }

    // 2. Perform DB update
    await updateClient(userSupabase, clientId, finalProfile, chemicalIds);
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

export async function checkClientActivationStatus(email: string) {
  const userSupabase = await createClient();

  // Verify caller is admin/staff
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user || (user.user_metadata?.role !== 'MASTER_ADMIN' && user.user_metadata?.role !== 'STAFF')) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const adminSupabase = createAdminClient();
    const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
    const match = authUsers.users.find((u) => u.email === email);
    
    // If the user doesn't exist in auth, or exists but has null last_sign_in_at
    if (!match) {
      return { success: true, needsActivation: true, exists: false };
    }
    
    if (!match.last_sign_in_at) {
      return { success: true, needsActivation: true, exists: true };
    }
    
    return { success: true, needsActivation: false, exists: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to check status.' };
  }
}

export async function resendClientInviteAction(email: string) {
  const userSupabase = await createClient();

  // Verify caller is admin/staff
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user || (user.user_metadata?.role !== 'MASTER_ADMIN' && user.user_metadata?.role !== 'STAFF')) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    // 1. Fetch client record
    const { data: client, error: clientErr } = await userSupabase
      .from('clients')
      .select('id, company_name')
      .eq('email', email)
      .single();

    if (clientErr || !client) {
      return { success: false, error: 'Client record not found in database.' };
    }

    const adminSupabase = createAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // 2. Generate new invite link
    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${appUrl}/reset-password`,
        data: {
          role: 'CLIENT',
          client_id: client.id,
        },
      },
    });

    if (inviteError) {
      throw inviteError;
    }

    const inviteLink = inviteData.properties.action_link;

    // 3. Send email
    const emailHtml = getInvitationEmail(client.company_name, inviteLink, inviteLink);
    const emailRes = await sendEmail({
      to: email,
      subject: 'Set Password for Pharmegic Healthcare Portal',
      html: emailHtml,
    });

    return {
      success: true,
      message: emailRes.fallback
        ? 'Invitation link generated (printed to server console, configure SMTP in Vercel to receive real emails).'
        : 'Invitation email successfully resent to client.',
      inviteLink: emailRes.fallback ? inviteLink : undefined,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to resend invite.' };
  }
}
