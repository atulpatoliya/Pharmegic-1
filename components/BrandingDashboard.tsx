'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTemplateAction } from '@/actions/templates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from '@/store/toast';
import {
  Settings,
  Upload,
  RefreshCw,
  Award,
  Sparkles,
  ShieldCheck,
  QrCode
} from 'lucide-react';

interface Template {
  id: string;
  logo: string | null;
  accent_color: string;
  footer_text: string | null;
  signature_image: string | null;
}

interface BrandingDashboardProps {
  template: Template;
}

export default function BrandingDashboard({ template }: BrandingDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [accentColor, setAccentColor] = useState(template.accent_color || '#064e3b');
  const [footerText, setFooterText] = useState(template.footer_text || '');
  const [logo, setLogo] = useState<string | null>(template.logo);
  const [signature, setSignature] = useState<string | null>(template.signature_image);

  // File Upload Handlers (Client-side Base64 conversion)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (type === 'logo') {
          setLogo(reader.result);
        } else {
          setSignature(reader.result);
        }
        toast.success(`${type === 'logo' ? 'Logo' : 'Signature'} loaded to preview.`);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateTemplateAction(template.id, {
        logo,
        signature_image: signature,
        accent_color: accentColor,
        footer_text: footerText,
      });

      if (res.success) {
        toast.success(res.message || 'Branding templates successfully updated.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update templates.');
      }
    });
  };

  const handleReset = () => {
    setAccentColor('#064e3b');
    setFooterText('Pharmegic Healthcare Compliance Division. For verification, scan the QR code.');
    setLogo(null);
    setSignature(null);
    toast.info('Branding inputs reset to default settings.');
  };

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Branding & Templates</h1>
        <p className="text-sm text-slate-500 font-medium">
          Customize official compliance certificates. Set corporate colors, upload verification signatures, and add legal footer notices.
        </p>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-5">
        {/* Editor Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-100">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <Settings className="h-5 w-5" />
                <CardTitle>Branding Settings</CardTitle>
              </div>
              <CardDescription>Configure accents, logos, and signatures.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Accent Color */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Accent Scheme Color
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1 font-mono text-sm"
                    placeholder="#064e3b"
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Official Header Logo
                </label>
                <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-lg p-4 text-center cursor-pointer relative transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'logo')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Upload className="h-5 w-5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">
                      Upload logo image (max 2MB)
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      PNG/JPG/SVG landscape format recommended
                    </span>
                  </div>
                </div>
                {logo && (
                  <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-xs font-semibold text-slate-500">Logo loaded</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLogo(null)}
                      className="h-7 text-rose-500 border-rose-100 hover:bg-rose-50 px-2 cursor-pointer"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Signature Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Authorized Signatory Image
                </label>
                <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-lg p-4 text-center cursor-pointer relative transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'signature')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Upload className="h-5 w-5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">
                      Upload compliance signature (max 2MB)
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Transparent signature PNG recommended
                    </span>
                  </div>
                </div>
                {signature && (
                  <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <span className="text-xs font-semibold text-slate-500">Signature loaded</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSignature(null)}
                      className="h-7 text-rose-500 border-rose-100 hover:bg-rose-50 px-2 cursor-pointer"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Footer Text */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Footer Legal Notice
                </label>
                <textarea
                  rows={3}
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  className="w-full text-sm p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none font-medium text-slate-700"
                  placeholder="Pharmegic Healthcare Compliance Division. For verification, scan the QR code."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" /> Reset Defaults
                </Button>
                <Button onClick={handleSave} isLoading={isPending} disabled={isPending}>
                  Save Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Mock Preview */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-500 animate-pulse" /> Live Certificate Preview
          </h2>

          <div className="w-full bg-slate-100 border border-slate-200/50 rounded-xl p-8 shadow-xs flex items-center justify-center">
            {/* Document layout mock */}
            <div className="bg-white border-4 p-8 w-full max-w-[500px] aspect-[1/1.414] shadow-lg flex flex-col justify-between" style={{ borderColor: accentColor }}>
              
              {/* Header */}
              <div className="text-center border-b pb-4 mb-4" style={{ borderColor: accentColor }}>
                {logo ? (
                  <img src={logo} alt="Logo" className="max-h-12 max-w-[150px] mx-auto mb-2 object-contain" />
                ) : (
                  <h3 className="font-black tracking-wider text-sm mb-1" style={{ color: accentColor }}>
                    PHARMEGIC HEALTHCARE
                  </h3>
                )}
                <h4 className="text-sm font-extrabold tracking-widest mt-1" style={{ color: accentColor }}>
                  TONNAGE COMPLIANCE CERTIFICATE
                </h4>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">TCC REGISTRATION PERMIT</p>
              </div>

              {/* Ref Code */}
              <div className="text-right text-[8px] text-slate-400 font-bold mb-4">
                CERTIFICATE REGISTRATION NO.
                <div className="text-[10px] text-slate-800 font-black">TCC-2026-X8F9A</div>
              </div>

              {/* Statement */}
              <div className="text-[9px] text-slate-600 leading-relaxed text-justify mb-4">
                This document certifies that the chemical substance specified below has been officially registered and
                authorized for export compliance in accordance with Pharmegic Healthcare safety standards and chemical
                registry policies.
              </div>

              {/* Grid data */}
              <div className="bg-slate-50 border rounded-lg p-3 space-y-1 text-[8px] text-slate-600 font-medium mb-4">
                <div className="flex justify-between border-b pb-0.5">
                  <span className="font-bold text-slate-500">Authorized Holder:</span>
                  <span className="font-bold text-slate-800">Acme Pharmaceutical Corp</span>
                </div>
                <div className="flex justify-between border-b pb-0.5">
                  <span className="font-bold text-slate-500">Legal Entity Name:</span>
                  <span className="font-bold text-slate-800">Acme Turkey Tic. Ltd. Şti.</span>
                </div>
                <div className="flex justify-between border-b pb-0.5">
                  <span className="font-bold text-slate-500">Chemical Name:</span>
                  <span className="font-bold text-slate-800">Ethylene Glycol Monoethyl Ether</span>
                </div>
                <div className="flex justify-between border-b pb-0.5">
                  <span className="font-bold text-slate-500">CAS Number:</span>
                  <span className="font-bold text-slate-800">110-80-5</span>
                </div>
                <div className="flex justify-between border-b pb-0.5">
                  <span className="font-bold text-slate-500">Tonnage Band Limit:</span>
                  <span className="font-bold text-slate-800">10-100 tonnes</span>
                </div>
                <div className="flex justify-between border-b pb-0.5">
                  <span className="font-bold text-slate-500">Authorized Quantity:</span>
                  <span className="font-bold text-slate-800">25.00 Metric Tons (MT)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Expiration Date:</span>
                  <span className="font-bold text-slate-800">2027-12-31</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end border-t pt-4">
                <div className="border p-1 bg-white rounded-md">
                  <QrCode className="h-10 w-10 text-slate-800" />
                </div>
                
                <div className="text-center w-36">
                  {signature ? (
                    <img src={signature} alt="Signature" className="max-h-8 max-w-[100px] mx-auto mb-1 object-contain" />
                  ) : (
                    <div className="h-8" />
                  )}
                  <div className="border-t border-slate-300 pt-1 text-[8px] font-bold text-slate-800 leading-tight">
                    Compliance Director
                  </div>
                  <div className="text-[6px] text-slate-400 font-semibold uppercase">Pharmegic Healthcare</div>
                </div>
              </div>

              {/* Footer text */}
              <div className="text-center text-[6px] text-slate-400 font-semibold mt-4">
                {footerText || 'Pharmegic Healthcare Compliance Registry. Scanning the QR code verifies authenticity.'}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
