'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { TableDataExport } from '@/components/TableDataExport';
import { formatDisplayDate } from '@/lib/date-filter';
import type { CsvColumn } from '@/lib/export-csv';

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
  Briefcase,
  AlertCircle
} from 'lucide-react';

interface ChemicalOption {
  id: string;
  chemical_name: string;
  cas_number: string;
}

interface Client {
  id: string;
  company_name: string;
  legal_name?: string | null;
  registration_number?: string | null;
  uuid_number: string | null;
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
  adminRole: 'SUPER_ADMIN' | 'MASTER_ADMIN' | 'CLIENT' | null;
}

const CLIENT_EXPORT_COLUMNS: CsvColumn<Client>[] = [
  { header: 'Company', value: (client) => client.company_name },
  { header: 'UUID', value: (client) => client.uuid_number },
  { header: 'Email', value: (client) => client.email },
  { header: 'Owner', value: (client) => client.owner_name },
  { header: 'Phone', value: (client) => client.phone },
  { header: 'City', value: (client) => client.city },
  { header: 'State', value: (client) => client.state },
  { header: 'Country', value: (client) => client.country },
  { header: 'Postal Code', value: (client) => client.postal_code },
  { header: 'Status', value: (client) => client.status },
  { header: 'Registered', value: (client) => formatDisplayDate(client.created_at) },
];

export default function ClientsDashboard({ initialClients, chemicals, adminRole }: ClientsDashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clients, setClients] = useState<Client[]>(initialClients);

  // Modals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Active client being edited/deleted
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Edit form state
  const [editProfile, setEditProfile] = useState({
    company_name: '',
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
  const [editChemicalIds, setEditChemicalIds] = useState<string[]>([]);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);


  // Update local clients when initialClients change
  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  // ── Realtime subscription: auto-refresh when clients table changes ──
  useEffect(() => {
    const channel = supabase
      .channel('clients-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        () => {
          // Re-fetch data from the server when any change occurs
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  // Handle Search and Filter
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.owner_name && c.owner_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredClientIds = useMemo(
    () => filteredClients.map((client) => client.id),
    [filteredClients]
  );

  const allFilteredSelected =
    filteredClientIds.length > 0 && filteredClientIds.every((id) => selectedClientIds.includes(id));

  const toggleClientSelection = (id: string) => {
    setSelectedClientIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const toggleSelectAllFilteredClients = () => {
    setSelectedClientIds(allFilteredSelected ? [] : [...filteredClientIds]);
  };

  // Open Edit Modal & load active data
  const handleOpenEdit = async (client: Client) => {
    setSelectedClient(client);
    setEditError(null);
    setEditProfile({
      company_name: client.company_name || '',
      uuid_number: client.uuid_number || '',
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

      // 1. Fetch authorized chemicals
      const { data, error } = await supabase
        .from('client_chemicals')
        .select('chemical_id')
        .eq('client_id', client.id);

      if (error) throw error;
      setEditChemicalIds(data.map((item) => item.chemical_id));
    } catch (err: any) {
      toast.error('Failed to load edit data: ' + err.message);
    } finally {
      setLoadingEditData(false);
    }
  };


  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setEditError(null);

    startTransition(async () => {
      const res = await updateClientAction(selectedClient.id, editProfile, editChemicalIds);
      if (res.success) {
        toast.success(res.message || 'Client updated successfully.');
        setIsEditOpen(false);
        router.refresh();
      } else {
        setEditError(res.error || 'Failed to update client.');
        toast.error(res.error || 'Failed to update client.');
      }
    });
  };

  // Open Delete Modal
  const handleOpenDelete = (client: Client) => {
    setSelectedClient(client);
    setIsDeleteOpen(true);
  };

  const canDeleteClient = adminRole === 'MASTER_ADMIN' || adminRole === 'SUPER_ADMIN';

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
        <div className="flex flex-wrap items-center gap-2 sm:self-start">
          <TableDataExport
            filename="clients"
            columns={CLIENT_EXPORT_COLUMNS}
            filteredRows={filteredClients}
            selectedIds={selectedClientIds}
            getRowId={(client) => client.id}
          />
          <Button onClick={() => router.push('/admin/clients/new')}>
            <UserPlus className="h-4 w-4 mr-2" />
            Onboard New Client
          </Button>
        </div>
      </div>

      {/* Filters card */}
      <Card className="border-slate-100 shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by company, owner, or email..."
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
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFilteredClients}
                    disabled={filteredClientIds.length === 0}
                    aria-label="Select all filtered clients"
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                </th>
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
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    No clients found matching the selected search criteria.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isSelected = selectedClientIds.includes(client.id);
                  return (
                  <tr
                    key={client.id}
                    className={`hover:bg-slate-50/50 transition-colors group ${isSelected ? 'bg-teal-50/40' : ''}`}
                  >
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleClientSelection(client.id)}
                        aria-label={`Select ${client.company_name}`}
                        className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-50 text-primary flex items-center justify-center font-bold">
                          <Building className="h-5 w-5" />
                        </div>
                        <div>
                          <Link 
                            href={`/admin/clients/${client.id}`}
                            className="font-bold text-slate-800 hover:text-primary transition-colors hover:underline block"
                          >
                            {client.company_name}
                          </Link>
                          <div className="text-xs text-slate-400 font-medium">
                            {client.owner_name || client.email}
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
                          onClick={() => router.push(`/admin/clients/${client.id}/edit`)}
                          className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                          title="Edit Client"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {canDeleteClient && (
                          <button
                            onClick={() => handleOpenDelete(client)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                            title="Delete Client"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
