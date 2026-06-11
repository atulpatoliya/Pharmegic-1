'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendCertificateEmailAction, resendCertificateEmailAction } from '@/actions/tcc';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/store/toast';
import {
  Download, ArrowLeft, Mail, RefreshCw, CheckCircle2,
  Building, FlaskConical, Calendar, FileText, Shield, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
import {
  buildReachCertificateDocxPreviewUrl,
  buildReachCertificatePdfDownloadUrl,
} from '@/lib/reach-certificate-download';
import {
  buildTccCertificateDocxPreviewUrl,
  buildTccCertificatePdfDownloadUrl,
} from '@/lib/tcc-certificate-download';
import { CertificatePdfDownloadLink } from '@/components/CertificatePdfDownloadLink';
import { CertificateMailHistoryList } from '@/components/CertificateMailHistoryList';

interface CertificatePreviewClientProps {
  cert: {
    id: string;
    client_id?: string | null;
    certificate_number: string;
    type?: string | null;
    file_url: string;
    issued_at: string;
    expires_at: string;
    status: string;
    mail_sent: boolean;
    mail_sent_at: string | null;
    mail_resend_count: number;
    last_resend_at: string | null;
    clients: {
      company_name: string;
      legal_name: string | null;
      email: string;
      registration_number: string | null;
    };
    chemicals?: {
      chemical_name: string;
      cas_number: string;
      ec_number: string | null;
      tonnage_band: string | null;
    } | null;
    tcc_applications?: {
      quantity_mt: number;
      kkdik_reg_no: string | null;
      export_date: string | null;
      chemicals: {
        chemical_name: string;
        cas_number: string;
        ec_number: string | null;
        tonnage_band: string | null;
      };
    } | null;
  };
  mailSentHistory?: string[];
}

export default function CertificatePreviewClient({
  cert,
  mailSentHistory = [],
}: CertificatePreviewClientProps) {
  const router = useRouter();
  const [isSending, startSendTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();

  const isReach = cert.type === 'REACH';
  const chemical = cert.chemicals || cert.tcc_applications?.chemicals;
  const backHref =
    isReach && cert.client_id
      ? `/admin/clients/${cert.client_id}/rc-certificates`
      : '/admin/approvals';

  const totalSent = cert.mail_resend_count + (cert.mail_sent ? 1 : 0);

  const handleSendMail = () => {
    startSendTransition(async () => {
      const res = await sendCertificateEmailAction(cert.id);
      if (res.success) {
        toast.success(res.message || 'Certificate email sent successfully.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to send email.');
      }
    });
  };

  const handleResendMail = () => {
    startResendTransition(async () => {
      const res = await resendCertificateEmailAction(cert.id);
      if (res.success) {
        toast.success(res.message || 'Certificate email resent.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to resend email.');
      }
    });
  };

  const accentColor = '#064e3b';

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              {isReach ? 'REACH Certificate Preview' : 'Certificate Preview'}
              <span className="font-mono text-primary text-base">{cert.certificate_number}</span>
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              {isReach
                ? 'REACH Compliance Certificate — valid for 1 year. Required before TCC application.'
                : 'TCC Import Certificate — review and send to the client'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Download */}
          <CertificatePdfDownloadLink
            pdfUrl={
              isReach
                ? buildReachCertificatePdfDownloadUrl(cert.id)
                : buildTccCertificatePdfDownloadUrl(cert.id)
            }
            docxUrl={
              isReach
                ? buildReachCertificateDocxPreviewUrl(cert.id)
                : buildTccCertificateDocxPreviewUrl(cert.id)
            }
            fileName={`${cert.certificate_number}.pdf`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors disabled:opacity-60"
          >
            <Download className="h-4 w-4" /> Download PDF
          </CertificatePdfDownloadLink>

          {/* Send / Resend — TCC only */}
          {!isReach && (
            !cert.mail_sent ? (
              <Button onClick={handleSendMail} isLoading={isSending} disabled={isSending} className="gap-1.5">
                <Mail className="h-4 w-4" /> Send Mail To Client
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700">
                    Sent {totalSent > 1 ? `(${totalSent}x)` : ''}
                  </span>
                </div>
                <Button variant="outline" onClick={handleResendMail} isLoading={isResending} disabled={isResending} size="sm" className="gap-1.5">
                  <RefreshCw className="h-4 w-4" /> Resend Mail
                </Button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Email History */}
      {cert.mail_sent && !isReach && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs font-medium text-blue-700 space-y-0.5 w-full">
            <CertificateMailHistoryList timestamps={mailSentHistory} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Certificate Details Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Client Info */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-800">Client Information</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Company</p>
                <p className="font-semibold text-slate-800">{cert.clients.company_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Email</p>
                <p className="font-medium text-slate-600">{cert.clients.email}</p>
              </div>
            </div>
          </div>

          {/* Chemical Info */}
          {chemical && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <FlaskConical className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-slate-800">
                  {isReach ? 'REACH Substance Details' : 'Chemical & Application'}
                </h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Substance</p>
                  <p className="font-semibold text-slate-800">{chemical.chemical_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">CAS Number</p>
                    <p className="font-mono font-semibold text-slate-700">{chemical.cas_number}</p>
                  </div>
                  {chemical.ec_number && (
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">EC Number</p>
                      <p className="font-mono font-semibold text-slate-700">{chemical.ec_number}</p>
                    </div>
                  )}
                </div>
                {!isReach && cert.tcc_applications && (
                  <>
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Quantity</p>
                      <p className="text-lg font-black text-slate-800">{cert.tcc_applications.quantity_mt} MT</p>
                    </div>
                    {cert.tcc_applications.kkdik_reg_no && (
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">KKDIK Reg. No</p>
                        <p className="font-mono font-semibold text-slate-700">{cert.tcc_applications.kkdik_reg_no}</p>
                      </div>
                    )}
                  </>
                )}
                {isReach && chemical.tonnage_band && (
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Tonnage Band</p>
                    <p className="font-semibold text-slate-700">{chemical.tonnage_band}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Certificate Validity */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Calendar className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-800">Validity</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Issue Date</p>
                <p className="font-semibold text-slate-800">{new Date(cert.issued_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Expiry Date</p>
                <p className="font-semibold text-slate-800">
                  {cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={cert.status === 'active' ? 'success' : 'warning'}>
                {cert.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* PDF Preview */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-slate-100">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-800">Certificate Document Preview</h3>
            </div>
            {cert.id ? (
              <ReachCertificateDocxViewer docxUrl={buildTccCertificateDocxPreviewUrl(cert.id)} />
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <Shield className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">Certificate preview not available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
