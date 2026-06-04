'use client';

import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { formatDisplayDate } from '@/lib/date-filter';
import {
  Building,
  FlaskConical,
  FileText,
  Paperclip,
  Shield,
  Download,
  ExternalLink,
} from 'lucide-react';

export interface TccViewApplication {
  id: string;
  tracking_id?: string | null;
  quantity_mt: number;
  kkdik_reg_no: string;
  export_date: string | null;
  remarks?: string | null;
  status: string;
  rejection_reason?: string | null;
  bo_attachment_url?: string | null;
  bo_attachment_name?: string | null;
  created_at: string;
  updated_at: string;
  client_chemicals?: { available_quantity: number } | null;
  clients: { company_name: string; email: string };
  chemicals: {
    chemical_name: string;
    cas_number: string;
    ec_number: string | null;
    tonnage_band: string | null;
    validity_date: string | null;
    available_quantity: number;
  };
  certificates?: {
    id: string;
    certificate_number: string;
    file_url: string | null;
    issued_at: string;
  } | {
    id: string;
    certificate_number: string;
    file_url: string | null;
    issued_at: string;
  }[] | null;
}

function resolveCertificate(app: TccViewApplication) {
  const c = app.certificates;
  if (!c) return null;
  if (Array.isArray(c)) return c[0] ?? null;
  return c;
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="text-sm font-semibold text-slate-800 mt-0.5">{children}</div>
    </div>
  );
}

function isPdfUrl(url: string) {
  return /\.pdf($|\?)/i.test(url) || url.includes('application/pdf');
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp)($|\?)/i.test(url);
}

function canReviewActions(status: string) {
  return status === 'pending' || status === 'changes_required' || status === 'modification_requested';
}

interface TccApplicationViewDialogProps {
  app: TccViewApplication | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

export function TccApplicationViewDialog({
  app,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRequestChanges,
  getStatusBadge,
}: TccApplicationViewDialogProps) {
  if (!app) return null;

  const cert = resolveCertificate(app);
  const availableQuota =
    app.client_chemicals?.available_quantity ?? app.chemicals.available_quantity;
  const showActions = canReviewActions(app.status);
  const boUrl = app.bo_attachment_url;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="wide"
      title={`Application Review — ${app.tracking_id || app.id.slice(0, 8).toUpperCase()}`}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          {getStatusBadge(app.status)}
          <span className="text-xs text-slate-500 font-medium">
            Submitted {formatDisplayDate(app.created_at)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client submission */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Building className="h-4 w-4 text-primary" />
              Client submission
            </h3>
            <div className="grid grid-cols-2 gap-4 bg-slate-50/80 rounded-xl border border-slate-100 p-4">
              <DetailItem label="Company">{app.clients.company_name}</DetailItem>
              <DetailItem label="Contact email">{app.clients.email}</DetailItem>
              <DetailItem label="Chemical substance">{app.chemicals.chemical_name}</DetailItem>
              <DetailItem label="CAS number">
                <span className="font-mono text-xs">{app.chemicals.cas_number}</span>
              </DetailItem>
              {app.chemicals.ec_number && (
                <DetailItem label="EC number">
                  <span className="font-mono text-xs">{app.chemicals.ec_number}</span>
                </DetailItem>
              )}
              {app.chemicals.tonnage_band && (
                <DetailItem label="Tonnage band">{app.chemicals.tonnage_band}</DetailItem>
              )}
              <DetailItem label="Substance validity">
                {formatDisplayDate(app.chemicals.validity_date)}
              </DetailItem>
              <DetailItem label="Quantity requested">
                <span className="text-lg font-black text-teal-800">{app.quantity_mt} MT</span>
              </DetailItem>
              <DetailItem label="Available quota (client)">
                {availableQuota} MT
              </DetailItem>
              <DetailItem label="KKDIK registration no">
                <span className="font-mono text-xs">{app.kkdik_reg_no}</span>
              </DetailItem>
              <DetailItem label="Expected export date">
                {formatDisplayDate(app.export_date)}
              </DetailItem>
              {app.remarks && (
                <div className="col-span-2">
                  <DetailItem label="Remarks / notes">{app.remarks}</DetailItem>
                </div>
              )}
            </div>

            {/* BO attachment */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  BO attachment (client upload)
                </span>
                {boUrl && (
                  <a
                    href={boUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {boUrl ? (
                <div className="p-2 bg-white min-h-[200px]">
                  {isImageUrl(boUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={boUrl}
                      alt={app.bo_attachment_name || 'BO attachment'}
                      className="max-h-[280px] w-full object-contain rounded"
                    />
                  ) : isPdfUrl(boUrl) ? (
                    <iframe
                      src={boUrl}
                      title="BO attachment preview"
                      className="w-full h-[280px] rounded border border-slate-100"
                    />
                  ) : (
                    <div className="p-6 text-center text-sm text-slate-500">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                      <p className="font-medium">{app.bo_attachment_name || 'Attachment file'}</p>
                      <a
                        href={boUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-bold text-xs mt-2 inline-block hover:underline"
                      >
                        Download / open file
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="p-6 text-sm text-slate-400 text-center font-medium">No BO attachment uploaded</p>
              )}
            </div>
          </div>

          {/* Certificate preview */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Shield className="h-4 w-4 text-primary" />
              Certificate preview
            </h3>
            {cert?.file_url ? (
              <div className="rounded-xl border border-emerald-100 overflow-hidden bg-emerald-50/30">
                <div className="px-4 py-2.5 border-b border-emerald-100 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <Badge variant="success" className="text-[10px]">
                      {cert.certificate_number}
                    </Badge>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium">
                      Issued {formatDisplayDate(cert.issued_at)}
                    </p>
                  </div>
                  <a
                    href={cert.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PDF
                  </a>
                </div>
                <iframe
                  src={cert.file_url}
                  title={`Certificate ${cert.certificate_number}`}
                  className="w-full h-[420px] bg-white"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">Certificate not issued yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Review the client submission and BO attachment above. After you approve, the PDF certificate will
                  appear here.
                </p>
              </div>
            )}

            {app.rejection_reason && app.status !== 'approved' && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-900 font-medium">
                <span className="font-bold block mb-1">Previous feedback</span>
                {app.rejection_reason}
              </div>
            )}
          </div>
        </div>

        {/* Review actions */}
        {showActions && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <p className="text-xs text-slate-500 font-medium">
              Review all submitted data and attachments, then choose an action:
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onRequestChanges}
                className="text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                Request changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onReject}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                Reject
              </Button>
              <Button
                type="button"
                onClick={onApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Approve &amp; issue certificate
              </Button>
            </div>
          </div>
        )}

        {!showActions && (
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
