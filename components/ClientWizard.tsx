'use client';

import { createClientAction } from '@/actions/clients';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from '@/store/toast';
import { Eye, EyeOff, Plus, Trash2, Save, User, AlertCircle } from 'lucide-react';
import { useState, useTransition } from 'react';

interface ClientWizardProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ClientWizard({ onSuccess, onCancel }: ClientWizardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    company_name: '',
    legal_name: '',
    registration_number: '',
    uuid_number: '',
    primary_contact_first_name: '',
    primary_contact_last_name: '',
    email: '',
    password: '',
    owner_name: '',
    phone: '',
    cc_emails: '',
    cc_phones: '',
    address: '',
    city: '',
    state: '',
    country: 'Turkey',
    postal_code: '',
    status: 'active' as 'active' | 'inactive' | 'pending',
  });

  const [contacts, setContacts] = useState<
    { first_name: string; last_name: string; email: string; phone: string; role: string }[]
  >([]);

  const [showPassword, setShowPassword] = useState(false);

  const [tempContact, setTempContact] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
  });

  const validateForm = () => {
    if (!profile.company_name) return 'Company name is required';
    if (!profile.registration_number) return 'Registration number is required';
    if (!profile.primary_contact_first_name) return 'Primary contact first name is required';
    if (!profile.primary_contact_last_name) return 'Primary contact last name is required';
    if (!profile.email) return 'Primary contact email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return 'Invalid email format';
    if (!profile.password || profile.password.length < 6) return 'Password must be at least 6 characters';
    if (!profile.phone) return 'Primary contact mobile number is required';
    return null;
  };

  const addContact = () => {
    if (!tempContact.first_name || !tempContact.last_name || !tempContact.email) {
      toast.error('First name, last name and email are required for adding a contact.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tempContact.email)) {
      toast.error('Invalid contact email format.');
      return;
    }

    setContacts([...contacts, tempContact]);
    setTempContact({ first_name: '', last_name: '', email: '', phone: '', role: '' });
    toast.success('Secondary contact added to list.');
  };

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError(null);
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      setError(validationError);
      return;
    }

    const payload = {
      profile,
      contacts,
      authorizedChemicalIds: [],
    };

    startTransition(async () => {
      const res = await createClientAction(null, payload);
      if (!res.success) {
        const message = res.error || 'Failed to create client.';
        setError(message);
        toast.error(message);
        return;
      }

      toast.success(res.message || 'Client created and login credentials set successfully.');
      onSuccess();
    });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">New Client Contact Form</h2>
        <p className="text-sm text-slate-500">Create the client profile, assign contacts, and set an initial password in one page.</p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Company Details</h3>
            <p className="text-xs text-slate-500">Basic client organization information.</p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Input
            label="Company Name"
            placeholder="Pharmegic Ltd."
            value={profile.company_name}
            onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
            required
          />
          <Input
            label="Legal Name"
            placeholder="Pharmegic Pharmaceuticals Ltd."
            value={profile.legal_name}
            onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })}
          />
          <Input
            label="Registration Number"
            placeholder="REG-123456"
            value={profile.registration_number}
            onChange={(e) => setProfile({ ...profile, registration_number: e.target.value })}
            required
          />
          <Input
            label="UUID Number"
            placeholder="Auto-generated if left blank"
            value={profile.uuid_number}
            onChange={(e) => setProfile({ ...profile, uuid_number: e.target.value })}
          />
          <Input
            label="Owner / Company Representative"
            placeholder="Ahmet Yilmaz"
            value={profile.owner_name}
            onChange={(e) => setProfile({ ...profile, owner_name: e.target.value })}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Primary Person</h3>
            <p className="text-xs text-slate-500">Primary contact details for the client account.</p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Input
            label="First Name"
            placeholder="Jane"
            value={profile.primary_contact_first_name}
            onChange={(e) => setProfile({ ...profile, primary_contact_first_name: e.target.value })}
            required
          />
          <Input
            label="Last Name"
            placeholder="Doe"
            value={profile.primary_contact_last_name}
            onChange={(e) => setProfile({ ...profile, primary_contact_last_name: e.target.value })}
            required
          />
          <Input
            type="email"
            label="Email Address"
            placeholder="jane@company.com"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            required
          />
          <Input
            label="Mobile Number"
            placeholder="+90 532 123 4567"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            required
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Login Credential</h3>
            <p className="text-xs text-slate-500">Set the client's initial authentication details.</p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a temporary password"
                value={profile.password}
                onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 pr-10 py-2 text-sm ring-offset-background placeholder:text-slate-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Secondary Person Contact</h3>
            <p className="text-xs text-slate-500">Optional secondary contacts for the client account.</p>
          </div>
        </div>

        <div className="mt-6 p-4 rounded-3xl bg-slate-50 border border-slate-100 grid gap-4 grid-cols-1 md:grid-cols-2">
          <h4 className="md:col-span-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            Add Secondary Contact Officer
          </h4>
          <Input
            label="First Name"
            placeholder="John"
            value={tempContact.first_name}
            onChange={(e) => setTempContact({ ...tempContact, first_name: e.target.value })}
          />
          <Input
            label="Last Name"
            placeholder="Smith"
            value={tempContact.last_name}
            onChange={(e) => setTempContact({ ...tempContact, last_name: e.target.value })}
          />
          <Input
            type="email"
            label="Email"
            placeholder="john@company.com"
            value={tempContact.email}
            onChange={(e) => setTempContact({ ...tempContact, email: e.target.value })}
          />
          <Input
            label="Mobile Number"
            placeholder="+90 532 123 4567"
            value={tempContact.phone}
            onChange={(e) => setTempContact({ ...tempContact, phone: e.target.value })}
          />
          <Input
            label="Position / Role"
            placeholder="Compliance Manager"
            value={tempContact.role}
            onChange={(e) => setTempContact({ ...tempContact, role: e.target.value })}
          />
          <div className="md:col-span-2 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={addContact}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Contact
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Saved Secondary Contacts ({contacts.length})</h4>
          {contacts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
              No secondary contact officers added yet.
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-100 bg-white divide-y divide-slate-100 overflow-hidden">
              {contacts.map((contact, idx) => (
                <div key={idx} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{contact.first_name} {contact.last_name}</div>
                    <div className="text-sm text-slate-500">{contact.email} {contact.role ? `• ${contact.role}` : ''}</div>
                    {contact.phone ? <div className="text-sm text-slate-500">{contact.phone}</div> : null}
                  </div>
                  <Button type="button" variant="ghost" onClick={() => removeContact(idx)}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Address Details</h3>
            <p className="text-xs text-slate-500">Client billing / office address information.</p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="md:col-span-2">
            <Input
              label="Address"
              placeholder="100 Compliance Boulevard, Suite 50"
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
            />
          </div>
          <Input
            label="City"
            placeholder="Istanbul"
            value={profile.city}
            onChange={(e) => setProfile({ ...profile, city: e.target.value })}
          />
          <Input
            label="State"
            placeholder="Marmara"
            value={profile.state}
            onChange={(e) => setProfile({ ...profile, state: e.target.value })}
          />
          <Input
            label="Postal Code"
            placeholder="34000"
            value={profile.postal_code}
            onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })}
          />
          <Input
            label="Country"
            placeholder="Turkey"
            value={profile.country}
            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
          />
        </div>
      </section>


      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-3xl text-sm font-semibold flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold mb-1">Onboarding Error</h4>
            <p className="text-xs leading-relaxed font-medium">{error}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} isLoading={isPending} disabled={isPending}>
          Create Client and Set Password <Save className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
