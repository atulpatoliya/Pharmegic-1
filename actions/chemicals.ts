'use server';

import { createClient } from '@/lib/supabase/server';
import { createChemical, updateChemical, deleteChemical } from '@/services/db';
import { chemicalSchema } from '@/lib/validations';
import { revalidatePath } from 'next/cache';

export async function createChemicalAction(prevState: any, formData: FormData) {
  const data = {
    chemical_name: formData.get('chemical_name') as string,
    cas_number: formData.get('cas_number') as string,
    ec_number: formData.get('ec_number') as string,
    tonnage_band: formData.get('tonnage_band') as string,
    validity_date: formData.get('validity_date') as string,
    available_quantity: formData.get('available_quantity') as string,
    status: (formData.get('status') as string) || 'active',
  };

  const parsed = chemicalSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message,
    };
  }

  const supabase = await createClient();

  // Role authorization check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (user.user_metadata?.role !== 'MASTER_ADMIN' && user.user_metadata?.role !== 'STAFF')) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    await createChemical(supabase, parsed.data);
    revalidatePath('/admin/chemicals');
    return { success: true, message: 'Chemical added successfully.' };
  } catch (err: any) {
    return {
      success: false,
      error: err.code === '23505' ? 'A chemical with this CAS number already exists.' : err.message || 'Failed to create chemical substance.',
    };
  }
}

export async function updateChemicalAction(id: string, data: any) {
  const parsed = chemicalSchema.partial().safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0].message,
    };
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (user.user_metadata?.role !== 'MASTER_ADMIN' && user.user_metadata?.role !== 'STAFF')) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    await updateChemical(supabase, id, parsed.data);
    revalidatePath('/admin/chemicals');
    return { success: true, message: 'Chemical updated successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update chemical.' };
  }
}

export async function deleteChemicalAction(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== 'MASTER_ADMIN') {
    return { success: false, error: 'Unauthorized. Admins only.' };
  }

  try {
    await deleteChemical(supabase, id);
    revalidatePath('/admin/chemicals');
    return { success: true, message: 'Chemical deleted successfully.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete chemical.' };
  }
}
