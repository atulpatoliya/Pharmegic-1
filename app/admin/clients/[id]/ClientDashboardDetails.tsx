'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  changeClientEmailAction, 
  changeClientPasswordAction, 
  toggleClientLoginAction, 
  assignChemicalToClientAction, 
  addNewChemicalToClientAction,
  removeChemicalFromClientAction, 
  editClientChemicalAction,
  addContactAction, 
  deleteContactAction, 
  addInternalNoteAction, 
  deleteInternalNoteAction 
} from '@/actions/clients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { ModalErrorBox } from '@/components/ui/ModalErrorBox';
import { formatErrorMessage } from '@/lib/format-error';
import { toast } from '@/store/toast';
import Link from 'next/link';
import { 
  Building, Mail, Phone, MapPin, Calendar, CheckCircle, 
  AlertCircle, FileText, User, ShieldAlert, Key, Plus, Trash2,
  FileSignature, Award, Clipboard, StickyNote, History, Lock, Unlock,
  Download, Ship, PieChart, TrendingUp, Filter, Eye, EyeOff, PenLine
} from 'lucide-react';
import { useLayoutStore } from '@/store/layout';
import dynamic from 'next/dynamic';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface ClientDashboardDetailsProps {
  client: any;
  user: any;
  clientChemicals: any[];
  allChemicals: any[];
  contacts: any[];
  tccHistory: any[];
  certificates: any[];
  activityLogs: any[];
  internalNotes: any[];
  currentUserId: string;
  currentUserRole: string;
}

export default function ClientDashboardDetails({
  client,
  user,
  clientChemicals: allClientChemicals,
  allChemicals,
  contacts,
  tccHistory,
  certificates,
  activityLogs,
  internalNotes,
  currentUserId,
  currentUserRole
}: ClientDashboardDetailsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const setCustomBreadcrumb = useLayoutStore((state) => state.setCustomBreadcrumb);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setCustomBreadcrumb(client.company_name);
    return () => setCustomBreadcrumb(null);
  }, [client.company_name, setCustomBreadcrumb]);

  // Data Filtering
  const clientChemicals = allClientChemicals.filter(c => c.status !== 'trashed');
  const trashedChemicals = allClientChemicals.filter(c => c.status === 'trashed');

  // Modals state
  const [isEmailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState(client.email);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isAssignChemModalOpen, setAssignChemModalOpen] = useState(false);
  const [assignChemData, setAssignChemData] = useState({
    chemical_name: '', cas_number: '', ec_number: '', tonnage_band: '', available_quantity: '', validity_date: ''
  });
  
  const [isEditChemModalOpen, setEditChemModalOpen] = useState(false);
  const [activeEditChemId, setActiveEditChemId] = useState('');
  const [editChemData, setEditChemData] = useState({
    chemical_name: '', cas_number: '', ec_number: '', tonnage_band: '', validity_date: ''
  });

  const [isContactModalOpen, setContactModalOpen] = useState(false);
  const [contactData, setContactData] = useState({
    first_name: '', last_name: '', email: '', phone: '', role: ''
  });
  const [isNoteModalOpen, setNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  type ModalErrorKey = 'email' | 'password' | 'assignChem' | 'editChem' | 'contact' | 'note' | 'security' | 'substances';
  const [modalErrors, setModalErrors] = useState<Record<ModalErrorKey, string | null>>({
    email: null,
    password: null,
    assignChem: null,
    editChem: null,
    contact: null,
    note: null,
    security: null,
    substances: null,
  });

  const setModalError = (key: ModalErrorKey, message: string | null) => {
    setModalErrors((prev) => ({ ...prev, [key]: message }));
  };

  const toErrorMessage = (err: unknown, fallback = 'Something went wrong.') => {
    if (typeof err === 'string' && err.trim()) return err;
    const formatted = formatErrorMessage(err);
    return formatted === 'An unexpected error occurred.' ? fallback : formatted;
  };

  // -------------------------------------------------------------
  // Data Calculations
  // -------------------------------------------------------------
  const approvedTccs = tccHistory.filter(t => t.status === 'approved');
  const totalExported = approvedTccs.reduce((sum, t) => sum + Number(t.quantity_mt || 0), 0);

  const activePermissions = clientChemicals.filter(c => c.status === 'active').length;
  const pendingRenewals = clientChemicals.filter(c => c.status === 'expired' || (c.validity_date && new Date(c.validity_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))).length;

  const totalAllocatedQuota = clientChemicals.reduce((sum, c) => sum + Number(c.available_quantity || 0), 0);

  const grandTotalQuota = totalAllocatedQuota + totalExported;
  const remainingQuotaPercent = grandTotalQuota > 0 ? (totalAllocatedQuota / grandTotalQuota) * 100 : 0;

  // Chart Data
  const chartOptions = {
    chart: { type: 'area' as const, toolbar: { show: false }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth' as const, width: 2 },
    colors: ['#0f766e'],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.0, stops: [0, 90, 100] } },
    xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
    yaxis: { show: false },
    grid: { show: false }
  };
  const chartSeries = [{ name: 'Exported (MT)', data: [10, 41, 35, 51, 49, 62, 69, 91, 148, 100, 110, 120] }];

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  const handleEmailChange = () => {
    if (!newEmail) {
      setModalError('email', 'Email is required.');
      return;
    }
    setModalError('email', null);
    startTransition(async () => {
      const res = await changeClientEmailAction(client.id, newEmail);
      if (res.success) {
        toast.success('Email updated.');
        setEmailModalOpen(false);
        router.refresh();
      } else {
        setModalError('email', toErrorMessage(res.error, 'Failed to update email.'));
      }
    });
  };
  const handlePasswordChange = () => {
    if (newPassword.length < 6) {
      setModalError('password', 'Password must be at least 6 characters.');
      return;
    }
    setModalError('password', null);
    startTransition(async () => {
      const res = await changeClientPasswordAction(client.id, newPassword);
      if (res.success) {
        toast.success('Password updated.');
        setPasswordModalOpen(false);
        setNewPassword('');
        router.refresh();
      } else {
        setModalError('password', toErrorMessage(res.error, 'Failed to update password.'));
      }
    });
  };
  const handleToggleLogin = () => {
    setModalError('security', null);
    startTransition(async () => {
      const res = await toggleClientLoginAction(client.id, !user?.is_disabled);
      if (res.success) {
        toast.success('Login toggled.');
        router.refresh();
      } else {
        setModalError('security', toErrorMessage(res.error, 'Failed to update login status.'));
      }
    });
  };
  const handleAssignChemical = () => {
    if (!assignChemData.chemical_name.trim()) {
      setModalError('assignChem', 'Substance name is required.');
      return;
    }
    if (!assignChemData.cas_number.trim()) {
      setModalError('assignChem', 'CAS number is required.');
      return;
    }
    setModalError('assignChem', null);
    startTransition(async () => {
      const res = await addNewChemicalToClientAction(client.id, assignChemData);
      if (res.success) {
        toast.success('Substance assigned.');
        setAssignChemModalOpen(false);
        setAssignChemData({ chemical_name: '', cas_number: '', ec_number: '', tonnage_band: '', available_quantity: '', validity_date: '' });
        router.refresh();
      } else {
        setModalError('assignChem', toErrorMessage(res.error, 'Failed to assign substance.'));
      }
    });
  };

  const openEditChemModal = (cc: any) => {
    setActiveEditChemId(cc.chemical_id);
    setEditChemData({
      chemical_name: cc.chemicals?.chemical_name || '',
      cas_number: cc.chemicals?.cas_number || '',
      ec_number: cc.chemicals?.ec_number || '',
      tonnage_band: cc.chemicals?.tonnage_band || '',
      validity_date: cc.validity_date || ''
    });
    setModalError('editChem', null);
    setEditChemModalOpen(true);
  };

  const handleEditChemical = () => {
    if (!editChemData.chemical_name.trim()) {
      setModalError('editChem', 'Substance name is required.');
      return;
    }
    setModalError('editChem', null);
    startTransition(async () => {
      const res = await editClientChemicalAction(client.id, activeEditChemId, editChemData);
      if (res.success) {
        toast.success('Substance updated.');
        setEditChemModalOpen(false);
        router.refresh();
      } else {
        setModalError('editChem', toErrorMessage(res.error, 'Failed to update substance.'));
      }
    });
  };

  const handleRemoveChemical = (chemId: string) => {
    if (confirm('Move this substance to trash?')) {
      startTransition(async () => {
        const res = await removeChemicalFromClientAction(client.id, chemId);
        if (res.success) { toast.success('Substance moved to trash.'); router.refresh(); }
        else setModalError('substances', toErrorMessage(res.error, 'Failed to remove substance.'));
      });
    }
  };
  const handleAddContact = () => {
    if (!contactData.first_name.trim() || !contactData.last_name.trim() || !contactData.email.trim()) {
      setModalError('contact', 'First name, last name, and email are required.');
      return;
    }
    setModalError('contact', null);
    startTransition(async () => {
      const res = await addContactAction(client.id, contactData);
      if (res.success) {
        toast.success('Contact added.');
        setContactModalOpen(false);
        router.refresh();
      } else {
        setModalError('contact', toErrorMessage(res.error, 'Failed to add contact.'));
      }
    });
  };
  const handleDeleteContact = (id: string) => {
    if (confirm('Delete contact?')) {
      startTransition(async () => {
        const res = await deleteContactAction(id, client.id);
        if (res.success) { toast.success('Contact deleted.'); router.refresh(); }
        else toast.error(res.error || 'Error');
      });
    }
  };
  const handleAddNote = () => {
    if (!noteContent.trim()) {
      setModalError('note', 'Note cannot be empty.');
      return;
    }
    setModalError('note', null);
    startTransition(async () => {
      const res = await addInternalNoteAction(client.id, noteContent);
      if (res.success) {
        toast.success('Note added.');
        setNoteModalOpen(false);
        setNoteContent('');
        router.refresh();
      } else {
        setModalError('note', toErrorMessage(res.error, 'Failed to save note.'));
      }
    });
  };
  const handleDeleteNote = (id: string) => {
    if (confirm('Delete note?')) {
      startTransition(async () => {
        const res = await deleteInternalNoteAction(id, client.id);
        if (res.success) { toast.success('Note deleted.'); router.refresh(); }
        else toast.error(res.error || 'Error');
      });
    }
  };

  const resolveChemical = (row: { chemicals?: { chemical_name?: string } | null }) =>
    row.chemicals?.chemical_name || 'N/A';

  const resolveCertificate = (row: { certificates?: { id?: string; certificate_number?: string; file_url?: string; issued_at?: string; status?: string } | null }) =>
    row.certificates ?? null;

  const tccStatusDisplay = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: 'Approved', className: 'text-emerald-600', icon: CheckCircle };
      case 'rejected':
        return { label: 'Rejected', className: 'text-rose-600', icon: AlertCircle };
      case 'changes_required':
        return { label: 'Changes Required', className: 'text-amber-600', icon: AlertCircle };
      default:
        return { label: 'Pending Review', className: 'text-amber-600', icon: History };
    }
  };

  const handleExportCSV = () => {
    if (clientChemicals.length === 0) {
      setModalError('substances', 'No substance data to export.');
      return;
    }
    setModalError('substances', null);

    const headers = ['Chemical Name', 'CAS Number', 'EC Number', 'Tonnage Band', 'Exported (MT)', 'Total Quota (MT)', 'Validity Date', 'Status'];

    const rows = clientChemicals.map(cc => {
      const name = cc.chemicals?.chemical_name || 'Unknown';
      const cas = cc.chemicals?.cas_number || 'N/A';
      const ec = cc.chemicals?.ec_number || 'N/A';
      const band = cc.chemicals?.tonnage_band || 'N/A';
      const exported = tccHistory.filter(t => t.chemical_id === cc.chemical_id && t.status === 'approved').reduce((sum, t) => sum + Number(t.quantity_mt || 0), 0);
      const max = Number(cc.available_quantity || 0) + exported;
      const validity = cc.validity_date ? new Date(cc.validity_date).toLocaleDateString('en-GB') : 'N/A';
      const status = cc.status === 'active' ? 'Active' : 'Expired';

      return `"${name}","${cas}","${ec}","${band}",${exported},${max},"${validity}","${status}"`;
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${client.company_name.replace(/\s+/g, '_')}_Chemicals.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-slide-in pb-12 text-slate-800">

      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-teal-900 tracking-tight">{client.company_name} Details</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {client.legal_name || 'Pharmaceutical Distributor'} | ID: {client.uuid_number ? client.uuid_number.split('-')[0].toUpperCase() : 'AP-882-2025'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {currentUserRole !== 'CLIENT' && (
            <Link href={`/admin/clients/${client.id}/edit`}>
              <Button variant="outline" size="sm" className="bg-white border-slate-200 shadow-xs">
                Edit Profile
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" className="bg-white border-slate-200 shadow-xs text-slate-700">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* 2. Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Column: Stat Cards */}
        <div className="space-y-4 lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between h-[120px]">
            <div className="flex justify-between items-start">
              <span className="text-sm font-semibold text-slate-500">Total Exported</span>
              <Ship className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800">{totalExported.toFixed(1)} <span className="text-sm text-slate-500 font-semibold">MT</span></div>
              <div className="text-xs font-semibold text-teal-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" /> +12% from last year
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between h-[120px]">
            <div className="flex justify-between items-start">
              <span className="text-sm font-semibold text-slate-500">Active Permissions</span>
              <CheckCircle className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800">{activePermissions} <span className="text-sm text-slate-500 font-semibold">Substances</span></div>
              <div className="text-xs font-semibold text-slate-500 mt-1">
                {pendingRenewals} Renewals pending
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between h-[120px]">
            <div className="flex justify-between items-start">
              <span className="text-sm font-semibold text-slate-500">Remaining Quota</span>
              <PieChart className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800">{remainingQuotaPercent.toFixed(1)} <span className="text-sm text-slate-500 font-semibold">%</span></div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5">
                <div className="bg-teal-700 h-1.5 rounded-full" style={{ width: `${Math.min(100, remainingQuotaPercent)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Chart */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-600">Monthly Export Activity</h3>
            <span className="px-2 py-1 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-500 rounded">Year 2024</span>
          </div>
          <div className="flex-1 w-full h-full min-h-[250px]">
            {isMounted && <ApexChart options={chartOptions} series={chartSeries} type="area" height="100%" width="100%" />}
          </div>
        </div>
      </div>

      {/* 3. Export Permissions & Quotas Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-bold text-slate-700 text-sm">Export Permissions</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500"><Filter className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500" onClick={handleExportCSV} title="Export CSV">
              <Download className="h-4 w-4" />
            </Button>
            {currentUserRole !== 'CLIENT' && (
              <Button size="sm" className="h-8 bg-teal-700 hover:bg-teal-800 ml-2" onClick={() => { setModalError('assignChem', null); setAssignChemModalOpen(true); }}>
                + Assign Sub.
              </Button>
            )}
          </div>
        </div>
        {modalErrors.substances && (
          <div className="px-5 pt-4">
            <ModalErrorBox message={modalErrors.substances} />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Chemical Name</th>
                <th className="px-6 py-4">CAS Number</th>
                <th className="px-6 py-4">EC Number</th>
                <th className="px-6 py-4 text-center">Tonnage Band</th>
                <th className="px-6 py-4">Quota Consumption</th>
                <th className="px-6 py-4">Validity</th>
                <th className="px-6 py-4 text-center">Status</th>
                {currentUserRole !== 'CLIENT' && <th className="px-6 py-4 text-right"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientChemicals.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">No substances assigned.</td></tr>
              ) : (
                clientChemicals.map((cc) => {
                  const name = cc.chemicals?.chemical_name || 'Unknown';
                  const exported = tccHistory.filter(t => t.chemical_id === cc.chemical_id && t.status === 'approved').reduce((sum, t) => sum + Number(t.quantity_mt || 0), 0);
                  const max = Number(cc.available_quantity || 0) + exported;
                  const pct = max > 0 ? (exported / max) * 100 : 0;
                  const isCritical = pct >= 90 || cc.status === 'expired';
                  const isWarning = pct >= 75 && pct < 90;

                  return (
                    <tr key={cc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-teal-900">{name}</div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{cc.chemicals?.hs_code ? `HS: ${cc.chemicals.hs_code}` : 'Standard Grade'}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-600 font-medium">
                        {cc.chemicals?.cas_number || 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-600 font-medium">
                        {cc.chemicals?.ec_number || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
                          {cc.chemicals?.tonnage_band || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-between items-end mb-1.5 text-xs">
                          <span className="font-semibold text-slate-700">{exported.toFixed(0)} MT <span className="text-slate-400 font-medium">exported</span></span>
                          <span className="font-medium text-slate-500">of {max.toFixed(0)} MT</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 flex overflow-hidden">
                          <div className={`h-full ${isCritical ? 'bg-red-600' : isWarning ? 'bg-emerald-600' : 'bg-teal-700'}`} style={{ width: `${Math.max(5, pct)}%` }}></div>
                          {isWarning && <div className="h-full bg-red-500" style={{ width: '10%' }}></div>}
                        </div>
                        {(isCritical || isWarning) && (
                          <div className="text-[10px] font-bold text-red-600 text-right mt-1">{isCritical ? 'Critical' : 'Limit Warning'}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium" suppressHydrationWarning>
                        {cc.validity_date ? new Date(cc.validity_date).toLocaleDateString('en-GB') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={cc.status === 'active' && !isCritical ? 'success' : 'danger'} className={`text-[10px] uppercase font-bold py-1 ${isCritical ? 'bg-red-100 text-red-700' : 'bg-lime-300 text-lime-900'}`}>
                          {isCritical ? 'Pending Renewal' : 'Active'}
                        </Badge>
                      </td>
                      {currentUserRole !== 'CLIENT' && (
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-teal-600 mr-1" onClick={() => openEditChemModal(cc)} title="Edit Allocation"><PenLine className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-rose-500 hover:text-rose-700" onClick={() => handleRemoveChemical(cc.chemical_id)} title="Move to Trash"><Trash2 className="h-4 w-4" /></Button>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trash Box Section */}
      {currentUserRole !== 'CLIENT' && trashedChemicals.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 shadow-xs overflow-hidden mt-8 opacity-80 hover:opacity-100 transition-opacity">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-slate-500" />
              <h2 className="font-bold text-slate-600 text-sm">Deleted Inventory (Trash)</h2>
            </div>
            <span className="text-xs text-slate-400">Data automatically deleted after 1 year</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Substance Name</th>
                  <th className="px-6 py-3">CAS Number</th>
                  <th className="px-6 py-3">Deleted Date</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trashedChemicals.map((cc) => (
                  <tr key={cc.id}>
                    <td className="px-6 py-3 text-slate-500 font-medium">{cc.chemicals?.chemical_name || 'Unknown'}</td>
                    <td className="px-6 py-3 text-slate-400 font-mono text-[11px]">{cc.chemicals?.cas_number || 'N/A'}</td>
                    <td className="px-6 py-3 text-slate-400" suppressHydrationWarning>{new Date(cc.updated_at).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded text-[10px] font-bold">TRASHED</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. TCC Applications & Issued Certificates */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mt-8">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <h2 className="font-bold text-slate-700 text-sm">
            {currentUserRole === 'CLIENT' ? 'My TCC Applications & Certificates' : 'Issued Export Certificates'}
          </h2>
          {currentUserRole === 'CLIENT' ? (
            <Link href="/client/apply">
              <Button size="sm" className="h-8 bg-teal-700 hover:bg-teal-800">
                + Apply for TCC
              </Button>
            </Link>
          ) : (
            <Link href="/admin/approvals">
              <Button size="sm" variant="outline" className="h-8 border-slate-300">
                Review Applications
              </Button>
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Chemical Item</th>
                <th className="px-6 py-4 text-right">Quantity (MT)</th>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tccHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                    {currentUserRole === 'CLIENT'
                      ? 'No TCC applications yet. Click "Apply for TCC" to submit your first request.'
                      : 'No TCC applications for this client.'}
                  </td>
                </tr>
              ) : (
                tccHistory.map((app) => {
                  const cert = resolveCertificate(app);
                  const statusInfo = tccStatusDisplay(app.status);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 tracking-wide text-xs">
                        {app.tracking_id || app.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{resolveChemical(app)}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-700">
                        {Number(app.quantity_mt || 0).toFixed(2)} MT
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium" suppressHydrationWarning>
                        {new Date(app.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${statusInfo.className}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusInfo.label}
                        </span>
                        {app.status === 'rejected' && app.rejection_reason && (
                          <p className="text-[10px] text-rose-500 mt-1 max-w-[200px]">{app.rejection_reason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          {app.bo_attachment_url && (
                            <a href={app.bo_attachment_url} target="_blank" rel="noopener noreferrer" title="View BO attachment">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                          {cert?.id && app.status === 'approved' ? (
                            <>
                              <Link
                                href={
                                  currentUserRole === 'CLIENT'
                                    ? '/client/certificates'
                                    : `/admin/certificate-preview/${cert.id}`
                                }
                              >
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-teal-700 hover:bg-teal-50">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              {cert.file_url && (
                                <a href={cert.file_url} target="_blank" rel="noopener noreferrer" title="Download certificate PDF">
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </a>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium px-1">
                              {app.status === 'pending' ? 'Awaiting review' : '—'}
                            </span>
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
      </div>
      {/* 5. Admin Extras (Contacts, Activity, Notes, Actions) - Only visible to Admins, placed at bottom so it doesn't ruin the main dashboard */}
      {currentUserRole !== 'CLIENT' && (
        <div className="mt-12 pt-8 border-t border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Administrative Controls</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card className="border-slate-100 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base text-slate-800">Account Security</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <ModalErrorBox message={modalErrors.security} />
                <Button variant="outline" className="w-full justify-start" onClick={() => { setNewEmail(client.email); setModalError('email', null); setEmailModalOpen(true); }}>
                  <Mail className="h-4 w-4 mr-2 text-slate-400" /> Primary Email address
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => { setNewPassword(''); setShowCurrentPassword(false); setShowNewPassword(false); setModalError('password', null); setPasswordModalOpen(true); }}>
                  <Key className="h-4 w-4 mr-2 text-slate-400" /> Reset Password
                </Button>
                <Button variant={user?.is_disabled ? 'primary' : 'outline'} className="w-full justify-start" onClick={handleToggleLogin} isLoading={isPending}>
                  {user?.is_disabled ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2 text-slate-400" />}
                  {user?.is_disabled ? 'Enable Login' : 'Disable Login'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-xs lg:col-span-2">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base text-slate-800">Secondary Contacts</CardTitle>
                <Button size="sm" onClick={() => { setModalError('contact', null); setContactModalOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> Add Contact</Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[250px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {contacts.map(c => (
                        <tr key={c.id}>
                          <td className="p-4 font-semibold text-slate-800">{c.first_name} {c.last_name}</td>
                          <td className="p-4 text-slate-500">{c.email}</td>
                          <td className="p-4 text-right">
                            <Button variant="ghost" size="sm" className="text-rose-500" onClick={() => handleDeleteContact(c.id)}><Trash2 className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Internal Notes */}
            <Card className="border-slate-100 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base text-slate-800 flex items-center gap-2"><StickyNote className="h-4 w-4 text-slate-400" /> Internal Notes</CardTitle>
                <Button size="sm" onClick={() => { setModalError('note', null); setNoteModalOpen(true); }}><Plus className="h-4 w-4 mr-1.5" /> Add Note</Button>
              </CardHeader>
              <CardContent className="pt-4 max-h-[300px] overflow-y-auto space-y-3">
                {internalNotes.map(n => (
                  <div key={n.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-700">{n.author_email} <span className="text-slate-400 font-normal" suppressHydrationWarning>on {new Date(n.created_at).toLocaleDateString()}</span></p>
                      <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{n.note}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-rose-500" onClick={() => handleDeleteNote(n.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {internalNotes.length === 0 && <div className="text-sm text-slate-400 text-center py-4">No notes added.</div>}
              </CardContent>
            </Card>

            {/* Activity Logs */}
            <Card className="border-slate-100 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base text-slate-800 flex items-center gap-2"><History className="h-4 w-4 text-slate-400" /> Activity Logs</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 max-h-[300px] overflow-y-auto">
                <div className="space-y-4">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-teal-500 shrink-0"></div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{log.action}</p>
                        <p className="text-xs text-slate-500">{log.description}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5" suppressHydrationWarning>{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  {activityLogs.length === 0 && <div className="text-sm text-slate-400 text-center py-4">No activity.</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* --- ALL MODALS --- */}
      {/* Email Modal */}
      <Dialog isOpen={isEmailModalOpen} onClose={() => { setEmailModalOpen(false); setModalError('email', null); }} title="Primary Email address">
        <div className="p-2 space-y-4">
          <Input
            label="Primary Email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            type="email"
          />
          <ModalErrorBox message={modalErrors.email} />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => { setEmailModalOpen(false); setModalError('email', null); }}>Cancel</Button>
            <Button onClick={handleEmailChange} isLoading={isPending}>Save Changes</Button>
          </div>
        </div>
      </Dialog>
      {/* Password Modal */}
      <Dialog isOpen={isPasswordModalOpen} onClose={() => { setPasswordModalOpen(false); setModalError('password', null); }} title="Reset Password">
        <div className="p-2 space-y-4">
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                readOnly
                value={user?.login_password || ''}
                placeholder={user?.login_password ? undefined : 'Not recorded — reset password to store'}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 pr-10 py-2 text-sm text-slate-700"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="New strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 pr-10 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <ModalErrorBox message={modalErrors.password} />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => { setPasswordModalOpen(false); setModalError('password', null); }}>Cancel</Button>
            <Button onClick={handlePasswordChange} isLoading={isPending}>Set Password</Button>
          </div>
        </div>
      </Dialog>
      {/* Assign Chemical Modal */}
      <Dialog isOpen={isAssignChemModalOpen} onClose={() => { setAssignChemModalOpen(false); setModalError('assignChem', null); }} title="Assign Substance Authority">
        <div className="p-2 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-1 block">Substance Name *</label>
              <Input placeholder="e.g. Methanol" value={assignChemData.chemical_name} onChange={(e) => setAssignChemData({ ...assignChemData, chemical_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">CAS Number *</label>
                <Input placeholder="e.g. 67-56-1" value={assignChemData.cas_number} onChange={(e) => setAssignChemData({ ...assignChemData, cas_number: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">EC Number</label>
                <Input placeholder="e.g. 200-659-6" value={assignChemData.ec_number} onChange={(e) => setAssignChemData({ ...assignChemData, ec_number: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">Allocated Quota (MT)</label>
                <Select 
                  value={assignChemData.tonnage_band}
                  onChange={(e) => setAssignChemData({ ...assignChemData, tonnage_band: e.target.value })}
                  options={[
                    { value: '', label: 'None' },
                    { value: '1-10 tonnes', label: '1-10 tonnes' },
                    { value: '10-100 tonnes', label: '10-100 tonnes' },
                    { value: '100-1000 tonnes', label: '100-1000 tonnes' },
                    { value: '1000+ tonnes', label: '1000+ tonnes' }
                  ]}
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Validity Date</label>
                <Input type="date" value={assignChemData.validity_date} onChange={(e) => setAssignChemData({ ...assignChemData, validity_date: e.target.value })} />
              </div>
            </div>
          </div>
          <ModalErrorBox message={modalErrors.assignChem} />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => { setAssignChemModalOpen(false); setModalError('assignChem', null); }}>Cancel</Button>
            <Button onClick={handleAssignChemical} isLoading={isPending}>Assign Authority</Button>
          </div>
        </div>
      </Dialog>
      {/* Edit Chemical Modal */}
      <Dialog isOpen={isEditChemModalOpen} onClose={() => { setEditChemModalOpen(false); setModalError('editChem', null); }} title="Edit Substance Allocation">
        <div className="p-2 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-1 block">Substance Name *</label>
              <Input
                placeholder="e.g. Methanol"
                value={editChemData.chemical_name}
                onChange={(e) => setEditChemData({ ...editChemData, chemical_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">CAS Number</label>
                <Input
                  placeholder="e.g. 67-56-1"
                  value={editChemData.cas_number}
                  onChange={(e) => setEditChemData({ ...editChemData, cas_number: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">EC Number</label>
                <Input
                  placeholder="e.g. 200-659-6"
                  value={editChemData.ec_number}
                  onChange={(e) => setEditChemData({ ...editChemData, ec_number: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">Allocated Quota (MT)</label>
                <Select 
                  value={editChemData.tonnage_band}
                  onChange={(e) => setEditChemData({ ...editChemData, tonnage_band: e.target.value })}
                  options={[
                    { value: '', label: 'None' },
                    { value: '1-10 tonnes', label: '1-10 tonnes' },
                    { value: '10-100 tonnes', label: '10-100 tonnes' },
                    { value: '100-1000 tonnes', label: '100-1000 tonnes' },
                    { value: '1000+ tonnes', label: '1000+ tonnes' }
                  ]}
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Validity Date</label>
                <Input type="date" value={editChemData.validity_date} onChange={(e) => setEditChemData({ ...editChemData, validity_date: e.target.value })} />
              </div>
            </div>
          </div>
          <ModalErrorBox message={modalErrors.editChem} />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => { setEditChemModalOpen(false); setModalError('editChem', null); }}>Cancel</Button>
            <Button className="bg-teal-700 hover:bg-teal-800" onClick={handleEditChemical} isLoading={isPending}>Save Changes</Button>
          </div>
        </div>
      </Dialog>
      {/* Add Contact Modal */}
      <Dialog isOpen={isContactModalOpen} onClose={() => { setContactModalOpen(false); setModalError('contact', null); }} title="Add Secondary Contact">
        <div className="p-2 space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="First Name" value={contactData.first_name} onChange={e => setContactData({ ...contactData, first_name: e.target.value })} />
              <Input placeholder="Last Name" value={contactData.last_name} onChange={e => setContactData({ ...contactData, last_name: e.target.value })} />
            </div>
            <Input placeholder="Email Address" type="email" value={contactData.email} onChange={e => setContactData({ ...contactData, email: e.target.value })} />
            <Input placeholder="Phone Number" value={contactData.phone} onChange={e => setContactData({ ...contactData, phone: e.target.value })} />
            <Input placeholder="Role / Position" value={contactData.role} onChange={e => setContactData({ ...contactData, role: e.target.value })} />
          </div>
          <ModalErrorBox message={modalErrors.contact} />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => { setContactModalOpen(false); setModalError('contact', null); }}>Cancel</Button>
            <Button onClick={handleAddContact} isLoading={isPending}>Add Contact</Button>
          </div>
        </div>
      </Dialog>
      {/* Add Note Modal */}
      <Dialog isOpen={isNoteModalOpen} onClose={() => { setNoteModalOpen(false); setModalError('note', null); }} title="Add Internal Note">
        <div className="p-2 space-y-4">
          <textarea 
            className="w-full h-32 p-3 border border-slate-200 rounded-lg text-sm"
            placeholder="Type confidential note here..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
          ></textarea>
          <ModalErrorBox message={modalErrors.note} />
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => { setNoteModalOpen(false); setModalError('note', null); }}>Cancel</Button>
            <Button onClick={handleAddNote} isLoading={isPending}>Save Note</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
