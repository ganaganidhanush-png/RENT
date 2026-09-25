'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, Search, Plus, User } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Search or Quick Info */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tenant, room number..."
            className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        <Link
          href="/tenants/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Tenant
        </Link>

        <button 
          type="button" 
          aria-label="Notifications"
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Bell className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-slate-200" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden sm:block text-left">
            <span className="text-xs font-semibold text-slate-900 block leading-tight">Landlord</span>
            <span className="text-[10px] text-slate-400 block">Owner / Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
