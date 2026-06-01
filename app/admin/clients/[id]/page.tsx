import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Building, Mail, Phone, MapPin, Calendar, CheckCircle, AlertCircle, FileText, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export const revalidate = 0;

export default async function ViewClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  // 1. Fetch client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (clientError || !client) {
    redirect('/admin/clients');
  }

  // 2. Fetch chemicals mapping
  const { data: clientChemicals, error: chemError } = await supabase
    .from('client_chemicals')
    .select('chemical_id, chemicals(chemical_name, cas_number)')
    .eq('client_id', id);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'inactive':
        return <Badge variant="danger">Inactive</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-slide-in">
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              {client.company_name}
              {getStatusBadge(client.status)}
            </h1>
            <p className="text-sm text-slate-500 font-medium">Client Details and Compliance Profile</p>
          </div>
          <Link href={`/admin/clients/${client.id}/edit`}>
            <Button>Edit Client</Button>
          </Link>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {/* Company Information */}
         <Card className="border-slate-100 shadow-xs">
           <CardHeader className="pb-3 border-b border-slate-100">
             <CardTitle className="text-lg flex items-center gap-2">
               <Building className="h-5 w-5 text-primary" />
               Company Information
             </CardTitle>
           </CardHeader>
           <CardContent className="pt-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Company Name</p>
                <p className="text-slate-800 font-medium">{client.company_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Legal Name</p>
                <p className="text-slate-800 font-medium">{client.legal_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Registration Number</p>
                <p className="text-slate-800 font-medium">{client.registration_number}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">UUID Number</p>
                <p className="text-slate-800 font-medium">{client.uuid_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Registered At</p>
                <p className="text-slate-800 font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {new Date(client.created_at).toLocaleDateString()}
                </p>
              </div>
           </CardContent>
         </Card>

         {/* Contact Information */}
         <Card className="border-slate-100 shadow-xs">
           <CardHeader className="pb-3 border-b border-slate-100">
             <CardTitle className="text-lg flex items-center gap-2">
               <User className="h-5 w-5 text-primary" />
               Contact Information
             </CardTitle>
           </CardHeader>
           <CardContent className="pt-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Primary Representative</p>
                <p className="text-slate-800 font-medium">{client.owner_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Email</p>
                <p className="text-slate-800 font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <a href={`mailto:${client.email}`} className="hover:text-primary transition-colors">{client.email}</a>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Phone</p>
                <p className="text-slate-800 font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {client.phone ? <a href={`tel:${client.phone}`} className="hover:text-primary transition-colors">{client.phone}</a> : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">CC Emails</p>
                <p className="text-slate-800 font-medium">{client.cc_emails || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">CC Phones</p>
                <p className="text-slate-800 font-medium">{client.cc_phones || 'N/A'}</p>
              </div>
           </CardContent>
         </Card>

         {/* Location */}
         <Card className="border-slate-100 shadow-xs">
           <CardHeader className="pb-3 border-b border-slate-100">
             <CardTitle className="text-lg flex items-center gap-2">
               <MapPin className="h-5 w-5 text-primary" />
               Location
             </CardTitle>
           </CardHeader>
           <CardContent className="pt-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Address</p>
                <p className="text-slate-800 font-medium">{client.address || 'N/A'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">City</p>
                  <p className="text-slate-800 font-medium">{client.city || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">State</p>
                  <p className="text-slate-800 font-medium">{client.state || 'N/A'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Country</p>
                  <p className="text-slate-800 font-medium">{client.country || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Postal Code</p>
                  <p className="text-slate-800 font-medium">{client.postal_code || 'N/A'}</p>
                </div>
              </div>
           </CardContent>
         </Card>
       </div>

       {/* Authorized Substances */}
       <Card className="border-slate-100 shadow-xs">
         <CardHeader className="pb-3 border-b border-slate-100">
           <CardTitle className="text-lg flex items-center gap-2">
             <FileText className="h-5 w-5 text-primary" />
             Authorized Substances
           </CardTitle>
         </CardHeader>
         <CardContent className="pt-4">
            {clientChemicals && clientChemicals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {clientChemicals.map((cc: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{cc.chemicals?.chemical_name}</p>
                      <p className="text-xs text-slate-500">CAS: {cc.chemicals?.cas_number}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                <AlertCircle className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">No authorized substances assigned to this client.</p>
              </div>
            )}
         </CardContent>
       </Card>
    </div>
  );
}
