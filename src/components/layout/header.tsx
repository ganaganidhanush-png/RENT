'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Search, Plus, User, Edit3, Activity } from 'lucide-react';
import EditProfileModal from './edit-profile-modal';
import RenderKeepAliveModal from './render-keep-alive-modal';
import { getLandlordProfile, LandlordProfile } from '@/lib/store/app-store';

export default function Header() {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isKeepAliveModalOpen, setIsKeepAliveModalOpen] = useState(false);
  const [profile, setProfile] = useState<LandlordProfile>(getLandlordProfile());

  useEffect(() => {
    const handleUpdate = () => {
      setProfile(getLandlordProfile());
    };
    window.addEventListener('landlord_profile_updated', handleUpdate);
    return () => window.removeEventListener('landlord_profile_updated', handleUpdate);
  }, []);

  // Background keep-alive heartbeat while tab is open (every 10 mins)
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/health', { cache: 'no-store' }).catch(() => {});
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-300 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Search or Quick Info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search rooms (G1, 2A, 2B...), tenants..."
              className="pl-9 pr-4 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-slate-900 placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3.5">
          {/* Render Anti-Sleep Button */}
          <button
            type="button"
            onClick={() => setIsKeepAliveModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
            title="Render Anti-Sleep Active - Click to test ping & view setup"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Anti-Sleep Active</span>
          </button>

          <Link
            href="/tenants/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Tenant
          </Link>

          <button 
            type="button" 
            aria-label="Notifications"
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-slate-300" />

          {/* Landlord Profile Button */}
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 transition-colors text-left group cursor-pointer"
            title="Click to edit landlord profile and UPI ID"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-900 block leading-tight">
                  {profile.name || 'Landlord'}
                </span>
                <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </div>
              <span className="text-[11px] text-slate-500 block font-medium">Owner / Admin</span>
            </div>
          </button>
        </div>
      </header>

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <EditProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onSaved={(updated) => setProfile(updated)}
        />
      )}

      {/* Render Anti-Sleep Keep-Alive Modal */}
      {isKeepAliveModalOpen && (
        <RenderKeepAliveModal
          isOpen={isKeepAliveModalOpen}
          onClose={() => setIsKeepAliveModalOpen(false)}
        />
      )}
    </>
  );
}

