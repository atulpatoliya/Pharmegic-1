'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { computeTccQuotaForExportDate } from '@/lib/quota';
import type { TccExportRecord } from '@/lib/quota';
import type { ReachCertificateRecord } from '@/lib/reach-certificate';
import { useRouter } from 'next/navigation';
import { applyForTccAction, updateTccApplicationAction } from '@/actions/tcc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { DatePicker } from './ui/DatePicker';
import { Select } from './ui/Select';
import { toast } from '@/store/toast';
import {
  FileText,
  AlertCircle,
  FlaskConical,
  Scale,
  CheckCircle,
  ArrowRight,
  Info,
  Paperclip,
  Building2,
} from 'lucide-react';
import { ModalErrorBox } from './ui/ModalErrorBox';
import { FormLabel } from './ui/FormLabel';

interface ReachCertificateInfo {
  id: string;
  certificate_number: string;
  issued_at: string;
  expires_at: string | null;
  file_url?: string | null;
  status: 'valid' | 'expired' | 'revoked' | 'missing';
}

interface Substance {
  id: string;
  chemical_name: string;
  cas_number: string;
  ec_number: string | null;
  tonnage_band: string | null;
  validity_date: string | null;
  available_quantity: number;
  has_reach_history?: boolean;
  reach_certificates?: ReachCertificateInfo[];
}

export interface TccApplicationEditData {
  id: string;
  chemical_id: string;
  quantity_mt: number;
  export_date: string | null;
  eu_importer_company_name: string | null;
  eu_importer_address: string | null;
  purchase_order_number: string | null;
  invoice_number: string | null;
  bo_attachment_url?: string | null;
  bo_attachment_name?: string | null;
}

interface TccApplicationFormProps {
  authorizedSubstances: Substance[];
  approvedExports?: TccExportRecord[];
  editApplication?: TccApplicationEditData | null;
}

function formatDateInput(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function TccApplicationForm({
  authorizedSubstances,
  approvedExports = [],
  editApplication = null,
}: TccApplicationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(editApplication?.id);

  const [chemicalId, setChemicalId] = useState(editApplication?.chemical_id ?? '');
  const [quantity, setQuantity] = useState(
    editApplication ? String(editApplication.quantity_mt) : ''
  );
  const [exportDate, setExportDate] = useState(formatDateInput(editApplication?.export_date));
  const [euImporterCompanyName, setEuImporterCompanyName] = useState(
    editApplication?.eu_importer_company_name?.trim() ?? ''
  );
  const [euImporterAddress, setEuImporterAddress] = useState(
    editApplication?.eu_importer_address ?? ''
  );
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(
    editApplication?.purchase_order_number ?? ''
  );
  const [invoiceNumber, setInvoiceNumber] = useState(editApplication?.invoice_number ?? '');
  const [boFile, setBoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!editApplication) return;
    setChemicalId(editApplication.chemical_id);
    setQuantity(String(editApplication.quantity_mt));
    setExportDate(formatDateInput(editApplication.export_date));
    setEuImporterCompanyName(editApplication.eu_importer_company_name?.trim() ?? '');
    setEuImporterAddress(editApplication.eu_importer_address ?? '');
    setPurchaseOrderNumber(editApplication.purchase_order_number ?? '');
    setInvoiceNumber(editApplication.invoice_number ?? '');
    setBoFile(null);
    setError(null);
  }, [editApplication]);

  const selectedSubstance = authorizedSubstances.find((s) => s.id === chemicalId);

  const quotaContext = useMemo(() => {
    if (!selectedSubstance || !exportDate) return null;
    const reachRecords: ReachCertificateRecord[] = (selectedSubstance.reach_certificates ?? []).map(
      (cert) => ({
        id: cert.id,
        certificate_number: cert.certificate_number,
        chemical_id: selectedSubstance.id,
        issued_at: cert.issued_at,
        expires_at: cert.expires_at,
        status: cert.status === 'revoked' ? 'revoked' : cert.status === 'valid' ? 'active' : 'expired',
        file_url: cert.file_url ?? null,
        type: 'REACH',
      })
    );

    return computeTccQuotaForExportDate({
      reachCertificates: reachRecords,
      approvedApplications: approvedExports,
      chemicalId: selectedSubstance.id,
      exportDate,
      tonnageBand: selectedSubstance.tonnage_band,
      excludeApplicationId: editApplication?.id,
    });
  }, [selectedSubstance, exportDate, approvedExports, editApplication?.id]);

  const matchedReachCert = quotaContext?.reachCert ?? null;
  const initialQuota = quotaContext?.remainingQuota ?? 0;
  const requestedAmt = Number(quantity) || 0;
  const finalQuota = initialQuota - requestedAmt;
  const quotaExceeded = requestedAmt > 0 && requestedAmt > initialQuota;
  const noQuotaLeft =
    selectedSubstance != null && exportDate !== '' && quotaContext != null && initialQuota <= 0;
  const noReachForExportDate =
    selectedSubstance != null && exportDate !== '' && quotaContext != null && !matchedReachCert;
  const eligibleSubstances = authorizedSubstances.filter((s) => s.has_reach_history);
  const hasExistingBo = Boolean(editApplication?.bo_attachment_url);

  const handleChemicalChange = (value: string) => {
    setChemicalId(value);
    setError(null);
  };

  const handleExportDateChange = (value: string) => {
    setExportDate(value);
    setError(null);
    if (selectedSubstance && quantity && exportDate) {
      const substance = authorizedSubstances.find((s) => s.id === chemicalId);
      if (!substance) return;
      const reachRecords: ReachCertificateRecord[] = (substance.reach_certificates ?? []).map(
        (cert) => ({
          id: cert.id,
          certificate_number: cert.certificate_number,
          chemical_id: substance.id,
          issued_at: cert.issued_at,
          expires_at: cert.expires_at,
          status: cert.status === 'revoked' ? 'revoked' : cert.status === 'valid' ? 'active' : 'expired',
          type: 'REACH',
        })
      );
      const next = computeTccQuotaForExportDate({
        reachCertificates: reachRecords,
        approvedApplications: approvedExports,
        chemicalId: substance.id,
        exportDate: value,
        tonnageBand: substance.tonnage_band,
        excludeApplicationId: editApplication?.id,
      });
      if (quantity && Number(quantity) > next.remainingQuota) {
        setQuantity('');
      }
    }
  };

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    if (error?.includes('quota') || error?.includes('Quantity exceeds')) {
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!chemicalId) {
      setError('Please select an authorized chemical substance.');
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setError('Please specify a positive quantity in metric tons (MT).');
      return;
    }

    if (!exportDate) {
      setError('Expected export shipment date is required.');
      return;
    }

    if (noReachForExportDate) {
      setError(
        quotaContext?.error ||
          'No Active RC Certificate Available.'
      );
      return;
    }

    if (noQuotaLeft) {
      setError('No remaining quota for this RC validity period. Contact your administrator.');
      return;
    }

    if (selectedSubstance && Number(quantity) > initialQuota) {
      setError(`Quantity exceeds available quota. Maximum allowed: ${initialQuota} MT.`);
      return;
    }

    if (!euImporterCompanyName.trim()) {
      setError('EU importer company name is required.');
      return;
    }

    if (!euImporterAddress.trim()) {
      setError('EU importer address is required.');
      return;
    }

    if (!purchaseOrderNumber.trim()) {
      setError('Purchase order number is required.');
      return;
    }

    if (!boFile && !hasExistingBo) {
      setError('PO attachment is required.');
      return;
    }

    if (selectedSubstance?.validity_date) {
      const expiry = new Date(selectedSubstance.validity_date);
      const shipment = new Date(exportDate);
      if (shipment > expiry) {
        setError(`The expected export date exceeds the substance validity date (${expiry.toLocaleDateString()}).`);
        return;
      }
    }

    startTransition(async () => {
      const payload = new FormData();
      if (isEditing && editApplication) {
        payload.append('application_id', editApplication.id);
      }
      payload.append('chemical_id', chemicalId);
      payload.append('quantity_mt', quantity);
      payload.append('export_date', exportDate);
      payload.append('eu_importer_company_name', euImporterCompanyName.trim());
      payload.append('eu_importer_address', euImporterAddress.trim());
      payload.append('purchase_order_number', purchaseOrderNumber.trim());
      payload.append('invoice_number', invoiceNumber.trim());
      if (boFile) {
        payload.append('bo_attachment', boFile);
      }

      const res = isEditing
        ? await updateTccApplicationAction(null, payload)
        : await applyForTccAction(null, payload);

      if (res.success) {
        toast.success(res.message || (isEditing ? 'Application updated.' : 'TCC application submitted.'));
        router.push('/client');
      } else {
        setError(typeof res.error === 'string' ? res.error : 'Failed to save application.');
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-slide-in">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Tonnage Compliance Declaration</h1>
        <p className="text-sm text-slate-500 font-medium">
          {isEditing
            ? 'Update your TCC application. Changes are allowed until the administrator approves it.'
            : 'Apply for an official TCC permit. A valid REACH Compliance Certificate (1-year validity) is required per substance before TCC application.'}
        </p>
      </div>

      {eligibleSubstances.length === 0 && !isEditing && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 font-medium flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">REACH Compliance Certificate Required</p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              No substances are eligible for TCC application. Each chemical must have an active REACH Compliance Certificate issued by your administrator (valid for 1 year).
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-8 grid-cols-1 md:grid-cols-5">
        <div className="md:col-span-3">
          <Card className="border-slate-100 shadow-xs">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <FileText className="h-5 w-5" />
                <CardTitle>Application Form</CardTitle>
              </div>
              <CardDescription>Enter correct regulatory and chemical data.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-teal-700" />
                    EU Importer Information
                  </h3>

                  <div className="space-y-2">
                    <FormLabel required>Company Name</FormLabel>
                    <Input
                      type="text"
                      name="eu_importer_company_name"
                      value={euImporterCompanyName}
                      onChange={(e) => setEuImporterCompanyName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <FormLabel required>Address</FormLabel>
                    <Input
                      type="text"
                      name="eu_importer_address"
                      value={euImporterAddress}
                      onChange={(e) => setEuImporterAddress(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <FormLabel required>Purchase Order Number</FormLabel>
                    <Input
                      type="text"
                      name="purchase_order_number"
                      value={purchaseOrderNumber}
                      onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <FormLabel>Invoice Number</FormLabel>
                    <Input
                      type="text"
                      name="invoice_number"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel required>Chemical Substance</FormLabel>
                  <Select
                    value={chemicalId}
                    onChange={(e) => handleChemicalChange(e.target.value)}
                    options={[
                      { value: '', label: 'Select authorized substance...' },
                      ...authorizedSubstances.map((s) => {
                        const hasRc = (s.reach_certificates?.length ?? 0) > 0;
                        let label = `${s.chemical_name} (CAS: ${s.cas_number})`;
                        if (!hasRc) {
                          label += ' — RC certificate required';
                        }
                        return {
                          value: s.id,
                          label,
                          disabled: !hasRc,
                        };
                      }),
                    ]}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel required>Expected Export Shipment Date</FormLabel>
                  <DatePicker
                    value={exportDate}
                    onChange={handleExportDateChange}
                    required
                  />
                  {matchedReachCert && (
                    <p className="text-[10px] text-slate-500 font-medium">
                      RC period:{' '}
                      <span className="font-bold text-slate-700">
                        {new Date(matchedReachCert.issued_at).toLocaleDateString()} –{' '}
                        {matchedReachCert.expires_at
                          ? new Date(matchedReachCert.expires_at).toLocaleDateString()
                          : 'N/A'}
                      </span>{' '}
                      ({matchedReachCert.certificate_number})
                    </p>
                  )}
                  {noReachForExportDate && (
                    <p className="text-[11px] text-rose-600 font-semibold">
                      No RC certificate covers this export date.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <FormLabel required>Export Tonnage (Metric Tons - MT)</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={exportDate && initialQuota > 0 ? initialQuota : undefined}
                    placeholder={
                      exportDate && initialQuota > 0 ? `Max ${initialQuota} MT` : 'e.g. 25.50'
                    }
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    disabled={(noQuotaLeft || noReachForExportDate || !exportDate) && !isEditing}
                    required
                  />
                  {selectedSubstance && exportDate && matchedReachCert && (
                    <p className="text-[10px] text-slate-500 font-medium">
                      Available for this RC period:{' '}
                      <span className="font-bold text-slate-700">{initialQuota} MT</span>
                    </p>
                  )}
                  {quotaExceeded && (
                    <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Request exceeds available quota by {(requestedAmt - initialQuota).toFixed(2)} MT.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <FormLabel required={!hasExistingBo}>
                    PO Attachment{hasExistingBo ? ' (replace optional)' : ''}
                  </FormLabel>
                  {hasExistingBo && (
                    <p className="text-[11px] text-slate-500 font-medium">
                      Current file:{' '}
                      <a
                        href={editApplication?.bo_attachment_url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-700 hover:underline"
                      >
                        {editApplication?.bo_attachment_name || 'View attachment'}
                      </a>
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-md bg-white cursor-pointer hover:bg-slate-50 text-sm text-slate-600">
                      <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="truncate">{boFile ? boFile.name : 'Choose file...'}</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*,application/pdf"
                        onChange={(e) => setBoFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Image, PDF, Word, Excel, or PowerPoint (max 10 MB)
                    </p>
                  </div>
                </div>

                <ModalErrorBox message={error} title="Application Error" />

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/client')}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isPending}
                    disabled={
                      isPending ||
                      quotaExceeded ||
                      (noQuotaLeft && !isEditing) ||
                      noReachForExportDate ||
                      !exportDate ||
                      !quantity ||
                      Number(quantity) <= 0
                    }
                  >
                    {isEditing ? 'Save Changes' : 'Submit Application'}{' '}
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="h-4 w-4 text-slate-400" /> Tonnage Quota Calculator
          </h3>

          <Card className="border-slate-100 bg-slate-50/50">
            <CardContent className="p-5 space-y-6 text-sm">
              {selectedSubstance ? (
                <>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Selected Chemical</span>
                    <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <FlaskConical className="h-4 w-4 text-emerald-600 shrink-0" />
                      {selectedSubstance.chemical_name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">CAS Number</span>
                      <span className="font-mono text-slate-700 font-bold text-xs">{selectedSubstance.cas_number}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">EC Number</span>
                      <span className="font-mono text-slate-700 font-bold text-xs">{selectedSubstance.ec_number || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Quota Simulation</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-500">Current Available:</span>
                        <span className="font-bold text-slate-800">{initialQuota} MT</span>
                      </div>
                      <div className="flex justify-between font-medium text-rose-600">
                        <span className="flex items-center gap-1">
                          <Scale className="h-3.5 w-3.5" /> Requested:
                        </span>
                        <span className="font-bold">- {requestedAmt} MT</span>
                      </div>
                      <div className="border-t border-dashed border-slate-200 my-2" />
                      <div className={`flex justify-between font-bold ${quotaExceeded ? 'text-rose-600' : 'text-primary'}`}>
                        <span>Projected Balance:</span>
                        <span>{quotaExceeded ? 'Quota exceeded' : `${Math.max(0, finalQuota)} MT`}</span>
                      </div>
                      {quotaExceeded && (
                        <p className="text-[10px] text-rose-600 font-semibold">
                          Only {initialQuota} MT remaining — reduce requested tonnage to continue.
                        </p>
                      )}
                    </div>
                  </div>

                  {!exportDate ? (
                    <div className="p-3 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex gap-2 items-start">
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p>Select export shipment date</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                          Quota is calculated from the RC certificate period that matches your export date.
                          A 2025 export uses 2025 RC quota; a 2026 export uses the 2026 RC certificate.
                        </p>
                      </div>
                    </div>
                  ) : noReachForExportDate ? (
                    <div className="p-3 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg text-xs font-semibold flex gap-2 items-start">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p>No RC Certificate For This Date</p>
                        <p className="text-[10px] text-amber-700 mt-0.5 font-medium">
                          {quotaContext?.error ||
                            'Choose an export date within an issued RC validity period, or ask your administrator to issue a new RC certificate.'}
                        </p>
                      </div>
                    </div>
                  ) : quotaExceeded ? (
                    <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-xs font-semibold flex gap-2 items-start">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p>Quota Limit Exceeded</p>
                        <p className="text-[10px] text-rose-600 mt-0.5 font-medium">
                          You cannot request more than {initialQuota} MT for this RC validity period.
                        </p>
                      </div>
                    </div>
                  ) : noQuotaLeft && !isEditing ? (
                    <div className="p-3 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg text-xs font-semibold flex gap-2 items-start">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p>No Quota Remaining</p>
                        <p className="text-[10px] text-amber-700 mt-0.5 font-medium">
                          Annual tonnage limit fully used. Contact your administrator to renew allocation.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-xs font-semibold flex gap-2 items-start">
                      <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p>RC Period &amp; Quota Verified</p>
                        <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">
                          Using {matchedReachCert?.certificate_number} (
                          {matchedReachCert?.issued_at
                            ? new Date(matchedReachCert.issued_at).toLocaleDateString()
                            : '—'}{' '}
                          –{' '}
                          {matchedReachCert?.expires_at
                            ? new Date(matchedReachCert.expires_at).toLocaleDateString()
                            : '—'}
                          ). {initialQuota} MT available for this period.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-slate-400 font-semibold text-xs flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-8 w-8 text-slate-300" />
                  Select an authorized chemical substance to view the dynamic quota deduction simulation.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
