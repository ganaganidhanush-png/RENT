'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Bell, Search, Plus, User, Edit3, Activity, 
  Menu, X, Building2, Users, IndianRupee 
} from 'lucide-react';
import EditProfileModal from './edit-profile-modal';
import RenderKeepAliveModal from './render-keep-alive-modal';
import { 
  getLandlordProfile, LandlordProfile, 
  getLocalRooms, getLocalTenants, getLocalPayments 
} from '@/lib/store/app-store';
import { Room, Tenant, Payment } from '@/types/database';

export default function Header() {
  const router = useRouter();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isKeepAliveModalOpen, setIsKeepAliveModalOpen] = useState(false);
  const [profile, setProfile] = useState<LandlordProfile>(getLandlordProfile());

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    rooms: Room[];
    tenants: Tenant[];
    payments: Payment[];
  }>({ rooms: [], tenants: [], payments: [] });

  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  // Handle outside click to close search dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Perform search across local store
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const q = query.trim().toLowerCase();
    if (!q) {
      setSearchResults({ rooms: [], tenants: [], payments: [] });
      setIsSearchOpen(false);
      return;
    }

    const allRooms = getLocalRooms();
    const allTenants = getLocalTenants();
    const allPayments = getLocalPayments();

    const matchedRooms = allRooms.filter(
      (r) => r.room_number.toLowerCase().includes(q) || (r.notes && r.notes.toLowerCase().includes(q))
    ).slice(0, 3);

    const matchedTenants = allTenants.filter((t) => {
      const nameMatch = t.full_name.toLowerCase().includes(q);
      const phoneMatch = t.phone.includes(q);
      const companyMatch = t.college_or_company && t.college_or_company.toLowerCase().includes(q);
      const occMatch = t.occupants && t.occupants.some((o) => o.name.toLowerCase().includes(q));
      return nameMatch || phoneMatch || companyMatch || occMatch;
    }).slice(0, 4);

    const matchedPayments = allPayments.filter((p) => {
      const monthMatch = (p.billing_month && p.billing_month.toLowerCase().includes(q)) || (p.billing_period_month && p.billing_period_month.includes(q));
      const refMatch = p.transaction_ref && p.transaction_ref.toLowerCase().includes(q);
      const tenantMatch = p.tenant?.full_name && p.tenant.full_name.toLowerCase().includes(q);
      return monthMatch || refMatch || tenantMatch;
    }).slice(0, 3);

    setSearchResults({
      rooms: matchedRooms,
      tenants: matchedTenants,
      payments: matchedPayments,
    });
    setIsSearchOpen(true);
  };

  const handleSelectResult = (path: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    router.push(path);
  };

  const hasResults =
    searchResults.rooms.length > 0 ||
    searchResults.tenants.length > 0 ||
    searchResults.payments.length > 0;

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-300 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Left Side: Mobile Hamburger & Search */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('rentvault_toggle_mobile_nav'))}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Interactive Search Bar */}
          <div ref={searchContainerRef} className="relative w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchQuery.trim() && setIsSearchOpen(true)}
              placeholder="Search rooms, tenants, payments..."
              className="pl-9 pr-8 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-slate-900 placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Instant Search Dropdown */}
            {isSearchOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in-50 duration-150">
                {hasResults ? (
                  <div className="max-h-80 overflow-y-auto p-2 space-y-2 text-xs">
                    {/* Matching Rooms */}
                    {searchResults.rooms.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                          Rooms & Units
                        </span>
                        {searchResults.rooms.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => handleSelectResult('/rooms')}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between transition-colors"
                          >
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                              Room {r.room_number} (Floor {r.floor})
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              r.status === 'OCCUPIED' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              ₹{r.base_rent}/mo
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Matching Tenants */}
                    {searchResults.tenants.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                          Tenants
                        </span>
                        {searchResults.tenants.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectResult('/tenants')}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between transition-colors"
                          >
                            <div>
                              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                {t.full_name}
                              </span>
                              <span className="text-[10px] text-slate-500 block ml-5">
                                {t.phone} • {t.tenant_type}
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              t.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {t.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Matching Payments */}
                    {searchResults.payments.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                          Payment Transactions
                        </span>
                        {searchResults.payments.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectResult('/payments')}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-between transition-colors"
                          >
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                              {p.billing_month || p.billing_period_month}
                            </span>
                            <span className="text-[11px] font-black text-emerald-700">
                              ₹{Number(p.amount_paid).toLocaleString('en-IN')} ({p.payment_status})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No matching rooms, tenants, or payments found for &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3.5">
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
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
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

          <div className="h-5 w-px bg-slate-300 hidden sm:block" />

          {/* Landlord Profile Button */}
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-colors text-left group cursor-pointer"
            title="Click to edit landlord profile and UPI ID"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-900 block leading-tight truncate max-w-[120px]">
                  {profile.name || 'Landlord'}
                </span>
                <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
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
