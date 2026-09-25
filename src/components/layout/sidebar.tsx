'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Building2, Users, IndianRupee, ShieldCheck, 
  LayoutDashboard, UserPlus, ChevronRight, X
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Rooms & Units', href: '/rooms', icon: Building2 },
  { name: 'Tenants Directory', href: '/tenants', icon: Users },
  { name: 'Add Tenant', href: '/tenants/new', icon: UserPlus },
  { name: 'Payments Ledger', href: '/payments', icon: IndianRupee },
  { name: 'Document Vault', href: '/documents', icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => {
      setIsMobileOpen((prev) => !prev);
    };
    window.addEventListener('rentvault_toggle_mobile_nav', handleToggle);
    return () => window.removeEventListener('rentvault_toggle_mobile_nav', handleToggle);
  }, []);

  const renderNavContent = (onLinkClick?: () => void) => (
    <>
      <div>
        {/* Brand / Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/40 font-bold text-lg">
              R
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight block">RentVault</span>
              <span className="text-xs font-semibold text-indigo-400 block -mt-0.5">Property Management</span>
            </div>
          </div>
          {onLinkClick && (
            <button
              type="button"
              onClick={onLinkClick}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
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
                onClick={onLinkClick}
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
        <p className="text-xs font-bold text-slate-100">All Units Online</p>
        <p className="text-xs font-medium text-indigo-300 mt-1">Multi-Unit Management</p>
        <p className="text-[11px] text-slate-400 mt-1">Bachelors & Families</p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-950 text-slate-100 h-screen sticky top-0 flex-col justify-between border-r border-slate-800 shrink-0 z-40 overflow-y-auto">
        {renderNavContent()}
      </aside>

      {/* Mobile Slide-over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileOpen(false)} 
          />
          <aside className="relative w-72 bg-slate-950 text-slate-100 h-full flex flex-col justify-between border-r border-slate-800 z-50 overflow-y-auto shadow-2xl animate-in slide-in-from-left duration-200">
            {renderNavContent(() => setIsMobileOpen(false))}
          </aside>
        </div>
      )}
    </>
  );
}
