'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  issueReachCertificateFromPreviewAction,
  sendReachCertificateEmailAction,
  resendReachCertificateEmailAction,
} from '@/actions/reach';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { FormLabel } from '@/components/ui/FormLabel';
import { toast } from '@/store/toast';
import {
  ArrowLeft,
  Download,
  FileText,
  ShieldCheck,
  Mail,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import ReachCertificateDocxViewer from '@/components/ReachCertificateDocxViewer';
type ReachCertificatePreviewClientProps = {
  clientId: string;
  chemicalId: string;
  client: {
    company_name: string;
    email: string;
    uuid_number: string | null;
  };
  chemical: {
    chemical_name: string;
    cas_number: string;
    ec_number: string | null;
    tonnage_band: string | null;
  };
  cert: {
    id: string;
    certificate_number: string;
    registration_number: string | null;
    issued_at: string;
    expires_at: string | null;
    status: string;
    file_url: string | null;
    mail_sent: boolean;
    mail_sent_at: string | null;
    mail_resend_count: number;
    last_resend_at: string | null;
  } | null;
  defaults: {
    registrationNumber: string;
    issuedDate: string;
    validatedDate: string;
  };
  mailRecipients: {
    to: string;
    cc: string[];
    bcc: string[];
  } | null;
};

function formatEmailList(emails: string[]): string {
  return emails.length > 0 ? emails.join(', ') : '—';
}

export default function ReachCertificatePreviewClient({
  clientId,
  chemicalId,
  client,
  chemical,
  cert,
  defaults,
  mailRecipients,
}: ReachCertificatePreviewClientProps) {
  const router = useRouter();
  const [isIssuing, startIssueTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();
  const isPending = !cert;
  const totalSent = cert ? cert.mail_resend_count + (cert.mail_sent ? 1 : 0) : 0;

  const [registrationNumber, setRegistrationNumber] = useState(defaults.registrationNumber);
  const [issuedDate, setIssuedDate] = useState(defaults.issuedDate);
  const [validatedDate, setValidatedDate] = useState(defaults.validatedDate);

  const docxPreviewUrl = useMemo(() => {
    const params = new URLSearchParams({
      clientId,
      chemicalId,
      registrationNumber: registrationNumber.trim() || '—',
      issuedDate,
      validatedDate,
    });
    return `/api/reach-certificate/docx?${params.toString()}`;
  }, [clientId, chemicalId, registrationNumber, issuedDate, validatedDate]);

  const downloadHref = cert?.file_url || docxPreviewUrl;
  const downloadLabel = cert?.file_url ? 'Download PDF' : 'Download DOCX';

  const backHref = `/admin/clients/${clientId}/rc-certificates`;

  const handleIssue = () => {
    if (!registrationNumber.trim()) {
      toast.error('Registration number is required before issuing.');
      return;
    }
    if (!issuedDate || !validatedDate) {
      toast.error('Issued date and validated date are required.');
      return;
    }

    startIssueTransition(async () => {
      const res = await issueReachCertificateFromPreviewAction(clientId, chemicalId, {
        registrationNumber: registrationNumber.trim(),
        issuedDate,
        validatedDate,
      });
      if (res.success) {
        toast.success(res.message || 'RC Certificate issued successfully.');
        router.push(backHref);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to issue RC certificate.');
      }
    });
  };

  const handleSendMail = () => {
    if (!cert) return;
    startSendTransition(async () => {
      const res = await sendReachCertificateEmailAction(cert.id);
      if (res.success) {
        toast.success(res.message || 'Certificate email sent successfully.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to send email.');
      }
    });
  };

  const handleResendMail = () => {
    if (!cert) return;
    startResendTransition(async () => {
      const res = await resendReachCertificateEmailAction(cert.id);
      if (res.success) {
        toast.success(res.message || 'Certificate email resent.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to resend email.');
      }
    });
  };

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
              RC Certificate Review
              {cert ? (
                <span className="font-mono text-primary text-base">{cert.certificate_number}</span>
              ) : (
                <Badge variant="warning" className="text-[10px] uppercase font-bold">
                  Pending
                </Badge>
              )}
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              {client.company_name} · {chemical.chemical_name} — CT-2026 template preview
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={downloadHref}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
          >
            <Download className="h-4 w-4" /> {downloadLabel}
          </a>

          {!isPending && cert && (
            <>
            {!cert.mail_sent ? (
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
                <Button
                  variant="outline"
                  onClick={handleResendMail}
                  isLoading={isResending}
                  disabled={isResending}
                  size="sm"
                  className="gap-1.5"
                >
                  <RefreshCw className="h-4 w-4" /> Resend Mail
                </Button>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {cert?.mail_sent && mailRecipients && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs font-medium text-blue-700 space-y-1">
          <p>
            <strong>TO:</strong> {mailRecipients.to}
          </p>
          <p>
            <strong>CC:</strong> {formatEmailList(mailRecipients.cc)}
          </p>
          <p>
            <strong>BCC:</strong> {formatEmailList(mailRecipients.bcc)}
          </p>
          {cert.mail_sent_at && (
            <p className="pt-1 border-t border-blue-100 mt-2">
              <strong>First sent:</strong> {new Date(cert.mail_sent_at).toLocaleString()}
            </p>
          )}
          {cert.mail_resend_count > 0 && cert.last_resend_at && (
            <p>
              <strong>Last resent:</strong> {new Date(cert.last_resend_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {isPending && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-800">Confirm details before issuing</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <FormLabel required>Registration Number</FormLabel>
              <Input
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="01-2119493908-18-0028"
              />
            </div>
            <div>
              <FormLabel required>Issued Date</FormLabel>
              <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
            </div>
            <div>
              <FormLabel required>Validated Date</FormLabel>
              <Input type="date" value={validatedDate} onChange={(e) => setValidatedDate(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Review the certificate preview below. Update fields if needed, then issue the RC certificate.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-slate-100">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-800">REACH Compliance Certificate (CT-2026)</h3>
        </div>
        <ReachCertificateDocxViewer key={docxPreviewUrl} docxUrl={docxPreviewUrl} />
      </div>

      {isPending && (
        <div className="flex justify-end">
          <Button
            onClick={handleIssue}
            isLoading={isIssuing}
            disabled={isIssuing}
            className="bg-teal-700 hover:bg-teal-800 gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            Issue RC Certificate
          </Button>
        </div>
      )}
    </div>
  );
}
