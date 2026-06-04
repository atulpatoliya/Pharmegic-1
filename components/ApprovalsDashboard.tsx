'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { processTccAction } from '@/actions/tcc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import { toast } from '@/store/toast';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Download,
  Calendar,
  Building,
  FlaskConical,
  MessageSquare,
  Search,
  AlertCircle
} from 'lucide-react';

interface Application {
  id: string;
  client_id: string;
  chemical_id: string;
  quantity_mt: number;
  kkdik_reg_no: string;
  export_date: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'modification_requested';
  rejection_reason: string | null;
  created_at: string;
  clients: {
    company_name: string;
    email: string;
  };
  chemicals: {
    chemical_name: string;
    cas_number: string;
    ec_number: string | null;
    validity_date: string | null;
    available_quantity: number;
  };
  certificates: {
    id: string;
    certificate_number: string;
    file_url: string;
  } | null;
}

interface ApprovalsDashboardProps {
  initialApplications: Application[];
}

export default function ApprovalsDashboard({ initialApplications }: ApprovalsDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [applications, setApplications] = useState<Application[]>(initialApplications);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog state
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | 'changes_required'>('approved');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.clients.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.chemicals.chemical_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.kkdik_reg_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.certificates?.certificate_number &&
        app.certificates.certificate_number.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenAction = (app: Application, type: 'approved' | 'rejected' | 'changes_required') => {
    setSelectedApp(app);
    setActionType(type);
    setRejectionReason('');
    setActionError(null);
    setIsActionOpen(true);
  };

  const handleProcessAction = () => {
    if (!selectedApp) return;
    setActionError(null);

    if (actionType !== 'approved' && !rejectionReason.trim()) {
      setActionError('A reason explanation is required for rejection/modification requests.');
      toast.error('A reason explanation is required for rejection/modification requests.');
      return;
    }

    startTransition(async () => {
      const res = await processTccAction(selectedApp.id, actionType, rejectionReason);
      if (res.success) {
        setIsActionOpen(false);
        if (actionType === 'approved' && res.certificateId) {
          // Redirect to certificate preview page — no auto-email
          toast.success('Certificate generated! Redirecting to preview...');
          router.push(`/admin/certificate-preview/${res.certificateId}`);
        } else {
          toast.success(res.message || 'Application processed.');
          router.refresh();
        }
      } else {
        setActionError(res.error || 'Failed to process application action.');
        toast.error(res.error || 'Failed to process application action.');
      }
    });
  };

  const getStatusBadge = (status: string) => {
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
      case 'modification_requested':
        return (
          <Badge variant="info" className="flex items-center gap-1 w-fit">
            <AlertTriangle className="h-3 w-3" /> Revision Needed
          </Badge>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">TCC Application Worklist</h1>
        <p className="text-sm text-slate-500 font-medium">
          Review company tonnage compliance certificate applications, allocate chemicals quota, and issue signed PDF permits.
        </p>
      </div>

      {/* Tabs Filter & Search */}
      <Card className="border-slate-100 shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
            {[
              { id: 'all', label: 'All Permits' },
              { id: 'pending', label: 'Awaiting Action' },
              { id: 'approved', label: 'Issued / Approved' },
              { id: 'changes_required', label: 'Changes Required' },
              { id: 'rejected', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by company, chemical substance name, registration numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-all"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Substance Details</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">KKDIK Registration No</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Export Date</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    No applications currently match the filtered criteria.
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-50 text-primary flex items-center justify-center font-bold shrink-0">
                          <Building className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{app.clients.company_name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            Submitted: {new Date(app.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <FlaskConical className="h-4 w-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-700">{app.chemicals.chemical_name}</div>
                          <div className="text-xs text-slate-400 font-medium">
                            CAS: {app.chemicals.cas_number} {app.chemicals.ec_number ? `• EC: ${app.chemicals.ec_number}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-extrabold text-slate-800">
                      {app.quantity_mt} MT
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-600">
                      {app.kkdik_reg_no}
                    </td>
                    <td className="p-4 text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{app.export_date ? new Date(app.export_date).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {getStatusBadge(app.status)}
                        {app.status === 'approved' && app.certificates && (
                          <div className="text-[11px] font-mono font-bold text-emerald-600">
                            {app.certificates.certificate_number}
                          </div>
                        )}
                        {app.status !== 'approved' && app.rejection_reason && (
                          <div className="text-xs font-semibold text-slate-400 bg-slate-50 p-1.5 rounded-md border border-slate-100 max-w-xs flex gap-1 items-start">
                            <MessageSquare className="h-3 w-3 mt-0.5 text-slate-500 shrink-0" />
                            <span className="line-clamp-2">{app.rejection_reason}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {app.status === 'pending' || app.status === 'modification_requested' ? (
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleOpenAction(app, 'approved')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:border-emerald-700 h-8"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenAction(app, 'changes_required')}
                            className="text-amber-700 border-amber-200 hover:bg-amber-50 h-8"
                          >
                            Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenAction(app, 'rejected')}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 h-8"
                          >
                            Reject
                          </Button>
                        </div>
                      ) : app.status === 'approved' && app.certificates?.file_url ? (
                        <a
                          href={app.certificates.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/50 rounded-lg transition-colors border border-emerald-100"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs font-semibold">Processed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Action Decision Dialog */}
      <Dialog
        isOpen={isActionOpen}
        onClose={() => setIsActionOpen(false)}
        title={
          actionType === 'approved'
            ? 'Confirm Approval & Issue Certificate'
            : actionType === 'rejected'
            ? 'Reject Application'
            : 'Request Application Revisions'
        }
      >
        <div className="space-y-4">
          {actionType === 'approved' ? (
            <>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Are you sure you want to approve this application from{' '}
                <span className="font-bold text-slate-800">{selectedApp?.clients.company_name}</span>?
              </p>
              <div className="bg-slate-50 border rounded-lg p-3 text-xs space-y-1.5 text-slate-600 font-medium">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px]">Substance</span>
                  <span className="font-bold text-slate-800">{selectedApp?.chemicals.chemical_name}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px]">Requested</span>
                    <span className="font-bold text-slate-800">{selectedApp?.quantity_mt} MT</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px]">Available Quota</span>
                    <span className="font-bold text-slate-800">{selectedApp?.chemicals.available_quantity} MT</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Approving will immediately subtract the requested tonnage from the inventory, generate the official PDF certificate with secure QR verification code, store the file, and dispatch SMTP email notification with PDF attachment.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 font-medium">
                Please specify the reason for this action. This feedback will be sent directly to the client company contact officers.
              </p>
              <textarea
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={
                  actionType === 'rejected'
                    ? 'State the reason for rejecting this application (e.g., CAS validation mismatch or invalid tonnage authorization limit)...'
                    : 'Detail the modification needed (e.g., Please upload updated KKDIK documentation or change the expected export shipment date)...'
                }
                className="w-full text-sm p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none font-medium text-slate-700"
                required
              />
            </>
          )}

          {actionError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm font-semibold flex items-start gap-2.5 w-full my-4">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 text-left">
                <h4 className="font-bold mb-1">Decision Error</h4>
                <p className="text-xs leading-relaxed font-medium">{actionError}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsActionOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcessAction}
              isLoading={isPending}
              disabled={isPending}
              className={
                actionType === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:border-emerald-700'
                  : actionType === 'rejected'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 hover:border-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 hover:border-amber-700'
              }
            >
              {actionType === 'approved'
                ? 'Approve & Issue Certificate'
                : actionType === 'rejected'
                ? 'Reject Permit'
                : 'Send Revision Request'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
