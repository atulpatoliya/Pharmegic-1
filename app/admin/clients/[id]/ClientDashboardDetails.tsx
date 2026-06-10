'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  changeClientEmailAction, 
  changeClientPasswordAction, 
  toggleClientLoginAction, 
  assignChemicalToClientAction, 
  addNewChemicalToClientAction,
  removeChemicalFromClientAction,
  restoreClientChemicalAction,
  permanentDeleteClientChemicalAction,
  editClientChemicalAction,
  addContactAction, 
  deleteContactAction, 
  addInternalNoteAction, 
  deleteInternalNoteAction,
  deleteClientAction,
} from '@/actions/clients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { ModalErrorBox } from '@/components/ui/ModalErrorBox';
import { FormLabel } from '@/components/ui/FormLabel';
import { formatErrorMessage } from '@/lib/format-error';
import { resolveQuotaConsumption, sumApprovedExports, getRemainingQuota } from '@/lib/quota';
import {
  isActiveReachCertificate,
  mapLatestReachByChemical,
  REACH_CERTIFICATE_TYPE,
  getReachCertificateStatus,
  getLastDateOfYear,
  getTodayDateString,
} from '@/lib/reach-certificate';
import { deleteReachCertificateAction } from '@/actions/reach';
import {
  buildReachCertificatePdfDownloadUrl,
  buildReachCertificatePdfPreviewUrl,
} from '@/lib/reach-certificate-download';
import { processTccAction } from '@/actions/tcc';
import { TccApplicationViewDialog, type TccViewApplication } from '@/components/TccApplicationViewDialog';
import { toast } from '@/store/toast';
import Link from 'next/link';
import { 
  Building, Mail, Phone, MapPin, Calendar, CheckCircle, 
  AlertCircle, FileText, User, ShieldAlert, Key, Plus, Trash2,
  FileSignature, Award, Clipboard, StickyNote, History, Lock, Unlock,
  Download, Filter, Eye, EyeOff, PenLine, RotateCcw, Clock, XCircle, ShieldCheck
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
  viewMode?: 'overview' | 'chemicals' | 'certificates' | 'rc-certificates';
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
  currentUserRole,
  viewMode = 'overview',
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

  const showOverview = viewMode === 'overview';
  const showChemicalsSection = viewMode === 'overview' || viewMode === 'chemicals';
  const showCertificatesSection = viewMode === 'overview' || viewMode === 'certificates';
  const showRcCertificatesSection = viewMode === 'rc-certificates';
  const showAdminExtras = viewMode === 'overview' && currentUserRole !== 'CLIENT';

  const clientChemicals = allClientChemicals.filter((c) => c.status !== 'trashed');
  const trashedChemicals = allClientChemicals.filter((c) => c.status === 'trashed');

  const rcCertificates = useMemo(
    () => (certificates || []).filter((c) => c.type === REACH_CERTIFICATE_TYPE),
    [certificates]
  );

  const rcListRows = useMemo(() => {
    const issued = rcCertificates.map((cert) => ({ kind: 'issued' as const, cert }));
    const chemicalIdsWithCert = new Set(
      issued.map((row) => row.cert.chemical_id).filter(Boolean)
    );
    const pending = clientChemicals
      .filter((cc) => !chemicalIdsWithCert.has(cc.chemical_id))
      .map((cc) => ({
        kind: 'pending' as const,
        chemicalId: cc.chemical_id,
        chemical: cc.chemicals,
      }));

    const all = [...issued, ...pending];
    all.sort((a, b) => {
      const nameA =
        a.kind === 'issued'
          ? a.cert.chemicals?.chemical_name || a.cert.chemical?.chemical_name || ''
          : a.chemical?.chemical_name || '';
      const nameB =
        b.kind === 'issued'
          ? b.cert.chemicals?.chemical_name || b.cert.chemical?.chemical_name || ''
          : b.chemical?.chemical_name || '';
      return nameA.localeCompare(nameB);
    });
    return all;
  }, [rcCertificates, clientChemicals]);

  const pageTitle =
    viewMode === 'chemicals'
      ? `${client.company_name} — Chemical Inventory`
      : viewMode === 'certificates'
        ? `${client.company_name} — TCC Certificates`
        : viewMode === 'rc-certificates'
          ? `${client.company_name} — RC Certificates`
          : `${client.company_name} Details`;

  const reachByChemical = useMemo(
    () =>
      mapLatestReachByChemical(
        (certificates || []).filter((c) => c.type === REACH_CERTIFICATE_TYPE)
      ),
    [certificates]
  );

  // Modals state
  const [isEmailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState(client.email);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const emptyAssignChemData = () => {
    const endOfYear = getLastDateOfYear();
    return {
      chemical_name: '',
      cas_number: '',
      ec_number: '',
      tonnage_band: '',
      available_quantity: '',
      registration_number: '',
      issued_date: getTodayDateString(),
      validated_date: endOfYear,
      validity_date: endOfYear,
    };
  };

  const [isAssignChemModalOpen, setAssignChemModalOpen] = useState(false);
  const [assignChemData, setAssignChemData] = useState(emptyAssignChemData);
  
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
  const [isDeleteClientOpen, setDeleteClientOpen] = useState(false);
  const [rcDeleteTarget, setRcDeleteTarget] = useState<
    | { kind: 'issued'; id: string; certificate_number: string; chemical_name: string }
    | { kind: 'pending'; chemicalId: string; chemical_name: string }
    | null
  >(null);

  const [isTccViewOpen, setIsTccViewOpen] = useState(false);
  const [viewTccApp, setViewTccApp] = useState<TccViewApplication | null>(null);
  const [isTccActionOpen, setIsTccActionOpen] = useState(false);
  const [selectedTccApp, setSelectedTccApp] = useState<TccViewApplication | null>(null);
  const [tccActionType, setTccActionType] = useState<'approved' | 'rejected' | 'changes_required'>('approved');
  const [tccRejectionReason, setTccRejectionReason] = useState('');
  const [tccActionError, setTccActionError] = useState<string | null>(null);
  const canReviewTcc = currentUserRole !== 'CLIENT';
  const canDeleteClient = currentUserRole === 'MASTER_ADMIN' || currentUserRole === 'SUPER_ADMIN';

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
  const activePermissions = clientChemicals.filter(c => c.status === 'active').length;
  const pendingRenewals = clientChemicals.filter(c => c.status === 'expired' || (c.validity_date && new Date(c.validity_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))).length;

  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const CHART_COLORS = [
    '#0f766e',
    '#2563eb',
    '#d97706',
    '#e11d48',
    '#7c3aed',
    '#ea580c',
    '#0891b2',
    '#4f46e5',
    '#65a30d',
    '#db2777',
  ];
  const chartYear = new Date().getFullYear();

  const { chartSeries, chartOptions, chartLegend } = useMemo(() => {
    const approvedApps = tccHistory.filter((t) => t.status === 'approved');

    const chemicalEntries: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    clientChemicals.forEach((cc) => {
      if (cc.chemical_id && cc.chemicals?.chemical_name && !seen.has(cc.chemical_id)) {
        seen.add(cc.chemical_id);
        chemicalEntries.push({ id: cc.chemical_id, name: cc.chemicals.chemical_name });
      }
    });
    approvedApps.forEach((app) => {
      const id = app.chemical_id as string;
      const name = app.chemicals?.chemical_name || 'Unknown substance';
      if (id && !seen.has(id)) {
        seen.add(id);
        chemicalEntries.push({ id, name });
      }
    });

    const getActivityDate = (app: { export_date?: string | null; updated_at?: string; created_at?: string }) => {
      const raw = app.export_date || app.updated_at || app.created_at;
      return raw ? new Date(raw) : null;
    };

    const series = chemicalEntries.map(({ id, name }, idx) => ({
      name,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      data: MONTH_LABELS.map((_, monthIdx) =>
        approvedApps
          .filter((app) => app.chemical_id === id)
          .filter((app) => {
            const d = getActivityDate(app);
            return d && d.getFullYear() === chartYear && d.getMonth() === monthIdx;
          })
          .reduce((sum, app) => sum + Number(app.quantity_mt || 0), 0)
      ),
    }));

    const legend = series.map((s, idx) => ({
      name: s.name,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      total: s.data.reduce((a, b) => a + b, 0),
    }));

    const seriesColors = series.map((s) => s.color);

    const options = {
      chart: {
        type: 'line' as const,
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true },
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth' as const, width: 3 },
      colors: seriesColors,
      markers: {
        size: 4,
        strokeWidth: 2,
        hover: { size: 6 },
      },
      xaxis: {
        categories: MONTH_LABELS,
        labels: { style: { fontSize: '11px', colors: '#64748b', fontWeight: 600 } },
      },
      yaxis: {
        title: { text: 'Exported (MT)', style: { fontSize: '11px', color: '#64748b', fontWeight: 600 } },
        labels: {
          formatter: (v: number) => `${Number(v).toFixed(0)}`,
          style: { fontSize: '10px', colors: '#64748b' },
        },
        min: 0,
      },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      legend: { show: false },
      tooltip: {
        shared: true,
        intersect: false,
        y: { formatter: (v: number) => `${Number(v).toFixed(2)} MT` },
      },
    };

    return {
      chartSeries: series.length > 0 ? series.map(({ name, data }) => ({ name, data })) : [],
      chartOptions: options,
      chartLegend: legend,
    };
  }, [tccHistory, clientChemicals, chartYear]);

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
    if (!assignChemData.ec_number.trim()) {
      setModalError('assignChem', 'EC number is required.');
      return;
    }
    if (!assignChemData.registration_number.trim()) {
      setModalError('assignChem', 'Registration number is required.');
      return;
    }
    if (!assignChemData.issued_date) {
      setModalError('assignChem', 'Issued date is required.');
      return;
    }
    if (!assignChemData.validated_date) {
      setModalError('assignChem', 'Validated date is required.');
      return;
    }
    setModalError('assignChem', null);
    startTransition(async () => {
      const res = await addNewChemicalToClientAction(client.id, assignChemData);
      if (res.success) {
        toast.success(res.message || 'Substance assigned and RC Certificate issued.');
        setAssignChemModalOpen(false);
        setAssignChemData(emptyAssignChemData());
        router.refresh();
        if (res.certificateId) {
          router.push(`/admin/certificate-preview/${res.certificateId}`);
        }
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
    if (!editChemData.ec_number.trim()) {
      setModalError('editChem', 'EC number is required.');
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
    if (confirm('Move this substance to trash? You can restore it from the Trash box below.')) {
      startTransition(async () => {
        const res = await removeChemicalFromClientAction(client.id, chemId);
        if (res.success) { toast.success('Substance moved to trash.'); router.refresh(); }
        else setModalError('substances', toErrorMessage(res.error, 'Failed to remove substance.'));
      });
    }
  };

  const handleRestoreClientChemical = (chemId: string) => {
    startTransition(async () => {
      const res = await restoreClientChemicalAction(client.id, chemId);
      if (res.success) {
        toast.success(res.message || 'Substance restored.');
        router.refresh();
      } else {
        setModalError('substances', toErrorMessage(res.error, 'Failed to restore substance.'));
      }
    });
  };

  const handlePermanentDeleteClientChemical = (chemId: string, name: string) => {
    if (
      !confirm(
        `Permanently delete "${name}" from this client? This removes the assignment forever and cannot be undone.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await permanentDeleteClientChemicalAction(client.id, chemId);
      if (res.success) {
        toast.success(res.message || 'Substance permanently deleted.');
        router.refresh();
      } else {
        setModalError('substances', toErrorMessage(res.error, 'Failed to permanently delete.'));
      }
    });
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

  const handleDeleteRcCertificate = () => {
    if (!rcDeleteTarget) return;
    startTransition(async () => {
      const res =
        rcDeleteTarget.kind === 'issued'
          ? await deleteReachCertificateAction(rcDeleteTarget.id, client.id)
          : await removeChemicalFromClientAction(client.id, rcDeleteTarget.chemicalId);
      if (res.success) {
        toast.success(res.message || 'Removed successfully.');
        setRcDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to remove.');
      }
    });
  };

  const handleDeleteClient = () => {
    startTransition(async () => {
      const res = await deleteClientAction(client.id);
      if (res.success) {
        toast.success(res.message || 'Client deleted successfully.');
        setDeleteClientOpen(false);
        router.push('/admin/clients');
        router.refresh();
      } else {
        setModalError('security', res.error || 'Failed to delete client.');
        toast.error(res.error || 'Failed to delete client.');
      }
    });
  };

  const resolveChemical = (row: { chemicals?: { chemical_name?: string } | null }) =>
    row.chemicals?.chemical_name || 'N/A';

  const resolveCertificate = (row: { certificates?: { id?: string; certificate_number?: string; file_url?: string; issued_at?: string; status?: string } | null }) =>
    row.certificates ?? null;

  const buildViewApplication = (app: Record<string, unknown>): TccViewApplication => {
    const chem = app.chemicals as {
      chemical_name?: string;
      cas_number?: string;
      ec_number?: string | null;
      tonnage_band?: string | null;
      validity_date?: string | null;
      available_quantity?: number;
    } | null;
    let cc: { available_quantity: number } | null = null;
    const rawCc = app.client_chemicals as { available_quantity?: number } | null;
    if (rawCc?.available_quantity != null) {
      cc = { available_quantity: Number(rawCc.available_quantity) };
    } else if (app.chemical_id) {
      const match = clientChemicals.find((c) => c.chemical_id === app.chemical_id);
      if (match) cc = { available_quantity: Number(match.available_quantity ?? 0) };
    }
    const chemicalId = app.chemical_id as string | undefined;
    const exportedRaw = chemicalId ? sumApprovedExports(tccHistory, chemicalId, chartYear) : 0;
    const tonnageBand = chem?.tonnage_band ?? null;
    const remainingQuota = getRemainingQuota(Number(cc?.available_quantity ?? 0), exportedRaw, tonnageBand);
    cc = { available_quantity: remainingQuota };
    return {
      id: app.id as string,
      tracking_id: app.tracking_id as string | undefined,
      quantity_mt: Number(app.quantity_mt ?? 0),
      kkdik_reg_no: (app.kkdik_reg_no as string) || '',
      export_date: (app.export_date as string | null | undefined) ?? null,
      remarks: app.remarks as string | null | undefined,
      status: app.status as string,
      rejection_reason: app.rejection_reason as string | null | undefined,
      bo_attachment_url: app.bo_attachment_url as string | null | undefined,
      bo_attachment_name: app.bo_attachment_name as string | null | undefined,
      created_at: app.created_at as string,
      updated_at: (app.updated_at as string | undefined) ?? (app.created_at as string),
      client_chemicals: cc,
      clients: { company_name: client.company_name, email: client.email },
      chemicals: {
        chemical_name: chem?.chemical_name || 'N/A',
        cas_number: chem?.cas_number || 'N/A',
        ec_number: chem?.ec_number ?? null,
        tonnage_band: chem?.tonnage_band ?? null,
        validity_date: chem?.validity_date ?? null,
        available_quantity: remainingQuota,
      },
      certificates: app.certificates as TccViewApplication['certificates'],
    };
  };

  const handleOpenTccView = (app: (typeof tccHistory)[number]) => {
    setViewTccApp(buildViewApplication(app));
    setIsTccViewOpen(true);
  };

  const handleOpenTccAction = (
    app: TccViewApplication,
    type: 'approved' | 'rejected' | 'changes_required'
  ) => {
    setSelectedTccApp(app);
    setTccActionType(type);
    setTccRejectionReason('');
    setTccActionError(null);
    setIsTccActionOpen(true);
  };

  const handleTccViewThenAction = (type: 'approved' | 'rejected' | 'changes_required') => {
    if (!viewTccApp) return;
    setIsTccViewOpen(false);
    handleOpenTccAction(viewTccApp, type);
  };

  const handleProcessTccAction = () => {
    if (!selectedTccApp) return;
    setTccActionError(null);

    if (tccActionType !== 'approved' && !tccRejectionReason.trim()) {
      const msg = 'A reason explanation is required for rejection/modification requests.';
      setTccActionError(msg);
      toast.error(msg);
      return;
    }

    startTransition(async () => {
      const res = await processTccAction(selectedTccApp.id, tccActionType, tccRejectionReason);
      if (res.success) {
        setIsTccActionOpen(false);
        if (tccActionType === 'approved' && res.certificateId) {
          toast.success('Certificate generated! Redirecting to preview...');
          router.push(`/admin/certificate-preview/${res.certificateId}`);
        } else {
          toast.success(res.message || 'Application processed.');
          router.refresh();
        }
      } else {
        setTccActionError(res.error || 'Failed to process application action.');
        toast.error(res.error || 'Failed to process application action.');
      }
    });
  };

  const getTccStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="warning" className="flex items-center gap-1 w-fit">
            <Clock className="h-3 w-3" /> Pending Review
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="success" className="flex items-center gap-1 w-fit">
            <CheckCircle className="h-3 w-3" /> Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="danger" className="flex items-center gap-1 w-fit">
            <XCircle className="h-3 w-3" /> Rejected
          </Badge>
        );
      case 'changes_required':
      case 'modification_requested':
        return (
          <Badge variant="info" className="flex items-center gap-1 w-fit">
            <AlertCircle className="h-3 w-3" /> Revision Needed
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const tccStatusDisplay = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: 'Approved', className: 'text-emerald-600', icon: CheckCircle };
      case 'rejected':
        return { label: 'Rejected', className: 'text-rose-600', icon: AlertCircle };
      case 'changes_required':
      case 'modification_requested':
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
      const exportedRaw = sumApprovedExports(tccHistory, cc.chemical_id, chartYear);
      const { exported, totalQuota: max } = resolveQuotaConsumption(
        exportedRaw,
        cc.chemicals?.tonnage_band,
        cc.available_quantity
      );
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
          <h1 className="text-xl font-bold text-teal-900 tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            ID: {client.uuid_number ? client.uuid_number.split('-')[0].toUpperCase() : 'AP-882-2025'}
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
      {showOverview && (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Column: Stat Cards */}
        <div className="space-y-4 lg:col-span-1">
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
        </div>

        {/* Right Column: Chart */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col min-h-[360px]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-600">Monthly TCC Activity</h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Chemical-wise approved export lines (MT per month)
              </p>
            </div>
            <span className="px-2 py-1 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-500 rounded">
              Year {chartYear}
            </span>
          </div>

          {chartLegend.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-slate-100">
              {chartLegend.map((item) => (
                <span
                  key={item.name}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold border"
                  style={{
                    borderColor: item.color,
                    color: item.color,
                    backgroundColor: `${item.color}14`,
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                  <span className="text-slate-400 font-semibold">
                    · {item.total.toFixed(1)} MT
                  </span>
                </span>
              ))}
            </div>
          )}

          <div className="flex-1 w-full h-full min-h-[280px]">
            {isMounted && chartSeries.length > 0 ? (
              <ApexChart options={chartOptions} series={chartSeries} type="line" height="100%" width="100%" />
            ) : isMounted ? (
              <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-slate-400 font-medium">
                Assign chemicals to this client to see activity chart.
              </div>
            ) : null}
          </div>
        </div>
      </div>
      )}

      {/* 3. Substance Details & Quotas Table */}
      {showChemicalsSection && (
      <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-bold text-slate-700 text-sm">Substance Details</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500"><Filter className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500" onClick={handleExportCSV} title="Export CSV">
              <Download className="h-4 w-4" />
            </Button>
            {currentUserRole !== 'CLIENT' && (
              <Button size="sm" className="h-8 bg-teal-700 hover:bg-teal-800 ml-2" onClick={() => { setModalError('assignChem', null); setAssignChemData(emptyAssignChemData()); setAssignChemModalOpen(true); }}>
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
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Validity</th>
                <th className="px-6 py-4">RC Certificate</th>
                <th className="px-6 py-4 text-center">Status</th>
                {currentUserRole !== 'CLIENT' && <th className="px-6 py-4 text-right"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientChemicals.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">No substances assigned.</td></tr>
              ) : (
                clientChemicals.map((cc) => {
                  const name = cc.chemicals?.chemical_name || 'Unknown';
                  const exportedRaw = sumApprovedExports(tccHistory, cc.chemical_id, chartYear);
                  const { exported, totalQuota: max, percentUsed: pct, isExceeded } = resolveQuotaConsumption(
                    exportedRaw,
                    cc.chemicals?.tonnage_band,
                    cc.available_quantity
                  );
                  const isCritical = isExceeded || pct >= 90 || cc.status === 'expired';
                  const isWarning = !isExceeded && pct >= 75 && pct < 90;
                  const reachCert = reachByChemical.get(cc.chemical_id) ?? null;
                  const reachValid = isActiveReachCertificate(reachCert);
                  const reachStatus = getReachCertificateStatus(reachCert);

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
                          <div className={`h-full ${isExceeded || isCritical ? 'bg-red-600' : isWarning ? 'bg-emerald-600' : 'bg-teal-700'}`} style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}></div>
                          {isWarning && <div className="h-full bg-red-500" style={{ width: '10%' }}></div>}
                        </div>
                        {(isExceeded || isCritical || isWarning) && (
                          <div className="text-[10px] font-bold text-red-600 text-right mt-1">
                            {isExceeded ? 'QTY Exceeded' : isCritical ? 'Critical' : 'Limit Warning'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium" suppressHydrationWarning>
                        {cc.validity_date ? new Date(cc.validity_date).toLocaleDateString('en-GB') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {reachValid ? (
                          <div className="space-y-1">
                            <Badge variant="success" className="text-[10px] uppercase font-bold flex items-center gap-1 w-fit">
                              <ShieldCheck className="h-3 w-3" /> Valid
                            </Badge>
                            <div className="text-[10px] text-slate-500 font-medium" suppressHydrationWarning>
                              Until {reachCert?.expires_at ? new Date(reachCert.expires_at).toLocaleDateString('en-GB') : 'N/A'}
                            </div>
                            {reachCert?.id && (
                              <a
                                href={buildReachCertificatePdfDownloadUrl(reachCert.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-bold text-teal-700 hover:underline"
                              >
                                View PDF
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant={reachStatus === 'expired' ? 'warning' : 'neutral'} className="text-[10px] uppercase font-bold">
                              {reachStatus === 'expired' ? 'Expired' : 'Not Issued'}
                            </Badge>
                            {currentUserRole !== 'CLIENT' && (
                              <Link href={`/admin/clients/${client.id}/rc-preview/${cc.chemical_id}`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] font-bold border-teal-200 text-teal-800 hover:bg-teal-50"
                                >
                                  View
                                </Button>
                              </Link>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={isExceeded ? 'danger' : cc.status === 'active' && !isCritical ? 'success' : 'danger'} className={`text-[10px] uppercase font-bold py-1 ${isExceeded ? 'bg-red-100 text-red-700' : isCritical ? 'bg-red-100 text-red-700' : 'bg-lime-300 text-lime-900'}`}>
                          {isExceeded ? 'QTY Exceeded' : cc.status === 'expired' ? 'Expired' : isCritical ? 'Critical' : 'Active'}
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
            <span className="text-xs text-slate-400">Restore to bring back · Delete permanently to remove forever</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Substance Name</th>
                  <th className="px-6 py-3">CAS Number</th>
                  <th className="px-6 py-3">Deleted Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
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
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs mr-2"
                        disabled={isPending}
                        onClick={() => handleRestoreClientChemical(cc.chemical_id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                        disabled={isPending}
                        onClick={() =>
                          handlePermanentDeleteClientChemical(
                            cc.chemical_id,
                            cc.chemicals?.chemical_name || 'this substance'
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete permanently
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </>
      )}

      {/* RC Certificates List */}
      {showRcCertificatesSection && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-bold text-slate-700 text-sm">RC Compliance Certificates</h2>
          {currentUserRole !== 'CLIENT' && (
            <Button
              size="sm"
              className="h-8 bg-teal-700 hover:bg-teal-800"
              onClick={() => {
                setModalError('assignChem', null);
                setAssignChemData(emptyAssignChemData());
                setAssignChemModalOpen(true);
              }}
            >
              + Assign Substance &amp; Issue RC
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Certificate No.</th>
                <th className="px-6 py-4">Registration No.</th>
                <th className="px-6 py-4">Chemical</th>
                <th className="px-6 py-4">CAS Number</th>
                <th className="px-6 py-4">Issued Date</th>
                <th className="px-6 py-4">Validated Date</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
                {currentUserRole !== 'CLIENT' && (
                  <th className="px-6 py-4 text-center">Delete</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rcListRows.length === 0 ? (
                <tr>
                  <td colSpan={currentUserRole !== 'CLIENT' ? 9 : 8} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No substances assigned yet. Assign a substance to issue an RC certificate.
                  </td>
                </tr>
              ) : (
                rcListRows.map((row) => {
                  if (row.kind === 'pending') {
                    const chemName = row.chemical?.chemical_name || 'Unknown';
                    const cas = row.chemical?.cas_number || 'N/A';

                    return (
                      <tr key={`pending-${row.chemicalId}`} className="hover:bg-slate-50/50 transition-colors bg-amber-50/30">
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">—</td>
                        <td className="px-6 py-4 text-slate-400">—</td>
                        <td className="px-6 py-4 font-semibold text-slate-800">{chemName}</td>
                        <td className="px-6 py-4 font-mono text-[11px] text-slate-600">{cas}</td>
                        <td className="px-6 py-4 text-slate-400">—</td>
                        <td className="px-6 py-4 text-slate-400">—</td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="warning" className="text-[10px] uppercase font-bold">
                            Pending
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {currentUserRole !== 'CLIENT' && (
                            <Link href={`/admin/clients/${client.id}/rc-preview/${row.chemicalId}`} title="Review certificate">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-teal-700 hover:bg-teal-50">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </td>
                        {currentUserRole !== 'CLIENT' && (
                          <td className="px-6 py-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              title="Remove assigned substance"
                              onClick={() =>
                                setRcDeleteTarget({
                                  kind: 'pending',
                                  chemicalId: row.chemicalId,
                                  chemical_name: chemName,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  }

                  const cert = row.cert;
                  const chem = cert.chemicals || cert.chemical;
                  const chemName = chem?.chemical_name || 'Unknown';
                  const cas = chem?.cas_number || 'N/A';
                  const isValid = isActiveReachCertificate(cert);
                  const status = getReachCertificateStatus(cert);

                  return (
                    <tr key={cert.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-teal-900 text-xs">{cert.certificate_number}</td>
                      <td className="px-6 py-4 font-medium text-slate-700">{cert.registration_number || '—'}</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{chemName}</td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-600">{cas}</td>
                      <td className="px-6 py-4 text-slate-600" suppressHydrationWarning>
                        {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('en-GB') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-slate-600" suppressHydrationWarning>
                        {cert.expires_at ? new Date(cert.expires_at).toLocaleDateString('en-GB') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={isValid ? 'success' : status === 'expired' ? 'warning' : 'neutral'} className="text-[10px] uppercase font-bold">
                          {isValid ? 'Valid' : status === 'expired' ? 'Expired' : cert.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          {cert.id && (
                            <a
                              href={buildReachCertificatePdfDownloadUrl(cert.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Download PDF"
                            >
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                          {currentUserRole !== 'CLIENT' && cert.chemical_id && (
                            <Link href={`/admin/clients/${client.id}/rc-preview/${cert.chemical_id}`} title="Preview certificate">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-teal-700 hover:bg-teal-50">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                      {currentUserRole !== 'CLIENT' && (
                        <td className="px-6 py-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Delete certificate"
                            onClick={() =>
                              setRcDeleteTarget({
                                kind: 'issued',
                                id: cert.id,
                                certificate_number: cert.certificate_number,
                                chemical_name: chemName,
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <Dialog
        isOpen={!!rcDeleteTarget}
        onClose={() => setRcDeleteTarget(null)}
        title={rcDeleteTarget?.kind === 'pending' ? 'Remove Assigned Substance' : 'Delete RC Certificate'}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {rcDeleteTarget?.kind === 'pending' ? (
              <>
                Remove assigned substance <strong>{rcDeleteTarget.chemical_name}</strong> from this client?
                The pending RC certificate row will be removed.
              </>
            ) : (
              <>
                Are you sure you want to delete RC Certificate{' '}
                <strong className="font-mono text-slate-800">{rcDeleteTarget?.certificate_number}</strong>{' '}
                for <strong>{rcDeleteTarget?.chemical_name}</strong>? This cannot be undone.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRcDeleteTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRcCertificate}
              isLoading={isPending}
              disabled={isPending}
            >
              {rcDeleteTarget?.kind === 'pending' ? 'Remove Substance' : 'Delete Certificate'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 4. TCC Applications & Issued Certificates */}
      {showCertificatesSection && (
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
                        <div className="flex justify-center gap-2 items-center">
                          {app.bo_attachment_url && (
                            <a href={app.bo_attachment_url} target="_blank" rel="noopener noreferrer" title="View BO attachment">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600">
                                <FileText className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-teal-700 hover:bg-teal-50"
                            title="View application"
                            onClick={() => handleOpenTccView(app)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {cert?.file_url && app.status === 'approved' && (
                            <a href={cert.file_url} target="_blank" rel="noopener noreferrer" title="Download certificate PDF">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-600">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
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
      )}

      {/* 5. Admin Extras (Contacts, Activity, Notes, Actions) - Only visible to Admins, placed at bottom so it doesn't ruin the main dashboard */}
      {showAdminExtras && (
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
                {canDeleteClient && (
                  <>
                    <hr className="border-slate-100 my-1" />
                    <Button
                      variant="outline"
                      className="w-full justify-start text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => { setModalError('security', null); setDeleteClientOpen(true); }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Compliance Account
                    </Button>
                  </>
                )}
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
              <FormLabel required className="text-sm normal-case mb-1 block">Substance Name</FormLabel>
              <Input placeholder="e.g. Methanol" value={assignChemData.chemical_name} onChange={(e) => setAssignChemData({ ...assignChemData, chemical_name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel required className="text-sm normal-case mb-1 block">CAS Number</FormLabel>
                <Input placeholder="e.g. 67-56-1" value={assignChemData.cas_number} onChange={(e) => setAssignChemData({ ...assignChemData, cas_number: e.target.value })} required />
              </div>
              <div>
                <FormLabel required className="text-sm normal-case mb-1 block">EC Number</FormLabel>
                <Input placeholder="e.g. 200-659-6" value={assignChemData.ec_number} onChange={(e) => setAssignChemData({ ...assignChemData, ec_number: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel required className="text-sm normal-case mb-1 block">Registration Number</FormLabel>
                <Input
                  placeholder="e.g. REG-2026-001"
                  value={assignChemData.registration_number}
                  onChange={(e) => setAssignChemData({ ...assignChemData, registration_number: e.target.value })}
                  required
                />
              </div>
              <div>
                <FormLabel className="text-sm normal-case mb-1 block">Allocated Quota (MT)</FormLabel>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel required className="text-sm normal-case mb-1 block">Issued Date</FormLabel>
                <Input
                  type="date"
                  value={assignChemData.issued_date}
                  onChange={(e) => setAssignChemData({ ...assignChemData, issued_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <FormLabel required className="text-sm normal-case mb-1 block">Validated Date</FormLabel>
                <Input
                  type="date"
                  value={assignChemData.validated_date}
                  onChange={(e) => setAssignChemData({ ...assignChemData, validated_date: e.target.value, validity_date: e.target.value })}
                  required
                />
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
              <FormLabel required className="text-sm normal-case mb-1 block">Substance Name</FormLabel>
              <Input
                placeholder="e.g. Methanol"
                value={editChemData.chemical_name}
                onChange={(e) => setEditChemData({ ...editChemData, chemical_name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel className="text-sm normal-case mb-1 block">CAS Number</FormLabel>
                <Input
                  placeholder="e.g. 67-56-1"
                  value={editChemData.cas_number}
                  onChange={(e) => setEditChemData({ ...editChemData, cas_number: e.target.value })}
                />
              </div>
              <div>
                <FormLabel required className="text-sm normal-case mb-1 block">EC Number</FormLabel>
                <Input
                  placeholder="e.g. 200-659-6"
                  value={editChemData.ec_number}
                  onChange={(e) => setEditChemData({ ...editChemData, ec_number: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel className="text-sm normal-case mb-1 block">Allocated Quota (MT)</FormLabel>
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
                <FormLabel className="text-sm normal-case mb-1 block">Validity Date</FormLabel>
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

      <TccApplicationViewDialog
        app={viewTccApp}
        isOpen={isTccViewOpen}
        onClose={() => setIsTccViewOpen(false)}
        allowReview={canReviewTcc}
        getStatusBadge={getTccStatusBadge}
        onApprove={() => handleTccViewThenAction('approved')}
        onReject={() => handleTccViewThenAction('rejected')}
        onRequestChanges={() => handleTccViewThenAction('changes_required')}
      />

      <Dialog
        isOpen={isTccActionOpen}
        onClose={() => setIsTccActionOpen(false)}
        title={
          tccActionType === 'approved'
            ? 'Confirm Approval & Issue Certificate'
            : tccActionType === 'rejected'
            ? 'Reject Application'
            : 'Request Application Revisions'
        }
      >
        <div className="space-y-4">
          {tccActionType === 'approved' ? (
            <>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Are you sure you want to approve this application from{' '}
                <span className="font-bold text-slate-800">{selectedTccApp?.clients.company_name}</span>?
              </p>
              <div className="bg-slate-50 border rounded-lg p-3 text-xs space-y-1.5 text-slate-600 font-medium">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px]">Substance</span>
                  <span className="font-bold text-slate-800">{selectedTccApp?.chemicals.chemical_name}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px]">Requested</span>
                    <span className="font-bold text-slate-800">{selectedTccApp?.quantity_mt} MT</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px]">Available Quota</span>
                    <span className="font-bold text-slate-800">
                      {selectedTccApp?.client_chemicals?.available_quantity ??
                        selectedTccApp?.chemicals.available_quantity}{' '}
                      MT
                    </span>
                  </div>
                </div>
                {selectedTccApp?.bo_attachment_url && (
                  <a
                    href={selectedTccApp.bo_attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    View BO: {selectedTccApp.bo_attachment_name || 'Attachment'}
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Approving will deduct client quota, generate the PDF certificate, and store it for download.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 font-medium">
                Please specify the reason for this action. This feedback will be sent to the client.
              </p>
              <textarea
                rows={4}
                value={tccRejectionReason}
                onChange={(e) => setTccRejectionReason(e.target.value)}
                placeholder={
                  tccActionType === 'rejected'
                    ? 'Reason for rejection…'
                    : 'Detail the modifications needed…'
                }
                className="w-full text-sm p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none font-medium text-slate-700"
                required
              />
            </>
          )}

          {tccActionError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm font-semibold flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold mb-1">Decision Error</h4>
                <p className="text-xs leading-relaxed font-medium">{tccActionError}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsTccActionOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleProcessTccAction}
              isLoading={isPending}
              disabled={isPending}
              className={
                tccActionType === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : tccActionType === 'rejected'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }
            >
              {tccActionType === 'approved'
                ? 'Approve & Issue Certificate'
                : tccActionType === 'rejected'
                ? 'Reject Permit'
                : 'Send Revision Request'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={isDeleteClientOpen} onClose={() => setDeleteClientOpen(false)} title="Confirm Deletion">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 font-medium">
            Are you sure you want to delete{' '}
            <span className="font-bold text-slate-800">{client.company_name}</span>?
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
              onClick={() => setDeleteClientOpen(false)}
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
