'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Users, Award, Clock, Activity, AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface AdminDashboardProps {
  stats: {
    totalClients: number;
    activeCertificates: number;
    pendingTcc: number;
    totalExported: number;
    renewalAlerts: number;
  };
  chartData: { name: string; quantity: number }[];
}

export default function AdminDashboard({ stats, chartData }: AdminDashboardProps) {
  const cards = [
    {
      title: 'Total Clients',
      value: stats.totalClients,
      description: 'Registered compliance corporations',
      icon: Users,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50',
      href: '/admin/clients',
    },
    {
      title: 'Active Certificates',
      value: stats.activeCertificates,
      description: 'Valid TCC permits issued',
      icon: Award,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      href: '/admin/approvals',
    },
    {
      title: 'Pending TCC',
      value: stats.pendingTcc,
      description: 'Applications awaiting review',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      href: '/admin/approvals',
    },
    {
      title: 'Exported Quantity',
      value: `${stats.totalExported} MT`,
      description: 'Substance exports dispatched',
      icon: Activity,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      href: '/admin/chemicals',
    },
    {
      title: 'Renewal Alerts',
      value: stats.renewalAlerts,
      description: 'Certificates expiring in 30 days',
      icon: AlertTriangle,
      color: stats.renewalAlerts > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400',
      bgColor: stats.renewalAlerts > 0 ? 'bg-rose-50' : 'bg-slate-50',
      href: '/admin/approvals',
    },
  ];

  return (
    <div className="space-y-8 animate-slide-in">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Compliance Analytics</h1>
        <p className="text-sm text-slate-500 font-medium">
          Pharmegic Healthcare registry and certificate monitoring console.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.title} href={c.href}>
              <Card className="hover:shadow-md transition-all duration-300 border-slate-100 group cursor-pointer relative overflow-hidden h-full">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                        {c.title}
                      </span>
                      <span className="text-2xl font-black text-slate-800 block">
                        {c.value}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-lg ${c.bgColor} ${c.color} shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-500 transition-colors flex items-center gap-0.5">
                    <span>{c.description}</span>
                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Charts section */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Main Export volume chart */}
        <Card className="lg:col-span-2 border-slate-100 shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-5 w-5" />
              <CardTitle>Export Volume Activity</CardTitle>
            </div>
            <CardDescription>
              Approved T tonnage compliance applications (MT) by calendar month.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#064e3b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#064e3b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                />
                <Area
                  type="monotone"
                  dataKey="quantity"
                  name="Tonnage (MT)"
                  stroke="#064e3b"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorQuantity)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Certificate analytics */}
        <Card className="border-slate-100 shadow-xs">
          <CardHeader>
            <CardTitle>Substance Distribution</CardTitle>
            <CardDescription>
              Quantity allocated (MT) across key registered chemicals.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {chartData.some((c) => c.quantity > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="quantity" fill="#10b981" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index % 2 === 0 ? '#064e3b' : '#10b981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                No active export metrics to show.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
