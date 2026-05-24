'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updateClientAction, deleteClientAction } from '@/actions/clients';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Badge } from './ui/Badge';
import { Dialog } from './ui/Dialog';
import { toast } from '@/store/toast';
import ClientWizard from './ClientWizard';
import {
  Search,
  Filter,
  UserPlus,
  Edit2,
  Trash2,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  X,
  Plus,
  Briefcase
} from 'lucide-react';

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
  created_at: string;
}

interface ClientsDashboardProps {
  initialClients: Client[];
  chemicals: ChemicalOption[];
}

export default function ClientsDashboard({ initialClients, chemicals }: ClientsDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clients, setClients] = useState<Client[]>(initialClients);

  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Active client being edited/deleted
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Edit form state
  const [editProfile, setEditProfile] = useState({
    company_name: '',
    legal_name: '',
    registration_number: '',
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
  const [editChemicalIds, setEditChemicalIds] = useState<string[]>([]);
  const [loadingEditData, setLoadingEditData] = useState(false);

  // Update local clients when initialClients change
  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  // Handle Search and Filter
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.legal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.owner_name && c.owner_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Open Edit Modal & load active data
  const handleOpenEdit = async (client: Client) => {
    setSelectedClient(client);
    setEditProfile({
      company_name: client.company_name || '',
      legal_name: client.legal_name || '',
      registration_number: client.registration_number || '',
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
    setIsEditOpen(true);
    setLoadingEditData(true);

    try {
      const { data, error } = await supabase
        .from('client_chemicals')
        .select('chemical_id')
        .eq('client_id', client.id);

      if (error) throw error;
      setEditChemicalIds(data.map((item) => item.chemical_id));
    } catch (err: any) {
      toast.error('Failed to load authorized chemicals: ' + err.message);
    } finally {
      setLoadingEditData(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    startTransition(async () => {
      const res = await updateClientAction(selectedClient.id, editProfile, editChemicalIds);
      if (res.success) {
        toast.success(res.message || 'Client updated successfully.');
        setIsEditOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update client.');
      }
    });
  };

  // Open Delete Modal
  const handleOpenDelete = (client: Client) => {
    setSelectedClient(client);
    setIsDeleteOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    startTransition(async () => {
      const res = await deleteClientAction(selectedClient.id);
      if (res.success) {
        toast.success(res.message || 'Client deleted successfully.');
        setIsDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete client.');
      }
    });
  };

  const toggleEditChemical = (id: string) => {
    setEditChemicalIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'inactive':
        return <Badge variant="danger">Inactive</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Client Directory</h1>
          <p className="text-sm text-slate-500 font-medium">
            Manage company compliance profiles, secondary contact officers, and substance authorization bands.
          </p>
        </div>
        <Button onClick={() => setIsWizardOpen(true)} className="sm:self-start">
          <UserPlus className="h-4 w-4 mr-2" />
          Onboard New Client
        </Button>
      </div>

      {/* Filters card */}
      <Card className="border-slate-100 shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by company, legal entity, owner, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-all"
            />
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-48">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'active', label: 'Active Only' },
                  { value: 'pending', label: 'Pending Only' },
                  { value: 'inactive', label: 'Inactive Only' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main clients list table */}
      <Card className="border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Company Profile</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Representative</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Registered</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    No clients found matching the selected search criteria.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-50 text-primary flex items-center justify-center font-bold">
                          <Building className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 group-hover:text-primary transition-colors">
                            {client.company_name}
                          </div>
                          <div className="text-xs text-slate-400 font-medium">
                            {client.legal_name || 'No legal name provided'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-700 flex items-center gap-1">
                          <span>{client.owner_name}</span>
                        </div>
                        <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span>{client.email}</span>
                        </div>
                        {client.phone && (
                          <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {client.city || client.country ? (
                        <div className="text-slate-600 font-medium flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {client.city ? `${client.city}, ` : ''}
                            {client.country}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Not set</span>
                      )}
                    </td>
                    <td className="p-4">{getStatusBadge(client.status)}</td>
                    <td className="p-4 text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{new Date(client.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(client)}
                          className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                          title="Edit Client"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(client)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                          title="Delete Client"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 1. Onboarding Wizard Modal */}
      <Dialog
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Client Onboarding Wizard"
      >
        <div className="max-h-[75vh] overflow-y-auto pr-1">
          <ClientWizard
            chemicals={chemicals}
            onSuccess={() => {
              setIsWizardOpen(false);
              router.refresh();
            }}
            onCancel={() => setIsWizardOpen(false)}
          />
        </div>
      </Dialog>

      {/* 2. Edit Client Modal */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Client: ${selectedClient?.company_name}`}
      >
        <form onSubmit={handleUpdateClient} className="space-y-6">
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
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
                type="email"
                label="Primary Email"
                value={editProfile.email}
                onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })}
                required
                disabled // Don't allow changing email since it's the auth username
              />
              <Input
                label="CC Email (comma-separated)"
                value={editProfile.cc_emails}
                onChange={(e) => setEditProfile({ ...editProfile, cc_emails: e.target.value })}
              />
              <Input
                label="Primary Phone Number"
                value={editProfile.phone}
                onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })}
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
                label="Primary Owner / Representative"
                value={editProfile.owner_name}
                onChange={(e) => setEditProfile({ ...editProfile, owner_name: e.target.value })}
              />
              <Select
                label="Status"
                value={editProfile.status}
                onChange={(e) => setEditProfile({ ...editProfile, status: e.target.value as any })}
                options={[
                  { value: 'active', label: 'Active (Fully Compliant)' },
                  { value: 'pending', label: 'Pending (Under Review)' },
                  { value: 'inactive', label: 'Inactive (Suspended)' },
                ]}
              />
            </div>

            <hr className="border-slate-100 my-4" />

            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-slate-500" /> Authorized Substances
            </h3>

            {loadingEditData ? (
              <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                Loading chemical mappings...
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
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
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending} disabled={isPending || loadingEditData}>
              Save Client Profile
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 3. Delete Confirmation Modal */}
      <Dialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Confirm Deletion">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 font-medium">
            Are you sure you want to delete <span className="font-bold text-slate-800">{selectedClient?.company_name}</span>?
          </p>
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700 font-semibold space-y-1">
            <p className="font-bold">WARNING: THIS ACTION IS PERMANENT & CANNOT BE UNDONE.</p>
            <p>
              Deleting this compliance account will immediately revoke all active certificates, cancel pending TCC permits, erase contact officer profiles, and delete the user credentials.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isPending}
            >
              No, Keep Client
            </Button>
            <Button
              type="button"
              onClick={handleDeleteClient}
              isLoading={isPending}
              disabled={isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white border-rose-600 hover:border-rose-700"
            >
              Yes, Delete Permanently
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
