'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateClientAction } from '@/actions/clients';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/store/toast';
import { useLayoutStore } from '@/store/layout';
import { Briefcase, AlertCircle } from 'lucide-react';


interface ChemicalOption {
  id: string;
  chemical_name: string;
  cas_number: string;
}

interface Client {
  id: string;
  company_name: string;
  legal_name: string;
  registration_number: string;
  uuid_number: string | null;
  primary_contact_first_name?: string;
  primary_contact_last_name?: string;
  email: string;
  owner_name: string;
  phone: string | null;
  cc_emails: string | null;
  cc_phones: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  status: 'active' | 'inactive' | 'pending';
}

interface EditClientClientProps {
  client: Client;
  chemicals: ChemicalOption[];
  initialChemicalIds: string[];
}

export default function EditClientClient({ client, chemicals, initialChemicalIds }: EditClientClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const setCustomBreadcrumb = useLayoutStore((state) => state.setCustomBreadcrumb);

  useEffect(() => {
    setCustomBreadcrumb(client.company_name);
    return () => setCustomBreadcrumb(null);
  }, [client.company_name, setCustomBreadcrumb]);

  const [editProfile, setEditProfile] = useState({
    company_name: client.company_name || '',
    legal_name: client.legal_name || '',
    registration_number: client.registration_number || '',
    uuid_number: client.uuid_number || '',
    primary_contact_first_name: client.primary_contact_first_name || '',
    primary_contact_last_name: client.primary_contact_last_name || '',
    email: client.email || '',
    owner_name: client.owner_name || '',
    phone: client.phone || '',
    cc_emails: client.cc_emails || '',
    cc_phones: client.cc_phones || '',
    address: client.address || '',
    city: client.city || '',
    state: client.state || '',
    country: client.country || 'Turkey',
    postal_code: client.postal_code || '',
    status: client.status,
  });

  const [editChemicalIds, setEditChemicalIds] = useState<string[]>(initialChemicalIds);
  const [editError, setEditError] = useState<string | null>(null);


  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    startTransition(async () => {
      const res = await updateClientAction(client.id, editProfile, editChemicalIds);
      if (res.success) {
        toast.success(res.message || 'Client updated successfully.');
        router.push('/admin/clients');
        router.refresh();
      } else {
        setEditError(res.error || 'Failed to update client.');
        toast.error(res.error || 'Failed to update client.');
      }
    });
  };

  const toggleEditChemical = (id: string) => {
    setEditChemicalIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  };

  return (
    <form onSubmit={handleUpdateClient} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company Profile</h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Input
            label="Company Name"
            value={editProfile.company_name}
            onChange={(e) => setEditProfile({ ...editProfile, company_name: e.target.value })}
            required
          />
          <Input
            label="Registration Number"
            value={editProfile.registration_number}
            onChange={(e) => setEditProfile({ ...editProfile, registration_number: e.target.value })}
            required
          />
          <Input
            label="Primary Contact First Name"
            value={editProfile.primary_contact_first_name}
            onChange={(e) => setEditProfile({ ...editProfile, primary_contact_first_name: e.target.value })}
            required
          />
          <Input
            label="Primary Contact Last Name"
            value={editProfile.primary_contact_last_name}
            onChange={(e) => setEditProfile({ ...editProfile, primary_contact_last_name: e.target.value })}
            required
          />
          <Input
            type="email"
            label="Primary Email"
            value={editProfile.email}
            onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })}
            required
          />
          <Input
            label="Primary Contact Mobile Number"
            value={editProfile.phone}
            onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })}
          />
          <Input
            label="CC Email (comma-separated)"
            value={editProfile.cc_emails}
            onChange={(e) => setEditProfile({ ...editProfile, cc_emails: e.target.value })}
          />
          <Input
            label="CC Phone Number"
            value={editProfile.cc_phones}
            onChange={(e) => setEditProfile({ ...editProfile, cc_phones: e.target.value })}
          />
          <div className="md:col-span-2">
            <Input
              label="Company Address"
              value={editProfile.address}
              onChange={(e) => setEditProfile({ ...editProfile, address: e.target.value })}
            />
          </div>
          <Input
            label="City"
            value={editProfile.city}
            onChange={(e) => setEditProfile({ ...editProfile, city: e.target.value })}
          />
          <Input
            label="State"
            value={editProfile.state}
            onChange={(e) => setEditProfile({ ...editProfile, state: e.target.value })}
          />
          <Input
            label="Postal Code"
            value={editProfile.postal_code}
            onChange={(e) => setEditProfile({ ...editProfile, postal_code: e.target.value })}
          />
          <Input
            label="Country"
            value={editProfile.country}
            onChange={(e) => setEditProfile({ ...editProfile, country: e.target.value })}
          />
          <Input
            label="UUID Number"
            placeholder="Auto-generated if left blank"
            value={editProfile.uuid_number}
            onChange={(e) => setEditProfile({ ...editProfile, uuid_number: e.target.value })}
          />
        </div>

        <hr className="border-slate-100 my-4" />

        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Briefcase className="h-4 w-4 text-slate-500" /> Authorized Substances
        </h3>

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {chemicals.map((chem) => (
            <div
              key={chem.id}
              onClick={() => toggleEditChemical(chem.id)}
              className={`p-3 rounded-lg border flex items-start gap-2.5 cursor-pointer select-none transition-all ${
                editChemicalIds.includes(chem.id)
                  ? 'border-primary bg-emerald-50/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <input
                type="checkbox"
                checked={editChemicalIds.includes(chem.id)}
                onChange={() => {}}
                className="mt-0.5 h-3.5 w-3.5 rounded-sm border-slate-300 text-primary focus:ring-primary cursor-pointer"
              />
              <div className="flex-1 space-y-0.5">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {chem.chemical_name}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">CAS: {chem.cas_number}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm font-semibold flex items-start gap-2.5 w-full">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold mb-1">Update Error</h4>
            <p className="text-xs leading-relaxed font-medium">{editError}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end items-center gap-3 pt-6 border-t border-slate-100 w-full">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/clients')}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isPending} disabled={isPending}>
          Save Client Profile
        </Button>
      </div>

    </form>
  );
}