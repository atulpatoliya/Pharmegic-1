'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendCertificateEmailAction, resendCertificateEmailAction } from '@/actions/tcc';
import { buildCertificateRecipients } from '@/lib/certificate-email-recipients';
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
  Mail,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import {
  buildTccCertificateDocxPreviewUrl,
  buildTccCertificatePdfDownloadUrl,
} from '@/lib/tcc-certificate-download';
import { CertificatePdfDownloadLink } from '@/components/CertificatePdfDownloadLink';
import { toast } from '@/store/toast';

export interface TccViewCertificate {
  id: string;
  certificate_number: string;
  file_url: string | null;
  issued_at: string;
  mail_sent?: boolean;
  mail_sent_at?: string | null;
  mail_resend_count?: number;
  last_resend_at?: string | null;
}

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
  certificates?: TccViewCertificate | TccViewCertificate[] | null;
}

export type TccEmailDefaults = {
  adminCcEmails?: string | null;
  adminBccEmails?: string | null;
  contactEmails?: string[];
};

function resolveCertificate(app: TccViewApplication): TccViewCertificate | null {
  const c = app.certificates;
  if (!c) return null;
  if (Array.isArray(c)) return c[0] ?? null;
  return c;
}

function formatEmailList(emails: string[]): string {
  return emails.length > 0 ? emails.join(', ') : '—';
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
  allowReview?: boolean;
  emailDefaults?: TccEmailDefaults;
}

export function TccApplicationViewDialog({
  app,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onRequestChanges,
  getStatusBadge,
  allowReview = true,
  emailDefaults,
}: TccApplicationViewDialogProps) {
  const router = useRouter();
  const [isSending, startSendTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();
  const [mailState, setMailState] = useState({
    mail_sent: false,
    mail_sent_at: null as string | null,
    mail_resend_count: 0,
    last_resend_at: null as string | null,
  });

  const cert = app ? resolveCertificate(app) : null;

  useEffect(() => {
    if (!cert) return;
    setMailState({
      mail_sent: cert.mail_sent ?? false,
      mail_sent_at: cert.mail_sent_at ?? null,
      mail_resend_count: cert.mail_resend_count ?? 0,
      last_resend_at: cert.last_resend_at ?? null,
    });
  }, [
    cert?.id,
    cert?.mail_sent,
    cert?.mail_sent_at,
    cert?.mail_resend_count,
    cert?.last_resend_at,
  ]);

  const mailRecipients = useMemo(() => {
    if (!app?.clients.email) return null;
    return buildCertificateRecipients({
      primaryEmail: app.clients.email,
      contactEmails: emailDefaults?.contactEmails,
      adminCcEmails: emailDefaults?.adminCcEmails,
      adminBccEmails: emailDefaults?.adminBccEmails,
    });
  }, [app?.clients.email, emailDefaults]);

  if (!app) return null;

  const availableQuota =
    app.client_chemicals?.available_quantity ?? app.chemicals.available_quantity;
  const showActions = allowReview && canReviewActions(app.status);
  const boUrl = app.bo_attachment_url;
  const totalSent = mailState.mail_resend_count + (mailState.mail_sent ? 1 : 0);

  const handleSendMail = () => {
    if (!cert?.id) return;
    startSendTransition(async () => {
      const res = await sendCertificateEmailAction(cert.id);
      if (res.success) {
        const now = new Date().toISOString();
        setMailState({
          mail_sent: true,
          mail_sent_at: now,
          mail_resend_count: 0,
          last_resend_at: null,
        });
        toast.success(res.message || 'Certificate email sent successfully.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to send email.');
      }
    });
  };

  const handleResendMail = () => {
    if (!cert?.id) return;
    startResendTransition(async () => {
      const res = await resendCertificateEmailAction(cert.id);
      if (res.success) {
        const now = new Date().toISOString();
        setMailState((prev) => ({
          ...prev,
          mail_resend_count: prev.mail_resend_count + 1,
          last_resend_at: now,
        }));
        toast.success(res.message || 'Certificate email resent.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to resend email.');
      }
    });
  };

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
            {cert?.id ? (
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <CertificatePdfDownloadLink
                      pdfUrl={buildTccCertificatePdfDownloadUrl(cert.id)}
                      docxUrl={buildTccCertificateDocxPreviewUrl(cert.id)}
                      fileName={`${cert.certificate_number}.pdf`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-60"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download PDF
                    </CertificatePdfDownloadLink>
                    {!mailState.mail_sent ? (
                      <Button
                        onClick={handleSendMail}
                        isLoading={isSending}
                        disabled={isSending}
                        size="sm"
                        className="gap-1.5 h-8"
                      >
                        <Mail className="h-3.5 w-3.5" /> Send Mail To Client
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-[10px] font-bold text-emerald-700">
                            Sent {totalSent > 1 ? `(${totalSent}x)` : ''}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleResendMail}
                          isLoading={isResending}
                          disabled={isResending}
                          size="sm"
                          className="gap-1.5 h-8"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Resend Mail
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {mailState.mail_sent && mailRecipients && (
                  <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 text-xs font-medium text-blue-700 space-y-1">
                    <p>
                      <strong>TO:</strong> {mailRecipients.to}
                    </p>
                    <p>
                      <strong>CC:</strong> {formatEmailList(mailRecipients.cc)}
                    </p>
                    <p>
                      <strong>BCC:</strong> {formatEmailList(mailRecipients.bcc)}
                    </p>
                    {mailState.mail_sent_at && (
                      <p className="pt-1 border-t border-blue-100 mt-2">
                        <strong>First sent:</strong> {new Date(mailState.mail_sent_at).toLocaleString()}
                      </p>
                    )}
                    {mailState.mail_resend_count > 0 && mailState.last_resend_at && (
                      <p>
                        <strong>Last resent:</strong> {new Date(mailState.last_resend_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <ReachCertificateDocxViewer docxUrl={buildTccCertificateDocxPreviewUrl(cert.id)} />
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
