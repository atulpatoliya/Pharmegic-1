'use client';

import { createClientAction } from '@/actions/clients';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { toast } from '@/store/toast';
import { Plus, Trash2, ArrowLeft, ArrowRight, Save, User, Shield, Briefcase } from 'lucide-react';
import { useState, useTransition } from 'react';

interface ChemicalOption {
  id: string;
  chemical_name: string;
  cas_number: string;
}

interface ClientWizardProps {
  chemicals: ChemicalOption[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ClientWizard({ chemicals, onSuccess, onCancel }: ClientWizardProps) {
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Wizard State
  const [profile, setProfile] = useState({
    company_name: '',
    legal_name: '',
    registration_number: '',
    uuid_number: '',
    email: '',
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
    { person_name: string; email: string; phone: string; role: string }[]
  >([]);
  const [tempContact, setTempContact] = useState({
    person_name: '',
    email: '',
    phone: '',
    role: '',
  });

  const [authorizedChemicalIds, setAuthorizedChemicalIds] = useState<string[]>([]);

  // Validation functions
  const validateStep1 = () => {
    if (!profile.company_name) return 'Company name is required';
    if (!profile.registration_number) return 'Registration number is required';
    if (!profile.email) return 'Primary corporate email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return 'Invalid email format';
    return null;
  };

  const handleNext = () => {
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        toast.error(err);
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
  };

  // Contacts Handlers
  const addContact = () => {
    if (!tempContact.person_name || !tempContact.email) {
      toast.error('Name and email are required for adding a contact.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tempContact.email)) {
      toast.error('Invalid contact email format.');
      return;
    }
    setContacts([...contacts, tempContact]);
    setTempContact({ person_name: '', email: '', phone: '', role: '' });
    toast.success('Contact officer added to list.');
  };

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  // Chemical Checkbox Handler
  const toggleChemical = (id: string) => {
    setAuthorizedChemicalIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  };

  // Submit Handler
  const handleSubmit = async () => {
    const payload = {
      profile,
      contacts,
      authorizedChemicalIds,
    };

    startTransition(async () => {
      const res = await createClientAction(null, payload);
      if (!res.success) {
        toast.error(res.error || 'Failed to create client.');
      } else {
        if (res.inviteLink) {
          toast.success(`${res.message} Invite Link: ${res.inviteLink}`, 10000);
        } else {
          toast.success(res.message || 'Client created and notified!');
        }
        onSuccess();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Wizard Step Indicator */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step === 1 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
          }`}>1</span>
          <span className="text-xs font-semibold text-slate-700">Company Profile</span>
          <div className="w-8 h-[2px] bg-slate-200" />

          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step === 2 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
          }`}>2</span>
          <span className="text-xs font-semibold text-slate-700">Contacts</span>
          <div className="w-8 h-[2px] bg-slate-200" />

          <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step === 3 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
          }`}>3</span>
          <span className="text-xs font-semibold text-slate-700">Authorizations</span>
        </div>
        <span className="text-xs font-semibold text-slate-400">Step {step} of 3</span>
      </div>

      {/* STEP 1: COMPANY PROFILE */}
      {step === 1 && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Input
            label="Company Name"
            placeholder="Pharmegic Ltd."
            value={profile.company_name}
            onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
            required
          />
          <Input
            label="Registration Number"
            placeholder="REG-123456"
            value={profile.registration_number}
            onChange={(e) => setProfile({ ...profile, registration_number: e.target.value })}
            required
          />
          <Input
            type="email"
            label="Primary Email Address"
            placeholder="primary@company.com"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            required
          />
          <Input
            label="CC Email (comma-separated)"
            placeholder="cc1@company.com, cc2@company.com"
            value={profile.cc_emails}
            onChange={(e) => setProfile({ ...profile, cc_emails: e.target.value })}
          />
          <Input
            label="Primary Phone Number"
            placeholder="+90 212 555 1234"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
          <Input
            label="CC Phone Number"
            placeholder="+90 212 555 5678, +90 212 555 9012"
            value={profile.cc_phones}
            onChange={(e) => setProfile({ ...profile, cc_phones: e.target.value })}
          />
          <div className="md:col-span-2">
            <Input
              label="Company Address"
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
            label="UUID Number"
            placeholder="Auto-generated if left blank"
            value={profile.uuid_number}
            onChange={(e) => setProfile({ ...profile, uuid_number: e.target.value })}
          />
          <Input
            label="Country"
            placeholder="Turkey"
            value={profile.country}
            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
          />
        </div>
      )}

      {/* STEP 2: CONTACT DETAILS */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 grid gap-4 grid-cols-1 md:grid-cols-2">
            <h3 className="md:col-span-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              Add Officer / Contact Person
            </h3>
            <Input
              label="Full Name"
              placeholder="Jane Doe"
              value={tempContact.person_name}
              onChange={(e) => setTempContact({ ...tempContact, person_name: e.target.value })}
            />
            <Input
              type="email"
              label="Direct Email"
              placeholder="jane@company.com"
              value={tempContact.email}
              onChange={(e) => setTempContact({ ...tempContact, email: e.target.value })}
            />
            <Input
              label="Phone Number"
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
                <Plus className="h-4 w-4 mr-1.5" /> Save Contact Officer
              </Button>
            </div>
          </div>

          {/* Contact List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Assigned Contact Officers ({contacts.length})
            </h4>
            {contacts.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg text-xs text-slate-400 font-medium">
                No secondary contact officers mapped yet.
              </div>
            ) : (
              <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 overflow-hidden bg-white">
                {contacts.map((c, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">{c.person_name}</div>
                        <div className="text-xs text-slate-500">
                          {c.email} {c.role ? `• ${c.role}` : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeContact(idx)}
                      className="p-1 rounded-md text-rose-500 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: SUBSTANCE AUTHORIZATION */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="text-sm text-slate-500 font-medium">
            Select the specific chemical substances this client is authorized to apply for and export:
          </div>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 max-h-[350px] overflow-y-auto pr-1">
            {chemicals.map((chem) => (
              <div
                key={chem.id}
                onClick={() => toggleChemical(chem.id)}
                className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer select-none transition-all ${
                  authorizedChemicalIds.includes(chem.id)
                    ? 'border-primary bg-emerald-50/30'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={authorizedChemicalIds.includes(chem.id)}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 rounded-sm border-slate-300 text-primary focus:ring-primary cursor-pointer"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="text-sm font-bold text-slate-800">{chem.chemical_name}</div>
                  <div className="text-xs text-slate-400 font-medium">CAS No: {chem.cas_number}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          onClick={step === 1 ? onCancel : handleBack}
          disabled={isPending}
        >
          {step === 1 ? 'Cancel' : 'Previous'}
        </Button>

        {step < 3 ? (
          <Button type="button" onClick={handleNext}>
            Next Step <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            isLoading={isPending}
            disabled={isPending}
          >
            Send email to client to generate password <Save className="ml-1.5 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
