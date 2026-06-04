'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLayoutStore } from '@/store/layout';
import {
  LayoutDashboard,
  Users,
  Database,
  FileText,
  CheckSquare,
  FileSignature,
  Award,
  X,
  Shield,
  Settings,
} from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { useEffect } from 'react';

interface SidebarProps {
  role: 'SUPER_ADMIN' | 'MASTER_ADMIN' | 'CLIENT';
  companyName?: string;
}

export default function Sidebar({ role, companyName }: SidebarProps) {
  const pathname = usePathname();
  const { isSidebarOpen, setSidebarOpen, customBreadcrumb } = useLayoutStore();

  // Close sidebar on path changes (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const adminLinks = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/clients', label: 'Clients', icon: Users },
    { href: '/admin/chemicals', label: 'Chemical Inventory', icon: Database },
    { href: '/admin/approvals', label: 'TCC Approvals', icon: CheckSquare },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  if (role === 'SUPER_ADMIN') {
    // Add Super Admin controls link
    adminLinks.splice(4, 0, { href: '/admin/super', label: 'Super Admin', icon: Shield });
  }

  const isClientProfileView =
    /^\/admin\/clients\/(?!new(?:\/|$))[^/]+/.test(pathname);

  const clientProfileHiddenHrefs = new Set([
    '/admin',
    '/admin/chemicals',
    '/admin/approvals',
    '/admin/settings',
    '/admin/super',
  ]);

  const filteredAdminLinks = isClientProfileView
    ? adminLinks.filter((link) => !clientProfileHiddenHrefs.has(link.href))
    : adminLinks;

  const clientLinks = [
    { href: '/client', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/client/apply', label: 'Apply for TCC', icon: FileSignature },
    { href: '/client/certificates', label: 'My Certificates', icon: Award },
  ];

  const links =
    role === 'SUPER_ADMIN' || role === 'MASTER_ADMIN' ? filteredAdminLinks : clientLinks;


  const sidebarContent = (
    <div className="flex flex-col h-full bg-primary text-primary-foreground border-r border-primary/20">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-6 border-b border-primary-hover">
        <div className="rounded-lg bg-white px-2.5 py-1.5 shadow-xs">
          <BrandLogo variant="sidebar" href="/" />
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-1 rounded-md text-primary-foreground/75 hover:text-white hover:bg-primary-hover"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Client Meta Info (If Client Portal) */}
      {role === 'CLIENT' && companyName && (
        <div className="px-6 py-4 bg-primary-hover/50 border-b border-primary-hover">
          <span className="text-[10px] uppercase text-primary-foreground/60 font-semibold tracking-wider block">Company Portal</span>
          <span className="text-sm font-semibold truncate block text-emerald-100">{companyName}</span>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/admin' && link.href !== '/client' && pathname.startsWith(link.href));
          const Icon = link.icon;
          const displayLabel =
            isClientProfileView && link.href === '/admin/clients' && customBreadcrumb
              ? customBreadcrumb
              : link.label;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-accent text-accent-foreground shadow-xs'
                  : 'text-primary-foreground/80 hover:text-white hover:bg-primary-hover'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate" title={displayLabel}>{displayLabel}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Branding */}
      <div className="p-6 border-t border-primary-hover bg-primary-hover/30">
        <div className="text-[11px] text-primary-foreground/50 text-center font-medium">
          Pharmegic Healthcare v1.0.0
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:flex flex-col w-64 h-full shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer content */}
          <div className="relative flex flex-col w-64 max-w-xs h-full bg-primary z-50 animate-slide-in shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
