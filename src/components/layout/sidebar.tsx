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
  { name: 'Rooms (5 Units)', href: '/#rooms-section', icon: Building2 },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Add Tenant', href: '/tenants/new', icon: UserPlus },
  { name: 'Payments Ledger', href: '/#payments-section', icon: IndianRupee },
  { name: 'Document Vault', href: '/#vault-section', icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col justify-between border-r border-slate-800 shrink-0">
      <div>
        {/* Brand / Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 bg-slate-950/40">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 font-bold text-lg">
            R
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-tight block">RentVault</span>
            <span className="text-[11px] text-slate-400 block -mt-1">5-Room Management</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Main Menu
          </p>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Property Badge / Landlord Status */}
      <div className="p-4 m-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Property Live</span>
        </div>
        <p className="text-xs text-slate-400">Total 5 Units Active</p>
        <p className="text-[11px] text-slate-500 mt-1">Ground & 1st Floor</p>
      </div>
    </aside>
  );
}
