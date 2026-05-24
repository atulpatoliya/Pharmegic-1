'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createChemicalAction, updateChemicalAction, deleteChemicalAction } from '@/actions/chemicals';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Badge } from './ui/Badge';
import { Dialog } from './ui/Dialog';
import { toast } from '@/store/toast';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  FlaskConical,
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle,
  FileText,
  Weight
} from 'lucide-react';

interface Chemical {
  id: string;
  chemical_name: string;
  cas_number: string;
  ec_number: string | null;
  tonnage_band: string | null;
  validity_date: string | null;
  available_quantity: number;
  exported_quantity: number;
  status: 'active' | 'inactive';
  created_at: string;
}

interface ChemicalsDashboardProps {
  initialChemicals: Chemical[];
}

export default function ChemicalsDashboard({ initialChemicals }: ChemicalsDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [chemicals, setChemicals] = useState<Chemical[]>(initialChemicals);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    chemical_name: '',
    cas_number: '',
    ec_number: '',
    tonnage_band: '10-100 tonnes',
    validity_date: '',
    available_quantity: '0',
    status: 'active' as 'active' | 'inactive',
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setChemicals(initialChemicals);
  }, [initialChemicals]);

  const filteredChemicals = chemicals.filter((chem) => {
    const matchesSearch =
      chem.chemical_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chem.cas_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (chem.ec_number && chem.ec_number.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || chem.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenCreate = () => {
    setFormError(null);
    setFormData({
      chemical_name: '',
      cas_number: '',
      ec_number: '',
      tonnage_band: '10-100 tonnes',
      validity_date: new Date().toISOString().split('T')[0],
      available_quantity: '0',
      status: 'active',
    });
    setIsCreateOpen(true);
  };

  const handleCreateChemical = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Check basic validations locally before hitting server
    if (!/^\d{2,7}-\d{2}-\d$/.test(formData.cas_number)) {
      setFormError('Invalid CAS number format (must match e.g. 110-80-5).');
      toast.error('Invalid CAS number format (must match e.g. 110-80-5).');
      return;
    }

    startTransition(async () => {
      const payload = new FormData();
      payload.append('chemical_name', formData.chemical_name);
      payload.append('cas_number', formData.cas_number);
      payload.append('ec_number', formData.ec_number);
      payload.append('tonnage_band', formData.tonnage_band);
      payload.append('validity_date', formData.validity_date);
      payload.append('available_quantity', formData.available_quantity);
      payload.append('status', formData.status);

      const res = await createChemicalAction(null, payload);
      if (res.success) {
        toast.success(res.message || 'Chemical added to compliance database.');
        setIsCreateOpen(false);
        router.refresh();
      } else {
        setFormError(res.error || 'Failed to create chemical.');
        toast.error(res.error || 'Failed to create chemical.');
      }
    });
  };

  const handleOpenEdit = (chem: Chemical) => {
    setFormError(null);
    setSelectedChemical(chem);
    setFormData({
      chemical_name: chem.chemical_name,
      cas_number: chem.cas_number,
      ec_number: chem.ec_number || '',
      tonnage_band: chem.tonnage_band || '10-100 tonnes',
      validity_date: chem.validity_date ? new Date(chem.validity_date).toISOString().split('T')[0] : '',
      available_quantity: String(chem.available_quantity),
      status: chem.status,
    });
    setIsEditOpen(true);
  };

  const handleUpdateChemical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChemical) return;
    setFormError(null);

    // Check basic validations locally before hitting server
    if (!/^\d{2,7}-\d{2}-\d$/.test(formData.cas_number)) {
      setFormError('Invalid CAS number format (must match e.g. 110-80-5).');
      toast.error('Invalid CAS number format (must match e.g. 110-80-5).');
      return;
    }

    startTransition(async () => {
      const res = await updateChemicalAction(selectedChemical.id, {
        chemical_name: formData.chemical_name,
        cas_number: formData.cas_number,
        ec_number: formData.ec_number || null,
        tonnage_band: formData.tonnage_band,
        validity_date: formData.validity_date,
        available_quantity: Number(formData.available_quantity),
        status: formData.status,
      });

      if (res.success) {
        toast.success(res.message || 'Chemical substance updated.');
        setIsEditOpen(false);
        router.refresh();
      } else {
        setFormError(res.error || 'Failed to update chemical.');
        toast.error(res.error || 'Failed to update chemical.');
      }
    });
  };

  const handleOpenDelete = (chem: Chemical) => {
    setSelectedChemical(chem);
    setIsDeleteOpen(true);
  };

  const handleDeleteChemical = async () => {
    if (!selectedChemical) return;

    startTransition(async () => {
      const res = await deleteChemicalAction(selectedChemical.id);
      if (res.success) {
        toast.success(res.message || 'Chemical deleted.');
        setIsDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete chemical substance.');
      }
    });
  };

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <Badge variant="success">Active</Badge>
    ) : (
      <Badge variant="danger">Inactive</Badge>
    );
  };

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Chemical Registry</h1>
          <p className="text-sm text-slate-500 font-medium">
            Manage tonnage limits, substance identification numbers, and export metrics of the compliance registry.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="sm:self-start">
          <Plus className="h-4 w-4 mr-2" />
          Add Substance
        </Button>
      </div>

      {/* Filters card */}
      <Card className="border-slate-100 shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by substance name, CAS, EC registration number..."
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
                  { value: 'active', label: 'Active Substances' },
                  { value: 'inactive', label: 'Inactive Substances' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chemicals inventory table */}
      <Card className="border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Substance Details</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Regulatory IDs</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tonnage Band</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Available Quota</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Exported (MT)</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredChemicals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    No substances found in registry matching your search query.
                  </td>
                </tr>
              ) : (
                filteredChemicals.map((chem) => (
                  <tr key={chem.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-50 text-primary flex items-center justify-center font-bold">
                          <FlaskConical className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 group-hover:text-primary transition-colors">
                            {chem.chemical_name}
                          </div>
                          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            <span>Expires: {chem.validity_date ? new Date(chem.validity_date).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-0.5 text-xs">
                        <div className="font-semibold text-slate-700">
                          <span className="text-slate-400 font-medium">CAS:</span> {chem.cas_number}
                        </div>
                        {chem.ec_number && (
                          <div className="font-semibold text-slate-700">
                            <span className="text-slate-400 font-medium">EC:</span> {chem.ec_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50/20 text-slate-600 font-semibold">
                        {chem.tonnage_band || 'N/A'}
                      </Badge>
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      <div className="flex items-center gap-1">
                        <Weight className="h-3.5 w-3.5 text-slate-400" />
                        <span>{chem.available_quantity} MT</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 font-medium">
                      <div className="flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-slate-400" />
                        <span>{chem.exported_quantity} MT</span>
                      </div>
                    </td>
                    <td className="p-4">{getStatusBadge(chem.status)}</td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(chem)}
                          className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                          title="Edit Substance"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(chem)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                          title="Delete Substance"
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

      {/* 1. Create Chemical Modal */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Register Chemical Substance">
        <form onSubmit={handleCreateChemical} className="space-y-4">
          <Input
            label="Chemical Substance Name"
            placeholder="e.g. Dimethylformamide (DMF)"
            value={formData.chemical_name}
            onChange={(e) => setFormData({ ...formData, chemical_name: e.target.value })}
            required
          />
          <div className="grid gap-4 grid-cols-2">
            <Input
              label="CAS Number"
              placeholder="e.g. 68-12-2"
              value={formData.cas_number}
              onChange={(e) => setFormData({ ...formData, cas_number: e.target.value })}
              required
            />
            <Input
              label="EC Number"
              placeholder="e.g. 200-679-5"
              value={formData.ec_number}
              onChange={(e) => setFormData({ ...formData, ec_number: e.target.value })}
            />
          </div>
          <div className="grid gap-4 grid-cols-2">
            <Select
              label="Tonnage Band"
              value={formData.tonnage_band}
              onChange={(e) => setFormData({ ...formData, tonnage_band: e.target.value })}
              options={[
                { value: '1-10 tonnes', label: '1-10 tonnes' },
                { value: '10-100 tonnes', label: '10-100 tonnes' },
                { value: '100-1000 tonnes', label: '100-1000 tonnes' },
                { value: '1000+ tonnes', label: '1000+ tonnes' },
              ]}
            />
            <Input
              type="date"
              label="Validity Expiration Date"
              value={formData.validity_date}
              onChange={(e) => setFormData({ ...formData, validity_date: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 grid-cols-2">
            <Input
              type="number"
              step="0.01"
              label="Initial Available Quota (MT)"
              value={formData.available_quantity}
              onChange={(e) => setFormData({ ...formData, available_quantity: e.target.value })}
              required
            />
            <Select
              label="Initial Registry Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              options={[
                { value: 'active', label: 'Active Compliance Substance' },
                { value: 'inactive', label: 'Inactive / Barred Substance' },
              ]}
            />
          </div>

          {formError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm font-semibold flex items-start gap-2.5 w-full my-4">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 text-left">
                <h4 className="font-bold mb-1">Registration Error</h4>
                <p className="text-xs leading-relaxed font-medium">{formError}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending} disabled={isPending}>
              Register Substance
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 2. Edit Chemical Modal */}
      <Dialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Edit Substance: ${selectedChemical?.chemical_name}`}>
        <form onSubmit={handleUpdateChemical} className="space-y-4">
          <Input
            label="Chemical Substance Name"
            value={formData.chemical_name}
            onChange={(e) => setFormData({ ...formData, chemical_name: e.target.value })}
            required
          />
          <div className="grid gap-4 grid-cols-2">
            <Input
              label="CAS Number"
              value={formData.cas_number}
              onChange={(e) => setFormData({ ...formData, cas_number: e.target.value })}
              required
            />
            <Input
              label="EC Number"
              value={formData.ec_number}
              onChange={(e) => setFormData({ ...formData, ec_number: e.target.value })}
            />
          </div>
          <div className="grid gap-4 grid-cols-2">
            <Select
              label="Tonnage Band"
              value={formData.tonnage_band}
              onChange={(e) => setFormData({ ...formData, tonnage_band: e.target.value })}
              options={[
                { value: '1-10 tonnes', label: '1-10 tonnes' },
                { value: '10-100 tonnes', label: '10-100 tonnes' },
                { value: '100-1000 tonnes', label: '100-1000 tonnes' },
                { value: '1000+ tonnes', label: '1000+ tonnes' },
              ]}
            />
            <Input
              type="date"
              label="Validity Expiration Date"
              value={formData.validity_date}
              onChange={(e) => setFormData({ ...formData, validity_date: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 grid-cols-2">
            <Input
              type="number"
              step="0.01"
              label="Available Quota Quantity (MT)"
              value={formData.available_quantity}
              onChange={(e) => setFormData({ ...formData, available_quantity: e.target.value })}
              required
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              options={[
                { value: 'active', label: 'Active Compliance Substance' },
                { value: 'inactive', label: 'Inactive / Barred Substance' },
              ]}
            />
          </div>

          {formError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm font-semibold flex items-start gap-2.5 w-full my-4">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 text-left">
                <h4 className="font-bold mb-1">Substance Update Error</h4>
                <p className="text-xs leading-relaxed font-medium">{formError}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending} disabled={isPending}>
              Save Substance Changes
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 3. Delete Confirmation Modal */}
      <Dialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Confirm Deletion">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 font-medium">
            Are you sure you want to delete <span className="font-bold text-slate-800">{selectedChemical?.chemical_name}</span>?
          </p>
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700 font-semibold space-y-1">
            <p className="font-bold">CAUTION: DATA LOSS WARNING.</p>
            <p>
              Deleting this chemical will permanently remove it from the inventory. All active clients linked to this chemical will lose substance authorization mappings immediately. Existing applications and certificates referencing this chemical will experience database constraint side effects.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteChemical}
              isLoading={isPending}
              disabled={isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white border-rose-600 hover:border-rose-700"
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
