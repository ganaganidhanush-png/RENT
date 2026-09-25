'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, IndianRupee, 
  CalendarClock, ArrowUpRight, Plus, ShieldCheck, CheckCircle2,
  GraduationCap, Edit3, Sparkles
} from 'lucide-react';
import { Room, Payment, Tenant } from '@/types/database';
import { DEFAULT_ROOMS } from '@/lib/constants/rooms';
import { getLocalRooms, getLocalTenants, getLocalPayments } from '@/lib/store/app-store';
import EditRoomModal from '@/components/rooms/edit-room-modal';
import RecordPaymentModal from '@/components/payments/record-payment-modal';

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

export default function DashboardView({ 
  rooms: initialRooms, 
  recentPayments: initialPayments, 
  expiringTenants: initialExpiring, 
  stats: initialStats 
}: DashboardProps) {
  const [rooms, setRooms] = useState<Room[]>(() => {
    if (initialRooms && initialRooms.length > 0) return initialRooms;
    if (typeof window !== 'undefined') {
      const local = getLocalRooms();
      if (local && local.length > 0) return local;
    }
    return DEFAULT_ROOMS;
  });

  const [tenants, setTenants] = useState<Tenant[]>(() => {
    if (initialExpiring && initialExpiring.length > 0) return initialExpiring;
    if (typeof window !== 'undefined') {
      return getLocalTenants();
    }
    return [];
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    if (initialPayments && initialPayments.length > 0) return initialPayments;
    if (typeof window !== 'undefined') {
      return getLocalPayments();
    }
    return [];
  });

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Live synchronization across pages
  useEffect(() => {
    const syncData = () => {
      setRooms(getLocalRooms());
      setTenants(getLocalTenants());
      setPayments(getLocalPayments());
    };

    window.addEventListener('rentvault_data_updated', syncData);
    return () => window.removeEventListener('rentvault_data_updated', syncData);
  }, []);

  const totalRoomsCount = rooms.length > 0 ? rooms.length : 6;
  const occupiedRoomsCount = rooms.filter((r) => r.status === 'OCCUPIED').length;
  const vacantRoomsCount = rooms.filter((r) => r.status === 'VACANT' || r.can_someone_get_in).length;
  const bachelorsCount = tenants.filter((t) => t.tenant_type === 'BACHELORS').length;
  const familiesCount = tenants.filter((t) => t.tenant_type === 'FAMILY').length;

  const totalRentExpected = rooms.reduce((acc, r) => acc + (r.status === 'OCCUPIED' ? Number(r.base_rent) : 0), 0) || initialStats.totalRentExpected;
  const totalRentCollected = payments.reduce((acc, p) => acc + (p.payment_status === 'PAID' ? Number(p.amount_paid || 0) : 0), 0) || initialStats.totalRentCollected;
  const pendingDues = Math.max(0, totalRentExpected - totalRentCollected);

  const occupancyPercentage = totalRoomsCount > 0 
    ? Math.round((occupiedRoomsCount / totalRoomsCount) * 100) 
    : 0;

  const handleEditClick = (room: Room) => {
    setEditingRoom(room);
    setIsEditModalOpen(true);
  };

  const handleRoomSaved = (updated: Room) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === updated.id || r.room_number === updated.room_number ? updated : r))
    );
  };

  const getMoveInBadge = (room: Room) => {
    if (room.status === 'MAINTENANCE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          Maintenance
        </span>
      );
    }

    if (room.status === 'VACANT' || (room.current_occupancy || 0) === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Empty / Ready to Move
        </span>
      );
    }

    if (room.can_someone_get_in) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-300">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
          Space Open (Can Move In)
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
        Occupied (Full)
      </span>
    );
  };

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-300 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Property Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              6 Units (G1, 2A, 2B, 3A, 3B, P1)
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-600 mt-1">
            Real-time occupancy tracking, bachelors & family management, and move-in availability
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/tenants/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Tenant
          </Link>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Occupancy Card */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Occupancy Rate</span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {occupiedRoomsCount} / {totalRoomsCount}{' '}
              <span className="text-xs font-bold text-slate-500">Rooms</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${occupancyPercentage}%` }}
              />
            </div>
            <p className="text-xs text-slate-700 mt-2 font-bold">
              {vacantRoomsCount} room(s) have vacancy open
            </p>
          </div>
        </div>

        {/* Total Rent Expected & Collected */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Expected Monthly Rent</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">₹{totalRentExpected.toLocaleString('en-IN')}</div>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              Collected so far: <span className="font-bold text-emerald-700">₹{totalRentCollected.toLocaleString('en-IN')}</span>
              {pendingDues > 0 ? (
                <span className="text-rose-600 font-bold ml-1.5">• ₹{pendingDues.toLocaleString('en-IN')} pending</span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Tenant Demographics: Bachelors vs Family */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Tenant Types</span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {bachelorsCount} <span className="text-xs font-bold text-purple-700">Bachelors</span> • {familiesCount} <span className="text-xs font-bold text-blue-700">Family</span>
            </div>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              Students, professionals & families
            </p>
          </div>
        </div>

        {/* Vacancy / Get-In Availability */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Move-In Availability</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700">
              {vacantRoomsCount > 0 ? `${vacantRoomsCount} Units Open` : 'Full House'}
            </div>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              Chance for someone to move in
            </p>
          </div>
        </div>
      </div>

      {/* 6 Rooms Visual Status Grid: G1, 2A, 2B, 3A, 3B, P1 */}
      <div id="rooms-section" className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-5 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">Rental Units Grid (6 Rooms)</h2>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Live status, members staying, and chance for someone to get in
            </p>
          </div>
          <Link
            href="/rooms"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Manage All Rooms →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {rooms.map((room) => {
            const roomTenants = tenants.filter(
              (t) => t.room_id === room.id || (t.room && t.room.room_number === room.room_number)
            );
            const primaryTenant = roomTenants[0];

            // Count actual members staying in room (not by bed)
            const membersStaying = roomTenants.reduce((sum, t) => {
              if (t.tenant_type === 'BACHELORS') {
                return sum + (t.occupants && t.occupants.length > 0 ? t.occupants.length : 1);
              }
              return sum + (t.family_members_count || 2);
            }, 0);

            const maxCapacity = room.capacity || 2;
            const hasSpace = room.can_someone_get_in ?? (room.status === 'VACANT' || membersStaying < maxCapacity);

            return (
              <div 
                key={room.id}
                className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 transition-all bg-slate-50/70 flex flex-col justify-between min-h-[250px] group hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-black text-slate-900">Room {room.room_number}</span>
                    <span className="text-[11px] text-slate-600 font-bold bg-slate-200/80 px-1.5 py-0.5 rounded">
                      {room.floor === 0 ? 'Ground' : room.floor === 4 ? 'Penthouse' : `Fl ${room.floor}`}
                    </span>
                  </div>
                  
                  <div className="mb-2">{getMoveInBadge(room)}</div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-black text-slate-900">
                      {Number(room.base_rent) > 0 ? (
                        <>
                          ₹{Number(room.base_rent).toLocaleString('en-IN')}
                          <span className="text-[11px] font-normal text-slate-500"> /mo</span>
                        </>
                      ) : (
                        <span className="text-slate-500 text-[11px] italic font-medium">Rent not set (click Edit)</span>
                      )}
                    </p>

                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium text-[11px]">Members Staying:</span>
                        <span className="font-bold text-slate-900">
                          {membersStaying > 0 ? `${membersStaying} Member${membersStaying > 1 ? 's' : ''}` : '0 (Empty)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Max Capacity:</span>
                        <span className="font-semibold text-slate-700">{maxCapacity} Members</span>
                      </div>
                    </div>

                    {roomTenants.length > 0 ? (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Occupants:</span>
                        <p className="text-xs font-bold text-indigo-950 truncate" title={roomTenants.map((t) => t.full_name).join(', ')}>
                          {roomTenants.map((t) => t.full_name).join(', ')}
                        </p>
                        <span className="text-[10px] font-semibold text-purple-700 block">
                          {primaryTenant?.tenant_type === 'BACHELORS' ? 'Bachelors Group' : `Family of ${membersStaying}`}
                        </span>
                      </div>
                    ) : room.notes ? (
                      <p className="text-[10px] text-slate-600 line-clamp-2 mt-1 leading-snug">
                        {room.notes}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditClick(room)}
                      className="text-[11px] font-bold text-slate-700 hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>

                    {hasSpace ? (
                      <Link
                        href={`/tenants/new?room_id=${room.id}`}
                        className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded transition-colors"
                      >
                        + Assign
                      </Link>
                    ) : (
                      <div className="flex items-center gap-1">
                        {primaryTenant ? (
                          <button
                            type="button"
                            onClick={() => {
                              const monthStr = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
                              setEditingPayment({
                                id: `pay-${Date.now()}`,
                                tenant_id: primaryTenant.id,
                                room_id: room.id,
                                billing_period_month: monthStr,
                                billing_month: monthStr,
                                amount_due: Number(primaryTenant.monthly_rent || room.base_rent),
                                amount_paid: Number(primaryTenant.monthly_rent || room.base_rent),
                                amount_pending: 0,
                                payment_status: 'PAID',
                                payment_date: new Date().toISOString().split('T')[0],
                                payment_method: 'UPI',
                                received_by: 'LANDLORD',
                                created_at: new Date().toISOString(),
                                tenant: primaryTenant,
                                room: room,
                              });
                              setIsPaymentModalOpen(true);
                            }}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                            title="Record rent payment for this unit"
                          >
                            + Pay
                          </button>
                        ) : null}
                        <Link
                          href="/tenants"
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900"
                        >
                          Details →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Grid: Recent Payments & Lease Expiry Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Ledger (2 Columns) */}
        <div id="payments-section" className="lg:col-span-2 bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Rent Payments & Collections</h2>
              <p className="text-xs font-semibold text-slate-600">UPI & Cash rent ledger</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingPayment(null);
                  setIsPaymentModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Record Payment
              </button>
              <Link href="/payments" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                Full Ledger <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="py-2.5 px-3">Room / Tenant</th>
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 px-3">Paid Amount</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-600 font-semibold">
                      No payment records logged yet. Click &quot;Record Payment&quot; above to log an entry.
                    </td>
                  </tr>
                ) : (
                  payments.slice(0, 6).map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900 block">{p.room?.room_number || 'Room'}</span>
                        <span className="text-[11px] text-slate-600 block">{p.tenant?.full_name || 'Tenant'}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {p.billing_month || 'Current'}
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700">
                        ₹{Number(p.amount_paid).toLocaleString('en-IN')}
                        {Number(p.amount_pending) > 0 ? (
                          <span className="text-[10px] text-rose-600 block font-normal">
                            ₹{Number(p.amount_pending).toLocaleString('en-IN')} due
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-semibold">
                        {p.payment_method || 'UPI'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          p.payment_status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {p.payment_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPayment(p);
                            setIsPaymentModalOpen(true);
                          }}
                          className="p-1.5 rounded-md text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors cursor-pointer"
                          title="Edit Payment"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expiring Leases & Quick Vault */}
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-amber-600" /> Lease Health
              </h2>
              <span className="text-xs font-bold text-slate-600">Active Agreements</span>
            </div>

            <div className="divide-y divide-slate-100">
              <div className="text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-90" />
                <p className="text-xs font-bold text-slate-800">
                  {tenants.length > 0 ? `${tenants.length} Tenant Leases Monitored` : 'Agreements in Good Standing'}
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  All active tenant lease periods and stay durations are tracked in real-time.
                </p>
              </div>
            </div>
          </div>

          <div id="vault-section" className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-300">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">Document Vault Ready</span>
              </div>
              <Link href="/documents" className="text-xs font-bold text-indigo-600 hover:underline">
                View Vault →
              </Link>
            </div>
            <p className="text-[11px] text-slate-600 font-medium">
              Aadhar cards & signed agreements for Bachelors & Families are archived with encrypted signed URLs.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Room Modal */}
      {isEditModalOpen && editingRoom && (
        <EditRoomModal
          room={editingRoom}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingRoom(null);
          }}
          onSaved={handleRoomSaved}
        />
      )}

      {/* Record / Edit Payment Modal */}
      {isPaymentModalOpen && (
        <RecordPaymentModal
          payment={editingPayment}
          tenants={tenants}
          rooms={rooms}
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setEditingPayment(null);
          }}
          onSaved={(saved) => {
            setPayments((prev) => {
              const idx = prev.findIndex((p) => p.id === saved.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = saved;
                return updated;
              }
              return [saved, ...prev];
            });
          }}
        />
      )}
    </div>
  );
}
