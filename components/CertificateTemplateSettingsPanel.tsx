'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import ReachCertificateViewer from '@/components/ReachCertificateViewer';
import {
  RC_TEMPLATE_OPTIONS,
  type CertificateTemplateKey,
} from '@/lib/certificate-template-config';
import {
  Palette,
  Upload,
  RefreshCw,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';

type CertificateTemplateSettingsPanelProps = {
  title: string;
  description: string;
  certificateType: 'rc' | 'tcc';
  showTemplatePicker?: boolean;
  templateKey?: CertificateTemplateKey;
  onTemplateKeyChange?: (value: CertificateTemplateKey) => void;
  accentColor: string;
  onAccentColorChange: (value: string) => void;
  footerText: string;
  onFooterTextChange: (value: string) => void;
  logo: string | null;
  signature: string | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature') => void;
  onClearLogo: () => void;
  onClearSignature: () => void;
  onSave: () => void;
  onReset: () => void;
  isPending: boolean;
};

export function CertificateTemplateSettingsPanel({
  title,
  description,
  certificateType,
  showTemplatePicker = false,
  templateKey = 'template_1',
  onTemplateKeyChange,
  accentColor,
  onAccentColorChange,
  footerText,
  onFooterTextChange,
  logo,
  signature,
  onFileChange,
  onClearLogo,
  onClearSignature,
  onSave,
  onReset,
  isPending,
}: CertificateTemplateSettingsPanelProps) {
  const previewDocxUrl = useMemo(() => {
    if (certificateType === 'rc') {
      const params = new URLSearchParams({ templateKey });
      return `/api/certificate-template/rc-preview?${params.toString()}`;
    }
    return '/api/certificate-template/tcc-preview';
  }, [certificateType, templateKey]);

  const previewPdfUrl = useMemo(() => {
    if (certificateType === 'rc' && templateKey === 'template_2') {
      const params = new URLSearchParams({ templateKey });
      return `/api/certificate-template/rc-preview/pdf?${params.toString()}`;
    }
    return undefined;
  }, [certificateType, templateKey]);

  return (
    <div className="grid gap-8 grid-cols-1 lg:grid-cols-5">
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-slate-100 shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Palette className="h-5 w-5" />
              <CardTitle>{title}</CardTitle>
            </div>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {showTemplatePicker && onTemplateKeyChange && (
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Active Certificate Design
                </label>
                <div className="grid gap-3">
                  {RC_TEMPLATE_OPTIONS.map((option) => {
                    const active = templateKey === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onTemplateKeyChange(option.value)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          active
                            ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-100'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{option.label}</p>
                            <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                          </div>
                          <span
                            className={`h-4 w-4 rounded-full border-2 shrink-0 ${
                              active ? 'border-teal-700 bg-teal-700' : 'border-slate-300'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Preview updates instantly. Save to apply this design to new RC certificates.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Theme Accent Color
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => onAccentColorChange(e.target.value)}
                  className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => onAccentColorChange(e.target.value)}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                PDF Header Logo
              </label>
              <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-lg p-4 text-center cursor-pointer relative transition-colors bg-slate-50/50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFileChange(e, 'logo')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-1">
                  <Upload className="h-5 w-5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">Upload Header Logo</span>
                  <span className="text-[10px] text-slate-400 font-semibold">Max 2MB (PNG/JPG/SVG)</span>
                </div>
              </div>
              {logo && (
                <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" /> Logo loaded
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClearLogo}
                    className="h-7 text-rose-500 border-rose-100 hover:bg-rose-50 px-2 cursor-pointer"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Compliance Signatory Signature
              </label>
              <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-lg p-4 text-center cursor-pointer relative transition-colors bg-slate-50/50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFileChange(e, 'signature')}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-1">
                  <Upload className="h-5 w-5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">Upload Signature File</span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Max 2MB (Transparent PNG recommended)
                  </span>
                </div>
              </div>
              {signature && (
                <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" /> Signature loaded
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClearSignature}
                    className="h-7 text-rose-500 border-rose-100 hover:bg-rose-50 px-2 cursor-pointer"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Footer Verification Notice
              </label>
              <textarea
                rows={3}
                value={footerText}
                onChange={(e) => onFooterTextChange(e.target.value)}
                className="w-full text-sm p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none font-medium text-slate-700"
                placeholder="Pharmegic Healthcare Compliance Registry..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={onReset} disabled={isPending}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Reset Defaults
              </Button>
              <Button onClick={onSave} isLoading={isPending} disabled={isPending}>
                Save Template
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-500 animate-pulse" /> Live Certificate Preview
          </h2>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            Same layout as print / PDF
          </span>
        </div>
        <div className="w-full border border-slate-200/80 rounded-xl shadow-xs overflow-hidden bg-white">
          <ReachCertificateViewer
            key={previewPdfUrl ?? previewDocxUrl}
            docxUrl={previewDocxUrl}
            pdfUrl={previewPdfUrl}
            preferPdf={templateKey === 'template_2'}
          />
        </div>
      </div>
    </div>
  );
}
