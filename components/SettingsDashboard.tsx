'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateAdminProfileSettingsAction,
  updateAdminAuthAction,
  updateTccSmtpSettingsAction,
  updateRcSmtpSettingsAction,
} from '@/actions/settings';
import {
  mapRcSmtpFormFromSettings,
  mapTccSmtpFormFromSettings,
  type CertificateSmtpFormData,
} from '@/lib/certificate-smtp-settings';
import { updateTemplateAction } from '@/actions/templates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { toast } from '@/store/toast';
import {
  User,
  Settings,
  ShieldAlert,
  Upload,
  RefreshCw,
  Sparkles,
  QrCode,
  Lock,
  Mail,
  Palette,
  Image as ImageIcon,
  FileSignature,
  ShieldCheck,
} from 'lucide-react';

interface SettingsData {
  full_name: string | null;
  mobile_number: string | null;
  email: string | null;
  cc_emails: string | null;
  bcc_emails: string | null;
  timezone: string | null;
  profile_image: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_pass?: string | null;
  smtp_from?: string | null;
  smtp_cc_default?: string | null;
  rc_smtp_host?: string | null;
  rc_smtp_port?: number | null;
  rc_smtp_user?: string | null;
  rc_smtp_pass?: string | null;
  rc_smtp_from?: string | null;
  rc_smtp_cc_default?: string | null;
}

interface TemplateData {
  id: string;
  logo: string | null;
  accent_color: string;
  footer_text: string | null;
  signature_image: string | null;
}

interface SettingsDashboardProps {
  initialSettings: SettingsData | null;
  initialTemplate: TemplateData | null;
}

export default function SettingsDashboard({ initialSettings, initialTemplate }: SettingsDashboardProps) {
  const router = useRouter();
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isBrandingPending, startBrandingTransition] = useTransition();
  const [isAuthPending, startAuthTransition] = useTransition();
  const [isTccSmtpPending, startTccSmtpTransition] = useTransition();
  const [isRcSmtpPending, startRcSmtpTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    'profile' | 'branding' | 'security' | 'smtp-tcc' | 'smtp-rc'
  >('profile');

  // 1. Profile Settings State
  const [profile, setProfile] = useState({
    full_name: initialSettings?.full_name || 'Admin User',
    mobile_number: initialSettings?.mobile_number || '',
    timezone: initialSettings?.timezone || 'UTC',
    cc_emails: initialSettings?.cc_emails || '',
    bcc_emails: initialSettings?.bcc_emails || '',
  });

  // 2. Branding Settings State
  const [accentColor, setAccentColor] = useState(initialTemplate?.accent_color || '#064e3b');
  const [footerText, setFooterText] = useState(initialTemplate?.footer_text || '');
  const [logo, setLogo] = useState<string | null>(initialTemplate?.logo || null);
  const [signature, setSignature] = useState<string | null>(initialTemplate?.signature_image || null);

  // 3. Security State
  const [emailUpdate, setEmailUpdate] = useState('');
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });

  // 4. SMTP State (TCC + RC)
  const [tccSmtp, setTccSmtp] = useState<CertificateSmtpFormData>(
    mapTccSmtpFormFromSettings(initialSettings)
  );
  const [rcSmtp, setRcSmtp] = useState<CertificateSmtpFormData>(
    mapRcSmtpFormFromSettings(initialSettings)
  );

  // Image Upload Handler (Base64 conversion)
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

  // Save Handlers
  const handleSaveProfile = () => {
    startProfileTransition(async () => {
      const res = await updateAdminProfileSettingsAction(profile);
      if (res.success) {
        toast.success(res.message || 'Profile settings updated successfully.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update profile settings.');
      }
    });
  };

  const handleSaveBranding = () => {
    if (!initialTemplate?.id) {
      toast.error('Branding template record not initialized in database.');
      return;
    }
    startBrandingTransition(async () => {
      const res = await updateTemplateAction(initialTemplate.id, {
        logo,
        signature_image: signature,
        accent_color: accentColor,
        footer_text: footerText,
      });
      if (res.success) {
        toast.success(res.message || 'Branding settings updated.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update templates.');
      }
    });
  };

  const handleUpdateEmail = () => {
    if (!emailUpdate || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailUpdate)) {
      toast.error('Please enter a valid new email address.');
      return;
    }
    startAuthTransition(async () => {
      const res = await updateAdminAuthAction({ email: emailUpdate });
      if (res.success) {
        toast.success(res.message || 'Verification link sent to new email.');
        setEmailUpdate('');
      } else {
        toast.error(res.error || 'Failed to update email.');
      }
    });
  };

  const handleUpdatePassword = () => {
    if (passwordForm.password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    startAuthTransition(async () => {
      const res = await updateAdminAuthAction({ password: passwordForm.password });
      if (res.success) {
        toast.success(res.message || 'Password successfully updated.');
        setPasswordForm({ password: '', confirmPassword: '' });
      } else {
        toast.error(res.error || 'Failed to update password.');
      }
    });
  };

  const handleResetBranding = () => {
    setAccentColor('#064e3b');
    setFooterText('Pharmegic Healthcare Compliance Division. For verification, scan the QR code.');
    setLogo(null);
    setSignature(null);
    toast.info('Branding inputs reset to default template.');
  };

  const handleSaveTccSmtp = () => {
    startTccSmtpTransition(async () => {
      const res = await updateTccSmtpSettingsAction({
        smtp_host: tccSmtp.smtp_host,
        smtp_port: Number(tccSmtp.smtp_port),
        smtp_user: tccSmtp.smtp_user,
        smtp_pass: tccSmtp.smtp_pass,
        smtp_from: tccSmtp.smtp_from,
        smtp_cc_default: tccSmtp.smtp_cc_default,
      });
      if (res.success) {
        toast.success(res.message || 'TCC SMTP settings saved.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to save TCC SMTP settings.');
      }
    });
  };

  const handleSaveRcSmtp = () => {
    startRcSmtpTransition(async () => {
      const res = await updateRcSmtpSettingsAction({
        smtp_host: rcSmtp.smtp_host,
        smtp_port: Number(rcSmtp.smtp_port),
        smtp_user: rcSmtp.smtp_user,
        smtp_pass: rcSmtp.smtp_pass,
        smtp_from: rcSmtp.smtp_from,
        smtp_cc_default: rcSmtp.smtp_cc_default,
      });
      if (res.success) {
        toast.success(res.message || 'RC SMTP settings saved.');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to save RC SMTP settings.');
      }
    });
  };

  const renderSmtpFields = (
    smtp: CertificateSmtpFormData,
    setSmtp: React.Dispatch<React.SetStateAction<CertificateSmtpFormData>>
  ) => (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      <div className="md:col-span-2">
        <Input
          label="SMTP Host"
          placeholder="smtp.gmail.com"
          value={smtp.smtp_host}
          onChange={(e) => setSmtp({ ...smtp, smtp_host: e.target.value })}
        />
      </div>
      <Input
        label="SMTP Port"
        type="number"
        placeholder="587"
        value={String(smtp.smtp_port)}
        onChange={(e) => setSmtp({ ...smtp, smtp_port: Number(e.target.value) })}
      />
      <Input
        label="SMTP Username"
        placeholder="smtp@company.com"
        value={smtp.smtp_user}
        onChange={(e) => setSmtp({ ...smtp, smtp_user: e.target.value })}
      />
      <Input
        type="password"
        label="SMTP Password"
        placeholder="••••••••"
        value={smtp.smtp_pass}
        onChange={(e) => setSmtp({ ...smtp, smtp_pass: e.target.value })}
      />
      <Input
        type="email"
        label="From Email Address"
        placeholder="noreply@pharmegic.com"
        value={smtp.smtp_from}
        onChange={(e) => setSmtp({ ...smtp, smtp_from: e.target.value })}
      />
      <Input
        type="email"
        label="Default CC Email (Admin)"
        placeholder="admin@company.com"
        value={smtp.smtp_cc_default}
        onChange={(e) => setSmtp({ ...smtp, smtp_cc_default: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Portal Configuration Settings</h1>
        <p className="text-sm text-slate-500 font-medium">
          Manage admin profile, branding templates, signature files, security credentials, and compliance alerts.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Navigation Tabs (Left Sidebar) */}
        <div className="flex md:flex-col gap-2 w-full md:w-56 shrink-0 bg-white border border-slate-100 p-2.5 rounded-xl shadow-xs">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-bold text-left cursor-pointer transition-all ${
              activeTab === 'profile'
                ? 'bg-primary text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <User className="h-4.5 w-4.5" />
            Profile Settings
          </button>
          <button
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-bold text-left cursor-pointer transition-all ${
              activeTab === 'branding'
                ? 'bg-primary text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Palette className="h-4.5 w-4.5" />
            Branding Templates
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-bold text-left cursor-pointer transition-all ${
              activeTab === 'security'
                ? 'bg-primary text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Lock className="h-4.5 w-4.5" />
            Security &amp; Login
          </button>
          <button
            onClick={() => setActiveTab('smtp-tcc')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-bold text-left cursor-pointer transition-all ${
              activeTab === 'smtp-tcc'
                ? 'bg-primary text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileSignature className="h-4.5 w-4.5" />
            TCC Email SMTP
          </button>
          <button
            onClick={() => setActiveTab('smtp-rc')}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-bold text-left cursor-pointer transition-all ${
              activeTab === 'smtp-rc'
                ? 'bg-primary text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="h-4.5 w-4.5" />
            RC Email SMTP
          </button>
        </div>

        {/* Workspace Panels (Right Content) */}
        <div className="flex-1 w-full space-y-6">
          {/* TAB 1: PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <Card className="border-slate-100 shadow-xs">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <User className="h-5 w-5" />
                  <CardTitle>Administrative Profile</CardTitle>
                </div>
                <CardDescription>Configure contact details and notification email preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  <Input
                    label="Administrator Name"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  />
                  <Input
                    label="Mobile Number"
                    placeholder="+91 XXXXX XXXXX"
                    value={profile.mobile_number}
                    onChange={(e) => setProfile({ ...profile, mobile_number: e.target.value })}
                  />
                  <Input
                    label="CC Notifications Email"
                    placeholder="cc@company.com"
                    value={profile.cc_emails}
                    onChange={(e) => setProfile({ ...profile, cc_emails: e.target.value })}
                  />
                  <Input
                    label="BCC Notifications Email"
                    placeholder="bcc@company.com"
                    value={profile.bcc_emails}
                    onChange={(e) => setProfile({ ...profile, bcc_emails: e.target.value })}
                  />
                  <Input
                    label="Timezone Preference"
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  />
                </div>
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button onClick={handleSaveProfile} isLoading={isProfilePending} disabled={isProfilePending}>
                    Save Profile Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: BRANDING & TEMPLATES */}
          {activeTab === 'branding' && (
            <div className="grid gap-8 grid-cols-1 lg:grid-cols-5">
              {/* Form Config */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-slate-100 shadow-xs">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-primary">
                      <Palette className="h-5 w-5" />
                      <CardTitle>Certificate Settings</CardTitle>
                    </div>
                    <CardDescription>Setup PDF logos, signatory images, and theme colors.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Accent Color */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                        Theme Accent Color
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
                        />
                      </div>
                    </div>

                    {/* Logo */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                        PDF Header Logo
                      </label>
                      <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-lg p-4 text-center cursor-pointer relative transition-colors bg-slate-50/50">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, 'logo')}
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
                            onClick={() => setLogo(null)}
                            className="h-7 text-rose-500 border-rose-100 hover:bg-rose-50 px-2 cursor-pointer"
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Signature */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                        Compliance Signatory Signature
                      </label>
                      <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-lg p-4 text-center cursor-pointer relative transition-colors bg-slate-50/50">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, 'signature')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Upload className="h-5 w-5 text-slate-400" />
                          <span className="text-xs font-bold text-slate-600">Upload Signature File</span>
                          <span className="text-[10px] text-slate-400 font-semibold">Max 2MB (Transparent PNG recommended)</span>
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
                            onClick={() => setSignature(null)}
                            className="h-7 text-rose-500 border-rose-100 hover:bg-rose-50 px-2 cursor-pointer"
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Footer legal text */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                        Footer Verification Notice
                      </label>
                      <textarea
                        rows={3}
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        className="w-full text-sm p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none font-medium text-slate-700"
                        placeholder="Pharmegic Healthcare Compliance Registry..."
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleResetBranding}
                        disabled={isBrandingPending}
                      >
                        <RefreshCw className="h-4 w-4 mr-1.5" /> Reset Defaults
                      </Button>
                      <Button onClick={handleSaveBranding} isLoading={isBrandingPending} disabled={isBrandingPending}>
                        Save Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Preview mock */}
              <div className="lg:col-span-3 space-y-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-500 animate-pulse" /> Live Certificate Preview
                </h2>
                <div className="w-full bg-slate-100 border border-slate-200/50 rounded-xl p-6 shadow-xs flex items-center justify-center">
                  <div className="bg-white border-4 p-6 w-full max-w-[420px] aspect-[1/1.414] shadow-lg flex flex-col justify-between" style={{ borderColor: accentColor }}>
                    <div className="text-center border-b pb-3 mb-3" style={{ borderColor: accentColor }}>
                      {logo ? (
                        <img src={logo} alt="Logo" className="max-h-10 max-w-[120px] mx-auto mb-1.5 object-contain" />
                      ) : (
                        <h3 className="font-black tracking-wider text-xs mb-0.5" style={{ color: accentColor }}>
                          PHARMEGIC HEALTHCARE
                        </h3>
                      )}
                      <h4 className="text-[10px] font-extrabold tracking-widest" style={{ color: accentColor }}>
                        TONNAGE COMPLIANCE CERTIFICATE
                      </h4>
                    </div>

                    <div className="text-right text-[7px] text-slate-400 font-bold mb-3">
                      CERTIFICATE REGISTRATION NO.
                      <div className="text-[9px] text-slate-800 font-black">TCC-2026-X8F9A</div>
                    </div>

                    <div className="text-[8px] text-slate-600 leading-relaxed text-justify mb-3">
                      This document certifies that the chemical substance specified below has been officially registered and
                      authorized for export compliance in accordance with safety standards.
                    </div>

                    <div className="bg-slate-50 border rounded-lg p-2.5 space-y-0.5 text-[7px] text-slate-600 font-semibold mb-3">
                      <div className="flex justify-between border-b pb-0.5">
                        <span className="text-slate-400">Authorized Holder:</span>
                        <span className="text-slate-800">Acme Pharmaceutical Corp</span>
                      </div>
                      <div className="flex justify-between border-b pb-0.5">
                        <span className="text-slate-400">Chemical Name:</span>
                        <span className="text-slate-800">Ethylene Glycol Monoethyl Ether</span>
                      </div>
                      <div className="flex justify-between border-b pb-0.5">
                        <span className="text-slate-400">CAS Number:</span>
                        <span className="text-slate-800">110-80-5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Quantity Limit:</span>
                        <span className="text-slate-800">25.00 Metric Tons (MT)</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-end border-t pt-3">
                      <div className="border p-0.5 bg-white rounded-md">
                        <QrCode className="h-8 w-8 text-slate-800" />
                      </div>
                      
                      <div className="text-center w-28">
                        {signature ? (
                          <img src={signature} alt="Signature" className="max-h-7 max-w-[80px] mx-auto mb-0.5 object-contain" />
                        ) : (
                          <div className="h-6" />
                        )}
                        <div className="border-t border-slate-300 pt-0.5 text-[7px] font-bold text-slate-800 leading-tight">
                          Compliance Director
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-[5px] text-slate-400 font-semibold mt-3">
                      {footerText || 'Pharmegic Healthcare Compliance Registry.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & AUTH */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Email Change */}
              <Card className="border-slate-100 shadow-xs">
                <CardHeader>
                  <div className="flex items-center gap-2 text-primary">
                    <Mail className="h-5 w-5" />
                    <CardTitle>Update Registered Email</CardTitle>
                  </div>
                  <CardDescription>Change your admin account login and contact email address.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="max-w-md">
                    <Input
                      type="email"
                      label="New Email Address"
                      placeholder="admin@newemail.com"
                      value={emailUpdate}
                      onChange={(e) => setEmailUpdate(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end pt-4 border-t border-slate-100">
                    <Button onClick={handleUpdateEmail} isLoading={isAuthPending} disabled={isAuthPending}>
                      Update Login Email
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Password Change */}
              <Card className="border-slate-100 shadow-xs">
                <CardHeader>
                  <div className="flex items-center gap-2 text-primary">
                    <Lock className="h-5 w-5" />
                    <CardTitle>Change Password</CardTitle>
                  </div>
                  <CardDescription>Update your login credentials. Must be at least 6 characters.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 max-w-2xl">
                    <Input
                      type="password"
                      label="New Password"
                      placeholder="••••••••"
                      value={passwordForm.password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                    />
                    <Input
                      type="password"
                      label="Confirm Password"
                      placeholder="••••••••"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end pt-4 border-t border-slate-100">
                    <Button onClick={handleUpdatePassword} isLoading={isAuthPending} disabled={isAuthPending}>
                      Update Account Password
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {/* TAB 4: TCC SMTP */}
          {activeTab === 'smtp-tcc' && (
            <Card className="border-slate-100 shadow-xs">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <FileSignature className="h-5 w-5" />
                  <CardTitle>TCC Certificate Email SMTP</CardTitle>
                </div>
                <CardDescription>
                  SMTP used when sending Tonnage Compliance Certificate (TCC) emails to clients.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-semibold text-amber-700">
                  Used only for TCC certificate delivery. Separate from RC certificate email settings.
                </div>
                {renderSmtpFields(tccSmtp, setTccSmtp)}
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button
                    onClick={handleSaveTccSmtp}
                    isLoading={isTccSmtpPending}
                    disabled={isTccSmtpPending}
                  >
                    Save TCC SMTP Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: RC SMTP */}
          {activeTab === 'smtp-rc' && (
            <Card className="border-slate-100 shadow-xs">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                  <CardTitle>RC Certificate Email SMTP</CardTitle>
                </div>
                <CardDescription>
                  SMTP used when sending REACH Compliance Certificate (RC) emails to clients.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-xs font-semibold text-teal-800">
                  Used only for RC certificate delivery. Configure independently from TCC SMTP.
                </div>
                {renderSmtpFields(rcSmtp, setRcSmtp)}
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button
                    onClick={handleSaveRcSmtp}
                    isLoading={isRcSmtpPending}
                    disabled={isRcSmtpPending}
                  >
                    Save RC SMTP Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
