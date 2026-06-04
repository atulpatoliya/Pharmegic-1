'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { 
  changeClientEmailAction, 
  changeClientPasswordAction, 
  toggleClientLoginAction, 
  archiveClientAction, 
  assignChemicalToClientAction, 
  removeChemicalFromClientAction, 
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
import { toast } from '@/store/toast';
import Link from 'next/link';
import { 
  Building, Mail, Phone, MapPin, Calendar, CheckCircle, 
  AlertCircle, FileText, User, ShieldAlert, Key, Plus, Trash2,
  FileSignature, Award, Clipboard, StickyNote, History, Lock, Unlock, Archive
} from 'lucide-react';

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
  clientChemicals,
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
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'chemicals' | 'tcc' | 'certificates' | 'activity' | 'notes'>('overview');

  // Modal Dialog states
  const [isEmailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState(client.email);

  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const [isAssignChemModalOpen, setAssignChemModalOpen] = useState(false);
  const [assignChemData, setAssignChemData] = useState({
    chemical_id: '',
    available_quantity: '',
    validity_date: '',
    status: 'active' as 'active' | 'expired' | 'suspended'
  });

  const [isContactModalOpen, setContactModalOpen] = useState(false);
  const [contactData, setContactData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: ''
  });

  const [isNoteModalOpen, setNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');

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

  const getTccStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      case 'changes_required':
        return <Badge variant="neutral">Changes Required</Badge>;
      case 'expired':
        return <Badge variant="danger">Expired</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getCertStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'expired':
        return <Badge variant="warning">Expired</Badge>;
      case 'revoked':
        return <Badge variant="danger">Revoked</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Actions implementation
  const handleEmailChange = () => {
    if (!newEmail) {
      toast.error('Email is required.');
      return;
    }
    startTransition(async () => {
      const res = await changeClientEmailAction(client.id, newEmail);
      if (res.success) {
        toast.success(res.message || 'Email changed successfully.');
        setEmailModalOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update email.');
      }
    });
  };

  const handlePasswordChange = () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    startTransition(async () => {
      const res = await changeClientPasswordAction(client.id, newPassword);
      if (res.success) {
        toast.success(res.message || 'Password changed successfully.');
        setPasswordModalOpen(false);
        setNewPassword('');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update password.');
      }
    });
  };

  const handleToggleLogin = () => {
    const nextState = !user?.is_disabled;
    startTransition(async () => {
      const res = await toggleClientLoginAction(client.id, nextState);
      if (res.success) {
        toast.success(res.message || 'Login state updated.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to toggle login state.');
      }
    });
  };

  const handleArchiveClient = () => {
    if (confirm('Are you sure you want to archive this client? This sets status to Inactive.')) {
      startTransition(async () => {
        const res = await archiveClientAction(client.id);
        if (res.success) {
          toast.success(res.message || 'Client archived successfully.');
          router.refresh();
        } else {
          toast.error(res.error || 'Failed to archive client.');
        }
      });
    }
  };

  const handleAssignChemical = () => {
    if (!assignChemData.chemical_id || !assignChemData.available_quantity || !assignChemData.validity_date) {
      toast.error('All fields are required.');
      return;
    }
    startTransition(async () => {
      const res = await assignChemicalToClientAction(client.id, assignChemData);
      if (res.success) {
        toast.success(res.message || 'Chemical assigned successfully.');
        setAssignChemModalOpen(false);
        setAssignChemData({ chemical_id: '', available_quantity: '', validity_date: '', status: 'active' });
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to assign chemical.');
      }
    });
  };

  const handleRemoveChemical = (chemId: string) => {
    if (confirm('Are you sure you want to remove this chemical authority from the client?')) {
      startTransition(async () => {
        const res = await removeChemicalFromClientAction(client.id, chemId);
        if (res.success) {
          toast.success(res.message || 'Chemical authority removed.');
          router.refresh();
        } else {
          toast.error(res.error || 'Failed to remove chemical.');
        }
      });
    }
  };

  const handleAddContact = () => {
    if (!contactData.first_name || !contactData.last_name || !contactData.email) {
      toast.error('First name, Last name, and Email are required.');
      return;
    }
    startTransition(async () => {
      const res = await addContactAction(client.id, contactData);
      if (res.success) {
        toast.success(res.message || 'Secondary contact added.');
        setContactModalOpen(false);
        setContactData({ first_name: '', last_name: '', email: '', phone: '', role: '' });
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to add contact.');
      }
    });
  };

  const handleDeleteContact = (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      startTransition(async () => {
        const res = await deleteContactAction(contactId, client.id);
        if (res.success) {
          toast.success(res.message || 'Contact deleted.');
          router.refresh();
        } else {
          toast.error(res.error || 'Failed to delete contact.');
        }
      });
    }
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) {
      toast.error('Note content is required.');
      return;
    }
    startTransition(async () => {
      const res = await addInternalNoteAction(client.id, noteContent);
      if (res.success) {
        toast.success(res.message || 'Internal note added.');
        setNoteModalOpen(false);
        setNoteContent('');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to add note.');
      }
    });
  };

  const handleDeleteNote = (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      startTransition(async () => {
        const res = await deleteInternalNoteAction(noteId, client.id);
        if (res.success) {
          toast.success(res.message || 'Internal note deleted.');
          router.refresh();
        } else {
          toast.error(res.error || 'Failed to delete note.');
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Top Banner / Client Summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary p-3.5 rounded-xl">
            <Building className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5 flex-wrap">
              {client.company_name}
              {getStatusBadge(client.status)}
              {user?.is_disabled && <Badge variant="danger">Login Disabled</Badge>}
            </h1>
            <p className="text-sm text-slate-500 font-semibold mt-1">
              UUID: <span className="font-mono text-xs">{client.uuid_number || 'N/A'}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href={`/admin/clients/${client.id}/edit`}>
            <Button variant="outline" size="sm">Edit Profile</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(true)}>
            <Mail className="h-4 w-4 mr-1.5" /> Email
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPasswordModalOpen(true)}>
            <Key className="h-4 w-4 mr-1.5" /> Password
          </Button>
          <Button 
            variant={user?.is_disabled ? 'primary' : 'outline'} 
            size="sm" 
            onClick={handleToggleLogin}
            isLoading={isPending}
          >

            {user?.is_disabled ? <Unlock className="h-4 w-4 mr-1.5" /> : <Lock className="h-4 w-4 mr-1.5" />}
            {user?.is_disabled ? 'Enable Login' : 'Disable Login'}
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleArchiveClient}
            isLoading={isPending}
            disabled={client.status === 'inactive'}
          >

            <Archive className="h-4 w-4 mr-1.5" /> Archive Client
          </Button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap -mb-px gap-1.5">
          {[
            { id: 'overview', label: 'Client Overview', icon: Building },
            { id: 'contacts', label: 'Contacts', icon: User },
            { id: 'chemicals', label: 'Authorized Substances', icon: FileText },
            { id: 'tcc', label: 'TCC History', icon: Clipboard },
            { id: 'certificates', label: 'Certificates', icon: Award },
            { id: 'activity', label: 'Activity Timeline', icon: History },
            { id: 'notes', label: 'Internal Notes', icon: StickyNote },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2.5 px-4 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Contents */}
      <div className="mt-4">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-slate-100 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                  <Building className="h-5 w-5 text-primary shrink-0" />
                  Legal & Registry Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Company Legal Name</p>
                  <p className="text-slate-800 font-semibold text-sm">{client.legal_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Registration Number</p>
                  <p className="text-slate-800 font-semibold text-sm">{client.registration_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Registered Representative (Owner)</p>
                  <p className="text-slate-800 font-semibold text-sm">{client.owner_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Onboarded At</p>
                  <p className="text-slate-800 font-semibold text-sm flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(client.created_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                  <User className="h-5 w-5 text-primary shrink-0" />
                  Primary Contact Info
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Contact Name</p>
                  <p className="text-slate-800 font-semibold text-sm">
                    {client.primary_contact_first_name} {client.primary_contact_last_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Login/Primary Email</p>
                  <p className="text-slate-800 font-semibold text-sm flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <a href={`mailto:${client.email}`} className="hover:text-primary transition-colors">{client.email}</a>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Mobile Number</p>
                  <p className="text-slate-800 font-semibold text-sm flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {client.phone ? <a href={`tel:${client.phone}`} className="hover:text-primary transition-colors">{client.phone}</a> : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Notifications CC</p>
                  <p className="text-slate-800 font-semibold text-sm">{client.cc_emails || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-100 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                  <MapPin className="h-5 w-5 text-primary shrink-0" />
                  Office Address
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Address</p>
                  <p className="text-slate-800 font-semibold text-sm">{client.address || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">City</p>
                    <p className="text-slate-800 font-semibold text-sm">{client.city || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">State</p>
                    <p className="text-slate-800 font-semibold text-sm">{client.state || 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Country</p>
                    <p className="text-slate-800 font-semibold text-sm">{client.country || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Postal Code</p>
                    <p className="text-slate-800 font-semibold text-sm">{client.postal_code || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'contacts' && (
          <Card className="border-slate-100 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base text-slate-800">Secondary Contact Registry</CardTitle>
                <p className="text-xs text-slate-500">Other representatives who receive CC notifications.</p>
              </div>
              <Button size="sm" onClick={() => setContactModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Contact
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {contacts.length === 0 ? (
                <div className="text-center p-8 text-slate-400 font-medium">
                  No secondary contacts registered.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3">Full Name</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3">Mobile</th>
                        <th className="px-6 py-3">Position / Role</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contacts.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-semibold text-slate-800">{c.first_name} {c.last_name}</td>
                          <td className="px-6 py-4 text-slate-600 font-medium">{c.email}</td>
                          <td className="px-6 py-4 text-slate-600 font-medium">{c.phone || 'N/A'}</td>
                          <td className="px-6 py-4 text-slate-600 font-medium">{c.role || 'N/A'}</td>
                          <td className="px-6 py-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteContact(c.id)}
                              isLoading={isPending}
                              className="text-rose-500 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" /> Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'chemicals' && (
          <Card className="border-slate-100 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base text-slate-800">Chemical Substance Authorizations</CardTitle>
                <p className="text-xs text-slate-500">Allocate quantities and validity periods for controlled chemicals.</p>
              </div>
              <Button size="sm" onClick={() => setAssignChemModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Assign Substance Authority
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {clientChemicals.length === 0 ? (
                <div className="text-center p-8 text-slate-400 font-medium">
                  No substances allocated to this client.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3">Substance</th>
                        <th className="px-6 py-3">CAS / EC Number</th>
                        <th className="px-6 py-3">Available Quota (MT)</th>
                        <th className="px-6 py-3">Validity Expiry</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clientChemicals.map((cc) => (
                        <tr key={cc.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-semibold text-slate-800">{cc.chemicals?.chemical_name}</td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                            CAS: {cc.chemicals?.cas_number}
                            {cc.chemicals?.ec_number && <><br />EC: {cc.chemicals.ec_number}</>}
                          </td>
                          <td className="px-6 py-4 text-emerald-600 font-bold text-sm">
                            {Number(cc.available_quantity).toFixed(2)} MT
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium">
                            {cc.validity_date ? new Date(cc.validity_date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={cc.status === 'active' ? 'success' : cc.status === 'expired' ? 'warning' : 'danger'}>
                              {cc.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleRemoveChemical(cc.chemical_id)}
                              isLoading={isPending}
                              className="text-rose-500 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" /> Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'tcc' && (
          <Card className="border-slate-100 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base text-slate-800">Tonnage Compliance Certificate (TCC) Applications</CardTitle>
              <p className="text-xs text-slate-500">History of export compliance submissions.</p>
            </CardHeader>
            <CardContent className="p-0">
              {tccHistory.length === 0 ? (
                <div className="text-center p-8 text-slate-400 font-medium">
                  No TCC applications recorded for this client.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3">Tracking ID</th>
                        <th className="px-6 py-3">Chemical</th>
                        <th className="px-6 py-3">Quantity (MT)</th>
                        <th className="px-6 py-3">Submission Date</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Action Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tccHistory.map((tcc) => (
                        <tr key={tcc.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-700">{tcc.tracking_id || 'N/A'}</td>
                          <td className="px-6 py-4 font-semibold text-slate-800">{tcc.chemicals?.chemical_name}</td>
                          <td className="px-6 py-4 font-bold text-slate-700 text-sm">{tcc.quantity_mt} MT</td>
                          <td className="px-6 py-4 text-slate-500 font-medium">{new Date(tcc.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4">{getTccStatusBadge(tcc.status)}</td>
                          <td className="px-6 py-4">
                            {tcc.status === 'approved' && tcc.certificates && (
                              <Link href={`/admin/certificate-preview/${tcc.certificates.id}`}>
                                <Button size="sm" variant="outline">
                                  View Cert
                                </Button>
                              </Link>
                            )}
                            {tcc.status === 'rejected' && tcc.rejection_reason && (
                              <span className="text-xs text-rose-500 block max-w-xs truncate" title={tcc.rejection_reason}>
                                Reason: {tcc.rejection_reason}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'certificates' && (
          <Card className="border-slate-100 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base text-slate-800">Generated Certificates</CardTitle>
              <p className="text-xs text-slate-500">Valid & historical export compliance credentials.</p>
            </CardHeader>
            <CardContent className="p-0">
              {certificates.length === 0 ? (
                <div className="text-center p-8 text-slate-400 font-medium">
                  No certificates issued.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3">Certificate Number</th>
                        <th className="px-6 py-3">Substance</th>
                        <th className="px-6 py-3">Issue Date</th>
                        <th className="px-6 py-3">Expiry Date</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Email Stats</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {certificates.map((cert) => (
                        <tr key={cert.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-bold text-slate-800 text-xs tracking-wider">{cert.certificate_number}</td>
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            {cert.tcc_applications?.chemicals?.chemical_name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-medium">{new Date(cert.issued_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium">{cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : 'N/A'}</td>
                          <td className="px-6 py-4">{getCertStatusBadge(cert.status)}</td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                            {cert.mail_sent ? (
                              <span className="text-emerald-600">
                                Sent ({cert.mail_resend_count || 1}x)
                              </span>
                            ) : (
                              <span className="text-amber-500">Not Sent</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right flex justify-end gap-1.5">
                            <Link href={`/admin/certificate-preview/${cert.id}`}>
                              <Button size="sm" variant="outline">
                                Preview / Send Email
                              </Button>
                            </Link>
                            {cert.file_url && (
                              <a href={cert.file_url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline">
                                  Download
                                </Button>
                              </a>
                            )}

                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'activity' && (
          <Card className="border-slate-100 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base text-slate-800">Client Activity Timeline</CardTitle>
              <p className="text-xs text-slate-500">Audit logs of operations relating to this client account.</p>
            </CardHeader>
            <CardContent className="pt-4">
              {activityLogs.length === 0 ? (
                <div className="text-center p-8 text-slate-400 font-medium">
                  No activity logged.
                </div>
              ) : (
                <div className="flow-root">
                  <ul className="-mb-8">
                    {activityLogs.map((log, idx) => (
                      <li key={log.id}>
                        <div className="relative pb-8">
                          {idx !== activityLogs.length - 1 && (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center ring-8 ring-white shrink-0">
                                <History className="h-4 w-4 text-slate-500" />
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{log.action}</p>
                                <p className="text-xs text-slate-500 mt-0.5 font-medium">{log.description}</p>
                              </div>
                              <div className="text-right text-xs whitespace-nowrap text-slate-400 font-semibold">
                                <time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'notes' && (
          <Card className="border-slate-100 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base text-slate-800">Admin Internal Notes</CardTitle>
                <p className="text-xs text-slate-500">Confidential admin-only notes. Visible strictly to administrators.</p>
              </div>
              <Button size="sm" onClick={() => setNoteModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Note
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {internalNotes.length === 0 ? (
                <div className="text-center p-8 text-slate-400 font-medium">
                  No internal notes recorded.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {internalNotes.map((note) => (
                    <div key={note.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3">
                      <StickyNote className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                          <span className="text-xs font-bold text-slate-700">
                            {note.author_email || 'Administrator'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {new Date(note.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap font-medium">{note.note}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        disabled={isPending}
                        className="text-rose-500 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 cursor-pointer"
                        title="Delete note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal Dialogs */}
      {/* 1. Change Email Modal */}
      <Dialog isOpen={isEmailModalOpen} onClose={() => setEmailModalOpen(false)} title="Change Client Primary Email">
        <div className="space-y-4">
          <Input 
            label="New Email Address" 
            type="email"
            value={newEmail} 
            onChange={(e) => setNewEmail(e.target.value)} 
            required 
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleEmailChange} isLoading={isPending}>Save Email</Button>
          </div>
        </div>
      </Dialog>

      {/* 2. Change Password Modal */}
      <Dialog isOpen={isPasswordModalOpen} onClose={() => setPasswordModalOpen(false)} title="Reset Client Account Password">
        <div className="space-y-4">
          <Input 
            label="New Password" 
            type="password"
            placeholder="Min 6 characters"
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
            required 
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPasswordModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handlePasswordChange} isLoading={isPending}>Save Password</Button>
          </div>
        </div>
      </Dialog>

      {/* 3. Assign Chemical Modal */}
      <Dialog isOpen={isAssignChemModalOpen} onClose={() => setAssignChemModalOpen(false)} title="Assign Substance Authority & Quota">
        <div className="space-y-4">
          <Select 
            label="Select Controlled Chemical"
            value={assignChemData.chemical_id}
            onChange={(e) => setAssignChemData({ ...assignChemData, chemical_id: e.target.value })}
            options={[
              { value: '', label: 'Select a chemical...' },
              ...allChemicals.map(chem => ({ value: chem.id, label: `${chem.chemical_name} (CAS: ${chem.cas_number})` }))
            ]}
          />
          <Input 
            label="Authorized Available Quantity (MT)"
            type="number"
            step="0.01"
            placeholder="e.g. 500.00"
            value={assignChemData.available_quantity}
            onChange={(e) => setAssignChemData({ ...assignChemData, available_quantity: e.target.value })}
            required
          />
          <Input 
            label="Authority Expiry Date"
            type="date"
            value={assignChemData.validity_date}
            onChange={(e) => setAssignChemData({ ...assignChemData, validity_date: e.target.value })}
            required
          />
          <Select 
            label="Authorization Status"
            value={assignChemData.status}
            onChange={(e) => setAssignChemData({ ...assignChemData, status: e.target.value as any })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'expired', label: 'Expired' },
              { value: 'suspended', label: 'Suspended' }
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignChemModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAssignChemical} isLoading={isPending}>Assign Authority</Button>
          </div>
        </div>
      </Dialog>

      {/* 4. Add Contact Modal */}
      <Dialog isOpen={isContactModalOpen} onClose={() => setContactModalOpen(false)} title="Add Secondary Contact Officer">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="First Name"
              value={contactData.first_name}
              onChange={(e) => setContactData({ ...contactData, first_name: e.target.value })}
              required
            />
            <Input 
              label="Last Name"
              value={contactData.last_name}
              onChange={(e) => setContactData({ ...contactData, last_name: e.target.value })}
              required
            />
          </div>
          <Input 
            label="Email Address"
            type="email"
            placeholder="e.g. name@company.com"
            value={contactData.email}
            onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
            required
          />
          <Input 
            label="Mobile Number (Optional)"
            placeholder="e.g. +90 532 123 4567"
            value={contactData.phone}
            onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
          />
          <Input 
            label="Position / Role (Optional)"
            placeholder="e.g. Compliance Director"
            value={contactData.role}
            onChange={(e) => setContactData({ ...contactData, role: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setContactModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddContact} isLoading={isPending}>Add Contact</Button>
          </div>
        </div>
      </Dialog>

      {/* 5. Add Internal Note Modal */}
      <Dialog isOpen={isNoteModalOpen} onClose={() => setNoteModalOpen(false)} title="Write Confidential Note">
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Note Content</label>
            <textarea
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-colors font-medium min-h-[120px]"
              placeholder="Record any compliance reviews, custom requirements, or call summaries..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setNoteModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddNote} isLoading={isPending}>Save Note</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
