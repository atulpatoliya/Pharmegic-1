'use client';

import { useLayoutStore } from '@/store/layout';
import { logout } from '@/actions/auth';
import { Menu, LogOut, User, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from './ui/Badge';
import Breadcrumbs from './Breadcrumbs';

interface TopNavbarProps {
  userEmail: string;
  role: 'SUPER_ADMIN' | 'MASTER_ADMIN' | 'CLIENT';
  notificationCount?: number;
}

export default function TopNavbar({ userEmail, role, notificationCount = 0 }: TopNavbarProps) {
  const { toggleSidebar } = useLayoutStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  const getRoleLabel = (r: string) => {
    if (r === 'SUPER_ADMIN') return 'Super Admin';
    if (r === 'MASTER_ADMIN') return 'Master Admin';
    return 'Client Representative';
  };

  const getRoleBadgeVariant = (r: string) => {
    if (r === 'SUPER_ADMIN') return 'danger';
    if (r === 'MASTER_ADMIN') return 'warning';
    return 'success';
  };


  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-100 bg-white px-6 shadow-xs">
      {/* Left section: Hamburger & Breadcrumbs */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden sm:block">
          <Breadcrumbs />
        </div>
      </div>

      {/* Right section: Profile & Actions */}
      <div className="flex items-center gap-6">
        {/* Notifications Icon */}
        <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors cursor-pointer">
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
              {notificationCount}
            </span>
          )}
        </button>

        {/* User Card */}
        <div className="flex items-center gap-3 border-l border-slate-100 pl-6">
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-800 max-w-[150px] truncate">
              {userEmail}
            </span>
            <Badge variant={getRoleBadgeVariant(role)} className="text-[10px] px-2 py-0">
              {getRoleLabel(role)}
            </Badge>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <User className="h-5 w-5" />
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sign out of portal"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
