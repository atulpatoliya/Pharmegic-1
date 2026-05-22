'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  Award,
  Activity,
  FileText,
  Bell,
  CheckCircle,
  AlertTriangle,
  Download,
  ShieldCheck,
  FlaskConical,
  TrendingUp,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/store/toast';

interface Substance {
  id: string;
  chemical_name: string;
  cas_number: string;
  ec_number: string | null;
  tonnage_band: string | null;
  validity_date: string | null;
  available_quantity: number;
  exported_quantity: number;
}

interface Certificate {
  id: string;
  certificate_number: string;
  file_url: string;
  issued_at: string;
  expires_at: string;
  status: string;
  tcc_applications: {
    quantity_mt: number;
    chemicals: {
      chemical_name: string;
      cas_number: string;
    };
  };
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface ClientDashboardProps {
  stats: {
    activePermissions: number;
    totalExported: number;
    remainingQuota: number;
  };
  authorizedSubstances: Substance[];
  certificates: Certificate[];
  notifications: Notification[];
}

export default function ClientDashboard({
  stats,
  authorizedSubstances,
  certificates,
  notifications,
}: ClientDashboardProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleMarkAsRead = async (notifId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notifId);

      if (error) throw error;
      router.refresh();
    } catch (err: any) {
      toast.error('Failed to dismiss notification: ' + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
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

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Compliance Console</h1>
          <p className="text-sm text-slate-500 font-medium">
            Monitor substance export quotas, view official TCC certificates, and submit new compliance declarations.
          </p>
        </div>
        <Link href="/client/apply">
          <Button className="sm:self-start">
            <Layers className="h-4 w-4 mr-2" />
            Apply for Export Permit
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <Card className="border-slate-100 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600" />
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                Authorized Substances
              </span>
              <span className="text-2xl font-black text-slate-800 block">
                {stats.activePermissions}
              </span>
              <span className="text-[10px] text-slate-400 font-medium block">
                Permitted chemical structures mapped
              </span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
              <FlaskConical className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                Remaining Export Quota
              </span>
              <span className="text-2xl font-black text-slate-800 block">
                {stats.remainingQuota} MT
              </span>
              <span className="text-[10px] text-slate-400 font-medium block">
                Available compliance weight capacity
              </span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-sky-600" />
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                Total Quantity Dispatched
              </span>
              <span className="text-2xl font-black text-slate-800 block">
                {stats.totalExported} MT
              </span>
              <span className="text-[10px] text-slate-400 font-medium block">
                Cumulative weight authorized for export
              </span>
            </div>
            <div className="p-3 rounded-lg bg-sky-50 text-sky-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Substances Inventory and Right sidebar */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        
        {/* Authorized Substances Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <FlaskConical className="h-4 w-4 text-emerald-600" /> Permitted Substance Registry
          </h2>
          {authorizedSubstances.length === 0 ? (
            <Card className="border-slate-100">
              <CardContent className="p-8 text-center text-slate-400 font-medium text-xs">
                No substances currently authorized for your company. Please contact support.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {authorizedSubstances.map((chem) => {
                const percentUsed = chem.available_quantity + chem.exported_quantity > 0
                  ? (chem.exported_quantity / (chem.available_quantity + chem.exported_quantity)) * 100
                  : 0;

                return (
                  <Card key={chem.id} className="border-slate-100 hover:shadow-md transition-shadow group relative bg-white">
                    <CardContent className="p-5 space-y-4">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase block">
                          CAS NO: {chem.cas_number}
                        </span>
                        <h3 className="font-bold text-slate-800 group-hover:text-primary transition-colors text-sm line-clamp-1">
                          {chem.chemical_name}
                        </h3>
                      </div>

                      {/* Quota breakdown */}
                      <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-50 py-2">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block">Available Quota</span>
                          <span className="font-extrabold text-slate-800">{chem.available_quantity} MT</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block">Exported to date</span>
                          <span className="font-bold text-slate-500">{chem.exported_quantity} MT</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                          <span>Usage Profile</span>
                          <span>{percentUsed.toFixed(0)}% Utilized</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${percentUsed}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 pt-1">
                        <span>Validity Band Limit: {chem.tonnage_band || 'N/A'}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar: Notifications and Quick alerts */}
        <div className="space-y-6">
          
          {/* Notifications feed */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-emerald-600" /> Notifications Feed
            </h2>
            <Card className="border-slate-100 max-h-[380px] overflow-y-auto">
              <CardContent className="p-0 divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-medium">
                    No recent compliance alerts to display.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 flex gap-3 items-start transition-colors relative group ${
                        !n.read ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      <div className={`mt-0.5 p-1.5 rounded-md ${
                        !n.read ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Bell className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-1">{n.title}</h4>
                          {!n.read && (
                            <button
                              onClick={() => handleMarkAsRead(n.id)}
                              className="text-[9px] font-bold text-primary hover:text-emerald-700 cursor-pointer shrink-0"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 leading-normal">{n.message}</p>
                        <span className="text-[9px] text-slate-400 font-semibold block">
                          {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      </div>

      {/* Recent Certificates List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="h-4 w-4 text-emerald-600" /> Recent Issued TCC Certificates
          </h2>
          <Link href="/client/certificates">
            <span className="text-xs font-bold text-primary hover:text-emerald-700 flex items-center gap-0.5 cursor-pointer">
              View All Certificates <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        </div>

        <Card className="border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100">
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Certificate Number</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Chemical Substance</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Authorized Weight</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Issue Date</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Expiration Date</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {certificates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                      No TCC permits have been issued for your company yet.
                    </td>
                  </tr>
                ) : (
                  certificates.map((cert) => (
                    <tr key={cert.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-800">{cert.certificate_number}</td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-700">
                          {cert.tcc_applications?.chemicals.chemical_name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          CAS: {cert.tcc_applications?.chemicals.cas_number}
                        </div>
                      </td>
                      <td className="p-4 font-extrabold text-slate-800">
                        {cert.tcc_applications?.quantity_mt} MT
                      </td>
                      <td className="p-4 text-slate-500 font-medium">
                        {new Date(cert.issued_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-slate-500 font-medium">
                        {cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="p-4">{getStatusBadge(cert.status)}</td>
                      <td className="p-4 text-right">
                        <a
                          href={cert.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-primary hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/50 rounded-lg transition-colors border border-emerald-100"
                        >
                          <Download className="h-3.5 w-3.5" /> PDF
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

    </div>
  );
}
