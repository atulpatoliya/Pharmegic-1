import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle, XCircle, AlertTriangle, ShieldCheck, ShieldAlert, Award, FileText, Calendar, Building, FlaskConical, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface VerifyPageProps {
  params: Promise<{
    certNumber: string;
  }>;
}

export const revalidate = 0; // Fresh verification check each scan

export default async function VerifyCertificatePage({ params }: VerifyPageProps) {
  const { certNumber } = await params;
  const adminSupabase = createAdminClient();

  // Fetch certificate details bypassing RLS
  const { data: cert, error } = await adminSupabase
    .from('certificates')
    .select(`
      *,
      clients (company_name, legal_name),
      tcc_applications (
        quantity_mt,
        kkdik_reg_no,
        export_date,
        chemicals (chemical_name, cas_number, ec_number)
      )
    `)
    .eq('certificate_number', certNumber)
    .maybeSingle();

  const isNotFound = !cert || error;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="flex-1 flex flex-col justify-center max-w-xl w-full mx-auto space-y-6">
        
        {/* Logo Header */}
        <div className="text-center">
          <h1 className="text-xl font-black text-slate-800 tracking-wider">PHARMEGIC HEALTHCARE</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">COMPLIANCE REGISTRY VERIFICATION</p>
        </div>

        {isNotFound ? (
          /* Not Found / Invalid */
          <Card className="border-rose-200 shadow-lg bg-white overflow-hidden">
            <div className="h-2 bg-rose-600" />
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                <XCircle className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-800">Verification Failed</h2>
                <p className="text-sm font-semibold text-rose-600 uppercase tracking-wider">Unregistered Certificate Code</p>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                The certificate number <span className="font-mono font-bold text-slate-800">{certNumber}</span> was not found in the Pharmegic Healthcare registry database. This document cannot be verified as authentic.
              </p>
              <div className="pt-4">
                <Link href="/">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-emerald-700 cursor-pointer">
                    <ArrowLeft className="h-4 w-4" /> Back to Portal Home
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Certificate Found */
          <Card className="border-slate-200 shadow-xl bg-white overflow-hidden">
            {/* Status Colored Top Bar */}
            <div className={`h-2 ${
              cert.status === 'active' ? 'bg-emerald-600' : cert.status === 'expired' ? 'bg-amber-500' : 'bg-rose-600'
            }`} />
            
            <CardContent className="p-8 space-y-6">
              
              {/* Verification Title */}
              <div className="text-center space-y-3">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                  cert.status === 'active' 
                    ? 'bg-emerald-50 text-emerald-600' 
                    : cert.status === 'expired' 
                    ? 'bg-amber-50 text-amber-600' 
                    : 'bg-rose-50 text-rose-600'
                }`}>
                  {cert.status === 'active' ? (
                    <ShieldCheck className="h-10 w-10" />
                  ) : (
                    <ShieldAlert className="h-10 w-10" />
                  )}
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-slate-800">Compliance Verified</h2>
                  <div className="flex justify-center">
                    {cert.status === 'active' ? (
                      <Badge variant="success" className="text-xs px-3 py-1 font-bold">VALID CERTIFICATE</Badge>
                    ) : cert.status === 'expired' ? (
                      <Badge variant="warning" className="text-xs px-3 py-1 font-bold">EXPIRED PERMIT</Badge>
                    ) : (
                      <Badge variant="danger" className="text-xs px-3 py-1 font-bold">REVOKED / CANCELLED</Badge>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Certificate Details */}
              <div className="space-y-4 text-xs font-semibold text-slate-600">
                <h3 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Substance and Registry Specs</h3>
                
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-3">
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-slate-400 font-medium">Certificate Registration No:</span>
                    <span className="font-mono text-slate-800 font-bold">{cert.certificate_number}</span>
                  </div>
                  
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-slate-400 font-medium">Authorized Holder:</span>
                    <span className="text-slate-800 font-bold text-right">{cert.clients?.company_name}</span>
                  </div>

                  {cert.clients?.legal_name && (
                    <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                      <span className="text-slate-400 font-medium">Legal Entity Name:</span>
                      <span className="text-slate-800 font-bold text-right">{cert.clients.legal_name}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-slate-400 font-medium">Chemical Name:</span>
                    <span className="text-slate-800 font-bold text-right">{cert.tcc_applications?.chemicals?.chemical_name}</span>
                  </div>

                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-slate-400 font-medium">CAS Registry Number:</span>
                    <span className="text-slate-800 font-bold">{cert.tcc_applications?.chemicals?.cas_number}</span>
                  </div>

                  {cert.tcc_applications?.chemicals?.ec_number && (
                    <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                      <span className="text-slate-400 font-medium">EC Number:</span>
                      <span className="text-slate-800 font-bold">{cert.tcc_applications.chemicals.ec_number}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-slate-400 font-medium">Authorized Export Quantity:</span>
                    <span className="text-slate-800 font-bold">{cert.tcc_applications?.quantity_mt} MT (Metric Tons)</span>
                  </div>

                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-slate-400 font-medium">KKDIK Registration No:</span>
                    <span className="font-mono text-slate-800 font-bold">{cert.tcc_applications?.kkdik_reg_no}</span>
                  </div>

                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-slate-400 font-medium">Date of Issuance:</span>
                    <span className="text-slate-800 font-bold">{new Date(cert.issued_at).toLocaleDateString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Date of Expiration:</span>
                    <span className="text-slate-800 font-bold">
                      {cert.expires_at ? new Date(cert.expires_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Message notice */}
              <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-semibold flex gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  This is a verified live record matching the compliance database registry. Printed documents must contain matching parameters to be recognized at customs control checkpoints.
                </div>
              </div>

              <div className="text-center pt-2">
                <Link href="/">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-emerald-700 cursor-pointer">
                    <ArrowLeft className="h-4 w-4" /> Go to Portal Home
                  </span>
                </Link>
              </div>

            </CardContent>
          </Card>
        )}

      </div>

      {/* Verification page footer notice */}
      <div className="text-center text-[9px] text-slate-400 font-bold uppercase mt-8">
        Pharmegic Healthcare Compliance Control Registry.
      </div>
    </div>
  );
}
