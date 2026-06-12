'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendBulkReachCertificatesEmailAction } from '@/actions/reach';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TableColumnFilter } from '@/components/ui/TableColumnFilter';
import { TableDateRangeFilter, type DateRangeValue } from '@/components/ui/TableDateRangeFilter';
import { TableDataExport } from '@/components/TableDataExport';
import { formatDisplayDate, matchesDateRange } from '@/lib/date-filter';
import type { CsvColumn } from '@/lib/export-csv';
import {
  getReachCertificateStatus,
  isActiveReachCertificate,
} from '@/lib/reach-certificate';
import { toast } from '@/store/toast';
import {
  Building,
  Eye,
  FlaskConical,
  Mail,
  RotateCcw,
} from 'lucide-react';

export type RcCertificateListRow = {
  id: string;
  client_id: string;
  chemical_id: string | null;
  certificate_number: string;
  registration_number: string | null;
  issued_at: string;
  expires_at: string | null;
  status: string;
  mail_sent: boolean;
  mail_sent_at: string | null;
  clients: {
    id: string;
    company_name: string;
    email: string;
    uuid_number: string | null;
  } | null;
  chemicals: {
    chemical_name: string;
    cas_number: string;
    ec_number: string | null;
    tonnage_band: string | null;
  } | null;
};

const EMPTY_DATE_RANGE: DateRangeValue = { from: '', to: '' };

const INITIAL_FILTERS = {
  company: '',
  certificate: '',
  registration: '',
  substance: '',
  status: 'all',
  issuedDate: { ...EMPTY_DATE_RANGE },
  validatedDate: { ...EMPTY_DATE_RANGE },
};

function matchesText(haystack: string, needle: string) {
  if (!needle.trim()) return true;
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

const EXPORT_COLUMNS: CsvColumn<RcCertificateListRow>[] = [
  { header: 'Certificate No.', value: (row) => row.certificate_number },
  { header: 'Registration No.', value: (row) => row.registration_number },
  { header: 'Company', value: (row) => row.clients?.company_name },
  { header: 'Client Email', value: (row) => row.clients?.email },
  { header: 'UUID', value: (row) => row.clients?.uuid_number },
  { header: 'Chemical', value: (row) => row.chemicals?.chemical_name },
  { header: 'CAS Number', value: (row) => row.chemicals?.cas_number },
  { header: 'EC Number', value: (row) => row.chemicals?.ec_number },
  { header: 'Issued Date', value: (row) => formatDisplayDate(row.issued_at) },
  { header: 'Expiry Date', value: (row) => formatDisplayDate(row.expires_at) },
  {
    header: 'Status',
    value: (row) => (isActiveReachCertificate(row) ? 'Valid' : getReachCertificateStatus(row)),
  },
  { header: 'Mail Sent', value: (row) => (row.mail_sent ? 'Yes' : 'No') },
  { header: 'Last Mail Sent', value: (row) => formatDisplayDate(row.mail_sent_at) },
];

interface RcCertificatesDashboardProps {
  initialCertificates: RcCertificateListRow[];
}

export default function RcCertificatesDashboard({
  initialCertificates,
}: RcCertificatesDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [certificates] = useState(initialCertificates);
  const [columnFilters, setColumnFilters] = useState(INITIAL_FILTERS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredCertificates = useMemo(() => {
    return certificates.filter((cert) => {
      if (!matchesText(cert.clients?.company_name || '', columnFilters.company)) return false;
      if (!matchesText(cert.certificate_number || '', columnFilters.certificate)) return false;
      if (!matchesText(cert.registration_number || '', columnFilters.registration)) return false;

      const substanceHaystack = [
        cert.chemicals?.chemical_name || '',
        cert.chemicals?.cas_number || '',
        cert.chemicals?.ec_number || '',
      ].join(' ');
      if (!matchesText(substanceHaystack, columnFilters.substance)) return false;

      if (columnFilters.status !== 'all') {
        const certStatus = isActiveReachCertificate(cert)
          ? 'valid'
          : getReachCertificateStatus(cert);
        if (certStatus !== columnFilters.status) return false;
      }

      if (
        !matchesDateRange(
          cert.issued_at,
          columnFilters.issuedDate.from,
          columnFilters.issuedDate.to
        )
      ) {
        return false;
      }

      if (
        !matchesDateRange(
          cert.expires_at,
          columnFilters.validatedDate.from,
          columnFilters.validatedDate.to
        )
      ) {
        return false;
      }

      return true;
    });
  }, [certificates, columnFilters]);

  const filteredIds = useMemo(
    () => filteredCertificates.map((cert) => cert.id),
    [filteredCertificates]
  );

  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const selectedByClient = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const id of selectedIds) {
      const cert = certificates.find((row) => row.id === id);
      if (!cert?.client_id) continue;
      const list = map.get(cert.client_id) || [];
      list.push(id);
      map.set(cert.client_id, list);
    }
    return map;
  }, [selectedIds, certificates]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (columnFilters.company.trim()) count++;
    if (columnFilters.certificate.trim()) count++;
    if (columnFilters.registration.trim()) count++;
    if (columnFilters.substance.trim()) count++;
    if (columnFilters.status !== 'all') count++;
    if (columnFilters.issuedDate.from || columnFilters.issuedDate.to) count++;
    if (columnFilters.validatedDate.from || columnFilters.validatedDate.to) count++;
    return count;
  }, [columnFilters]);

  const updateColumnFilter = <K extends keyof typeof columnFilters>(
    key: K,
    value: (typeof columnFilters)[K]
  ) => {
    setColumnFilters((current) => ({ ...current, [key]: value }));
  };

  const clearAllFilters = () => {
    setColumnFilters({
      company: '',
      certificate: '',
      registration: '',
      substance: '',
      status: 'all',
      issuedDate: { ...EMPTY_DATE_RANGE },
      validatedDate: { ...EMPTY_DATE_RANGE },
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds(allFilteredSelected ? [] : [...filteredIds]);
  };

  const handleBulkSendMail = () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one RC certificate.');
      return;
    }

    if (selectedByClient.size > 1) {
      toast.error('Select certificates from one client only for bulk email send.');
      return;
    }

    const [[clientId, certIds]] = selectedByClient.entries();
    startTransition(async () => {
      const res = await sendBulkReachCertificatesEmailAction(clientId, certIds);
      if (res.success) {
        toast.success(res.message || 'RC certificates sent successfully.');
        setSelectedIds([]);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to send RC certificates.');
      }
    });
  };

  return (
    <div className="space-y-8 animate-slide-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">RC Certificates</h1>
          <p className="text-sm text-slate-500 font-medium">
            All REACH Compliance Certificates across clients — filter, select, export, or send by email.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.length > 0 && selectedByClient.size === 1 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-teal-200 text-teal-800 hover:bg-teal-50"
              onClick={handleBulkSendMail}
              disabled={isPending}
              isLoading={isPending}
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Send Mail ({selectedIds.length})
            </Button>
          )}
          <TableDataExport
            filename="rc-certificates"
            columns={EXPORT_COLUMNS}
            filteredRows={filteredCertificates}
            selectedIds={selectedIds}
            getRowId={(row) => row.id}
          />
        </div>
      </div>

      <Card className="border-slate-100 overflow-hidden">
        {(activeFilterCount > 0 || selectedIds.length > 0) && (
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-600">
              Showing {filteredCertificates.length} of {certificates.length} certificates
              {activeFilterCount > 0 && (
                <span className="text-primary ml-1">
                  ({activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active)
                </span>
              )}
              {selectedIds.length > 0 && (
                <span className="text-teal-700 ml-2">· {selectedIds.length} selected</span>
              )}
            </p>
            {activeFilterCount > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={clearAllFilters} className="h-8 text-xs">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Clear filters
              </Button>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1280px]">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 align-top">
                <th className="p-3 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    disabled={filteredIds.length === 0}
                    aria-label="Select all filtered RC certificates"
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                </th>
                <th className="p-3 min-w-[150px]">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company</span>
                  <TableColumnFilter
                    value={columnFilters.company}
                    onChange={(value) => updateColumnFilter('company', value)}
                    placeholder="Filter company…"
                  />
                </th>
                <th className="p-3 min-w-[140px]">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Certificate No.</span>
                  <TableColumnFilter
                    value={columnFilters.certificate}
                    onChange={(value) => updateColumnFilter('certificate', value)}
                    placeholder="RC-2026…"
                  />
                </th>
                <th className="p-3 min-w-[140px]">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registration No.</span>
                  <TableColumnFilter
                    value={columnFilters.registration}
                    onChange={(value) => updateColumnFilter('registration', value)}
                    placeholder="Reg no…"
                  />
                </th>
                <th className="p-3 min-w-[180px]">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Substance</span>
                  <TableColumnFilter
                    value={columnFilters.substance}
                    onChange={(value) => updateColumnFilter('substance', value)}
                    placeholder="Name / CAS…"
                  />
                </th>
                <th className="p-3 min-w-[120px]">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Issued Date</span>
                  <TableDateRangeFilter
                    value={columnFilters.issuedDate}
                    onChange={(value) => updateColumnFilter('issuedDate', value)}
                  />
                </th>
                <th className="p-3 min-w-[120px]">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Validated Date</span>
                  <TableDateRangeFilter
                    value={columnFilters.validatedDate}
                    onChange={(value) => updateColumnFilter('validatedDate', value)}
                  />
                </th>
                <th className="p-3 min-w-[100px]">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</span>
                  <TableColumnFilter
                    type="select"
                    value={columnFilters.status}
                    onChange={(value) => updateColumnFilter('status', value)}
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'valid', label: 'Valid' },
                      { value: 'expired', label: 'Expired' },
                      { value: 'revoked', label: 'Revoked' },
                    ]}
                  />
                </th>
                <th className="p-3 min-w-[90px] text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                  Mail
                </th>
                <th className="p-3 min-w-[80px] text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                  View
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredCertificates.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    No RC certificates match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredCertificates.map((cert) => {
                  const isSelected = selectedIds.includes(cert.id);
                  const isValid = isActiveReachCertificate(cert);
                  const status = getReachCertificateStatus(cert);

                  return (
                    <tr
                      key={cert.id}
                      className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-teal-50/40' : ''}`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(cert.id)}
                          aria-label={`Select ${cert.certificate_number}`}
                          className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-emerald-50 text-primary flex items-center justify-center shrink-0">
                            <Building className="h-4 w-4" />
                          </div>
                          <div>
                            <Link
                              href={`/admin/clients/${cert.client_id}`}
                              className="font-bold text-slate-800 hover:text-primary hover:underline"
                            >
                              {cert.clients?.company_name || '—'}
                            </Link>
                            <div className="text-[10px] text-slate-400 font-medium">{cert.clients?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs font-bold text-teal-900">{cert.certificate_number}</td>
                      <td className="p-4 font-medium text-slate-700">{cert.registration_number || '—'}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-slate-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-800">{cert.chemicals?.chemical_name || '—'}</div>
                            <div className="text-xs text-slate-400 font-mono">{cert.chemicals?.cas_number}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{formatDisplayDate(cert.issued_at)}</td>
                      <td className="p-4 text-slate-600">{formatDisplayDate(cert.expires_at)}</td>
                      <td className="p-4">
                        <Badge
                          variant={isValid ? 'success' : status === 'expired' ? 'warning' : 'neutral'}
                          className="text-[10px] uppercase font-bold"
                        >
                          {isValid ? 'Valid' : status === 'expired' ? 'Expired' : cert.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant={cert.mail_sent ? 'success' : 'neutral'} className="text-[10px]">
                          {cert.mail_sent ? 'Sent' : 'Not sent'}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        {cert.chemical_id && (
                          <Link href={`/admin/clients/${cert.client_id}/rc-preview/${cert.chemical_id}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-teal-700 hover:bg-teal-50">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
