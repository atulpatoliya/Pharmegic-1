'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendBulkReachCertificatesEmailAction } from '@/actions/reach';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/toast';
import { Mail } from 'lucide-react';
import RcCertificatesTable, { type RcCertificateTableRecord } from '@/components/RcCertificatesTable';

export type RcCertificateListRow = RcCertificateTableRecord;

interface RcCertificatesDashboardProps {
  initialCertificates: RcCertificateListRow[];
  tccHistory?: any[];
}

export default function RcCertificatesDashboard({
  initialCertificates,
  tccHistory,
}: RcCertificatesDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [certificates] = useState(initialCertificates);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [, setFilteredRows] = useState<RcCertificateListRow[]>(initialCertificates);

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

  const extraActions = useMemo(() => {
    if (selectedIds.length > 0 && selectedByClient.size === 1) {
      return (
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
      );
    }
    return null;
  }, [selectedIds, selectedByClient, isPending]);

  return (
    <div className="space-y-6">
      <RcCertificatesTable
        certificates={certificates}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onFilteredRowsChange={setFilteredRows as any}
        tccHistory={tccHistory}
        title="RC Compliance Certificates (Year-wise)"
        description="Manage issue/expiry dates & remaining quota per year | Expired certificates retain quantity for TCC applications using old date."
        extraActions={extraActions}
        exportFilename="rc-certificates"
      />
    </div>
  );
}
