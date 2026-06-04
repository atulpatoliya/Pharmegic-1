'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useLayoutStore } from '@/store/layout';
import React from 'react';

const routeMaps: Record<string, string> = {
  admin: 'Admin Portal',
  clients: 'Client Management',
  chemicals: 'Chemical Inventory',
  templates: 'Document Templates',
  approvals: 'TCC Approvals',
  client: 'Client Portal',
  apply: 'Apply for TCC',
  certificates: 'My Certificates',
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const { customBreadcrumb } = useLayoutStore();

  if (segments.length === 0) return null;

  if (customBreadcrumb) {
    return (
      <nav className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
        <Link href="/" className="flex items-center gap-1 hover:text-primary transition-colors">
          <Home className="h-3.5 w-3.5" />
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <span className="text-slate-800 font-bold truncate max-w-[150px] sm:max-w-[300px]">
          {customBreadcrumb}
        </span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
      <Link href="/" className="flex items-center gap-1 hover:text-primary transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>

      {segments.map((segment, index) => {
        const url = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;
        const displayName = routeMaps[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        return (
          <React.Fragment key={url}>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            {isLast ? (
              <span className="text-slate-800 font-bold truncate max-w-[150px] sm:max-w-[300px]">
                {displayName}
              </span>
            ) : (
              <Link href={url} className="hover:text-primary transition-colors truncate max-w-[120px]">
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
