'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Building2, Users, IndianRupee, ShieldCheck, 
  LayoutDashboard, UserPlus, ChevronRight
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Rooms (6 Units)', href: '/rooms', icon: Building2 },
  { name: 'Tenants Directory', href: '/tenants', icon: Users },
  { name: 'Add Tenant', href: '/tenants/new', icon: UserPlus },
  { name: 'Payments Ledger', href: '/payments', icon: IndianRupee },
  { name: 'Document Vault', href: '/documents', icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-950 text-slate-100 h-screen sticky top-0 flex flex-col justify-between border-r border-slate-800 shrink-0 z-40 overflow-y-auto">
      <div>
        {/* Brand / Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 bg-slate-900/60">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/40 font-bold text-lg">
            R
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-tight block">RentVault</span>
            <span className="text-xs font-semibold text-indigo-400 block -mt-0.5">6 Units Management</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5">
          <p className="px-3 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Main Menu
          </p>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-200 hover:text-white hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-300'}`} />
                  <span className="text-slate-100">{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-white opacity-90" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Property Badge / Landlord Status */}
      <div className="p-4 m-4 mb-8 rounded-xl bg-slate-900 border border-slate-700/80 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-bold text-white uppercase tracking-wider">Property Live</span>
        </div>
        <p className="text-xs font-bold text-slate-100">6 Rooms Active</p>
        <p className="text-xs font-medium text-indigo-300 mt-1">G1 • 2A • 2B • 3A • 3B • P1</p>
        <p className="text-[11px] text-slate-400 mt-1">Bachelors & Families</p>
      </div>
    </aside>
  );
}

