'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Building2, IndianRupee, AlertCircle, 
  CalendarClock, ArrowUpRight, Plus, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { Room, Payment, Tenant } from '@/types/database';

interface DashboardProps {
  rooms: Room[];
  recentPayments: Payment[];
  expiringTenants: Tenant[];
  stats: {
    occupiedRooms: number;
    totalRooms: number;
    totalRentCollected: number;
    totalRentExpected: number;
    pendingDues: number;
    expiriesCount: number;
  };
}

export default function DashboardView({ rooms, recentPayments, expiringTenants, stats }: DashboardProps) {
  const occupancyPercentage = stats.totalRooms > 0 
    ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) 
    : 0;

  const getStatusBadge = (status: Room['status']) => {
    switch (status) {
      case 'VACANT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            To-Let (Vacant)
          </span>
        );
      case 'OCCUPIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Occupied
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Maintenance
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Property Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">Live Occupancy, Rental Cashflow & Document Vault</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/tenants/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add New Tenant
          </Link>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Occupancy Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Occupancy Rate</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {stats.occupiedRooms} / {stats.totalRooms}{' '}
              <span className="text-xs font-medium text-slate-500">Rooms</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${occupancyPercentage}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">{occupancyPercentage}% current occupancy</p>
          </div>
        </div>

        {/* Total Rent Collected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Collected This Month</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">₹{stats.totalRentCollected.toLocaleString('en-IN')}</div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Expected Total: ₹{stats.totalRentExpected.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Pending Dues */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Dues</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold ${stats.pendingDues > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              ₹{stats.pendingDues.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {stats.pendingDues > 0 ? 'Immediate follow-up required' : 'All rent dues clear'}
            </p>
          </div>
        </div>

        {/* Upcoming Lease Expiries */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Expiring Leases</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats.expiriesCount}</div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">Within next 30 days</p>
          </div>
        </div>
      </div>

      {/* 5 Rooms Visual Status Grid */}
      <div id="rooms-section" className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Rental Units (5 Rooms)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Ground & First floor unit status and assignments</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
            Total: {stats.totalRooms} Units
          </span>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No rooms found in database</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Your property database is clean and ready. Add rooms in Supabase to start tracking occupancy.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {rooms.map((room) => (
              <div 
                key={room.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400/80 transition-all bg-slate-50/50 flex flex-col justify-between h-52 group hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-900">{room.room_number}</span>
                    <span className="text-[11px] text-slate-400 font-medium">Floor {room.floor}</span>
                  </div>
                  <div className="mb-3">{getStatusBadge(room.status)}</div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-900">
                      ₹{Number(room.base_rent).toLocaleString('en-IN')}
                      <span className="text-[10px] font-normal text-slate-400"> /month</span>
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {room.notes || 'Master room, attached bath'}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80">
                  {room.status === 'VACANT' ? (
                    <Link
                      href={`/tenants/new?room_id=${room.id}`}
                      className="w-full text-center block text-xs font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 bg-indigo-50 py-1.5 rounded-lg transition-all"
                    >
                      + Assign Tenant
                    </Link>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="text-[11px] font-medium text-slate-700">Unit Occupied</span>
                      <Link
                        href="/tenants"
                        className="text-[11px] font-semibold text-indigo-600 hover:underline flex items-center gap-0.5"
                      >
                        Details →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Grid: Recent Payments & Lease Expiry Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Ledger (2 Columns) */}
        <div id="payments-section" className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Rent Payments & Ledger</h2>
              <p className="text-xs text-slate-500">Track payment method and receiver (Landlord / Caretaker)</p>
            </div>
            <Link href="/payments" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-semibold">
              Full Ledger <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Room / Tenant</th>
                  <th className="py-2.5 px-3">Paid Amount</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Receiver</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      No payment records logged yet. Payments recorded will appear here.
                    </td>
                  </tr>
                ) : (
                  recentPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-900 block">{p.room?.room_number || 'Room'}</span>
                        <span className="text-[11px] text-slate-400 block">{p.tenant?.full_name || 'Tenant'}</span>
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-600">
                        ₹{Number(p.amount_paid).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {p.payment_method || 'UPI'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          p.received_by === 'LANDLORD' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {p.received_by}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.payment_status === 'PAID' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {p.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expiring Leases */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-500" /> Lease Expiries
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">Next 30 Days</span>
            </div>

            <div className="divide-y divide-slate-100">
              {expiringTenants.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-semibold text-slate-700">No leases expiring soon</p>
                  <p className="text-[11px] text-slate-400 mt-1">All tenant agreements are currently healthy.</p>
                </div>
              ) : (
                expiringTenants.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{t.full_name}</p>
                      <p className="text-[11px] text-slate-500">
                        {t.room?.room_number} • Lease Ends: {t.lease_end_date}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      Action Required
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div id="vault-section" className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">Document Vault Ready</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Aadhar cards & signed agreements are stored privately in encrypted Supabase storage with 60-second signed URLs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
